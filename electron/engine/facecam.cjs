// Finds a streamer-style facecam (a small, fixed rectangle with a face in it) inside a gameplay recording.
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const R = require('./render.cjs');
const { run } = require('./proc.cjs');

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// dets: per-frame {faces:[{cx,cy,w,h,score}]} (all 0..1). Returns the stable small face cluster or null.
function stableFace(dets) {
  const pts = [];
  dets.forEach((d, i) => (d.faces || []).forEach(f => { if ((f.score ?? 1) >= 0.4) pts.push({ ...f, i }); }));
  const clusters = [];
  for (const p of pts) {
    let c = clusters.find(c => Math.hypot(c.cx - p.cx, c.cy - p.cy) < 0.08);
    if (!c) { c = { cx: p.cx, cy: p.cy, items: [] }; clusters.push(c); }
    c.items.push(p); c.cx = c.items.reduce((a, b) => a + b.cx, 0) / c.items.length; c.cy = c.items.reduce((a, b) => a + b.cy, 0) / c.items.length;
  }
  let best = null;
  for (const c of clusters) {
    const frames = new Set(c.items.map(x => x.i)).size;
    const w = median(c.items.map(x => x.w)), h = median(c.items.map(x => x.h));
    if (frames < Math.max(3, Math.ceil(dets.length * 0.3))) continue;        // must be there most of the time
    if (w > 0.32 || w < 0.015) continue;                                    // a face filling the screen is the main video, not a facecam
    if (!best || frames > best.frames) best = { cx: median(c.items.map(x => x.cx)), cy: median(c.items.map(x => x.cy)), w, h, frames };
  }
  return best;
}

// First guess of the facecam rectangle from the face box (4:3 around the face), snapped flush to nearby frame edges.
function guessRect(face, aspect) {
  let rw = clamp(face.w * 2.6, 0.08, 0.6);
  let rh = rw * aspect * 0.75;                                              // 4:3 in pixels
  if (rh > 0.9) { rh = 0.9; rw = rh / (aspect * 0.75); }
  let x = face.cx - rw / 2, y = face.cy - rh * 0.46;
  x = clamp(x, 0, 1 - rw); y = clamp(y, 0, 1 - rh);
  const SN = 0.05;
  if (x < SN) x = 0; if (y < SN) y = 0; if (1 - (x + rw) < SN) x = 1 - rw; if (1 - (y + rh) < SN) y = 1 - rh;
  return { x, y, w: rw, h: rh };
}

// Snap each side to the strongest steady edge nearby (the facecam border does not move, the game does).
function refine(rect, gray) {
  const { w: GW, h: GH, frames } = gray;
  if (!frames || frames.length < 3) return rect;
  const gx = (x) => Math.round(x * GW), gy = (y) => Math.round(y * GH);
  const x0 = gx(rect.x), x1 = gx(rect.x + rect.w), y0 = gy(rect.y), y1 = gy(rect.y + rect.h);
  const colScore = (x, ya, yb) => median(frames.map(fr => { let s = 0, n = 0; for (let y = ya; y < yb; y++) { s += Math.abs(fr[y * GW + Math.min(GW - 1, x + 1)] - fr[y * GW + Math.max(0, x - 1)]); n++; } return n ? s / n : 0; }));
  const rowScore = (y, xa, xb) => median(frames.map(fr => { let s = 0, n = 0; for (let x = xa; x < xb; x++) { s += Math.abs(fr[Math.min(GH - 1, y + 1) * GW + x] - fr[Math.max(0, y - 1) * GW + x]); n++; } return n ? s / n : 0; }));
  const OUT = Math.round(GW * 0.05), IN = Math.round(GW * 0.05), OUTH = Math.round(GH * 0.05), INH = Math.round(GH * 0.05);   // small corrections only
  const ya = y0 + Math.round((y1 - y0) * 0.15), yb = y1 - Math.round((y1 - y0) * 0.15);
  const xa = x0 + Math.round((x1 - x0) * 0.15), xb = x1 - Math.round((x1 - x0) * 0.15);
  // outer = -1 means the outside is towards smaller values (left/top edge), +1 towards bigger (right/bottom)
  const pick = (cur, outer, outReach, inReach, max, fn) => {
    const lo = Math.max(1, cur - (outer < 0 ? outReach : inReach)), hi = Math.min(max - 2, cur + (outer < 0 ? inReach : outReach));
    const sc = []; let bestS = 0;
    for (let v = lo; v <= hi; v++) { const q = fn(v); sc.push([v, q]); if (q > bestS) bestS = q; }
    const med = median(sc.map(x => x[1]));
    if (!(bestS > 10 && bestS > med * 2.2)) return cur;                      // only trust a clearly sharper, steady edge
    const strong = sc.filter(x => x[1] >= bestS * 0.6);
    return strong.reduce((a, b) => Math.abs(b[0] - cur) < Math.abs(a[0] - cur) ? b : a)[0];   // the strong edge nearest to the guess
  };
  let nx0 = x0, nx1 = x1, ny0 = y0, ny1 = y1;
  if (rect.x > 0.01) nx0 = pick(x0, -1, OUT, IN, GW, v => colScore(v, ya, yb));
  if (rect.x + rect.w < 0.99) nx1 = pick(x1, 1, OUT, IN, GW, v => colScore(v, ya, yb));
  if (rect.y > 0.01) ny0 = pick(y0, -1, OUTH, INH, GH, v => rowScore(v, xa, xb));
  if (rect.y + rect.h < 0.99) ny1 = pick(y1, 1, OUTH, INH, GH, v => rowScore(v, xa, xb));
  if (nx1 - nx0 < GW * 0.06 || ny1 - ny0 < GH * 0.06) return rect;
  return { x: nx0 / GW, y: ny0 / GH, w: (nx1 - nx0) / GW, h: (ny1 - ny0) / GH };
}

function locate(dets, gray, aspect) {
  const face = stableFace(dets);
  if (!face) return { found: false };
  let rect = guessRect(face, aspect);
  try { if (gray) rect = refine(rect, gray); } catch {}
  rect = { x: clamp(rect.x, 0, 0.95), y: clamp(rect.y, 0, 0.95), w: 0, h: 0, ...{ w: clamp(rect.w, 0.06, 1 - clamp(rect.x, 0, 0.95)), h: clamp(rect.h, 0.06, 1 - clamp(rect.y, 0, 0.95)) } };
  return { found: true, rect, face, hits: face.frames, total: dets.length };
}

// Samples N frames over the video for the face detector + small grey frames for edge refinement.
async function sample(file, dur, work, n = 12) {
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
  const fps = n / Math.max(1, dur);
  const frames = await R.extractFrames(file, 0, dur, path.join(work, 'f'), fps);
  const GW = 320;
  const info = await R.probe(file);
  const GH = Math.round(GW * info.height / info.width / 2) * 2;
  const raw = path.join(work, 'g.raw');
  await run(P.binOrPath('ffmpeg'), ['-y', '-i', path.resolve(file), '-vf', `fps=${fps},scale=${GW}:${GH},format=gray`, '-f', 'rawvideo', raw]);
  const buf = fs.readFileSync(raw), sz = GW * GH, gf = [];
  for (let i = 0; i + sz <= buf.length; i += sz) gf.push(buf.subarray(i, i + sz));
  return { frames, gray: { w: GW, h: GH, frames: gf }, info };
}
module.exports = { locate, sample, stableFace, guessRect, refine };
