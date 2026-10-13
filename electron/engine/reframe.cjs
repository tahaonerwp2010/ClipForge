// Turns per-frame face detections into a smooth horizontal crop path (pure functions, no electron).
// detections[i] = { faces: [{cx,cy,w,h,score,act}] }  sampled at `fps`.  cx etc. are 0..1 of the source frame.

const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// Picks ONE subject x per sampled frame (null = nobody). Works per camera SHOT (cuts / wide shots are detected from the frame
// difference), judges face size relative to that shot, and follows the person whose mouth moves the most (smoothed over time).
function pickSubjects(dets, { fps = 3, hints = null, speech = null, cutTimes = [] } = {}) {
  const area = f => f.w * f.h, n = dets.length;
  const CUT = 22;                                                  // mean grey-level change that means "camera cut"
  const cuts = new Set(), shotOf = new Array(n).fill(0); let shot = 0;
  for (const tc of cutTimes) { const ic = Math.ceil(tc * fps - 1e-6); if (ic > 0 && ic < n) cuts.add(ic); }      // exact cut times from FFmpeg scene detection
  for (let i = 0; i < n; i++) { if (i > 0 && ((dets[i].diff || 0) > CUT || cuts.has(i))) { shot++; cuts.add(i); } shotOf[i] = shot; }
  const typ = {};                                                   // typical main-face area per shot
  for (let s = 0; s <= shot; s++) {
    const m = dets.filter((d, i) => shotOf[i] === s).map(d => Math.max(0, ...(d.faces || []).filter(f => f.score >= 0.5).map(area))).filter(x => x > 0);
    typ[s] = m.length ? median(m) : 0;
  }
  const hold = Math.max(2, Math.round(0.8 * fps));                // a challenger must lead this long before we switch speaker
  const pts = []; let cur = null, challenger = null, tracks = [], lastShot = -1;
  for (let i = 0; i < n; i++) {
    const faces = (dets[i].faces || []).filter(f => f.score >= 0.4 && area(f) >= typ[shotOf[i]] * 0.35);
    if (shotOf[i] !== lastShot) { lastShot = shotOf[i]; cur = null; challenger = null; tracks = []; }
    if (!faces.length) { const h0 = hints ? hints[i] : null; if (h0 != null) { cur = { cx: h0 }; pts.push(h0); } else pts.push(null); continue; }
    // smoothed mouth activity per person (matched to the nearest face of the previous frames)
    const next = [];
    for (const f of faces) {
      const t = tracks.reduce((a, b) => (!a || Math.abs(b.cx - f.cx) < Math.abs(a.cx - f.cx) ? b : a), null);
      const prev = t && Math.abs(t.cx - f.cx) < 0.1 ? t.ema : null;
      const talking = !speech || speech[i] !== false;                       // nobody speaks right now: mouth movement means nothing, keep the old estimate
      f.ema = prev == null ? (talking ? (f.act || 0) : 0) : (talking ? prev * 0.65 + (f.act || 0) * 0.35 : prev);
      next.push({ cx: f.cx, ema: f.ema });
    }
    tracks = next;
    const hx = hints ? hints[i] : null;                              // where the prompt's person/object is (null = unknown / not visible)
    if (hx != null) {
      const near = faces.filter(f => Math.abs(f.cx - hx) < 0.12).sort((a, b) => Math.abs(a.cx - hx) - Math.abs(b.cx - hx))[0];
      cur = near || { cx: hx }; challenger = null; pts.push(cur.cx); continue;
    }
    const maxE = Math.max(...faces.map(f => f.ema), 1e-6), maxA = Math.max(...faces.map(area));
    const sc = f => (f.ema / maxE) * 0.55 + (area(f) / maxA) * 0.25 + (cur ? Math.max(0, 1 - Math.abs(f.cx - cur.cx) * 5) * 0.2 : 0);
    const best = faces.reduce((a, b) => (sc(b) > sc(a) ? b : a));
    if (!cur) {                                                         // new shot: decide at once, but judge by the next ~1 s so a transition frame cannot mislead
      let lb = best, ls = -1;
      for (const f of faces) {
        let sc2 = 0;
        for (let k = i; k < Math.min(n, i + 3) && shotOf[k] === shotOf[i]; k++) {
          const near = (dets[k].faces || []).filter(g => g.score >= 0.4).reduce((x, g) => (!x || Math.abs(g.cx - f.cx) < Math.abs(x.cx - f.cx) ? g : x), null);
          if (near && Math.abs(near.cx - f.cx) < 0.1) sc2 += (near.act || 0) + area(near);
        }
        if (sc2 > ls) { ls = sc2; lb = f; }
      }
      cur = lb; pts.push(cur.cx); continue;
    }
    const same = faces.reduce((a, b) => (Math.abs(b.cx - cur.cx) < Math.abs(a.cx - cur.cx) ? b : a));
    if (Math.abs(same.cx - cur.cx) > 0.12) { cur = best; challenger = null; pts.push(cur.cx); continue; }   // our person left
    if (speech && speech[i] === false) { challenger = null; cur = same; pts.push(cur.cx); continue; }   // silence: never switch speaker
    if (best !== same && Math.abs(best.cx - same.cx) > 0.08 && sc(best) > sc(same) * 1.25 + 0.05) {
      if (challenger && Math.abs(challenger.cx - best.cx) < 0.1) challenger.n++; else challenger = { cx: best.cx, n: 1 };
      if (challenger.n >= hold) { cur = best; challenger = null; } else cur = same;
    } else { challenger = null; cur = same; }
    pts.push(cur.cx);
  }
  // right after a camera cut the first frame is often a transition / wrong guess: use the person that the shot settles on (no 0.3 s wrong framing)
  if (!hints) {
    const starts = [...cuts].sort((a, b) => a - b);
    starts.forEach((s0, k) => {
      const end = (starts[k + 1] ?? n), L = end - s0, win = Math.min(hold, L - 1);
      if (win < 1) return;
      const target = pts[s0 + win];
      if (target == null) return;
      for (let j = s0; j < s0 + win; j++) if (pts[j] == null || Math.abs(pts[j] - target) > 0.12) pts[j] = target;
    });
  }
  // kill single-frame spikes (never across a cut)
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    if (!cuts.has(i) && !cuts.has(i + 1) && p != null && a != null && b != null && Math.abs(a - b) < 0.1 && Math.abs(p - a) > 0.15) pts[i] = (a + b) / 2;
  }
  pts.cuts = cuts;
  return pts;
}

