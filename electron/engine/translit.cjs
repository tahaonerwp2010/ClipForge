// Turns any word into the A-Z letters the alignment model knows. Latin stays as it is; Hindi (Devanagari) and Urdu/Arabic script are
// transliterated by sound; digits are spelled out. Returns '' when nothing can be aligned (the word then keeps its old timing).
const DEV_C = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l' };
const DEV_NUKTA = { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' };
const DEV_V = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' };
const DEV_M = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri', 'ॉ': 'o', 'ं': 'n', 'ँ': 'n', 'ः': 'h' };
function devanagari(w) {
  const s = [...w.normalize('NFD')]; let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (DEV_C[c]) {
      const nu = s[i + 1] === '़'; if (nu) i++;
      out += (nu && DEV_NUKTA[c]) || DEV_C[c];
      const n = s[i + 1];
      if (n === '्') i++;                                          // virama: no vowel
      else if (DEV_M[n] && !'ंँः'.includes(n)) { out += DEV_M[n]; i++; }
      else out += 'a';                                              // inherent vowel (removed again at the end of a word)
    } else if (DEV_V[c]) out += DEV_V[c];
    else if (DEV_M[c]) out += DEV_M[c];
  }
  return out.replace(/a$/, (m) => (out.length > 2 ? '' : m));
}
const ARB = { 'ا': 'a', 'آ': 'aa', 'أ': 'a', 'إ': 'i', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o', 'ؤ': 'o', 'ہ': 'h', 'ھ': 'h', 'ه': 'h', 'ة': 'h', 'ء': '', 'ی': 'i', 'ي': 'i', 'ے': 'e', 'ئ': 'y', 'ى': 'a' };
const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
function toLatin(word) {
  let w = String(word || '');
  let out = '';
  for (const part of w.split(/(\d+)/)) {
    if (/^\d+$/.test(part)) { out += part.split('').map(d => DIGIT[+d]).join(''); continue; }
    if (/[ऀ-ॿ]/.test(part)) { out += devanagari(part); continue; }
    if (/[؀-ۿ]/.test(part)) { out += [...part].map(c => ARB[c] ?? '').join(''); continue; }
    out += part.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  return out.toUpperCase().replace(/[^A-Z']/g, '').replace(/^'+|'+$/g, '');
}
module.exports = { toLatin };
