// CPU / GPU / Both: which hardware does the heavy work.
//   video encoding : GPU encoder of the graphics card (NVIDIA NVENC, Intel QSV, AMD AMF, Apple VideoToolbox) or the processor (x264)
//   speech engine  : GPU build of whisper (Vulkan, or Metal on Mac) or the processor build
// Every GPU step falls back to the processor by itself, so a missing driver can never break a job.
const P = require('./paths.cjs');
const { spawn } = require('child_process');

const ENCODERS = [
  { id: 'h264_nvenc', label: 'NVIDIA NVENC', args: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '23', '-b:v', '0'] },
  { id: 'h264_qsv', label: 'Intel Quick Sync', args: ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-global_quality', '23'] },
  { id: 'h264_amf', label: 'AMD AMF', args: ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cqp', '-qp_i', '23', '-qp_p', '23'] },
  { id: 'h264_videotoolbox', label: 'Apple VideoToolbox', args: ['-c:v', 'h264_videotoolbox', '-b:v', '8M'] },
];
let _enc;   // cached result of the test encodes
function tryEncode(ff, e) {
  return new Promise(resolve => {
    let done = false, c;
    try { c = spawn(ff, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=25:d=0.4', ...e.args, '-pix_fmt', 'yuv420p', '-f', 'null', '-'], { windowsHide: true }); } catch { return resolve(false); }
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve(false); } }, 20000);
    c.on('error', () => { if (!done) { done = true; clearTimeout(t); resolve(false); } });
    c.on('close', code => { if (!done) { done = true; clearTimeout(t); resolve(code === 0); } });
  });
}
// the first GPU encoder that really works on this computer (a real test encode, not only a name in the list), or null
async function gpuEncoder() {
  if (_enc !== undefined) return _enc;
  _enc = null;
  try {
    const ff = P.binOrPath('ffmpeg');
    const list = await new Promise(res => { let o = ''; try { const c = spawn(ff, ['-hide_banner', '-encoders'], { windowsHide: true }); c.stdout.on('data', d => { o += d; }); c.on('error', () => res('')); c.on('close', () => res(o)); } catch { res(''); } });
    for (const e of ENCODERS) { if (new RegExp(e.id + '\\b').test(list) && await tryEncode(ff, e)) { _enc = e; break; } }
  } catch {}
  return _enc;
}
// speech engine builds: the processor build, and (if shipped) the GPU build. Mac: the normal build already uses Metal, "-ng" turns it off.
function speechBins() {
  const cpu = P.resolveBin('whisper-cli') || P.resolveBin('main');
  const gpuBin = P.resolveBin('whisper-cli-gpu');
  const mac = process.platform === 'darwin';
  return { cpu, gpu: gpuBin || (mac ? cpu : null), cpuExtra: mac ? ['-ng'] : [], gpuIsMain: !gpuBin && mac };
}
async function info() {
  const e = await gpuEncoder(), s = speechBins();
  return { encoder: e ? e.label : null, speechGpu: !!s.gpu, platform: process.platform };
}
const normMode = m => (m === 'gpu' || m === 'both') ? m : 'cpu';
// Work queue: `workers` run side by side (each = an id like 'gpu' / 'cpu') and take the next job whenever they are free,
// so the faster one automatically does more. One worker = plain sequential order.
async function pool(count, workers, fn) {
  let next = 0, failed = null;
  await Promise.all(workers.map(async (w) => {
    while (!failed) {
      const i = next++; if (i >= count) return;
      try { await fn(i, w); } catch (e) { failed = failed || e; return; }
    }
  }));
  if (failed) throw failed;
}
module.exports = { gpuEncoder, speechBins, info, normMode, pool, ENCODERS };
