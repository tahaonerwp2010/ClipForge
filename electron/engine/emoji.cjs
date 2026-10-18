// Plans emoji pops for CapCut-style captions + title emojis. Emoji are bundled Twemoji PNGs (no font / internet needed).
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const MAP = require('./emoji-map.json');   // word -> twemoji codepoint filename

const fileFor = cp => { const f = path.join(P.emojiDir() || '', `${cp}.png`); return fs.existsSync(f) ? f : null; };
// Words that are in the dictionary but are too vague to deserve an emoji (they were the main reason emoji looked random)
const GENERIC = new Set(('again agree agreement basic basics begin below call calling calls care caring change changed changes changing chapter check complete completed continue correct count day days daily detail details done down early end ending exactly find finding found give giving go here hey hi how in instant item join like liked link list live look looking maybe message messages month months must need new newest next note notes notice number numbers offer open order place places plan planning please point private process proceed question questions read reading ready real really remember repeat report required results right said say second seconds see seeing set share sharing start step steps stop take tell telling that then think thinking this thought three time together top true truly up update view views wait waiting wake week weekend weekends what whatever who why work working world worldwide year years yes ok okay hmm haha lol wait fast faster quick quickly special unique basic old first final finally third double multiply master lead leaders skill skills practice training fit walk follow tap click people team community answer happy trend trending sell market markets road sky health hand hands lie lies afraid god american question questions fair fresh fall falling rise rising drop drove drive driving hit key keys loop mind nothing everything plant planet play playing hot cold high low big small great good nice best better worst bad best wild crazy ill hear hearing speak speaking talk talking sound pay payment payments paid cost bought sale sales run running travel traveling trip course courses lock locked'
).split(/\s+/));
// Hand-picked pairs that are better than the generic dictionary entry
const OVERRIDE = { crazy: '1f92a', insane: '1f92a', amazing: '1f929', incredible: '1f929', unbelievable: '1f92f', mindblowing: '1f92f', money: '1f4b0', cash: '1f4b5', rich: '1f911', broke: '1f4b8', fire: '1f525', hot: '1f975', cold: '1f976', freezing: '1f976', love: '2764', loved: '2764', hate: '1f621', angry: '1f621', sad: '1f622', cry: '1f62d', crying: '1f62d', scared: '1f631', scary: '1f631', fear: '1f628', afraid: '1f628', secret: '1f92b', secrets: '1f92b', shh: '1f92b', think: '1f914', idea: '1f4a1', brain: '1f9e0', smart: '1f9e0', genius: '1f9e0', dead: '1f480', dying: '1f480', death: '1f480', dangerous: '26a0', warning: '26a0', win: '1f3c6', winner: '1f3c6', winning: '1f3c6', champion: '1f3c6', victory: '1f3c6', success: '1f4c8', growth: '1f4c8', grow: '1f4c8', crash: '1f4c9', fail: '1f4c9', failure: '1f4c9', failed: '1f4c9', lost: '1f4c9', rocket: '1f680', eyes: '1f440', laugh: '1f602', laughing: '1f602', funny: '1f602', lol: '1f602', haha: '1f602', hilarious: '1f602', tired: '1f634', sleep: '1f634', sleeping: '1f634', sleepy: '1f634', party: '1f973', celebrate: '1f973', celebration: '1f973', gift: '1f381', gifts: '1f381', bomb: '1f4a3', boom: '1f4a5', wow: '1f62e', omg: '1f631', shocked: '1f631', shocking: '1f631', surprise: '1f632', surprised: '1f632', free: '1f193', perfect: '1f44c', great: '1f44d', good: '1f44d', best: '1f3c6', worst: '1f44e', bad: '1f44e', strong: '1f4aa', strength: '1f4aa', muscle: '1f4aa', power: '26a1', powerful: '26a1', energy: '26a1', fast: '26a1', speed: '26a1', hundred: '1f4af', hardwork: '1f4aa', job: '1f4bc', phone: '1f4f1', video: '1f3ac', music: '1f3b5', song: '1f3b5', food: '1f354', hungry: '1f924', eat: '1f37d', eating: '1f37d', drink: '1f964', coffee: '2615', heart: '2764', kiss: '1f48b', star: '2b50', stars: '2b50', sun: '2600', moon: '1f319', night: '1f319', rain: '1f327', money_bag: '1f4b0', dollar: '1f4b5', dollars: '1f4b5', million: '1f4b0', billion: '1f4b0', millionaire: '1f4b0', stop: '1f6d1', quit: '1f6aa', mistake: '274c', mistakes: '274c', wrong: '274c', correct: '2705', lie: '1f925', lies: '1f925', liar: '1f925', fake: '1f921', scam: '1f6a8', police: '1f46e', gun: '1f52b', fight: '1f94a', boxing: '1f94a', gym: '1f3cb', workout: '1f3cb', car: '1f697', cars: '1f697', home: '1f3e0', house: '1f3e0', school: '1f3eb', book: '1f4d6', books: '1f4da', study: '1f4da', studying: '1f4da', phone_call: '1f4de', camera: '1f4f8', photo: '1f4f8', pray: '1f64f', prayer: '1f64f', thank: '1f64f', thanks: '1f64f', please: '1f64f', sorry: '1f625', pain: '1f623', hurt: '1f915', sick: '1f912', doctor: '1f468', baby: '1f476', kid: '1f9d2', kids: '1f9d2', dog: '1f436', cat: '1f431', ghost: '1f47b', devil: '1f608', evil: '1f608', king: '1f451', queen: '1f451', boss: '1f451', legend: '1f451', goat: '1f410', diamond: '1f48e', gold: '1f947', trophy: '1f3c6', target: '1f3af', goal: '1f3af', goals: '1f3af', idea_: '1f4a1', luck: '1f340', lucky: '1f340', magic: '2728', clean: '2728', sparkle: '2728', gem: '1f48e' };
const NEGATORS = new Set(['not', 'no', 'dont', "don't", 'never', 'cant', "can't", 'without', 'wont', "won't", 'isnt', "isn't", 'nobody', 'hardly']);
const NEGATIVE = new Set(['fail', 'failed', 'failure', 'bad', 'sad', 'dead', 'dying', 'death', 'worst', 'broke', 'lost', 'wrong', 'mistake', 'mistakes', 'hate', 'angry', 'crash', 'scared', 'scary', 'fear', 'afraid', 'pain', 'hurt', 'sick', 'cry', 'crying', 'tired', 'lie', 'lies', 'fake', 'scam', 'dangerous', 'warning']);
const cpFor = clean => {
  if (OVERRIDE[clean]) return OVERRIDE[clean];
  if (GENERIC.has(clean)) return null;
  if (MAP[clean]) return MAP[clean];
  if (clean.length >= 5) { const st = clean.replace(/(ing|ed|es|s)$/, ''); if (st.length >= 4 && !GENERIC.has(st) && (OVERRIDE[st] || MAP[st])) return OVERRIDE[st] || MAP[st]; }
  return null;
};
function pngFor(word) {
  const clean = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const cp = cpFor(clean);
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
    const cp = cpFor(w); if (cp && fileFor(cp)) { try { return String.fromCodePoint(...cp.split('-').map(h => parseInt(h, 16))); } catch {} }
  }
  return '🔥';
}

