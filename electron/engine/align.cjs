// Caption sync: forced alignment of the transcript to the audio with a small wav2vec2 CTC model (ONNX, runs on the CPU).
// Whisper writes the words, this model decides exactly WHEN each word is spoken (about 20-50 ms accuracy, like CapCut / WhisperX).
// Anything that goes wrong (model missing, unsupported script, bad fit) keeps the old timings, so it can never make captions worse.
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const SYNC = require('./sync.cjs');
const { forcedAlign, logSoftmax } = require('./ctc.cjs');
const { toLatin } = require('./translit.cjs');

const FILE = 'aligner-wav2vec2-en.onnx';
const MIN_SIZE = +process.env.CF_ALIGN_MIN || 90e6;
const modelPath = () => path.join(P.modelsDir(), FILE);
const VOCAB = { "'": 27, A: 7, B: 24, C: 19, D: 14, E: 5, F: 20, G: 21, H: 11, I: 10, J: 29, K: 26, L: 15, M: 17, N: 9, O: 8, P: 23, Q: 30, R: 13, S: 12, T: 6, U: 16, V: 25, W: 18, X: 28, Y: 22, Z: 31, '|': 4 };
const STEP = 0.02;                                               // wav2vec2 frame = 20 ms

let ort, sess, sessPath;
async function session() {
  if (!ort) ort = require('onnxruntime-node');
  const p = modelPath();
  if (sess && sessPath === p) return sess;
  sess = await ort.InferenceSession.create(p, { executionProviders: ['cpu'], intraOpNumThreads: 2, graphOptimizationLevel: 'all' });
  sessPath = p; return sess;
}
function modelReady() { if (global.__cfMobile) return false; try { return fs.statSync(modelPath()).size >= MIN_SIZE; } catch { return false; } }

function chunksOf(words, dur) {
  const out = []; let a = 0;
  for (let i = 1; i <= words.length; i++) {
    const end = i === words.length;
    const gap = end ? 99 : words[i].start - words[i - 1].end;
    const len = end ? 0 : words[i].end - words[a].start;
    if (end || gap > 1.0 || len > 22) { out.push([a, i - 1]); a = i; }
  }
  return out.map(([x, y]) => ({ a: x, b: y, t0: Math.max(0, words[x].start - 0.4), t1: Math.min(dur, words[y].end + 0.4) }));
}

async function alignWords(words, wavPath, { onProgress, checkCancel, log = () => {} } = {}) {
  if (!words.length) return { words, used: false, reason: 'empty' };
  if (!modelReady()) return { words, used: false, reason: 'model-missing' };
  let wav;
  try { wav = SYNC.readWav(wavPath); } catch { return { words, used: false, reason: 'audio' }; }
  if (wav.rate !== 16000 || wav.ch !== 1) return { words, used: false, reason: 'audio' };
  const toks = words.map(w => toLatin(w.word));
  if (toks.filter(Boolean).length < words.length * 0.5) return { words, used: false, reason: 'script' };
  let s;
  try { s = await session(); } catch (e) { return { words, used: false, reason: 'engine', error: String(e.message || e).slice(0, 120) }; }
  const dur = wav.samples.length / 16000;
  const out = words.map(w => ({ ...w }));
  const chunks = chunksOf(words, dur);
  let okWords = 0, failChunks = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    checkCancel && checkCancel();
    const { a, b, t0, t1 } = chunks[ci];
    onProgress && onProgress(ci / chunks.length);
    try {
      const idxs = []; for (let i = a; i <= b; i++) if (toks[i]) idxs.push(i);
      if (!idxs.length) continue;
      const ids = [], owner = [];
      idxs.forEach((wi, k) => { if (k) { ids.push(VOCAB['|']); owner.push(-1); } for (const ch of toks[wi]) { ids.push(VOCAB[ch]); owner.push(wi); } });
      const i0 = Math.floor(t0 * 16000), i1 = Math.min(wav.samples.length, Math.ceil(t1 * 16000));
      const n = i1 - i0; if (n < 3200) continue;
      const x = new Float32Array(n); let mean = 0;
      for (let i = 0; i < n; i++) { x[i] = wav.samples[i0 + i] / 32768; mean += x[i]; }
      mean /= n; let v = 0; for (let i = 0; i < n; i++) { x[i] -= mean; v += x[i] * x[i]; }
      const inv = 1 / Math.sqrt(v / n + 1e-7); for (let i = 0; i < n; i++) x[i] *= inv;
      const res = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1, n]) });
      const t = res[s.outputNames[0]]; const T = t.dims[1], V = t.dims[2];
      const em = logSoftmax(t.data, T, V);
      const al = forcedAlign(em, ids, 0);
      if (!al || al.meanLogProb < -2.5) { failChunks++; continue; }
      const st = new Map(), en = new Map();
      owner.forEach((wi, k) => { if (wi < 0) return; if (!st.has(wi)) st.set(wi, al.first[k]); en.set(wi, al.last[k]); });
      const shifts = [];
      for (const wi of idxs) shifts.push(Math.abs(t0 + st.get(wi) * STEP - words[wi].start));
      shifts.sort((p, q) => p - q);
      if (shifts[Math.floor(shifts.length / 2)] > 1.5) { failChunks++; continue; }   // whisper and the model disagree wildly: do not trust it
      for (const wi of idxs) { out[wi].start = t0 + st.get(wi) * STEP; out[wi].end = t0 + (en.get(wi) + 1) * STEP; out[wi].al = 1; okWords++; }
      // words without letters (symbols, emoji): squeeze them between their aligned neighbours
      for (let i = a; i <= b; i++) {
        if (toks[i] || out[i].al) continue;
        let p = i - 1; while (p >= a && !out[p].al) p--; let q = i + 1; while (q <= b && !out[q].al) q++;
        const lo = p >= a ? out[p].end : out[i].start, hi = q <= b ? out[q].start : out[i].end;
        out[i].start = Math.min(lo, hi); out[i].end = Math.max(lo, hi, out[i].start + 0.1);
      }
    } catch (e) { if (String(e.message) === 'CANCELLED') throw e; failChunks++; }
  }
  onProgress && onProgress(1);
  // tidy: keep order, no overlaps, sensible durations
  for (let i = 0; i < out.length; i++) {
    const prevEnd = i ? out[i - 1].end : 0;
    if (out[i].start < prevEnd) out[i].start = prevEnd;
    if (out[i].end < out[i].start + 0.05) out[i].end = out[i].start + 0.05;
    out[i].start = +out[i].start.toFixed(3); out[i].end = +out[i].end.toFixed(3); delete out[i].al;
  }
  return { words: okWords ? out : words, used: okWords > 0, aligned: okWords, failedChunks: failChunks, total: words.length };
}
module.exports = { alignWords, modelReady, modelPath, FILE, MIN_SIZE };
