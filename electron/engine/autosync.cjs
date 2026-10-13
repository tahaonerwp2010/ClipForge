// Finds how far apart two recordings of the same event are, by matching their loudness patterns.
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const { run } = require('./proc.cjs');

async function envelope(file, work, tag, maxSec) {
  fs.mkdirSync(work, { recursive: true });
  const out = path.join(work, `sync_${tag}.raw`);
  await run(P.binOrPath('ffmpeg'), ['-y', '-t', String(maxSec), '-i', path.resolve(file), '-vn', '-ac', '1', '-ar', '4000', '-f', 's16le', out]);
  const b = fs.readFileSync(out), n = Math.floor(b.length / 2), hop = 40;       // 10 ms frames at 4 kHz
  const env = new Float32Array(Math.floor(n / hop));
  for (let i = 0; i < env.length; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = b.readInt16LE((i * hop + j) * 2) / 32768; s += v * v; } env[i] = Math.log10(s / hop + 1e-9); }
  // remove slow trend + normalise
  const out2 = new Float32Array(env.length), W = 100; let acc = 0;
  for (let i = 0; i < env.length; i++) { acc += env[i]; if (i >= W) acc -= env[i - W]; out2[i] = env[i] - acc / Math.min(i + 1, W); }
  let m = 0; for (const v of out2) m += v * v; m = Math.sqrt(m / (out2.length || 1)) || 1;
  for (let i = 0; i < out2.length; i++) out2[i] /= m;
  return out2;
}

// Returns {offset, confidence}: second-video time = main-video time + offset.
async function offsetBetween(mainFile, secFile, work, { maxSec = 240, maxLag = 60 } = {}) {
  const a = await envelope(mainFile, work, 'a', maxSec), b = await envelope(secFile, work, 'b', maxSec + maxLag);
  const L = Math.min(maxLag * 100, Math.floor(b.length / 2));
  let best = -1e9, bi = 0, sum = 0, sum2 = 0, cnt = 0;
  const N = Math.min(a.length, 12000);
  for (let lag = -L; lag <= L; lag++) {
    let s = 0;
    for (let i = Math.max(0, -lag); i < N && i + lag < b.length; i++) s += a[i] * b[i + lag];
    if (s > best) { best = s; bi = lag; }
    sum += s; sum2 += s * s; cnt++;
  }
  const mean = sum / cnt, sd = Math.sqrt(Math.max(1e-9, sum2 / cnt - mean * mean));
  return { offset: bi / 100, confidence: +((best - mean) / sd).toFixed(1) };
}
module.exports = { offsetBetween };