// Picks the few words that really deserve an emoji: only meaningful words (see GENERIC), not after "not / never / don't"
// (so "not good" never gets a thumbs-up), the strongest words first, never two emoji closer than 1.3 s, the same emoji
// not again within 6 s, and at most two on screen at once. -> [{png, start, end, x?}] relative to clip start.
function plan(words, clipStart, clipEnd, box) {
  const dur = clipEnd - clipStart, cands = [];
  const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd);
  cw.forEach((w, i) => {
    const clean = String(w.word).toLowerCase().replace(/[^a-z0-9-']/g, '');
    const bare = clean.replace(/'/g, '');
    const png = pngFor(bare); if (!png) return;
    const prev = cw[i - 1] && String(cw[i - 1].word).toLowerCase().replace(/[^a-z0-9']/g, '');
    if (prev && NEGATORS.has(prev) && !NEGATIVE.has(bare)) return;
    const score = 1 + (OVERRIDE[bare] ? 2 : 0) + (bare.length >= 5 ? 1 : 0) + (/[!?]$/.test(String(w.word)) ? 1 : 0) + ((i && w.start - cw[i - 1].end > 0.4) ? 1 : 0);
    cands.push({ w, png, score, s: Math.max(0, w.start - clipStart - 0.04) });
  });
  cands.sort((a, b) => b.score - a.score || a.s - b.s);
  const picked = [];
  for (const c of cands) {
    if (picked.some(p => Math.abs(p.s - c.s) < 1.3)) continue;
    if (picked.some(p => p.png === c.png && Math.abs(p.s - c.s) < 6)) continue;
    picked.push(c);
  }
  picked.sort((a, b) => a.s - b.s);
  const out = [], slotsEnd = [-9, -9], dx = [0, 1.15];
  for (const c of picked) {
    const slot = slotsEnd.findIndex(t => t <= c.s); if (slot < 0) continue;
    const e = Math.min(dur, Math.max(c.s + 0.8, c.w.end - clipStart + 0.45));
    out.push({ png: c.png, start: +c.s.toFixed(2), end: +e.toFixed(2), ...(box ? { x: Math.round(box.x + dx[slot] * box.size), y: box.y, size: box.size } : {}) });
    slotsEnd[slot] = e;
  }
  return out;
}
module.exports = { plan, pngForChar, splitTitle, emojiForText, EMOJI_RE };
