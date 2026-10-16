// Optional caption translation + Roman-script conversion (needs Gemini; both keep the original word timings).
const G = require('./ai.cjs');

async function ask(g, prompt) {
  const r = await G.generate(g, { prompt, json: true });
  const out = G.parseJson(r.text);
  return Array.isArray(out) ? out : (out.result || out.words || out.segments || []);
}


// ---- Offline Roman fallback (no AI key / AI down): Devanagari (Hindi) and Urdu/Arabic script ----
const DV = { 'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au','ऑ':'o','अं':'an',
  'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'n','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'n','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
  'त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
  'क़':'q','ख़':'kh','ग़':'g','ज़':'z','ड़':'r','ढ़':'rh','फ़':'f','य़':'y' };
const DM = { 'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o','ं':'n','ँ':'n','ः':'h' };
const DD = { '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9' };
function devaRoman(word) {
  const ch = [...word.normalize('NFC')];
  const isCons = c => /[\u0915-\u0939\u0958-\u095F]/.test(c);
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], n = ch[i + 1];
    if (c === '\u093C') continue;
    if (isCons(c)) {
      let base = DV[c];
      if (n === '\u093C') { base = DV[c + '\u093C'] || base; i++; }
      out += base;
      const m = ch[i + 1];
      if (m === '\u094D') { i++; continue; }                 // virama: joins with the next consonant
      if (m && DM[m] !== undefined && !'ंँः'.includes(m)) continue; // a vowel sign follows
      if (i + 1 < ch.length) out += 'a';                      // inherent vowel; dropped at the end of a word
    } else if (DM[c] !== undefined) out += DM[c];
    else if (DV[c]) out += DV[c];
    else if (DD[c]) out += DD[c];
    else if (c === '\u094D') continue;
    else if (c === '।') out += '.';
    else out += c;
  }
  return out;
}
const UR = { 'ا':'a','آ':'aa','ب':'b','پ':'p','ت':'t','ٹ':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh','د':'d','ڈ':'d','ذ':'z','ر':'r','ڑ':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ک':'k','گ':'g','ل':'l','م':'m','ن':'n','ں':'n','و':'o','ہ':'h','ھ':'h','ء':'','ی':'i','ے':'e','ئ':'e','ؤ':'o','ۃ':'h','ك':'k','ي':'i','ى':'a','ه':'h','َ':'a','ِ':'i','ُ':'u','ّ':'','ْ':'','ٰ':'a','،':',','؟':'?','۔':'.' };
function urduRoman(word) { return [...word].map(c => UR[c] !== undefined ? UR[c] : c).join('').replace(/aa+/g, 'aa'); }
function localRoman(words) {
  return words.map(w => {
    const t = String(w.word);
    if (/[\u0900-\u097F]/.test(t)) return { ...w, word: devaRoman(t).replace(/ee$/, 'i').replace(/en$/, 'ein') };
    if (/[\u0600-\u06FF]/.test(t)) return { ...w, word: urduRoman(t) };
    return { ...w };
  });
}

// 1:1 transliteration of every word (Urdu / Hindi / Arabic script -> Roman letters). Timings stay untouched.
async function toRoman(words, g, onProgress) {
  if (!G.ready(g)) return localRoman(words);
  const out = words.map(w => ({ ...w })), B = 80;
  for (let i = 0; i < words.length; i += B) {
    const part = words.slice(i, i + B).map(w => w.word);
    const prompt = `Convert each word below to Roman script (Latin letters) the way people type Urdu/Hindi in chat, e.g. "کیسے" -> "kaise". Words already in Latin letters stay unchanged.
Return ONLY a JSON array of exactly ${part.length} strings, same order, one per input word.
${JSON.stringify(part)}`;
    let res = null;
    for (let t = 0; t < 2 && !res; t++) { const r = await ask(g, prompt); if (r.length === part.length) res = r; }
    if (res) res.forEach((x, j) => { if (typeof x === 'string' && x.trim()) out[i + j].word = x.trim(); });
    else localRoman(words.slice(i, i + B)).forEach((x, j) => { out[i + j].word = x.word; });
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
module.exports = { localRoman, toRoman, translate };
