// Auto effects planner: finds the strong moments of a clip from the word timings, picks a fitting visual effect for each moment
// (18 different effects, chosen by what the word means and never the same one over and over) and a matching sound effect
// from the built-in library. Works offline. The same clip + seed always gives the same result.
//
// Effect families (each can be switched off in the UI):
//   zoom   : punch, push (slow push-in), pull (zoom-out settle), pulse (double beat)
//   motion : shake, tilt, pan (whip-settle)
//   flash  : flash, dip (black dip), strobe, negate
//   glitch : glitch, vhs, chroma
//   color  : mono (drain colour), colorpop, glow, blur
const SFX = require('./sfxlib.cjs');

const S = s => new Set(s.split(/\s+/));
const POWER = S('never always secret secrets money free insane crazy huge biggest best worst mistake mistakes truth stop million billion thousand important wrong rich success fail failure win lose dangerous powerful shocking unbelievable impossible everything nothing nobody everyone only first last now warning secretly finally literally actually really boom wow omg incredible massive extreme brutal ultimate guaranteed proven exposed banned illegal paisa lakh crore zabardast dhamaka khatarnak sach jhoot dhoka kamal barbad');
const NEG = S('fail failed failure mistake mistakes wrong worst lose lost loser never broke broken bad sad die died dead hate stupid waste wasted problem problems pain scam fake trouble struggle scared fear afraid nobody nothing impossible dangerous warning stop quit regret sorry ugh no cant dont wont jhoot dhoka barbad khatarnak');
const WIN = S('money million billion rich win won winner success successful profit free best first growth grow upgrade level unlock unlocked achieved boom wow amazing perfect genius bonus reward dollars cash paid champion victory record paisa lakh crore zabardast kamal');
const NUMW = S('zero one two three four five six seven eight nine ten twenty thirty fifty hundred thousand million billion percent');
const STOP = S('the a an and or but so to of in on at is are was were be been it its this that these those you your yours i me my we our they them their he she his her him as for with from by if then than just very too also have has had do does did not dont am will would can could should about into over out up down what when where who which how there here some any all more most one like get got gonna gotta kind sort thing things stuff yeah okay well um uh hmm mein hai hain ka ki ke ko se ne par aur yeh woh kya tha thi hota hoti');

