// FFmpeg: probe, audio extract, encoder detect, clip render (reframe + grade + captions).
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const { run } = require('./proc.cjs');
const FONTS = require('./fonts.cjs');

const ASPECT = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '4:3': [1080, 810], '16:9': [1920, 1080] };
const ffmpeg = () => P.binOrPath('ffmpeg');
const ffprobe = () => P.binOrPath('ffprobe');

async function probe(file) {
  const { stdout } = await run(ffprobe(), ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(stdout);
  const v = j.streams.find(s => s.codec_type === 'video'), a = j.streams.find(s => s.codec_type === 'audio');
  const [n, d] = (v?.r_frame_rate || '0/1').split('/').map(Number);
  return { duration: +j.format.duration, width: v?.width, height: v?.height, fps: d ? +(n / d).toFixed(2) : 0, vcodec: v?.codec_name, acodec: a?.codec_name, hasAudio: !!a };
}
const extractAudio = (video, wav) => run(ffmpeg(), ['-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
const sliceAudio = (wav, start, dur, out) => run(ffmpeg(), ['-y', '-ss', String(start), '-t', String(dur), '-i', wav, '-c:a', 'pcm_s16le', out]);

let _enc;
async function encoderArgs() {
  if (!_enc) {
    let list = '';
    try { list = (await run(ffmpeg(), ['-hide_banner', '-encoders'])).stdout; } catch {}
    _enc = /libx264\s/.test(list) ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23']
         : /libopenh264/.test(list) ? ['-c:v', 'libopenh264', '-b:v', '6M']
         : ['-c:v', 'h264'];
  }
  return [..._enc, '-pix_fmt', 'yuv420p'];
}

// Rounded-corner alpha mask as a tiny binary PGM (pure JS, no extra tools needed)
function writeMask(file, w, h, r) {
  const buf = Buffer.alloc(w * h, 255);
  for (let y = 0; y < Math.min(r, h); y++) for (let x = 0; x < Math.min(r, w); x++) {
    const d = Math.hypot(r - x - 0.5, r - y - 0.5);
    const a = Math.max(0, Math.min(1, r - d + 0.5)), v = Math.round(a * 255);
    buf[y * w + x] = v; buf[y * w + (w - 1 - x)] = v; buf[(h - 1 - y) * w + x] = v; buf[(h - 1 - y) * w + (w - 1 - x)] = v;
  }
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), buf]));
}

// Background music: trim from the chosen start, loop if the song is too short, set the dB level, fade, mix under the voice
function musicChain(idx, m, clipLen, src = '0:a') {
  const rate = 44100, start = Math.max(0, m.startSec || 0), avail = Math.max(1, (m.duration || 0) - start);
  const db = Math.max(-60, Math.min(24, m.volumeDb ?? -18));
  const loop = m.duration && avail < clipLen ? `,aloop=loop=-1:size=${Math.min(2e9, Math.round(avail * rate))}` : '';
  const f = m.fade === false ? '' : `,afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0, clipLen - 1.2).toFixed(2)}:d=1.2`;
  const fmt = 'aformat=sample_fmts=fltp:channel_layouts=stereo';
  return `[${src}]aresample=${rate},${fmt}[a0];` +
    `[${idx}:a]aresample=${rate},atrim=start=${start.toFixed(2)},asetpts=PTS-STARTPTS${loop},atrim=duration=${clipLen.toFixed(2)},asetpts=PTS-STARTPTS,volume=${db}dB${f},${fmt}[a1];` +
    `[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.97[aout]`;
}


