// "Behind the person" captions: the big word is drawn between the background and the speaker.
// 1) a small copy of the clip (same framing, no captions) is cut into frames, 2) the person is cut out of every frame
// (MediaPipe selfie segmentation, offline, runs in the hidden browser window), 3) the final render draws
//    background -> big word -> person cut-out -> normal captions.
const fs = require('fs');
const path = require('path');
const DYN = require('./dyn.cjs');
const MFPS = 10;
const wants = (captions) => !!(captions && captions.enabled && (DYN.get(captions.style) || {}).behind);

// masks cached in <outDir>/.edit/mask_NN so editing a clip later does not repeat the work (they only depend on framing)
async function masks({ R, segment, cacheDir, workDir, input, start, end, ratio, framing, grading, track, srcAspect, split, fps, log = () => {} }) {
  if (!segment) return null;
  const dur = end - start;
  if (cacheDir) {
    try { const m = JSON.parse(fs.readFileSync(path.join(cacheDir, 'mask.json'), 'utf8')); if (m.ok && m.key === `${dur.toFixed(2)}|${ratio}` && fs.existsSync(path.join(cacheDir, 'm_0001.png'))) return { dir: cacheDir, fps: m.fps }; } catch {}
  }
  try {
    fs.mkdirSync(workDir, { recursive: true });
    const base = path.join(workDir, 'bh_base.mp4');
    log('Cutting the person out for the behind-the-person captions…');
    await R.renderClip({ quality: 480, input, start, end, out: base, assText: '', ratio, framing, grading: { ...(grading || {}), fx: undefined }, workDir: path.join(workDir, 'bh_w'), track, emojis: [], srcAspect, hasAudio: false, fontFamilies: [], split: split || undefined, fps: 25 });
    const frames = await R.extractFrames(base, 0, dur, path.join(workDir, 'bh_f'), MFPS);
    if (!frames.length) return null;
    const out = [];
    for (let i = 0; i < frames.length; i += 60) { const part = await segment(frames.slice(i, i + 60)); if (!Array.isArray(part)) return null; out.push(...part); }
    const good = out.filter(Boolean).length;
    if (good < out.length * 0.5) return null;
    const dir = cacheDir || path.join(workDir, 'bh_m');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    let prev = null;
    out.forEach((u, i) => { const b = u ? Buffer.from(u.split(',')[1], 'base64') : prev; if (!b) return; prev = b; fs.writeFileSync(path.join(dir, `m_${String(i + 1).padStart(4, '0')}.png`), b); });
    fs.writeFileSync(path.join(dir, 'mask.json'), JSON.stringify({ ok: true, fps: MFPS, key: `${dur.toFixed(2)}|${ratio}` }));
    try { fs.rmSync(path.join(workDir, 'bh_f'), { recursive: true, force: true }); fs.rmSync(base, { force: true }); } catch {}
    return { dir, fps: MFPS };
  } catch (e) { log(`Person cut-out unavailable (${String(e.message).slice(0, 80)}); the big word is drawn in front instead`); return null; }
}
module.exports = { wants, masks, MFPS };
