// Caption sounds: a soft whoosh when the hook appears and subtle pops on the strong words of the captions. Uses the sounds that ship with ClipForge, mixed quietly under the voice.
const SFX = require('./sfxlib.cjs');
const pickBy = (role, seed, maxDur) => { const l = SFX.byRole(role).filter(x => (x.dur || 1) <= maxDur); return l.length ? l[Math.abs(seed) % l.length] : null; };

function build({ words = [], clipStart = 0, clipEnd = 0, captions = {}, branding = {}, seed = 1 }) {
  if (!captions.enabled || captions.sfx === false) return [];
  const dur = clipEnd - clipStart, out = [];
  const at = branding.autoTitle || {};
  const wh = pickBy('whoosh', seed, 1.2);
  if (at.enabled && wh && (at.title || at.enabled)) out.push({ file: wh.path, t: 0.08, db: -13 + (wh.gainDb || 0) * 0.3, dur: Math.min(wh.dur || 0.8, 0.9), name: wh.name });
  const pop = pickBy('pop', seed, 0.8);
  if (pop) {
    const ws = words.filter(w => w.start >= clipStart + 0.6 && w.start < clipEnd - 0.8);
    let last = -9, n = 0; const max = Math.max(1, Math.floor(dur / 2.4));
    for (const w of ws) {
      const txt = String(w.word || '').replace(/[^\p{L}\p{N}]/gu, '');
      const strong = txt.length >= 7 || /[!?]$/.test(String(w.word || '')) || /^\d/.test(txt);   // longer, emphasised or numeric words
      const t = w.start - clipStart;
      if (strong && t - last >= 2.2 && n < max && !(out.length && Math.abs(out[0].t - t) < 1)) { out.push({ file: pop.path, t: +t.toFixed(2), db: -17 + (pop.gainDb || 0) * 0.3, dur: Math.min(pop.dur || 0.5, 0.6), name: pop.name }); last = t; n++; }
    }
  }
  return out;
}
module.exports = { build };
