// Plans emoji pops for CapCut-style captions + title emojis. Emoji are bundled Twemoji PNGs (no font / internet needed).
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const MAP = require('./emoji-map.json');   // word -> twemoji codepoint filename

const fileFor = cp => { const f = path.join(P.emojiDir() || '', `${cp}.png`); return fs.existsSync(f) ? f : null; };
function pngFor(word) {
  const clean = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const cp = MAP[clean] || MAP[clean.replace(/(ing|ed|es|s)$/, '')];
  return cp ? fileFor(cp) : null;
}
// "🔥" -> png path (handles fe0f / ZWJ variants); null when we do not bundle it
function pngForChar(ch) {
  const cps = [...ch].map(c => c.codePointAt(0).toString(16));
  const noVs = cps.filter(c => c !== 'fe0f');
  return fileFor(noVs.join('-')) || fileFor(cps.join('-')) || (noVs.length > 1 ? fileFor(noVs[0]) : null);
}
const EMOJI_RE = (() => {                         // built at run time: Android's Node has no Unicode property tables, and a literal \p{..} would stop the whole file from loading
  try { return new RegExp('\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|[\\u{1F3FB}-\\u{1F3FF}])*', 'gu'); }
  catch { return new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B50}\\u{2B55}\\u{1F1E6}-\\u{1F1FF}](?:\\uFE0F|\\u200D[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]|[\\u{1F3FB}-\\u{1F3FF}])*', 'gu'); }
})();
function splitTitle(text) {                       // -> { text without emoji, emojis:[char] }
  const emojis = String(text).match(EMOJI_RE) || [];
  return { text: String(text).replace(EMOJI_RE, '').replace(/️/g, '').replace(/\s+/g, ' ').trim(), emojis };
}
// Keyword -> emoji for the offline title fallback (always returns one)
function emojiForText(text) {
  for (const w of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    const cp = MAP[w]; if (cp && fileFor(cp)) { try { return String.fromCodePoint(...cp.split('-').map(h => parseInt(h, 16))); } catch {} }
  }
  return '🔥';
}

// Each emoji shows from the moment the word is spoken until shortly after it ends (short), several can be on screen together
// (they sit side by side). -> [{png, start, end, x?}] relative to clip start.
function plan(words, clipStart, clipEnd, box) {
  const dur = clipEnd - clipStart, out = [], lastShown = new Map();
  const slotsEnd = [-9, -9, -9];                                 // when each horizontal slot becomes free
  const dx = [0, 1.15, -1.15];
  for (const w of words) {
    if (w.start < clipStart || w.start >= clipEnd) continue;
    const png = pngFor(w.word);
    if (!png) continue;
    const s = Math.max(0, w.start - clipStart - 0.04);
    if (s - (lastShown.get(png) ?? -9) < 3) continue;            // same emoji not again within 3 s
    let slot = slotsEnd.findIndex(t => t <= s);
    if (slot < 0) continue;                                      // three already on screen
    const e = Math.min(dur, Math.max(s + 0.6, w.end - clipStart + 0.3));
    out.push({ png, start: +s.toFixed(2), end: +e.toFixed(2), ...(box ? { x: Math.round(box.x + dx[slot] * box.size), y: box.y, size: box.size } : {}) });
    slotsEnd[slot] = e; lastShown.set(png, s);
  }
  return out;
}
module.exports = { plan, pngForChar, splitTitle, emojiForText, EMOJI_RE };
