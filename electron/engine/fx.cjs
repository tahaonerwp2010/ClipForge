// Auto effects planner: finds the strong moments of a clip from the word timings and turns them into visual effects
// (punch-in zoom, camera shake, white flash, RGB glitch) and matching sound effects from the built-in library.
// Works offline. The same clip + seed always gives the same result.
const SFX = require('./sfxlib.cjs');

const POWER = new Set(['never', 'always', 'secret', 'secrets', 'money', 'free', 'insane', 'crazy', 'huge', 'biggest', 'best', 'worst', 'mistake', 'mistakes', 'truth', 'stop', 'million', 'billion', 'thousand', 'important', 'wrong', 'rich', 'success', 'fail', 'failure', 'win', 'lose', 'dangerous', 'powerful', 'shocking', 'unbelievable', 'impossible', 'everything', 'nothing', 'nobody', 'everyone', 'only', 'first', 'last', 'now', 'warning', 'secretly', 'finally', 'literally', 'actually', 'really', 'boom', 'wow', 'omg']);
const NEG = new Set(['fail', 'failed', 'failure', 'mistake', 'mistakes', 'wrong', 'worst', 'lose', 'lost', 'loser', 'never', 'broke', 'broken', 'bad', 'sad', 'die', 'died', 'dead', 'hate', 'stupid', 'waste', 'wasted', 'problem', 'problems', 'pain', 'scam', 'fake', 'trouble', 'struggle', 'scared', 'fear', 'afraid', 'nobody', 'nothing', 'impossible', 'dangerous', 'warning', 'stop', 'quit', 'regret', 'sorry', 'ugh', 'no']);
const WIN = new Set(['money', 'million', 'billion', 'rich', 'win', 'won', 'winner', 'success', 'successful', 'profit', 'free', 'best', 'first', 'growth', 'grow', 'upgrade', 'level', 'unlock', 'unlocked', 'achieved', 'boom', 'wow', 'amazing', 'perfect', 'genius', 'bonus', 'reward', 'dollars', 'cash', 'paid']);
const NUMW = new Set(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'million', 'billion', 'percent']);
const LEVEL = {
  subtle:   { gap: 5,   thr: 3, amp: 0.05, flashAt: 99, shake: false, glitch: false, fail: false, funny: false, riser: false, intro: false },
  balanced: { gap: 3.2, thr: 2, amp: 0.08, flashAt: 4,  shake: true,  glitch: false, fail: true,  funny: false, riser: true,  intro: true },
  wild:     { gap: 1.8, thr: 1, amp: 0.12, flashAt: 2,  shake: true,  glitch: true,  fail: true,  funny: true,  riser: true,  intro: true },
};
const norm = w => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function plan(words, clipStart, clipEnd, opt = {}, seed = 1) {
  const out = { zoom: [], shake: [], flashes: [], glitch: [], sfx: [], events: 0 };
  if (!opt || !opt.enabled) return out;
  const lv = LEVEL[opt.intensity] || LEVEL.balanced, dur = clipEnd - clipStart, r = rng(seed);
  const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd);
  if (cw.length < 4 || dur < 4) return out;
  const useSfx = opt.sfx !== false;

  // ---- candidate moments ----
  const cands = cw.map((w, i) => {
    const n = norm(w.word); if (n.length < 2) return null;
    const prev = cw[i - 1], next = cw[i + 1];
    const gapBefore = prev ? w.start - prev.end : 1, gapAfter = next ? next.start - w.end : 1;
    let s = 0, cls = 'plain';
    if (/\d/.test(n) || NUMW.has(n)) { s += 3; cls = 'num'; }
    if (POWER.has(n)) s += 3;
    if (WIN.has(n)) { s += 1; cls = 'win'; }
    if (NEG.has(n)) { s += 1; cls = 'neg'; }
    if (gapBefore >= 0.45) s += 2;
    if (n.length >= 8) s += 1;
    if (gapAfter >= 0.4) s += 1;
    if (/[!?]$/.test(String(w.word))) s += 1;
    return { t: w.start - clipStart - 0.03, s, cls, gapBefore, i };
  }).filter(c => c && c.s >= lv.thr && c.t >= 0.5 && c.t <= dur - 0.6);
  cands.sort((a, b) => b.s - a.s);
  const picked = [], max = Math.max(1, Math.ceil(dur / lv.gap));
  for (const c of cands) { if (picked.length >= max) break; if (picked.every(p => Math.abs(p.t - c.t) >= lv.gap)) picked.push(c); }
  picked.sort((a, b) => a.t - b.t);

  // ---- sound picking (role based, no immediate repeats, spacing and quotas) ----
  const recent = []; let lastSfxT = -9, lastFail = -99, lastRiser = -99;
  const pick = (roles) => {
    for (const role of roles) {
      const pool = SFX.byRole(role); if (!pool.length) continue;
      const fresh = pool.filter(x => !recent.includes(x.name)), use = fresh.length ? fresh : pool;
      const f = use[Math.floor(r() * use.length)]; recent.push(f.name); if (recent.length > 6) recent.shift(); return f;
    }
    return null;
  };
  const addSfx = (f, t, extra = 0) => {
    if (!f || !useSfx) return false;
    t = Math.max(0, +t.toFixed(2));
    if (t - lastSfxT < 0.7 && t >= lastSfxT) return false;
    out.sfx.push({ file: f.path, t, db: +((opt.sfxDb ?? -6) + (f.gainDb || 0) + extra).toFixed(1), dur: f.dur, role: f.roles[0], name: f.name });
    lastSfxT = Math.max(lastSfxT, t); return true;
  };
  const wantZoom = opt.zoom !== false, wantFlash = !!opt.flash && opt.intensity !== 'subtle', wantShake = opt.shake !== false && lv.shake, wantGlitch = opt.glitch !== false && lv.glitch;

  // ---- intro: a short whoosh + small punch right at the start (hook moment) ----
  if (lv.intro && dur >= 6) {
    if (wantZoom) out.zoom.push({ t: 0.1, amp: +(lv.amp * 0.8).toFixed(3) });
    addSfx(pick(['whoosh']), 0.02, -2);
    out.events++;
  }

  for (const c of picked) {
    const kind = c.s >= 5 ? 'hit' : (c.gapBefore >= 0.6 && c.s >= lv.flashAt ? 'transition' : 'punch');
    const t = +c.t.toFixed(2);
    if (wantZoom) out.zoom.push({ t, amp: +(lv.amp * (kind === 'hit' ? 1.5 : 1)).toFixed(3) });
    if (wantShake && (kind === 'hit' || (kind === 'transition' && opt.intensity === 'wild'))) out.shake.push({ t, amp: kind === 'hit' ? 1 : 0.6 });
    if (wantFlash && kind !== 'punch') out.flashes.push(t);
    const negNow = c.cls === 'neg' && lv.fail && t - lastFail > 9;
    if (wantGlitch && (negNow || (kind === 'transition' && r() < 0.6))) out.glitch.push(t);
    if (useSfx) {
      let f = null, at = t;
      if (negNow) { f = pick(lv.funny && r() < 0.35 ? ['funny', 'fail'] : ['fail']); lastFail = t; }
      else if (c.cls === 'win' || c.cls === 'num') f = pick(r() < 0.75 ? ['reward', 'pop'] : ['pop', 'reward']);
      else if (kind === 'hit') {
        if (lv.riser && c.gapBefore >= 0.5 && t >= 1.8 && t - lastRiser > 10) { const rs = pick(['riser']); if (rs && addSfx(rs, t - Math.min(rs.dur, t - 0.2), -3)) lastRiser = t; }
        f = pick(lv.funny && r() < 0.2 ? ['funny', 'hit'] : ['hit', 'pop']);
      } else if (kind === 'transition') {
        if (wantFlash && r() < 0.5) f = pick(['camera', 'whoosh']);
        else if (wantGlitch && out.glitch.includes(t)) f = pick(['glitch', 'whoosh']);
        else { f = pick(['whoosh']); at = t - 0.15; }
      } else f = pick(r() < 0.65 ? ['pop', 'tech'] : ['whoosh', 'pop']);
      addSfx(f, at);
    }
  }
  out.events += picked.length;
  return out;
}
module.exports = { plan };