const LEVEL = {
  subtle:   { gap: 5,   min: 8,   thr: 4, amp: 0.05, kinds: 'punch push pull glow colorpop pan', layer: 0 },
  balanced: { gap: 3.4, min: 4.5, thr: 3, amp: 0.08, kinds: 'punch push pull pulse shake tilt pan flash dip chroma blur mono colorpop glow', layer: 0.25 },
  wild:     { gap: 2.0, min: 3,   thr: 2, amp: 0.12, kinds: 'punch push pull pulse shake tilt pan flash dip strobe negate glitch vhs chroma blur mono colorpop glow', layer: 0.45 },
};
const BIAS = {   // wild = loud and punchy, balanced = a little punchier than neutral
  wild: { shake: 2, punch: 1.8, pulse: 1.6, flash: 2, strobe: 1.6, glitch: 2, vhs: 1.5, negate: 1.5, tilt: 1.6, dip: 1.5, glow: 0.5, pull: 0.6, push: 0.6 },
  balanced: { shake: 1.3, punch: 1.3, flash: 1.3, glow: 0.8 },
};
const FAMILY = { punch: 'zoom', push: 'zoom', pull: 'zoom', pulse: 'zoom', shake: 'motion', tilt: 'motion', pan: 'motion', flash: 'flash', dip: 'flash', strobe: 'flash', negate: 'flash', glitch: 'glitch', vhs: 'glitch', chroma: 'glitch', mono: 'color', colorpop: 'color', glow: 'color', blur: 'color' };
// What fits what: ctx -> kind weights
const WEIGHTS = {
  neg:   { mono: 4, glitch: 3, shake: 2, dip: 2, vhs: 2, tilt: 2, pull: 1, chroma: 1 },
  win:   { colorpop: 4, glow: 3, pulse: 2, punch: 2, flash: 1, strobe: 1 },
  num:   { pulse: 3, punch: 2, colorpop: 2, glow: 2, chroma: 1 },
  hit:   { shake: 3, punch: 3, flash: 2, tilt: 2, chroma: 2, strobe: 1, negate: 1, pulse: 1 },
  trans: { pan: 3, dip: 2, blur: 2, flash: 2, glitch: 1, pull: 2, push: 1 },
  quest: { pull: 3, tilt: 2, push: 2, blur: 1, pan: 1 },
  plain: { push: 3, pan: 2, pull: 2, glow: 1, chroma: 1, pulse: 1, punch: 1.5, shake: 1, flash: 1, tilt: 1, glitch: 0.7, dip: 0.6 },
};
// Which sound roles go with each effect (first = preferred) and how to line the sound up with the word
const SOUND = {
  punch: ['pop', 'hit'], push: ['whoosh'], pull: ['whoosh'], pulse: ['pop', 'hit'], shake: ['hit'], tilt: ['whoosh', 'hit'], pan: ['whoosh'],
  flash: ['camera'], dip: ['hit', 'whoosh'], strobe: ['camera', 'tech'], negate: ['glitch'], glitch: ['glitch'], vhs: ['glitch', 'tech'], chroma: ['glitch', 'pop'],
  mono: ['tech', 'whoosh'], colorpop: ['reward', 'pop'], glow: ['reward', 'pop'], blur: ['whoosh'],
};
const CAP = { whoosh: 0.9, hit: 1.0, funny: 1.3, fail: 1.3, reward: 1.1, pop: 0.8, tech: 1.0, glitch: 0.9, camera: 0.6, riser: 1.8 };
const norm = w => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function plan(words, clipStart, clipEnd, opt = {}, seed = 1) {
  const out = { zoom: [], push: [], pull: [], pulse: [], shake: [], tilt: [], pan: [], flashes: [], dip: [], strobe: [], negate: [], glitch: [], vhs: [], chroma: [], mono: [], colorpop: [], glow: [], blur: [], sfx: [], events: 0, kinds: {} };
  if (!opt || !opt.enabled) return out;
  const lv = LEVEL[opt.intensity] || LEVEL.balanced, dur = clipEnd - clipStart, r = rng(seed);
  const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd);
  if (cw.length < 4 || dur < 4) return out;
  const useSfx = opt.sfx !== false;
  const allowedFam = { zoom: opt.zoom !== false, motion: opt.shake !== false, flash: !!opt.flash, glitch: opt.glitch !== false, color: opt.color !== false };
  const allowed = new Set(lv.kinds.split(' ').filter(k => allowedFam[FAMILY[k]]));

  // ---- candidate moments: only words that carry meaning (no "the / and / to"), judged by meaning, pauses and delivery ----
  const cands = cw.map((w, i) => {
    const n = norm(w.word); if (n.length < 2 || STOP.has(n)) return null;
    const prev = cw[i - 1], next = cw[i + 1];
    const gapBefore = prev ? w.start - prev.end : 1, gapAfter = next ? next.start - w.end : 1;
    let s = 0, cls = 'plain';
    const sem = POWER.has(n) || NEG.has(n) || WIN.has(n) || /\d/.test(n) || NUMW.has(n);
    if (/\d/.test(n) || NUMW.has(n)) { s += 3; cls = 'num'; }
    if (POWER.has(n)) s += 3;
    if (WIN.has(n)) { s += 2; cls = 'win'; }
    if (NEG.has(n)) { s += 2; cls = 'neg'; }
    if (n.length >= 4) {
      if (gapBefore >= 0.45) s += 1;
      if (gapAfter >= 0.4) s += 1;
      if (n.length >= 8) s += 1;
      if (w.end - w.start > 0.55 && n.length <= 9) s += 1;      // stretched = stressed by the speaker
    } else if (!sem) return null;
    const q = /[!?]$/.test(String(w.word));
    if (q) s += 1;
    return { t: w.start - clipStart - 0.03, s, cls, gapBefore, q, i, len: n.length, sem };
  }).filter(c => c && c.t >= 0.5 && c.t <= dur - 0.7);
  const strong = cands.filter(c => c.s >= lv.thr).sort((a, b) => b.s - a.s);
  const picked = [], max = Math.max(1, Math.ceil(dur / lv.gap));
  for (const c of strong) { if (picked.length >= max) break; if (picked.every(p => Math.abs(p.t - c.t) >= lv.gap)) picked.push(c); }
  // never leave a clip bare: if too few strong moments, add the next best words (still real words, spaced out)
  const want = Math.max(1, Math.ceil(dur / lv.min));
  if (picked.length < want) {
    const rest = cands.filter(c => !picked.includes(c)).sort((a, b) => (b.s - a.s) || (b.gapBefore - a.gapBefore));
    for (const c of rest) { if (picked.length >= want) break; if (picked.every(p => Math.abs(p.t - c.t) >= lv.gap * 0.7)) picked.push(c); }
  }
  picked.sort((a, b) => a.t - b.t);

  // ---- sound picking: by role, never the same sound twice in a row, least-used first ----
  const recent = [], uses = {}; let lastSfxT = -9, lastRiser = -99;
  const pick = (roles) => {
    for (const role of roles) {
      const pool = SFX.byRole(role); if (!pool.length) continue;
      const fresh = pool.filter(x => !recent.includes(x.name));
      const base = fresh.length ? fresh : pool;
      const least = Math.min(...base.map(x => uses[x.name] || 0));
      const use = base.filter(x => (uses[x.name] || 0) === least);
      const f = use[Math.floor(r() * use.length)];
      recent.push(f.name); if (recent.length > 10) recent.shift(); uses[f.name] = (uses[f.name] || 0) + 1;
      return { ...f, useRole: role };
    }
    return null;
  };
  // t = the moment the word starts. Whooshes are placed so their peak lands on the word, risers so they end on it.
  const addSfx = (f, t, extra = 0, align = 'start') => {
    if (!f || !useSfx) return false;
    const role = f.useRole || f.roles[0], d = Math.min(f.dur || 1, CAP[role] || 1.2);
    let at = t - 0.02;
    if (align === 'peak') at = t - d * (role === 'whoosh' ? 0.5 : 0.3);
    if (align === 'end') at = t - d;
    at = Math.max(0, +at.toFixed(2));
    if (Math.abs(at - lastSfxT) < 0.45 && at >= lastSfxT - 0.45) return false;
    out.sfx.push({ file: f.path, t: at, db: +((opt.sfxDb ?? -6) + (f.gainDb || 0) + extra).toFixed(1), dur: d, role, name: f.name, t0: t, align, baseDb: (opt.sfxDb ?? -6), extra });
    lastSfxT = Math.max(lastSfxT, at); return true;
  };

  // ---- effect choice ----
  const usedK = {}, hist = []; let zoomN = 0, total = 0;
  const choose = (ctx, exclude) => {
    const base = WEIGHTS[ctx] || WEIGHTS.plain, ws = [];
    for (const [k, w0] of Object.entries(base)) {
      if (!allowed.has(k) || k === exclude) continue;
      let w = (w0 * ((BIAS[opt.intensity] || {})[k] || 1)) / (1 + 2 * (usedK[k] || 0));
      if (hist[hist.length - 1] === k) continue;
      const fam = FAMILY[k];
      if (hist.length >= 2 && FAMILY[hist[hist.length - 1]] === fam && FAMILY[hist[hist.length - 2]] === fam) w *= 0.15;
      if (fam === 'zoom' && total >= 3 && zoomN / total > 0.35) w *= 0.4;
      ws.push([k, w]);
    }
    if (!ws.length) { const any = [...allowed].filter(k => k !== exclude && k !== hist[hist.length - 1]); return any.length ? any[Math.floor(r() * any.length)] : null; }
    const sum = ws.reduce((a, b) => a + b[1], 0); let x = r() * sum;
    for (const [k, w] of ws) { x -= w; if (x <= 0) return k; }
    return ws[ws.length - 1][0];
  };
  const apply = (k, t, c) => {
    const amp = lv.amp;
    switch (k) {
      case 'punch': out.zoom.push({ t, amp: +(amp * (c.s >= 5 ? 1.5 : 1)).toFixed(3) }); break;
      case 'push': out.push.push({ t, t2: +(t + Math.min(2.6, Math.max(1.4, dur * 0.12))).toFixed(2), amp: +(amp * 0.9).toFixed(3) }); break;
      case 'pull': out.pull.push({ t, amp: +(amp * 1.3).toFixed(3) }); break;
      case 'pulse': out.pulse.push({ t, amp: +(amp * 1.1).toFixed(3) }); break;
      case 'shake': out.shake.push({ t, amp: c.s >= 5 ? 1 : 0.7 }); break;
      case 'tilt': out.tilt.push({ t, dir: r() < 0.5 ? -1 : 1 }); break;
      case 'pan': out.pan.push({ t, dir: r() < 0.5 ? -1 : 1 }); break;
      case 'flash': out.flashes.push(t); break;
      case 'dip': out.dip.push(t); break;
      case 'strobe': out.strobe.push(t); break;
      case 'negate': out.negate.push(t); break;
      case 'glitch': out.glitch.push(t); break;
      case 'vhs': out.vhs.push(t); break;
      case 'chroma': out.chroma.push(t); break;
      case 'mono': out.mono.push(t); break;
      case 'colorpop': out.colorpop.push(t); break;
      case 'glow': out.glow.push(t); break;
      case 'blur': out.blur.push(t); break;
    }
    out.kinds[k] = (out.kinds[k] || 0) + 1; usedK[k] = (usedK[k] || 0) + 1; total++; if (FAMILY[k] === 'zoom') zoomN++;
  };

  // ---- intro: a short whoosh and a gentle settle at the very start ----
  if (dur >= 6 && opt.intensity !== 'subtle') {
    if (allowed.has('pull')) { out.pull.push({ t: 0.05, amp: +(lv.amp * 0.9).toFixed(3) }); out.kinds.pull = 1; usedK.pull = 1; total++; zoomN++; hist.push('pull'); }
    addSfx(pick(['whoosh']), 0.05, -3, 'peak');
    out.events++;
  }

  let lastRoleTime = -99;
  for (const c of picked) {
    const t = +c.t.toFixed(2);
    const ctx = c.cls === 'neg' ? 'neg' : c.cls === 'win' ? 'win' : c.cls === 'num' ? 'num' : c.s >= 5 ? 'hit' : c.gapBefore >= 0.6 ? 'trans' : c.q ? 'quest' : 'plain';
    const k = choose(ctx); if (!k) continue;
    apply(k, t, c); hist.push(k);
    // strong moments sometimes get a second effect from another family, layered on top
    let k2 = null;
    if ((ctx === 'hit' || ctx === 'neg') && r() < lv.layer) {
      const sv = hist.slice(); k2 = choose(ctx === 'hit' ? 'hit' : 'neg', k);
      if (k2 && FAMILY[k2] !== FAMILY[k]) { apply(k2, t, c); } else k2 = null;
      hist.length = sv.length;
    }
    if (useSfx) {
      const roles = (opt.intensity === 'wild' && ctx === 'neg' && r() < 0.3) ? ['funny', 'fail'] : (opt.intensity === 'wild' && ctx === 'hit' && r() < 0.15) ? ['funny', 'hit'] : SOUND[k];
      if (ctx === 'hit' && c.gapBefore >= 0.5 && t >= 1.8 && t - lastRiser > 10 && opt.intensity !== 'subtle' && r() < 0.6) {
        const rs = pick(['riser']); if (rs && addSfx(rs, t, -3, 'end')) lastRiser = t;
      }
      const f = pick(roles);
      addSfx(f, t, 0, (f && (f.useRole === 'whoosh')) ? 'peak' : 'start');
      lastRoleTime = t;
    }
  }
  out.events += picked.length;

  // ---- soft whoosh on real sentence breaks that got no effect, so cuts between thoughts feel edited ----
  if (useSfx && opt.intensity !== 'subtle') {
    let lastBreak = -9;
    cw.forEach((w, i) => {
      const p = cw[i - 1]; if (!p) return;
      const gap = w.start - p.end, t = w.start - clipStart;
      if (gap >= 0.9 && t > 1 && t < dur - 1 && t - lastBreak > 3.5 && !out.sfx.some(s => Math.abs(s.t - t) < 1.2)) {
        if (addSfx(pick(['whoosh']), t, -5, 'peak')) lastBreak = t;
      }
    });
  }
  // ---- accent sounds: lighter sounds on other meaningful words, so wild/balanced clips are never quiet between the big moments ----
  if (useSfx && opt.intensity !== 'subtle') {
    const sp = opt.intensity === 'wild' ? 1.1 : 2.4;
    const extra = cands.filter(c => c.s >= 2).sort((a, b) => b.s - a.s);
    for (const c of extra) {
      const t = +c.t.toFixed(2);
      if (out.sfx.some(x => Math.abs(x.t - t) < sp)) continue;
      const roles = c.cls === 'num' ? ['pop', 'reward'] : c.cls === 'win' ? ['reward', 'pop'] : c.cls === 'neg' ? ['hit', 'pop'] : c.gapBefore >= 0.5 ? ['whoosh'] : ['pop', 'hit', 'tech'];
      const f = pick(roles); if (f && addSfx(f, t, -2, f.useRole === 'whoosh' ? 'peak' : 'start')) out.events++;
    }
  }
  out.sfx.sort((a, b) => a.t - b.t);
  return out;
}
module.exports = { plan, FAMILY };
