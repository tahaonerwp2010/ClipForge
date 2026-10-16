// Sound-effect library: imports any audio/video files (e.g. .mp4 meme sounds), extracts the audio, listens to it and tags it
// (whoosh / pop / impact / ding / riser / glitch / meme / other) from the SOUND itself, not from the file name.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const P = require('./paths.cjs');
const { run } = require('./proc.cjs');

const CATS = ['whoosh', 'pop', 'impact', 'ding', 'riser', 'glitch', 'meme', 'other'];
const EXT = /\.(mp4|mov|mkv|webm|avi|m4v|mp3|wav|m4a|aac|ogg|flac)$/i;
const dir = () => path.join(P.userDataDir(), 'sfx');
const indexFile = () => path.join(dir(), 'index.json');
const ffmpeg = () => P.binOrPath('ffmpeg');

function load() { try { return JSON.parse(fs.readFileSync(indexFile(), 'utf8')); } catch { return []; } }
function save(list) { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(indexFile(), JSON.stringify(list, null, 1)); }
const withPaths = l => l.map(x => ({ ...x, path: path.join(dir(), x.file) }));
const list = () => withPaths(load()).filter(x => fs.existsSync(x.path));

// ---- tiny FFT (radix 2) ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

// ---- audio features from 16 kHz mono float samples ----
function analyze(x, rate = 16000) {
  const hop = rate / 100, n = Math.floor(x.length / hop), env = new Float32Array(n);
  let peak = -200;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = x[i * hop + j]; s += v * v; } env[i] = 10 * Math.log10(s / hop + 1e-12); peak = Math.max(peak, env[i]); }
  const thr = peak - 30;                                       // "active" = within 30 dB of the loudest part
  let a0 = 0, a1 = n - 1; while (a0 < n && env[a0] < thr) a0++; while (a1 > a0 && env[a1] < thr) a1--;
  const act = Math.max(1, a1 - a0 + 1), activeDur = act / 100;
  let maxI = a0; for (let i = a0; i <= a1; i++) if (env[i] > env[maxI]) maxI = i;
  const attack = Math.max(0, (maxI - a0)) / 100;               // onset -> loudest point
  let reach = a0; while (reach <= a1 && env[reach] < peak - 3) reach++;
  const attack3 = (reach - a0) / 100;                          // onset -> within 3 dB of peak
  const peakPos = (maxI - a0) / act;
  let flips = 0, on = env[a0] > peak - 12; for (let i = a0; i <= a1; i++) { const o = env[i] > peak - 12; if (o !== on) { flips++; on = o; } }
  // spectrum averaged over the active part
  const N = 512, re = new Float64Array(N), im = new Float64Array(N), mag = new Float64Array(N / 2);
  let frames = 0; const from = a0 * hop, to = Math.min(x.length - N, (a1 + 1) * hop);
  const step = Math.max(N / 2, Math.floor((to - from) / 200));
  for (let p = from; p <= to; p += step) {
    for (let i = 0; i < N; i++) { re[i] = x[p + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))); im[i] = 0; }
    fft(re, im); for (let k = 0; k < N / 2; k++) mag[k] += Math.hypot(re[k], im[k]); frames++;
  }
  let tot = 0, cen = 0, low = 0, high = 0, logS = 0, cnt = 0;
  const bin = rate / N;
  for (let k = 1; k < N / 2; k++) { const m = mag[k] / Math.max(1, frames); tot += m; cen += m * k * bin; if (k * bin < 250) low += m; if (k * bin > 3000) high += m; logS += Math.log(m + 1e-9); cnt++; }
  const mean = tot / cnt, flat = Math.exp(logS / cnt) / (mean + 1e-9);
  let rms = 0, rc = 0; for (let i = a0; i <= a1; i++) { rms += Math.pow(10, env[i] / 10); rc++; }
  const rmsDb = 10 * Math.log10(rms / Math.max(1, rc) + 1e-12);
  return { dur: x.length / rate, activeDur, attack, attack3, peakPos, flips, centroid: cen / (tot + 1e-9), lowRatio: low / (tot + 1e-9), highRatio: high / (tot + 1e-9), flatness: flat, rmsDb, peakDb: peak };
}

const HINTS = [
  [/whoo?sh|swo?o?sh|swipe|woosh|whosh/i, 'whoosh'], [/riser|rise|build|sweep|charge/i, 'riser'],
  [/boom|impact|hit|bust|slam|thud|bass|drop|explo/i, 'impact'], [/ding|bell|coin|notif|level|beep|chime|ping|success|complete/i, 'ding'],
  [/pop|click|clik|snap|camera|shutter|tap|tick|flash/i, 'pop'], [/glitch|digital|error|static|data|load/i, 'glitch'], [/meme/i, 'meme'],
];
function classify(f, name = '') {
  let cat;
  if (f.activeDur > 2.4) cat = 'meme';
  else if (f.activeDur > 0.8 && f.peakPos > 0.7 && f.attack3 > 0.4) cat = 'riser';
  else if (f.flips >= 5 && f.activeDur > 0.3) cat = 'glitch';
  else if (f.activeDur >= 0.2 && f.activeDur <= 1.8 && f.flatness > 0.2 && f.attack3 > 0.06 && f.peakPos > 0.12 && f.peakPos < 0.85 && f.lowRatio < 0.5) cat = 'whoosh';
  else if (f.lowRatio > 0.3 && f.attack3 < 0.08 && f.activeDur > 0.2) cat = 'impact';
  else if (f.flatness < 0.15 && f.centroid > 1100 && f.attack3 < 0.08 && f.activeDur > 0.15) cat = 'ding';
  else if (f.activeDur < 0.35) cat = 'pop';
  else cat = 'other';
  if (cat === 'other') { const h = HINTS.find(([re]) => re.test(name)); if (h) cat = h[1]; }
  return cat;
}

