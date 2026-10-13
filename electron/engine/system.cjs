// Hardware (GPU) and software (engine) checks for Settings → System.
const fs = require('fs');
const os = require('os');
const P = require('./paths.cjs');
const { spawn } = require('child_process');
// Own tiny runner (with timeout, never rejects on a non-zero exit) so a check can never hang or be cancelled by a running job.
function run(cmd, args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let out = '', err = '', done = false;
    let c; try { c = spawn(cmd, args, { windowsHide: true }); } catch (e) { return reject(e); }
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} reject(new Error('timed out')); } }, timeoutMs);
    c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { err += d; });
    c.on('error', e => { if (!done) { done = true; clearTimeout(t); reject(e); } });
    c.on('close', code => { if (!done) { done = true; clearTimeout(t); resolve({ stdout: out, stderr: err, code }); } });
  });
}

async function gpuNames(electronApp) {
  const names = [];
  const add = (n) => { n = String(n || '').trim(); if (n && !names.includes(n) && !/^microsoft basic/i.test(n)) names.push(n); };
  if (process.platform === 'win32') {
    try {
      const r = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }) -join "|"'], { timeoutMs: 8000 });
      String(r.stdout || '').split(/[|\r\n]+/).forEach(add);
    } catch { /* try wmic */ }
    if (!names.length) {
      try { const r = await run('wmic', ['path', 'win32_VideoController', 'get', 'name'], { timeoutMs: 8000 }); String(r.stdout || '').split(/\r?\n/).slice(1).forEach(add); } catch { /* ignore */ }
    }
  } else if (process.platform === 'linux') {
    try { const r = await run('sh', ['-c', "lspci 2>/dev/null | grep -Ei 'vga|3d|display' | sed 's/.*: //'"], { timeoutMs: 5000 }); String(r.stdout || '').split(/\r?\n/).forEach(add); } catch { /* ignore */ }
  }
  if (!names.length && electronApp && electronApp.getGPUInfo) {
    try { const g = await electronApp.getGPUInfo('basic'); (g.gpuDevice || []).forEach(d => add(d.deviceString || (d.vendorId ? `GPU ${d.vendorId.toString(16)}:${(d.deviceId || 0).toString(16)}` : ''))); } catch { /* ignore */ }
  }
  return names;
}

async function specs(electronApp) {
  const cpus = os.cpus() || [];
  const gpus = await gpuNames(electronApp);
  return {
    cpuName: cpus.length ? cpus[0].model.trim() : 'Unknown processor',
    cpuCores: `${cpus.length} threads`,
    ramTotal: `${(os.totalmem() / 1024 ** 3).toFixed(1)} GB`,
    ramAvailable: `${(os.freemem() / 1024 ** 3).toFixed(1)} GB`,
    gpu: gpus.length ? gpus.join(' + ') : 'No graphics card detected',
    gpuFound: gpus.length > 0,
    os: `${os.platform()} ${os.arch()} (${os.release()})`, arch: os.arch(),
  };
}

// Every piece of software the app needs. "required" ones block clip making; "auto" ones download themselves when needed.
async function engine() {
  const items = [];
  const probeBin = async (id, name, bins, args, required, hint) => {
    let file = null; for (const b of bins) { file = P.resolveBin(b); if (file) break; }
    if (!file) { items.push({ id, name, ok: false, required, detail: hint }); return; }
    let ver = '';
    try { const r = await run(file, args, { timeoutMs: 10000 }); ver = String(r.stdout || r.stderr || '').split(/\r?\n/)[0].slice(0, 70); } catch (e) { items.push({ id, name, ok: false, required, detail: `Found but it does not start (${String(e.message || e).slice(0, 60)}). Reinstall ClipForge.` }); return; }
    items.push({ id, name, ok: true, required, detail: ver || 'Ready' });
  };
  await probeBin('ffmpeg', 'Video engine (FFmpeg)', ['ffmpeg'], ['-version'], true, 'Missing. Reinstall ClipForge or run get-binaries.ps1.');
  await probeBin('ffprobe', 'Video reader (FFprobe)', ['ffprobe'], ['-version'], true, 'Missing. Reinstall ClipForge or run get-binaries.ps1.');
  const wb = ['whisper-cli', 'main'];
  let wf = null; for (const b of wb) { wf = P.resolveBin(b); if (wf) break; }
  items.push({ id: 'whisper', name: 'Speech engine (Whisper)', ok: !!wf, required: true, detail: wf ? 'Ready' : 'Missing. Reinstall ClipForge or run get-binaries.ps1.' });
  const yt = P.resolveBin('yt-dlp');
  items.push({ id: 'ytdlp', name: 'YouTube downloader (yt-dlp)', ok: !!yt, required: false, detail: yt ? 'Ready' : 'Not installed yet. It downloads by itself the first time you paste a YouTube link.' });
  items.push({ id: 'fonts', name: 'Caption fonts', ok: !!P.fontsDir(), required: false, detail: P.fontsDir() ? 'Ready' : 'Missing. Captions will use a basic font.' });
  items.push({ id: 'emoji', name: 'Emoji images', ok: !!P.emojiDir(), required: false, detail: P.emojiDir() ? 'Ready' : 'Missing. Emojis will not show on videos.' });
  const missing = items.filter(i => !i.ok && i.required);
  const optional = items.filter(i => !i.ok && !i.required);
  return { items, allReady: missing.length === 0, missing: missing.map(i => i.name), optionalMissing: optional.map(i => i.name) };
}
module.exports = { specs, engine };
