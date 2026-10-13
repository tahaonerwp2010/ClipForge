// Auto Hook: the AI-written on-screen line. Always exactly two lines; the font size is chosen to fit the longest line.
const EM = require('./emoji.cjs');
const STOP = /^(a|an|the|and|or|but|of|to|in|on|at|for|with|is|are|was|were|that|this|it|its|my|your|our|their|i|you|we|they|he|she)$/i;

function hookTwoLines(text, fallback = '') {
  const clean = (t) => EM.splitTitle(String(t || '')).text.replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  let t = String(text || '').replace(/\\n/g, '\n');
  if (/\n/.test(t)) {                                           // already split by the AI
    const parts = t.split(/\n+/).map(clean).filter(Boolean);
    if (parts.length === 2 && parts.every(p => p.split(' ').length >= 1)) return parts.join('\n');
    t = parts.join(' ');
  }
  let words = clean(t).split(' ').filter(Boolean);
  if (words.length < 2) words = clean(fallback).split(' ').filter(Boolean).concat(words).slice(0, 8);
  if (words.length < 2) words = ['WATCH', 'THIS'];
  if (words.length > 8) words = words.slice(0, 12);
  while (words.length > 3 && STOP.test(words[words.length - 1].replace(/[.,!?]+$/, ''))) words.pop();
  let best = 1, bs = 1e9;                                       // split where the two lines are most even
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
    const sc = Math.max(a, b) * 10 + Math.abs(a - b);
    if (sc < bs) { bs = sc; best = i; }
  }
  return words.slice(0, best).join(' ') + '\n' + words.slice(best).join(' ');
}
// font size (px at the given canvas width) so the longest line fills at most ~88% of the width
function hookFontPx(hook, W) {
  const k = W / 1080;
  const maxLen = Math.max(4, ...String(hook).split('\n').map(l => l.length));
  return Math.round(Math.max(52 * k, Math.min(124 * k, (W * 0.88) / (maxLen * 0.64))));
}
module.exports = { hookTwoLines, hookFontPx };
