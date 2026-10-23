// Tightens word timestamps against the real audio energy so captions land exactly when the word is spoken.
const fs = require('fs');

function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, rate = 16000, ch = 1, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('latin1', p, p + 4); let sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(p + 10); rate = b.readUInt32LE(p + 12); }
    if (id === 'data') { if (p + 8 + sz > b.length) sz = b.length - p - 8; data = b.subarray(p + 8, p + 8 + sz); break; }
    p += 8 + sz + (sz & 1);
  }
  if (!data) throw new Error('bad wav');
  return { rate, ch, samples: new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2)) };
}

// energy in dB per 10 ms frame
function envelope(wav) {
  const hop = Math.round(wav.rate * 0.01) * wav.ch, n = Math.floor(wav.samples.length / hop), env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; for (let j = 0; j < hop; j++) { const v = wav.samples[i * hop + j] / 32768; s += v * v; }
    env[i] = 10 * Math.log10(s / hop + 1e-10);
  }
  // 30 ms smoothing
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (env[Math.max(0, i - 1)] + env[i] + env[Math.min(n - 1, i + 1)]) / 3;
  return out;
}
const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

function refineWords(words, wavPath, { maxShift = 0.15 } = {}) {
  let env;
  try { env = envelope(readWav(wavPath)); } catch { return words; }
  if (env.length < 100) return words;
  const floor = pct(env, 0.2), top = pct(env, 0.9);
  if (top - floor < 10) return words;                       // no clear speech/silence contrast
  const thr = floor + Math.max(6, (top - floor) * 0.3);
  const on = i => env[i] > thr;
  const W = Math.round(maxShift * 100);

  const out = words.map(w => ({ ...w }));
  for (let k = 0; k < out.length; k++) {
    const w = out[k], si = Math.round(w.start * 100), ei = Math.round(w.end * 100);
    // start: nearest silence->speech edge within +-maxShift
    let best = null;
    for (let d = 0; d <= W; d++) for (const i of (d ? [si - d, si + d] : [si])) {
      if (i > 0 && i < env.length && on(i) && !on(i - 1)) { best = i; break; }
    if (best != null) break; }
    if (best != null) w.start = best / 100;
    else if (!on(Math.min(si, env.length - 1))) {                       // timestamp sits in silence (word shown too early): jump to the real onset
      for (let i = si; i <= Math.min(ei - 5, si + 150, env.length - 1); i++) if (on(i)) { w.start = i / 100; break; }
    } else {                                                            // timestamp is inside speech but the onset was earlier (word shown too late)
      const pe = out[k - 1] ? out[k - 1].end : 0;
      let j = si; while (j > si - 50 && j > 1 && on(j - 1) && (j - 1) / 100 >= pe - 0.02) j--;
      if (j < si && j > 0 && !on(j - 1) && j / 100 >= pe - 0.02) w.start = j / 100;
    }
    // end: nearest speech->silence edge within +-maxShift
    let bestE = null;
    for (let d = 0; d <= W; d++) for (const i of (d ? [ei - d, ei + d] : [ei])) {
      if (i > 0 && i < env.length && !on(i) && on(i - 1)) { bestE = i; break; }
    if (bestE != null) break; }
    if (bestE != null && bestE / 100 > w.start + 0.06) w.end = bestE / 100;
    else if (bestE == null && ei > 1 && ei <= env.length && !on(ei - 1)) {          // trailing silence counted as part of the word
      for (let i = ei - 1; i > Math.round(w.start * 100) + 5; i--) if (on(i)) { w.end = (i + 1) / 100; break; }
    }
  }
  // Speech "islands" (stretches of sound separated by real pauses). Whisper often puts the first word of an island too early and the
  // last one too late/early: pull the island's outer edges onto the real sound edges and spread the words in between accordingly.
  {
    const GAP = 12;                                           // pauses shorter than 120 ms are part of the same island
    const isl = []; let st = -1, lastOn = -1;
    for (let i = 0; i < env.length; i++) {
      if (on(i)) { if (st < 0) st = i; lastOn = i; }
      else if (st >= 0 && i - lastOn > GAP) { isl.push([st, lastOn + 1]); st = -1; }
    }
    if (st >= 0) isl.push([st, lastOn + 1]);
    const mid = w => (w.start + w.end) / 2 * 100;
    const groups = new Map();
    out.forEach((w, k) => {
      let bi = -1, bd = 1e9;
      isl.forEach(([a0, b0], j) => { const d = mid(w) < a0 ? a0 - mid(w) : mid(w) > b0 ? mid(w) - b0 : 0; if (d < bd) { bd = d; bi = j; } });
      if (bi >= 0 && bd <= 60) { if (!groups.has(bi)) groups.set(bi, []); groups.get(bi).push(k); }
    });
    for (const [j, ks] of groups) {
      const [a0, b0] = isl[j], first = out[ks[0]], last = out[ks[ks.length - 1]];
      const s0 = a0 / 100, e0 = b0 / 100, ws = first.start, we = last.end;
      if (we - ws < 0.1 || e0 - s0 < 0.1) continue;
      const ratio = (e0 - s0) / (we - ws);
      if (ratio < 0.6 || ratio > 1.7) continue;               // the island holds something else (music, noise): do not trust it
      if (Math.abs(ws - s0) < 0.03 && Math.abs(we - e0) < 0.03) continue;
      for (const k of ks) {                                    // affine map of the whisper span onto the sound span
        const w = out[k];
        w.start = s0 + (w.start - ws) * ratio; w.end = s0 + (w.end - ws) * ratio;
      }
      first.start = s0; last.end = e0;
    }
  }
  // continuous speech has no silence between words: put the boundary on the energy valley (the real syllable break)
  const VW = 12, DEPTH = 3;
  for (let k = 0; k + 1 < out.length; k++) {
    const a = out[k], b = out[k + 1];
    if (b.start - a.end > 0.15) continue;
    const mid = Math.round((a.end + b.start) / 2 * 100);
    let m = -1, mv = 1e9;
    for (let i = Math.max(2, mid - VW); i <= Math.min(env.length - 3, mid + VW); i++) if (env[i] < mv) { mv = env[i]; m = i; }
    if (m < 0) continue;
    let L = -1e9, Rr = -1e9;
    for (let i = Math.max(0, m - 10); i < m; i++) L = Math.max(L, env[i]);
    for (let i = m + 1; i <= Math.min(env.length - 1, m + 10); i++) Rr = Math.max(Rr, env[i]);
    if (Math.min(L, Rr) - mv >= DEPTH && m / 100 > a.start + 0.05 && m / 100 < b.end - 0.05) { a.end = m / 100; b.start = m / 100; }
  }
  // keep order, no overlaps, minimum length
  for (let k = 0; k < out.length; k++) {
    const w = out[k], prev = out[k - 1], next = out[k + 1];
    if (prev && w.start < prev.end) { const mid = (w.start + prev.end) / 2; prev.end = Math.max(prev.start + 0.05, Math.min(prev.end, mid)); w.start = Math.max(w.start, prev.end); }
    if (w.end < w.start + 0.08) w.end = w.start + 0.08;
    if (next && w.end > next.start && next.start > w.start + 0.05) w.end = next.start;
    w.start = +w.start.toFixed(2); w.end = +w.end.toFixed(2);
  }
  return out;
}

