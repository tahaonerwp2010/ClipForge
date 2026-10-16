// Auto effects planner: picks the strong moments of a clip (numbers, power words, sentence starts after a pause) from the word timings
// and turns them into: punch-in zoom, white flash, and sound effects from the user's library. Works offline.
const SFX = require('./sfxlib.cjs');

const POWER = new Set(['never', 'always', 'secret', 'secrets', 'money', 'free', 'insane', 'crazy', 'huge', 'biggest', 'best', 'worst', 'mistake', 'mistakes', 'truth', 'stop', 'million', 'billion', 'thousand', 'important', 'wrong', 'rich', 'success', 'fail', 'failure', 'win', 'lose', 'dangerous', 'powerful', 'shocking', 'unbelievable', 'impossible', 'everything', 'nothing', 'nobody', 'everyone', 'only', 'first', 'last', 'now', 'warning', 'secretly', 'finally', 'literally', 'actually', 'really']);
const NUMW = new Set(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'million', 'billion', 'percent']);
const LEVEL = { subtle: { gap: 5, thr: 3, amp: 0.05, flashAt: 99 }, balanced: { gap: 3.2, thr: 2, amp: 0.08, flashAt: 4 }, wild: { gap: 1.8, thr: 1, amp: 0.12, flashAt: 2 } };
const norm = w => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function plan(words, clipStart, clipEnd, opt = {}, seed = 1) {
  const out = { zoom: [], flashes: [], sfx: [], events: 0 };
  if (!opt || !opt.enabled) return out;
  const lv = LEVEL[opt.intensity] || LEVEL.balanced, dur = clipEnd - clipStart;
  const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd);
  if (cw.length < 4 || dur < 4) return out;
  const cands = cw.map((w, i) => {
    const n = norm(w.word); if (n.length < 2) return null;
    const prev = cw[i - 1], next = cw[i + 1];
    const gapBefore = prev ? w.start - prev.end : 1, gapAfter = next ? next.start - w.end : 1;
    let s = 0;
    if (/\d/.test(n) || NUMW.has(n)) s += 3;
    if (POWER.has(n)) s += 3;
    if (gapBefore >= 0.45) s += 2;
    if (n.length >= 8) s += 1;
    if (gapAfter >= 0.4) s += 1;
    if (/[!?]$/.test(String(w.word))) s += 1;
    return { t: w.start - clipStart - 0.03, s, gapBefore, i };
  }).filter(c => c && c.s >= lv.thr && c.t >= 0.5 && c.t <= dur - 0.6);
  cands.sort((a, b) => b.s - a.s);
  const picked = [], max = Math.max(1, Math.ceil(dur / lv.gap));
  for (const c of cands) { if (picked.length >= max) break; if (picked.every(p => Math.abs(p.t - c.t) >= lv.gap)) picked.push(c); }
  picked.sort((a, b) => a.t - b.t);
  const lib = SFX.list(), r = rng(seed); let lastFile = '';
  const pool = cats => { const l = lib.filter(x => cats.includes(x.cat)); return l.length ? l : []; };
  const pickFile = cats => { for (const c of cats) { const l = pool([c]).filter(x => x.id !== lastFile); const use = l.length ? l : pool([c]); if (use.length) { const f = use[Math.floor(r() * use.length)]; lastFile = f.id; return f; } } return null; };
  for (const c of picked) {
    const kind = c.s >= 5 ? 'hit' : (c.gapBefore >= 0.6 && c.s >= lv.flashAt ? 'transition' : 'punch');
    if (opt.zoom !== false) out.zoom.push({ t: +c.t.toFixed(2), amp: +(lv.amp * (kind === 'hit' ? 1.5 : 1)).toFixed(3) });
    if (opt.flash && kind !== 'punch' && opt.intensity !== 'subtle') out.flashes.push(+c.t.toFixed(2));
    if (opt.sfx !== false) {
      const f = kind === 'hit' ? pickFile(['impact', 'pop']) : kind === 'transition' ? pickFile(['whoosh', 'riser']) : pickFile(['pop', 'ding', 'whoosh']);
      if (f) out.sfx.push({ file: f.path, t: Math.max(0, +(c.t - (f.cat === 'whoosh' ? 0.15 : 0)).toFixed(2)), db: +((opt.sfxDb ?? -6) + (f.gainDb || 0)).toFixed(1), cat: f.cat });
    }
  }
  out.events = picked.length;
  return out;
}
module.exports = { plan };
