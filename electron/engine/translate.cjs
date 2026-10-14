// Optional caption translation + Roman-script conversion (needs Gemini; both keep the original word timings).
const G = require('./ai.cjs');

async function ask(g, prompt) {
  const r = await G.generate(g, { prompt, json: true });
  const out = G.parseJson(r.text);
  return Array.isArray(out) ? out : (out.result || out.words || out.segments || []);
}

// 1:1 transliteration of every word (Urdu / Hindi / Arabic script -> Roman letters). Timings stay untouched.
async function toRoman(words, g, onProgress) {
  const out = words.map(w => ({ ...w })), B = 80;
  for (let i = 0; i < words.length; i += B) {
    const part = words.slice(i, i + B).map(w => w.word);
    const prompt = `Convert each word below to Roman script (Latin letters) the way people type Urdu/Hindi in chat, e.g. "کیسے" -> "kaise". Words already in Latin letters stay unchanged.
Return ONLY a JSON array of exactly ${part.length} strings, same order, one per input word.
${JSON.stringify(part)}`;
    let res = null;
    for (let t = 0; t < 2 && !res; t++) { const r = await ask(g, prompt); if (r.length === part.length) res = r; }
    if (res) res.forEach((x, j) => { if (typeof x === 'string' && x.trim()) out[i + j].word = x.trim(); });
    onProgress && onProgress(Math.min(1, (i + B) / words.length));
  }
  return out;
}

// Sentence-level translation; the translated words are spread over the same time span, weighted by word length.
function segments(words) {
  const segs = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(i);
    const gap = words[i + 1] ? words[i + 1].start - w.end : 99;
    if (/[.!?۔]$/.test(w.word) || gap > 0.8 || cur.length >= 28) { segs.push(cur); cur = []; }
  });
  if (cur.length) segs.push(cur);
  return segs;
}
async function translate(words, language, g, onProgress) {
  const segs = segments(words), res = [], B = 25;
  for (let i = 0; i < segs.length; i += B) {
    const part = segs.slice(i, i + B).map(s => s.map(k => words[k].word).join(' '));
    const prompt = `Translate each line into ${language}. Keep the meaning and a natural spoken tone, keep every line short.
Return ONLY a JSON array of exactly ${part.length} strings, same order.
${JSON.stringify(part)}`;
    let r = null;
    for (let t = 0; t < 2 && !r; t++) { const x = await ask(g, prompt); if (x.length === part.length) r = x; }
    part.forEach((orig, j) => res.push(r && typeof r[j] === 'string' && r[j].trim() ? r[j].trim() : orig));
    onProgress && onProgress(Math.min(1, (i + B) / segs.length));
  }
  const out = [];
  segs.forEach((idx, si) => {
    const start = words[idx[0]].start, end = words[idx[idx.length - 1]].end;
    const tw = res[si].split(/\s+/).filter(Boolean);
    const tot = tw.reduce((a, w) => a + w.length + 2, 0) || 1;
    let t = start;
    tw.forEach(w => { const d = (end - start) * (w.length + 2) / tot; out.push({ word: w, start: +t.toFixed(2), end: +(t + d).toFixed(2) }); t += d; });
  });
  return out;
}
module.exports = { toRoman, translate };