// -> keyframes [{t, c, cut?}] where c = crop CENTER (0..1 of source width), or null if no face found at all.
// Smooth-pan is low-pass filtered (eased start/stop) and the whole path runs LEAD seconds early, because the speaker is known in advance.
const LEAD = 0.25;
function buildPath(dets, { fps = 2, vf = 0.316, style = 'smooth-pan', hints = null, speech = null, cutTimes = [] } = {}) {
  let xs = pickSubjects(dets, { fps, hints, speech, cutTimes });
  const cutAt = {}; for (const tc of cutTimes) { const ic = Math.ceil(tc * fps - 1e-6); if (cutAt[ic] == null) cutAt[ic] = tc; } const cutSet = xs.cuts || new Set();
  if (xs.every(x => x == null)) return null;
  const first = xs.find(x => x != null);
  let last = first; xs = xs.map(x => (x == null ? last : (last = x)));       // missing detections: keep the last known position
  xs = xs.map((x, i) => { if (cutSet.has(i) || cutSet.has(i + 1)) return x; const a = xs[Math.max(0, i - 1)], b = xs[Math.min(xs.length - 1, i + 1)]; return Math.abs(a - b) > 0.15 ? x : median([a, x, b]); });
  const lo = vf / 2, hi = 1 - vf / 2, clamp = c => Math.max(lo, Math.min(hi, c));
  const lim = vf * 0.3, maxStep = vf * 0.45 / fps * 2;
  let cur = clamp(xs[0]), pending = 0;
  const S = [{ t: 0, c: cur, hard: null }];                                   // samples; hard = 'cut' (camera cut) | 'jump' (speaker change)
  for (let i = 1; i < xs.length; i++) {
    const t = i / fps, target = clamp(xs[i]), jump = Math.abs(xs[i] - xs[i - 1]);
    if (jump > 0.2 || cutSet.has(i)) { cur = target; pending = 0; S.push({ t: (cutAt[i] != null && cutAt[i] > S[S.length - 1].t + 0.05) ? cutAt[i] : t, c: cur, hard: 'cut' }); continue; }
    let hard = null;
    if (style === 'smart-cut') {
      if (Math.abs(target - cur) > vf * 0.3) { if (++pending >= 2) { cur = target; pending = 0; hard = 'jump'; } } else pending = 0;
    } else {
      const diff = target - cur, dead = vf * 0.08;
      if (Math.abs(diff) > dead) cur += Math.sign(diff) * Math.min(Math.abs(diff) * 0.45, maxStep * (1 + Math.min(1.5, Math.abs(diff) / vf * 0.7)));   // far-away speaker: pan faster
    }
    cur = clamp(Math.max(xs[i] - lim, Math.min(xs[i] + lim, cur)));            // the face never leaves the central 60% of the window
    S.push({ t, c: cur, hard });
  }
  if (style !== 'smart-cut') {                                                 // ease: smooth inside each shot (never across a camera cut)
    const W = [1, 2, 3, 2, 1]; let seg = 0; const id = S.map(p => (p.hard === 'cut' ? ++seg : seg));
    const sm = S.map((p, i) => { let a = 0, w = 0; for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < S.length && id[j] === id[i]) { a += S[j].c * W[k + 2]; w += W[k + 2]; } } return a / w; });
    S.forEach((p, i) => { p.c = clamp(Math.max(xs[i] - lim, Math.min(xs[i] + lim, sm[i]))); });
  }
  const kf = [];
  S.forEach((p, i) => {
    if (i === 0) { kf.push({ t: 0, c: p.c }); return; }
    if (p.hard) kf.push({ t: Math.max(0, p.t - 0.04), c: kf[kf.length - 1].c, cut: p.hard === 'cut', hold: true });
    kf.push({ t: p.t, c: p.c, cut: p.hard === 'cut' });
  });
  // run early (anticipation), but camera cuts in the picture stay exactly where they are
  let lastCut = -1;
  for (const k of kf) {
    if (k.cut) { lastCut = k.t; continue; }
    k.t = Math.max(k.t - LEAD, lastCut >= 0 ? lastCut + 0.05 : 0);
  }
  kf.sort((a, b) => a.t - b.t);
  const out = kf.filter((k, i) => i === 0 || k.t - kf[i - 1].t > 0.001);
  return out.filter((k, i) => i === 0 || i === out.length - 1 || Math.abs(k.c - out[i - 1].c) > 0.0015 || Math.abs(k.c - out[i + 1].c) > 0.0015);
}

// Piecewise-linear ffmpeg expression for C(t)
function centerExpr(kf) {
  const f = n => n.toFixed(4);
  let e = f(kf[kf.length - 1].c);
  for (let i = kf.length - 2; i >= 0; i--) {
    const a = kf[i], b = kf[i + 1], dt = Math.max(0.001, b.t - a.t);
    e = `if(lt(t,${f(b.t)}),${f(a.c)}+(${f(b.c - a.c)})*(t-${f(a.t)})/${f(dt)},${e})`;
  }
  return e;
}
module.exports = { buildPath, centerExpr, pickSubjects };
