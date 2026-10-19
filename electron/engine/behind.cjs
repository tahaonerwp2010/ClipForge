// "Behind the person" captions: the big word is drawn between the background and the speaker.
// 1) a small copy of the clip (same framing, no captions) is cut into frames, 2) the person is cut out of every frame
// (MediaPipe selfie segmentation, offline, runs in the hidden browser window), 3) the final render draws
//    background -> big word -> person cut-out -> normal captions.
const fs = require('fs');
const path = require('path');
const DYN = require('./dyn.cjs');
const MFPS = 10;
const wants = (captions) => !!(captions && captions.enabled && (DYN.get(captions.style) || {}).behind);


async function segmentAll(segment, frames) {
  const out = [], tops = [], bots = [];
  for (let i = 0; i < frames.length; i += 60) {
    const r = await segment(frames.slice(i, i + 60)); const part = Array.isArray(r) ? r : r && r.m;
    if (!Array.isArray(part)) throw new Error('segmentation returned nothing');
    out.push(...part); if (r && r.top != null) { tops.push(r.top); bots.push(r.bottom); }
  }
  const med = a => a.length ? a.sort((x, y) => x - y)[a.length >> 1] : null;
  return { out, box: tops.length ? { top: med(tops), bottom: med(bots) } : null };
}
// ---- fallback: head + shoulders shape built from the face detector (no AI model needed) ----
const zlib = require('zlib');
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function greyPng(w, h, px) {
  const raw = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; px.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function shapeMask(faces, w, h) {
  const px = Buffer.alloc(w * h);
  for (const f of faces) {
    const cx = f.cx * w, cy = f.cy * h, fw = f.w * w, fh = f.h * h;
    const rx = fw * 0.62, ry = fh * 0.78, shY = cy + fh * 0.55;
    for (let y = Math.max(0, Math.floor(cy - ry)); y < h; y++) for (let x = 0; x < w; x++) {
      let on = ((x - cx) / rx) ** 2 + ((y - (cy - fh * 0.05)) / ry) ** 2 <= 1;
      if (!on && y >= shY) { const t = Math.min(1, (y - shY) / (fh * 1.4)), half = fw * (0.55 + 1.15 * Math.min(1, t * 1.6)); if (Math.abs(x - cx) <= half) on = true; }   // neck + shoulders widen downwards
      if (on) px[y * w + x] = 255;
    }
  }
  return px;
}
async function faceMasks(detectFaces, frames, ratio) {
  const ar = (() => { const m = String(ratio || '9:16').split(':').map(Number); return m[0] && m[1] ? m[0] / m[1] : 9 / 16; })();
  const w = 180, h = Math.max(2, Math.round(w / ar));
  const dets = await detectFaces(frames), out = [], tops = [], bots = []; let last = null;
  for (let i = 0; i < frames.length; i++) {
    const fs_ = ((dets[i] && dets[i].faces) || []).filter(f => f.score > 0.4).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 2);
    const f = fs_.length ? fs_ : last; if (fs_.length) last = fs_;
    if (!f) { out.push(null); continue; }
    out.push(greyPng(w, h, shapeMask(f, w, h)));
    tops.push(Math.max(0, f[0].cy - f[0].h * 0.8)); bots.push(1);
  }
  const med = a => a.length ? a.sort((x, y) => x - y)[a.length >> 1] : null;
  return { out, box: tops.length ? { top: med(tops), bottom: 1 } : null };
}

// masks cached in <outDir>/.edit/mask_NN so editing a clip later does not repeat the work (they only depend on framing)
async function masks({ R, segment, detectFaces, cacheDir, workDir, input, start, end, ratio, framing, grading, track, srcAspect, split, fps, log = () => {} }) {
  if (!segment && !detectFaces) return null;
  const dur = end - start;
  if (cacheDir) {
    try { const m = JSON.parse(fs.readFileSync(path.join(cacheDir, 'mask.json'), 'utf8')); if (m.ok && m.key === `${dur.toFixed(2)}|${ratio}` && fs.existsSync(path.join(cacheDir, 'm_0001.png'))) return { dir: cacheDir, fps: m.fps, box: m.box || null }; } catch {}
  }
  try {
    fs.mkdirSync(workDir, { recursive: true });
    const base = path.join(workDir, 'bh_base.mp4');
    log('Cutting the person out for the behind-the-person captions…');
    await R.renderClip({ quality: 480, input, start, end, out: base, assText: '', ratio, framing, grading: { ...(grading || {}), fx: undefined }, workDir: path.join(workDir, 'bh_w'), track, emojis: [], srcAspect, hasAudio: false, fontFamilies: [], split: split || undefined, fps: 25 });
    const frames = await R.extractFrames(base, 0, dur, path.join(workDir, 'bh_f'), MFPS);
    if (!frames.length) throw new Error('no frames');
    let out = [], box = null, how = 'segmentation';
    try {
      if (!segment) throw new Error('segmentation not available');
      const r = await segmentAll(segment, frames);
      out = r.out; box = r.box;
      if (out.filter(Boolean).length < out.length * 0.5) throw new Error('no person found in most frames');
    } catch (e) {
      if (!detectFaces) throw e;
      log(`Person cut-out (AI) failed: ${String(e.message).slice(0, 80)}. Using the face-based cut-out instead`);
      const r = await faceMasks(detectFaces, frames, ratio); out = r.out; box = r.box; how = 'face shape';
      if (!out.some(Boolean)) throw new Error('no face found');
    }
    const dir = cacheDir || path.join(workDir, 'bh_m');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    let prev = null;
    out.forEach((u, i) => { const b = u ? (Buffer.isBuffer(u) ? u : Buffer.from(u.split(',')[1], 'base64')) : prev; if (!b) return; prev = b; fs.writeFileSync(path.join(dir, `m_${String(i + 1).padStart(4, '0')}.png`), b); });
    fs.writeFileSync(path.join(dir, 'mask.json'), JSON.stringify({ ok: true, fps: MFPS, key: `${dur.toFixed(2)}|${ratio}`, box }));
    try { fs.rmSync(path.join(workDir, 'bh_f'), { recursive: true, force: true }); fs.rmSync(base, { force: true }); } catch {}
    log(`Person cut-out ready (${how})`);
    return { dir, fps: MFPS, box };
  } catch (e) { log(`Person cut-out unavailable (${String(e.message).slice(0, 80)}); the big word is drawn in front instead`); return null; }
}
module.exports = { wants, masks, MFPS };
