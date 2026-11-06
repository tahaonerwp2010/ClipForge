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
// What the graphics card can do besides encoding (cached, a real test run each, so a missing driver / old ffmpeg build just turns it off):
//   decArgs : hardware decoding of the source video (frames come back to normal memory, every filter keeps working)
//   filters : NVIDIA only - the source stays on the card while it is scaled (scale_cuda), and only the small result is copied back
let _plan;
function runTest(ff, args, ms = 25000) {
  return new Promise(resolve => {
    let done = false, c;
    try { c = spawn(ff, ['-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true }); } catch { return resolve(false); }
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve(false); } }, ms);
    c.on('error', () => { if (!done) { done = true; clearTimeout(t); resolve(false); } });
    c.on('close', code => { if (!done) { done = true; clearTimeout(t); resolve(code === 0); } });
  });
}
async function gpuPlan() {
  if (_plan) return _plan;
  _plan = { enc: null, decArgs: [], filters: false };
  try {
    const enc = await gpuEncoder(); if (!enc) return _plan;
    _plan.enc = enc;
    const ff = P.binOrPath('ffmpeg'), nv = enc.id === 'h264_nvenc';
    const tmp = require('path').join(require('os').tmpdir(), 'clipforge_gputest_' + process.pid + '.mp4');
    if (!(await runTest(ff, ['-y', '-f', 'lavfi', '-i', 'testsrc=s=640x360:r=25:d=0.6', ...enc.args, '-pix_fmt', 'yuv420p', tmp]))) return _plan;
    const dec = nv ? ['-hwaccel', 'cuda'] : ['-hwaccel', 'auto'];
    if (await runTest(ff, [...dec, '-i', tmp, '-f', 'null', '-'])) _plan.decArgs = dec;
    if (nv && await runTest(ff, ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-i', tmp, '-filter_complex',
      '[0:v]split[a][b];[a]scale_cuda=320:180:force_original_aspect_ratio=increase:format=nv12,hwdownload,format=nv12[x];[b]scale_cuda=320:180:format=nv12,hwdownload,format=nv12[y];[x][y]hstack', '-f', 'null', '-'])) _plan.filters = true;
    try { require('fs').unlinkSync(tmp); } catch {}
  } catch {}
  return _plan;
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
// Render workers for a mode ('cpu' | 'gpu' | both): a strong computer runs a second (or third) render side by side, a small one stays at one.
async function workerList(mode) {
  const cores = require('os').cpus().length, n = Math.max(1, Math.min(3, Math.floor(cores / 4)));
  const enc = mode === 'cpu' ? null : await gpuEncoder();
  if (!enc) return Array(Math.min(2, n)).fill('cpu');
  // GPU only: up to 3 renders side by side. Both: up to 2 renders on the graphics card + 1 on the processor, whoever is free takes the next clip.
  const g = Array(Math.min(mode === 'gpu' ? 3 : 2, n)).fill('gpu');
  return mode === 'gpu' ? g : [...g, 'cpu'];
}
module.exports = { workerList, gpuPlan, gpuEncoder, speechBins, info, normMode, pool, ENCODERS };
