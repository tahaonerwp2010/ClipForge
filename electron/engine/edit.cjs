// Edit a finished clip later: only captions + hook (template, size, position, font, colour) change.
// The pipeline saves a small state file next to the clips; this module re-renders ONE clip from it (no transcription, no AI).
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('./paths.cjs');
const R = require('./render.cjs');
const ASS = require('./ass.cjs');
const EMOJI = require('./emoji.cjs');
const FX = require('./fx.cjs');
const BH = require('./behind.cjs');

const stateFile = (outDir) => path.join(outDir, '.clipforge-edit.json');
function saveState(outDir, st) {
  try {
    const b = { ...(st.branding || {}) };
    if (b.watermarkImage) b.watermarkImage = { ...b.watermarkImage, dataUrl: undefined };
    fs.writeFileSync(stateFile(outDir), JSON.stringify({ ...st, branding: b, savedAt: Date.now() }));
  } catch {}
}
function loadState(outDir) { try { return JSON.parse(fs.readFileSync(stateFile(outDir), 'utf8')); } catch { return null; } }
const nn = i => String(i + 1).padStart(2, '0');
const editDir = (outDir) => { const d = path.join(outDir, '.edit'); fs.mkdirSync(d, { recursive: true }); return d; };

// Everything renderClip needs for clip i (same rules as the main pipeline), with the user's caption/hook changes applied.
async function ctxFor(st, i, ov = {}, work, extra = {}) {
  const shorts = st.kind === 'shorts';
  const captions = { ...(st.captions || {}), ...(ov.captions || {}) };
  const hookText0 = ov.hookText != null ? ov.hookText : (st.clips[i].hookText || st.clips[i].title);
  const ovb = ov.branding || {};
  const branding = { ...(st.branding || {}), ...ovb, autoTitle: { ...((st.branding || {}).autoTitle || {}), ...(ovb.autoTitle || {}), ...(ov.autoTitle || {}), title: hookText0 } };
  const quality = +st.quality || 1080;
  const [Wd, Ht] = R.dimsFor(st.ratio || '9:16', quality);
  const c = st.clips[i];
  const start = shorts ? 0 : c.start, end = shorts ? st.infos[i].duration : c.end, dur = end - start;
  const cw = shorts ? st.capWords[i] : st.capWords, ow = shorts ? st.words[i] : st.words;
  const hookText = ov.hookText != null ? ov.hookText : (c.hookText || c.title);
  const k = Wd / 1080, capPx = (captions.fontSize || 24) * 3.4 * k, eSize = Math.round(capPx * 1.5);
  const emojiBox = { size: eSize, x: Math.round((captions.positionX ?? 50) / 100 * Wd - eSize / 2), y: Math.max(0, Math.round((captions.positionY ?? 72) / 100 * Ht - capPx * 0.65 - eSize)) };
  const useEmoji = captions.enabled && captions.showEmoji && captions.style === 'capcut-emoji';
  const assArgs = { words: cw, clipStart: start, clipEnd: end, W: Wd, H: Ht, captions, branding, title: hookText, hookText };
  let behind = null;
  if (extra.outDir && extra.deps && (extra.deps.segment || extra.deps.detectFaces) && BH.wants(captions)) {
    const info0 = shorts ? st.infos[i] : st.info;
    behind = await BH.masks({ R, segment: extra.deps.segment, detectFaces: extra.deps.detectFaces, cacheDir: path.join(editDir(extra.outDir), `mask_${nn(i)}`), workDir: path.join(os.tmpdir(), `cf_bh_${process.pid}_${i}`), input: shorts ? st.files[i] : st.input, start, end, ratio: st.ratio || '9:16',
      framing: st.framing, grading: st.grading, track: (st.tracks || [])[i] || null, srcAspect: info0.width / info0.height, split: st.split || undefined, log: extra.log });
  }
  assArgs.behindBox = behind && behind.box; assArgs.keywords = ((shorts ? st.clips : st.clips) || [])[i] && ((st.clips || [])[i].keywords);
  const ass = ASS.build({ ...assArgs, part: behind ? 'front' : 'all' }), assBehind = behind ? ASS.build({ ...assArgs, part: 'behind' }) : '';
  const emojis = [...(useEmoji ? EMOJI.plan(ow, start, end, emojiBox).map(e => ({ ...e, x: Math.max(0, Math.min(Wd - emojiBox.size, e.x)) })) : []),
    ...ASS.titleEmojis({ title: hookText, branding, W: Wd, H: Ht, dur: dur })];
  let watermark = null;
  if (branding.showWatermark && branding.watermarkType === 'image' && branding.watermarkImage && branding.watermarkImage.path && fs.existsSync(branding.watermarkImage.path)) {
    watermark = { file: branding.watermarkImage.path, sizePct: branding.watermarkImageSize ?? 20, opacity: branding.watermarkOpacity ?? 100, x: branding.watermarkPositionX ?? 20, y: branding.watermarkPositionY ?? 92 };
  }
  let music = null; const bm = branding.bgMusic;
  if (bm && bm.path && fs.existsSync(bm.path)) {
    let d = bm.duration || 0; if (!d) { try { d = (await R.probe(bm.path)).duration || 0; } catch {} }
    music = { file: bm.path, startSec: bm.startSec || 0, volumeDb: bm.volumeDb ?? -18, duration: d, fade: bm.fade !== false };
  }
  const info = shorts ? st.infos[i] : st.info;
  return { captions, branding, quality, Wd, Ht, start, end, ass, assBehind, behind, emojis, emojiBox, watermark, music, info, cw, fontFamilies: ASS.fontsUsed({ captions, branding }), input: shorts ? st.files[i] : st.input };
}

