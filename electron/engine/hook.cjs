// Auto Hook: the AI-written on-screen line. Always exactly two lines; the font size is chosen to fit the longest line.
const EM = require('./emoji.cjs');
const STOP = /^(a|an|the|and|or|but|of|to|in|on|at|for|with|is|are|was|were|that|this|it|its|my|your|our|their|i|you|we|they|he|she)$/i;

const MAXW = { 1: 5, 2: 10, 3: 14 };
// Split the hook into N balanced lines (N = 1, 2 or 3, chosen by the user). Lines the AI already broke are kept when the count matches.
function hookLines(text, fallback = '', n = 2) {
  n = n === 1 || n === 3 ? n : 2;
  const clean = (t) => EM.splitTitle(String(t || '')).text.replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  let t = String(text || '').replace(/\\n/g, '\n');
  if (/\n/.test(t)) {
    const parts = t.split(/\n+/).map(clean).filter(Boolean);
    if (parts.length === n) return parts.join('\n');
    t = parts.join(' ');
  }
  let words = clean(t).split(' ').filter(Boolean);
  if (words.length < n) words = clean(fallback).split(' ').filter(Boolean).concat(words).slice(0, MAXW[n]);
  if (words.length < n) words = ['WATCH', 'THIS', 'NOW'].slice(0, Math.max(n, 2));
  words = words.slice(0, MAXW[n]);
  while (words.length > n + 1 && STOP.test(words[words.length - 1].replace(/[.,!?]+$/, ''))) words.pop();
  if (n === 1) return words.join(' ');
  // choose the cut points that make the longest line as short as possible (then the most even)
  const len = (i, j) => words.slice(i, j).join(' ').length;
  let best = null;
  const W = words.length;
  if (n === 2) { for (let i = 1; i < W; i++) { const m = Math.max(len(0, i), len(i, W)), d = Math.abs(len(0, i) - len(i, W)); if (!best || m * 10 + d < best.sc) best = { sc: m * 10 + d, cuts: [i] }; } }
  else { for (let i = 1; i < W - 1; i++) for (let j = i + 1; j < W; j++) { const a = len(0, i), b = len(i, j), c = len(j, W), m = Math.max(a, b, c), d = Math.max(a, b, c) - Math.min(a, b, c); if (!best || m * 10 + d < best.sc) best = { sc: m * 10 + d, cuts: [i, j] }; } }
  const cuts = [0, ...best.cuts, W];
  return cuts.slice(1).map((c, i) => words.slice(cuts[i], c).join(' ')).join('\n');
}
const hookTwoLines = (text, fallback) => hookLines(text, fallback, 2);
// Font size (px at the given canvas width). userSize = the size the user chose (px at 1080 wide); without it the size is picked to fit.
// A chosen size is only reduced when the text would not fit inside the screen at all.
function hookFontPx(hook, W, userSize) {
  const k = W / 1080;
  const maxLen = Math.max(4, ...String(hook).split('\n').map(l => l.length));
  const fit = (W * 0.92) / (maxLen * 0.64);
  if (userSize > 0) return Math.round(Math.max(24 * k, Math.min(userSize * k, fit)));
  return Math.round(Math.max(52 * k, Math.min(124 * k, (W * 0.88) / (maxLen * 0.64))));
}
module.exports = { hookLines, hookTwoLines, hookFontPx };