// ---------------- Split screen: top/bottom sections (facecam + game / second video / background footage) ----------------
const ev2 = n => Math.max(2, Math.round(n / 2) * 2);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function splitSizes(split, W, H) {
  const k = W / 1080;
  const gap = split.gap > 0 ? ev2((split.gap || 0) * k) : 0;
  const topH = ev2(H * clampN(split.splitPct ?? 40, 20, 80) / 100);
  return { gap, topH, botH: H - topH - gap, k };
}
// One section: crop the source (optional rectangle), scale to cover the section, apply the user's zoom/pan, or "fit" with a blurred backdrop.
function sectionChain({ label, dims, rect, w, h, z = 1, px = 0, py = 0, fit = false, out, pre = '' }) {
  const [sw, sh] = dims;
  if (fit) {
    return `${label}${pre}split[fa${out}][fb${out}];[fa${out}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=18:2,eq=brightness=-0.15[fg${out}];` +
      `[fb${out}]scale=${w}:${h}:force_original_aspect_ratio=decrease[ff${out}];[fg${out}][ff${out}]overlay=(W-w)/2:(H-h)/2[${out}]`;
  }
  let r = { x: 0, y: 0, w: sw, h: sh };
  if (rect) {
    r = { x: Math.round(clampN(rect.x, 0, 1) * sw), y: Math.round(clampN(rect.y, 0, 1) * sh), w: ev2(clampN(rect.w, 0.05, 1) * sw), h: ev2(clampN(rect.h, 0.05, 1) * sh) };
    r.w = Math.min(r.w, sw - r.x); r.h = Math.min(r.h, sh - r.y);
    if (r.w < 16 || r.h < 16) r = { x: 0, y: 0, w: sw, h: sh };
  }
  const full = r.w === sw && r.h === sh;
  const sc = Math.max(w / r.w, h / r.h) * Math.max(1, z);
  const cw = Math.max(w, Math.ceil(r.w * sc)), ch = Math.max(h, Math.ceil(r.h * sc));
  const x = Math.round(clampN((cw - w) / 2 * (1 + px / 50), 0, cw - w)), y = Math.round(clampN((ch - h) / 2 * (1 + py / 50), 0, ch - h));
  return `${label}${pre}${full ? '' : `crop=${r.w}:${r.h}:${r.x}:${r.y},`}scale=${cw}:${ch},crop=${w}:${h}:${x}:${y}[${out}]`;
}
function splitBase({ W, H, split, secIdx, fcMaskIdx, fps, dur, lead = 0 }) {
  const { gap, topH, botH } = splitSizes(split, W, H);
  const mainD = split.mainDims || [1920, 1080], secD = split.secondDims || mainD;
  const mode = split.mode || 'single';
  const parts = [];
  const faceFirst = !split.swap;                                   // facecam on top unless swapped
  const faceBox = faceFirst ? { h: topH, ui: split.top || {} } : { h: botH, ui: split.bottom || {} };
  const gameBox = faceFirst ? { h: botH, ui: split.bottom || {} } : { h: topH, ui: split.top || {} };
  let faceLabel = '[0:v]', gameLabel;
  let faceRect = null, gameRect = null;
  if (mode === 'single') {
    parts.push('[0:v]split=2[m0][m1]'); faceLabel = '[m0]'; gameLabel = '[m1]'; faceRect = split.facecam || null;
  } else gameLabel = `[${secIdx}:v]`;
  const pre2 = mode === 'single' ? '' : `${lead > 0 ? `tpad=start_duration=${lead.toFixed(3)}:start_mode=clone,` : ''}setpts=PTS-STARTPTS,fps=${fps},`;
  const fz = faceBox.ui;
  parts.push(sectionChain({ label: faceLabel, dims: mainD, rect: faceRect, w: W, h: faceBox.h, z: fz.zoom, px: fz.panX, py: fz.panY, out: 'face' }));
  const gz = gameBox.ui;
  parts.push(sectionChain({ label: gameLabel, dims: mode === 'single' ? mainD : secD, rect: gameRect, w: W, h: gameBox.h, z: gz.zoom, px: gz.panX, py: gz.panY, fit: split.gameFit === 'fit', out: 'game', pre: pre2 }));
  let faceOut = 'face';
  if (fcMaskIdx != null) { parts.push(`[face]format=yuva420p[face0];[${fcMaskIdx}:v]format=gray[fcm];[face0][fcm]alphamerge[facer]`); faceOut = 'facer'; }
  const topL = faceFirst ? faceOut : 'game', botL = faceFirst ? 'game' : faceOut;
  const col = String(split.gapColor || '#000000').replace('#', '0x');
  parts.push(`color=c=${col}:s=${W}x${H}:r=${fps}:d=${dur.toFixed(3)}[cv]`);
  parts.push(`[cv][${topL}]overlay=0:0:format=auto[t1]`);
  parts.push(`[t1][${botL}]overlay=0:${topH + gap}:format=auto[v0]`);
  return parts.join(';');
}