async function decode(file) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    const c = spawn(ffmpeg(), ['-v', 'error', '-i', file, '-vn', '-t', '12', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { windowsHide: true });
    const bufs = []; let err = '';
    c.stdout.on('data', d => bufs.push(d)); c.stderr.on('data', d => { err += d; });
    c.on('error', e => reject(e));
    c.on('close', code => { const b = Buffer.concat(bufs); if (!b.length) return reject(new Error(err.slice(-200) || 'no audio')); resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4))); });
  });
}

async function addFile(src, { copy = true } = {}) {
  const base = path.basename(src).replace(EXT, '');
  const id = crypto.createHash('sha1').update(src + fs.statSync(src).size).digest('hex').slice(0, 10);
  const file = `${id}.mp3`, dest = path.join(dir(), file);
  fs.mkdirSync(dir(), { recursive: true });
  const x = await decode(src);
  const f = analyze(x);
  if (f.peakDb < -60) throw new Error('silent');
  // keep it short, mono-friendly mp3 (max 8 s)
  await run(ffmpeg(), ['-y', '-i', src, '-vn', '-t', '8', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', dest]);
  const cat = classify(f, base);
  return { id, name: base, file, cat, auto: true, dur: +Math.min(8, f.activeDur + 0.05).toFixed(2), gainDb: +Math.max(-12, Math.min(18, -20 - f.rmsDb)).toFixed(1) };
}

// Imports every audio/video file of a folder (not recursive into huge trees: 2 levels). Calls onProgress(done,total,name).
async function importFolder(folder, onProgress = () => {}) {
  const files = [];
  const walk = (d, depth) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory() && depth < 2) walk(p, depth + 1); else if (e.isFile() && EXT.test(e.name)) files.push(p); } };
  walk(folder, 0);
  const cur = load(), have = new Set(cur.map(x => x.id)); const added = []; const failed = [];
  for (let i = 0; i < files.length; i++) {
    onProgress(i, files.length, path.basename(files[i]));
    try { const it = await addFile(files[i]); if (!have.has(it.id)) { cur.push(it); have.add(it.id); added.push(it); } }
    catch (e) { if (String(e.message) === 'CANCELLED') throw e; failed.push(path.basename(files[i])); }
  }
  save(cur); onProgress(files.length, files.length, '');
  return { total: files.length, added: added.length, failed, byCat: countBy(cur) };
}
const countBy = l => Object.fromEntries(CATS.map(c => [c, l.filter(x => x.cat === c).length]));
function setCat(id, cat) { if (!CATS.includes(cat)) return false; const l = load(); const it = l.find(x => x.id === id); if (!it) return false; it.cat = cat; it.auto = false; save(l); return true; }
function remove(id) { const l = load(), it = l.find(x => x.id === id); if (it) { try { fs.unlinkSync(path.join(dir(), it.file)); } catch {} } save(l.filter(x => x.id !== id)); return true; }
function clear() { for (const x of load()) { try { fs.unlinkSync(path.join(dir(), x.file)); } catch {} } save([]); return true; }

// Built-in basic sounds (made with FFmpeg) so effects work even before the user imports a library.
async function ensureBuiltin() {
  const have = list().some(x => x.builtin); if (have) return;
  fs.mkdirSync(dir(), { recursive: true });
  const make = async (id, cat, name, src, af) => {
    const file = `${id}.mp3`;
    try { await run(ffmpeg(), ['-y', '-f', 'lavfi', '-i', src, '-af', af, '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', path.join(dir(), file)]); return { id, name, file, cat, builtin: true, auto: false, dur: 0.6, gainDb: 0 }; } catch { return null; }
  };
  const items = (await Promise.all([
    make('b_whoosh', 'whoosh', 'Basic whoosh', 'anoisesrc=d=0.55:c=pink:a=0.9', 'highpass=f=250,lowpass=f=5500,afade=t=in:d=0.25,afade=t=out:st=0.28:d=0.27,volume=0.9'),
    make('b_pop', 'pop', 'Basic pop', 'sine=f=720:d=0.12', 'afade=t=out:st=0.01:d=0.11,volume=0.8'),
    make('b_hit', 'impact', 'Basic hit', 'sine=f=70:d=0.5', 'afade=t=out:st=0.02:d=0.48,volume=1.2'),
    make('b_ding', 'ding', 'Basic ding', 'sine=f=1568:d=0.6', 'afade=t=out:st=0.02:d=0.58,volume=0.7'),
  ])).filter(Boolean);
  const cur = load().filter(x => !x.builtin); save([...cur, ...items]);
}
module.exports = { CATS, list, importFolder, setCat, remove, clear, analyze, classify, decode, ensureBuiltin, dir, addFile };
