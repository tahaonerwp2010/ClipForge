// CTC forced alignment (Viterbi). emissions: array of Float32Array(V) log-probabilities per frame; tokens: ids to align (blank = 0).
// Returns for every token {first,last} frame, or null when the audio is too short for the text.
function forcedAlign(em, tokens, blank = 0) {
  const T = em.length, L = tokens.length;
  if (!T || !L) return null;
  const S = 2 * L + 1, NEG = -1e30;
  const lab = (s) => (s & 1) ? tokens[(s - 1) >> 1] : blank;
  let prev = new Float32Array(S).fill(NEG), cur = new Float32Array(S);
  const bp = new Uint8Array(T * S);
  prev[0] = em[0][blank]; if (S > 1) prev[1] = em[0][lab(1)];
  for (let t = 1; t < T; t++) {
    const e = em[t];
    for (let s = 0; s < S; s++) {
      let best = prev[s], from = 0;
      if (s >= 1 && prev[s - 1] > best) { best = prev[s - 1]; from = 1; }
      if (s >= 2 && (s & 1) && lab(s) !== lab(s - 2) && prev[s - 2] > best) { best = prev[s - 2]; from = 2; }
      cur[s] = best > NEG / 2 ? best + e[lab(s)] : NEG;
      bp[t * S + s] = from;
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  let s = prev[S - 1] >= (S > 1 ? prev[S - 2] : NEG) ? S - 1 : S - 2;
  if (prev[s] < NEG / 2) return null;                           // text does not fit into the audio
  const first = new Int32Array(L).fill(-1), last = new Int32Array(L).fill(-1);
  let score = 0, n = 0;
  for (let t = T - 1; t >= 0; t--) {
    if (s & 1) {
      const i = (s - 1) >> 1;
      if (last[i] < 0) last[i] = t;
      first[i] = t; score += em[t][tokens[i]]; n++;
    }
    s -= bp[t * S + s];
  }
  return { first, last, meanLogProb: n ? score / n : -99 };
}
function logSoftmax(logits, T, V) {
  const out = new Array(T);
  for (let t = 0; t < T; t++) {
    const row = logits.subarray ? logits.subarray(t * V, (t + 1) * V) : logits.slice(t * V, (t + 1) * V);
    let m = -Infinity; for (let v = 0; v < V; v++) if (row[v] > m) m = row[v];
    let sum = 0; for (let v = 0; v < V; v++) sum += Math.exp(row[v] - m);
    const lse = m + Math.log(sum), r = new Float32Array(V);
    for (let v = 0; v < V; v++) r[v] = row[v] - lse;
    out[t] = r;
  }
  return out;
}
module.exports = { forcedAlign, logSoftmax };