function layoutInfo(f, W, H, srcAspect) {
  const ev = n => Math.max(2, Math.round(n / 2) * 2);
  const ar = srcAspect || 16 / 9;
  let fgW, fgH;
  if (f.mode === 'custom-scale') { fgW = ev(W * Math.max(0.3, (f.customScale || 100) / 100)); fgH = ev(fgW / ar); }
  else { fgW = W; fgH = ev(W / ar); if (fgH > H) { fgH = H; fgW = ev(H * ar); } }
  const radius = Math.round(Math.max(0, f.innerBorderRadius || 0) * W / 1080 * 2.6);
  return { fgW, fgH, radius };
}

function filterGraph({ W, H, framing, grading, hasAss, track, emojiGroups = [], emojiBox, srcAspect, maskIdx, watermark, splitArgs }) {
  const f = framing || {}, g = grading || {};
  const mode = f.mode || 'fit-blur';
  let base, note = null;
  if (splitArgs) {
    base = splitBase(splitArgs);
  } else if (mode === 'fill-crop') {
    const pan = Math.max(-50, Math.min(50, f.panX || 0));
    const xExpr = track && track.expr
      ? `max(0,min(iw-${W},(${track.expr})*iw-${W}/2))`                       // AI face tracking path
      : `max(0,min(iw-${W},(iw-${W})/2*(1+${pan}/50)))`;                       // manual pan slider
    base = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:'${xExpr}':'(ih-${H})/2'[v0]`;
  } else {
    if (mode === 'split-screen') note = 'split-screen needs a second video; using fit instead';
    const { fgW, fgH, radius } = layoutInfo({ ...f, mode: mode === 'custom-scale' ? mode : 'fit-blur' }, W, H, srcAspect);
    const black = f.fitBackground === 'black' || mode === 'letterbox';
    const bgFx = black ? 'drawbox=t=fill:c=black'
      : `boxblur=${Math.max(4, f.blurIntensity || 18)}:2,eq=brightness=${-(f.backdropDarken ?? 0.3) * 0.5}`;
    const offX = Math.round(((f.offsetX || 0) / 100) * W), offY = Math.round(((f.offsetY || 0) / 100) * H);
    const tracked = mode === 'custom-scale' && track && track.expr && fgW > W;
    const xo = tracked ? `max(${W}-w,min(0,${W}/2-(${track.expr})*w))+${offX}` : `(W-w)/2+${offX}`;
    const useMask = radius > 0 && maskIdx != null;
    const fgChain = `[b]scale=${fgW}:${fgH}${useMask ? `,format=yuva420p[fg0];[${maskIdx}:v]format=gray[m];[fg0][m]alphamerge[fg]` : '[fg]'}`;
    base = `[0:v]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${bgFx}[bg];` +
           `${fgChain};[bg][fg]overlay=x='${xo}':y='(H-h)/2+${offY}'${tracked ? ':eval=frame' : ''}[v0]`;
  }
  const eq = `eq=brightness=${(((g.brightness ?? 100) - 100) / 200).toFixed(3)}:contrast=${((g.contrast ?? 100) / 100).toFixed(3)}:saturation=${((g.saturation ?? 100) / 100).toFixed(3)}`;
  const w = Math.max(-0.3, Math.min(0.3, (((g.warmth ?? 100) - 100) / 100) * 0.2));
  const post = [eq];
  if (w) post.push(`colorbalance=rs=${w.toFixed(3)}:bs=${(-w).toFixed(3)}`);
  if (g.vignette) post.push('vignette=PI/5');
  if (g.grain) post.push('noise=alls=8:allf=t');
  if (hasAss) post.push('ass=captions.ass:fontsdir=fonts');
  let graph = `${base};[v0]${post.join(',')}[vc]`;
  let last = 'vc';
  emojiGroups.forEach((g, i) => {
    const en = g.windows.map(([a, b]) => `between(t,${a},${b})`).join('+');
    const sz = g.size || emojiBox.size, ex = g.x != null ? g.x : emojiBox.x, ey = g.y != null ? g.y : emojiBox.y;
    graph += `;[${i + 1}:v]scale=${sz}:${sz}[e${i}];[${last}][e${i}]overlay=x=${ex}:y=${ey}:enable='${en}'[o${i}]`;
    last = `o${i}`;
  });
  if (watermark) {
    const w = Math.max(16, Math.round(W * Math.max(3, Math.min(80, watermark.sizePct || 20)) / 100 / 2) * 2);
    const op = Math.max(0.05, Math.min(1, (watermark.opacity ?? 100) / 100));
    const px = Math.round(W * (watermark.x ?? 85) / 100), py = Math.round(H * (watermark.y ?? 90) / 100);
    graph += `;[${watermark.idx}:v]format=rgba,scale=${w}:-2,colorchannelmixer=aa=${op}[wm];[${last}][wm]overlay=x='max(0,min(W-w,${px}-w/2))':y='max(0,min(H-h,${py}-h/2))'[ow]`;
    last = 'ow';
  }
  graph += `;[${last}]null[v]`;
  return { graph, note };
}

async function renderClip({ input, start, end, out, assText, ratio, framing, grading, workDir, hasAudio = true, track, emojis = [], emojiBox, onProgress, srcAspect, fontFamilies = [], watermark, music, split, fps = 30 }) {
  const [W, H] = ASPECT[ratio] || ASPECT['9:16'];
  fs.mkdirSync(workDir, { recursive: true });
  if (assText) fs.writeFileSync(path.join(workDir, 'captions.ass'), assText, 'utf8');
  FONTS.stageFonts(path.join(workDir, 'fonts'), fontFamilies);
  const byPng = new Map();
  for (const e of emojis) {
    const key = `${e.png}|${e.x ?? ''}|${e.y ?? ''}|${e.size ?? ''}`;
    if (!byPng.has(key)) byPng.set(key, { png: e.png, x: e.x, y: e.y, size: e.size, windows: [] });
    byPng.get(key).windows.push([e.start, e.end]);
  }
  const emojiGroups = [...byPng.values()];
  const mode = (framing || {}).mode || 'fit-blur';
  let maskIdx = null, maskArgs = [];
  if (!split && mode !== 'fill-crop' && mode !== 'letterbox') {
    const { fgW, fgH, radius } = layoutInfo({ ...framing, mode: mode === 'custom-scale' ? mode : 'fit-blur' }, W, H, srcAspect);
    if (radius > 0) {
      const mf = path.join(workDir, 'mask.pgm'); writeMask(mf, fgW, fgH, Math.min(radius, Math.floor(Math.min(fgW, fgH) / 2)));
      maskIdx = 1 + emojiGroups.length; maskArgs = ['-loop', '1', '-framerate', '25', '-t', String(end - start), '-i', mf];
    }
  }
  let wmIdx = null;
  if (watermark && watermark.file && fs.existsSync(watermark.file)) {
    wmIdx = (maskIdx != null ? maskIdx : 0) + (maskIdx != null ? 1 : 1 + emojiGroups.length);
    maskArgs.push('-loop', '1', '-framerate', '25', '-t', String(end - start), '-i', watermark.file);
  }
  let musicIdx = null;
  if (music && music.file && fs.existsSync(music.file) && hasAudio) {
    musicIdx = 1 + emojiGroups.length + (maskIdx != null ? 1 : 0) + (wmIdx != null ? 1 : 0);
    maskArgs.push('-i', music.file);
  }
  // ---- split screen extra inputs (second video / background footage, facecam rounding mask) ----
  const dur = end - start;
  let nextIdx = 1 + emojiGroups.length + (maskIdx != null ? 1 : 0) + (wmIdx != null ? 1 : 0) + (musicIdx != null ? 1 : 0);
  let splitArgs = null, splitInputs = [], secIdx = null, secAudio = false, lead = 0;
  if (split) {
    const mode = split.mode || 'single';
    let fcMaskIdx = null;
    if (mode !== 'single' && split.secondPath && fs.existsSync(split.secondPath)) {
      secIdx = nextIdx++;
      if (mode === 'bg') {
        const bd = Math.max(0, (split.secondDuration || 0) - dur - 0.5);
        splitInputs.push('-stream_loop', '-1', '-ss', String(bd > 1 ? +(start % bd).toFixed(2) : 0), '-t', String(dur), '-i', path.resolve(split.secondPath));
      } else {
        const t = start + (split.offset || 0);
        lead = t < 0 ? -t : 0;
        splitInputs.push('-ss', String(Math.max(0, t)), '-t', String(Math.max(0.1, dur - lead)), '-i', path.resolve(split.secondPath));
        secAudio = !!split.secondHasAudio;
      }
    } else if (mode !== 'single') throw new Error('The second video could not be found.');
    if ((split.radius || 0) > 0) {
      const { topH, botH, k } = splitSizes(split, W, H);
      const fh = split.swap ? botH : topH;
      const mf = path.resolve(workDir, 'fcmask.pgm'); writeMask(mf, W, fh, Math.min(Math.round(split.radius * k), Math.floor(Math.min(W, fh) / 2)));
      fcMaskIdx = nextIdx++;
      splitInputs.push('-loop', '1', '-framerate', String(fps), '-t', String(dur), '-i', mf);
    }
    splitArgs = { W, H, split, secIdx, fcMaskIdx, fps, dur, lead };
  }
  const { graph: vGraph, note } = filterGraph({ W, H, framing, grading, hasAss: !!assText, track, emojiGroups, emojiBox, srcAspect, maskIdx, watermark: wmIdx != null ? { ...watermark, idx: wmIdx } : null, splitArgs });
  let graph = vGraph;
  // audio source for split screen: facecam audio (default), game audio, or both
  let aSrc = '0:a', aMap = '0:a:0';
  if (split && hasAudio && secIdx != null && secAudio && (split.audio === 'game' || split.audio === 'mix')) {
    const dl = Math.round(lead * 1000), delay = dl > 0 ? `,adelay=${dl}|${dl}` : '';
    const fm = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
    if (split.audio === 'game') graph += `;[${secIdx}:a]${fm}${delay}[amain]`;
    else graph += `;[0:a]${fm}[x0];[${secIdx}:a]${fm}${delay}[x1];[x0][x1]amix=inputs=2:duration=first:dropout_transition=0,volume=2[amain]`;
    aSrc = 'amain'; aMap = '[amain]';
  }
  if (musicIdx != null) graph += ';' + musicChain(musicIdx, music, end - start, aSrc);
  const args = ['-y', '-ss', String(start), '-t', String(end - start), '-i', path.resolve(input),
    ...emojiGroups.flatMap(g => ['-i', g.png]), ...maskArgs, ...splitInputs,
    '-filter_complex', graph, '-map', '[v]', ...(hasAudio ? ['-map', musicIdx != null ? '[aout]' : aMap, '-c:a', 'aac', '-b:a', '160k'] : []),
    ...(await encoderArgs()), '-movflags', '+faststart', path.resolve(out)];
  const total = end - start;
  await run(ffmpeg(), args, { cwd: workDir, onStderr: s => {
    const m = [...s.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
    if (m && onProgress) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / total));
  } });
  return { note };
}

async function thumbnail(video, jpg) {
  await run(ffmpeg(), ['-y', '-ss', '1', '-i', video, '-frames:v', '1', '-vf', 'scale=360:-2', jpg]);
  return 'data:image/jpeg;base64,' + fs.readFileSync(jpg).toString('base64');
}
// Exact camera-cut times (seconds from clip start) using FFmpeg scene detection on a small copy of the video.
async function detectCuts(input, start, dur, th = 0.32) {
  const { stderr } = await run(ffmpeg(), ['-hide_banner', '-nostats', '-ss', String(start), '-t', String(dur), '-i', path.resolve(input), '-an', '-vf', `fps=15,scale=256:-2,select='gt(scene,${th})',showinfo`, '-f', 'null', '-']);
  const out = []; for (const m of stderr.matchAll(/pts_time:([\d.]+)/g)) out.push(+m[1]);
  return out.filter((t, i) => i === 0 || t - out[i - 1] > 0.4);
}
// Sample frames (low-res) of a clip for face detection. Frame i is at time i/fps from clip start.
async function extractFrames(input, start, dur, outDir, fps = 2) {
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  await run(ffmpeg(), ['-y', '-ss', String(start), '-t', String(dur), '-i', path.resolve(input), '-vf', `fps=${fps},scale=640:-2`, '-q:v', '5', path.join(outDir, 'f_%04d.jpg')]);
  return fs.readdirSync(outDir).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(outDir, f));
}
module.exports = { detectCuts, sliceAudio, extractFrames, probe, extractAudio, renderClip, thumbnail, ASPECT, filterGraph };