// A clean copy of the clip (framing, face tracking and grading applied, but NO captions / hook / emoji) at a small size. Used for the live preview.
async function prepare(outDir, i) {
  const st = loadState(outDir); if (!st) throw new Error('This project was made with an older version, so its clips cannot be edited. Generate it again to enable editing.');
  const f = path.join(editDir(outDir), `base_${nn(i)}.mp4`);
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return { base: f, dims: R.dimsFor(st.ratio || '9:16', 540) };
  const x = await ctxFor(st, i, { captions: { enabled: false } }, null);
  const tmp = f + '.part.mp4';
  const w = path.join(os.tmpdir(), `cf_editprev_${process.pid}_${i}`);
  await R.renderClip({ quality: 540, input: x.input, start: x.start, end: x.end, out: tmp, assText: '', ratio: st.ratio || '9:16', framing: st.framing, grading: { ...(st.grading || {}), fx: undefined },
    workDir: w, track: (st.tracks || [])[i] || null, emojis: [], emojiBox: x.emojiBox, srcAspect: x.info.width / x.info.height, hasAudio: x.info.hasAudio !== false, fontFamilies: [], split: st.split || undefined, fps: Math.round(x.info.fps || 30) || 30 });
  fs.renameSync(tmp, f);
  try { fs.rmSync(w, { recursive: true, force: true }); } catch {}
  return { base: f, dims: R.dimsFor(st.ratio || '9:16', 540) };
}

// Re-render clip i with the user's caption / hook changes and replace the old file. The new settings are remembered.
async function rerender(outDir, i, ov, onProgress, deps) {
  const st = loadState(outDir); if (!st) throw new Error('This project was made with an older version, so its clips cannot be edited.');
  const x = await ctxFor(st, i, ov, null, { outDir, deps, log: m => { try { onProgress && onProgress(0); } catch {} } });
  const out = path.join(outDir, `clip_${nn(i)}.mp4`), tmp = path.join(outDir, `clip_${nn(i)}.edit.mp4`);
  const w = path.join(os.tmpdir(), `cf_edit_${process.pid}_${i}`);
  if (ov.fx) st.grading = { ...(st.grading || {}), fx: { ...((st.grading || {}).fx || {}), ...ov.fx } };
  let fx; const o = st.grading && st.grading.fx;
  if (o && o.enabled) { try { fx = FX.plan(x.cw, x.start, x.end, o, i + 1); } catch {} }
  await R.renderClip({ behind: x.behind, assBehind: x.assBehind, quality: x.quality, fx, input: x.input, start: x.start, end: x.end, out: tmp, assText: x.ass, ratio: st.ratio || '9:16', framing: st.framing, grading: st.grading,
    workDir: w, track: (st.tracks || [])[i] || null, emojis: x.emojis, emojiBox: x.emojiBox, srcAspect: x.info.width / x.info.height, hasAudio: x.info.hasAudio !== false, fontFamilies: x.fontFamilies,
    watermark: x.watermark, music: x.music, split: st.split || undefined, fps: Math.round(x.info.fps || 30) || 30, onProgress });
  try { fs.unlinkSync(out); } catch {}
  fs.renameSync(tmp, out);
  let thumb; try { thumb = await R.thumbnail(out, path.join(w, 't.jpg')); } catch {}
  try { fs.rmSync(w, { recursive: true, force: true }); } catch {}
  // remember the edit so the next editor session starts from it
  st.captions = x.captions; st.branding = { ...x.branding, autoTitle: { ...x.branding.autoTitle, title: '' } };
  if (ov.hookText != null) st.clips[i].hookText = ov.hookText;
  saveState(outDir, st);
  return { outputPath: out, thumbnailUrl: thumb };
}
module.exports = { saveState, loadState, prepare, rerender };