// Final cut points of every clip, placed in real silence (10 ms resolution) right before the first word and right after the last word,
// so the clip never starts inside the previous word, never keeps a piece of the next word, and never clips the last syllable.
function cutFit(words, wavPath, clips) {
  let env;
  try { env = envelope(readWav(wavPath)); } catch { return clips; }
  if (env.length < 100 || !words.length) return clips;
  const floor = pct(env, 0.2), top = pct(env, 0.9);
  const hasContrast = top - floor >= 10;
  const at = t => Math.max(0, Math.min(env.length - 1, Math.round(t * 100)));
  const quiet = floor + 4;
  const out = clips.map(c => {
    let i0 = words.findIndex(w => w.end > c.start + 0.01); if (i0 < 0) return c;
    let i1 = -1; for (let k = words.length - 1; k >= 0; k--) if (words[k].start < c.end - 0.01) { i1 = k; break; }
    if (i1 < i0) return c;
    const first = words[i0], last = words[i1], prev = words[i0 - 1], next = words[i1 + 1];
    const pe = prev ? prev.end : Math.max(0, first.start - 0.6), nw = next ? next.start : last.end + 0.6;
    // start: the quiet moment closest before the first word (never later than 40 ms before the word)
    let start;
    const hiS = first.start - 0.04, loS = Math.max(pe + 0.01, first.start - 0.35);
    if (hiS > loS) {
      start = hasContrast ? null : hiS;
      if (start == null) { let best = -1; for (let i = at(hiS); i >= at(loS); i--) if (env[i] <= quiet) { best = i; break; } start = best >= 0 ? best / 100 : Math.max(loS, hiS - 0.02); }
    } else start = Math.max(pe + 0.005, (pe + first.start) / 2 - 0.01);
    // end: the first quiet moment after the last word, giving the final sound time to die out (at least 70 ms)
    let end;
    const loE = last.end + 0.07, hiE = Math.min(nw - 0.03, last.end + 0.5);
    if (hiE > loE) {
      end = null;
      if (hasContrast) { for (let i = at(loE); i <= at(hiE); i++) if (env[i] <= quiet) { end = i / 100; break; } }
      if (end == null) end = Math.min(hiE, loE + 0.05);
    } else end = Math.max(last.end + 0.01, Math.min(nw - 0.01, (last.end + nw) / 2));
    start = Math.max(0, +start.toFixed(2)); end = +Math.max(end, start + 1).toFixed(2);
    return { ...c, start, end };
  });
  // two neighbouring clips never overlap
  const order = out.map((c, i) => i).sort((a, b) => out[a].start - out[b].start);
  for (let k = 1; k < order.length; k++) { const a = out[order[k - 1]], b = out[order[k]]; if (b.start < a.end) { const m = +((a.end + b.start) / 2).toFixed(2); a.end = Math.max(a.start + 1, Math.min(a.end, m)); b.start = Math.max(b.start, a.end); } }
  return out;
}
module.exports = { refineWords, readWav, cutFit };
