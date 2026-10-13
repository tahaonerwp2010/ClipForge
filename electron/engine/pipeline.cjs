// Orchestrates the 9 UI steps with REAL work. emit({type:'step'|'progress'|'log'}).
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('./paths.cjs');
const R = require('./render.cjs');
const W = require('./whisper.cjs');
const A = require('./analyze.cjs');
const ASS = require('./ass.cjs');
const EMOJI = require('./emoji.cjs');
const RF = require('./reframe.cjs');
const SYNC = require('./sync.cjs');
const SUBJ = require('./subject.cjs');
const TR = require('./translate.cjs');
const { checkCancel } = require('./proc.cjs');
// Each project gets its own folder; a different project with the same name gets _2, _3 ...
function uniqueDir(base, id) {
  for (let i = 1; i < 200; i++) {
    const d = i === 1 ? base : `${base}_${i}`;
    if (!fs.existsSync(d)) return d;
    try { if (JSON.parse(fs.readFileSync(path.join(d, '.clipforge.json'), 'utf8')).projectId === id) return d; } catch {}
  }
  return base;
}
const fmtDur = s => s < 60 ? `${s.toFixed(1)}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m`;
const slug = s => String(s || 'project').replace(/[^\w\-]+/g, '_').slice(0, 50) || 'project';

async function runInner(job, emit, deps = {}) {
  const t0 = Date.now();
  const log = (source, message, kind = 'info') => emit({ type: 'log', source, message, kind });
  if (!fs.existsSync(job.filePath)) throw new Error(`Source file not found: ${job.filePath}`);
  const outDir = job.outDir || uniqueDir(path.join(job.clipsBase || path.join(os.homedir(), 'Videos', 'ClipForge'), slug(job.name)), String(job.id || job.name));
  fs.mkdirSync(outDir, { recursive: true });
  try { fs.writeFileSync(path.join(outDir, '.clipforge.json'), JSON.stringify({ projectId: String(job.id || job.name) })); } catch {}

  // Stable work dir per project => a paused run can resume from its checkpoints.
  const work = path.join(P.workRoot(), `job_${slug(job.id || job.name)}`);
  if (!job.resume) fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const f = n => path.join(work, n);
  const readJson = n => { try { return JSON.parse(fs.readFileSync(f(n), 'utf8')); } catch { return null; } };
  const writeJson = (n, v) => fs.writeFileSync(f(n), JSON.stringify(v));
  const meta = readJson('meta.json') || { steps: {} };
  const saveMeta = () => writeJson('meta.json', meta);

  // ---- progress model: weighted steps, monotonic overall %, ETA ----
  const ratio = job.split ? '9:16' : (job.ratio || '9:16');
  const [Wd, Ht] = R.ASPECT[ratio] || R.ASPECT['9:16'];
  const pct = new Array(9).fill(0);
  let wantTrack = false;                       // set after probe
  const weights = () => [1, 3, 45, (job.captions?.enabled && job.captions.translateTo) ? 3 : 0, (job.captions?.enabled && job.captions.romanScript) ? 3 : 0, 6, 0, wantTrack ? 14 : 1, 30];
  let best = 0, tWork = null, f0 = 0, lastEmit = 0;
  const overall = () => { const w = weights(), sum = w.reduce((a, b) => a + b, 0); return w.reduce((a, x, i) => a + x * pct[i], 0) / sum; };
  const pushProgress = (force) => {
    const now = Date.now();
    if (!force && now - lastEmit < 350) return;
    lastEmit = now;
    best = Math.max(best, overall());
    let etaSec = null;
    if (tWork && best - f0 > 0.02 && now - tWork > 4000) etaSec = Math.max(0, Math.round((now - tWork) / 1000 * (1 - best) / (best - f0)));
    emit({ type: 'progress', percent: Math.min(100, Math.floor(best * 100)), etaSec });
  };
  const setPct = (i, p, force) => {
    pct[i] = Math.max(pct[i], Math.min(1, p));
    emit({ type: 'stepProgress', index: i, percent: Math.round(pct[i] * 100) });
    pushProgress(force);
  };
  const startWork = () => { if (!tWork) { tWork = Date.now(); f0 = best = Math.max(best, overall()); } };
  const timers = {};
  const begin = (i, name) => { timers[i] = Date.now(); emit({ type: 'step', index: i, status: 'running', name }); };
  const end = (i, detail) => {
    const duration = fmtDur((Date.now() - timers[i]) / 1000);
    meta.steps[i] = { duration, detail }; saveMeta();
    pct[i] = 1; emit({ type: 'stepProgress', index: i, percent: 100 });
    emit({ type: 'step', index: i, status: 'completed', duration, detail }); pushProgress(true);
  };
  const restore = i => {                       // step finished in an earlier run: report it as done instantly
    const m = meta.steps[i] || {};
    pct[i] = 1; emit({ type: 'stepProgress', index: i, percent: 100 });
    emit({ type: 'step', index: i, status: 'completed', duration: m.duration || '', detail: m.detail ? `${m.detail} (resumed)` : 'restored from checkpoint' });
    pushProgress(true);
  };
  if (job.resume) log('System', 'Resuming from the last checkpoint…');

  // 1 probe (always, it is instant)
  begin(0);
  const info = await R.probe(job.filePath);
  const isCustom = job.framing?.mode === 'custom-scale';
  const vf = isCustom ? Math.min(1, 100 / Math.max(30, job.framing.customScale || 100)) : (Wd / Ht) / (info.width / info.height);
  wantTrack = !job.split && !!((job.framing?.mode === 'fill-crop' || isCustom) && job.framing?.autoReframing && vf < 0.98 && deps.detectFaces);
  // split screen: describe both sources for the renderer
  let split = null;
  if (job.split) {
    split = { ...job.split, mainDims: [info.width, info.height] };
    if (split.mode === 'single') { if (!split.facecam) throw new Error('Facecam area is not set. Go back and select the facecam area.'); }
    else {
      if (!split.secondPath || !fs.existsSync(split.secondPath)) throw new Error('The second video was not found. Please select it again.');
      const si = await R.probe(split.secondPath);
      split.secondDims = [si.width, si.height]; split.secondHasAudio = si.hasAudio; split.secondDuration = si.duration;
    }
  }
  end(0, `${info.width}×${info.height} @ ${info.fps}fps, ${info.duration.toFixed(1)}s, ${info.vcodec}/${info.acodec || 'no audio'}`);
  log('FFmpeg', `Probed ${path.basename(job.filePath)}`, 'success');
  if (!info.hasAudio) throw new Error('This video has no audio track, nothing to transcribe.');
  checkCancel();

  // 2 audio
  const wav = f('audio.wav');
  if (meta.steps[1] && fs.existsSync(wav)) restore(1);
  else {
    startWork(); begin(1);
    await R.extractAudio(job.filePath, wav);
    end(1, '16 kHz mono PCM');
  }
  checkCancel();

  // 3 whisper (chunked, each chunk is a checkpoint)
  let words = readJson('words.json');
  if (meta.steps[2] && words) restore(2);
  else {
    startWork(); begin(2);
    log('Whisper', `Transcribing with model "${job.modelId}" on CPU. This is the slowest step.`);
    words = await W.transcribe(wav, { modelId: job.modelId, language: job.language || 'auto', workDir: work,
      duration: info.duration, chunkSec: +process.env.CF_CHUNK_SEC || 300, slice: R.sliceAudio, onProgress: p => setPct(2, p) });
    if (!words.length) throw new Error('No speech detected in this video.');
    try { words = SYNC.refineWords(words, wav); log('Whisper', 'Word timings aligned to the audio', 'success'); } catch {}
    writeJson('words.json', words);
    end(2, `${words.length} words with timestamps`); log('Whisper', `${words.length} words`, 'success');
  }
  checkCancel();

  // 4/5 optional: translate captions / Roman script (Gemini). Original words stay for moment-finding; captions use capWords.
  let capWords = words;
  const wantTr = !!(job.captions?.enabled && job.captions.translateTo), wantRoman = !!(job.captions?.enabled && job.captions.romanScript);
  const gOk = !!(job.gemini && job.gemini.enabled && job.gemini.apiKey);
  const cached = readJson('capwords.json');
  for (const [i, want, label] of [[3, wantTr, 'translate'], [4, wantRoman, 'roman']]) {
    if (!want) { emit({ type: 'step', index: i, status: 'skipped' }); pct[i] = 1; continue; }
    if (meta.steps[i] && cached) { restore(i); capWords = cached; continue; }
    startWork(); begin(i);
    try {
      if (!gOk) throw new Error('needs AI Boost (Gemini API key)');
      if (label === 'translate') capWords = await TR.translate(capWords, job.captions.translateTo, job.gemini, p => setPct(i, p));
      else capWords = await TR.toRoman(capWords, job.gemini, p => setPct(i, p));
      writeJson('capwords.json', capWords);
      end(i, label === 'translate' ? `translated to ${job.captions.translateTo}` : 'converted to Roman letters');
    } catch (e) {
      if (String(e.message) === 'CANCELLED') throw e;
      log('Gemini', `${label === 'translate' ? 'Translation' : 'Roman conversion'} skipped: ${String(e.message).slice(0, 120)}`, 'warn');
      end(i, `skipped (${String(e.message).slice(0, 40)})`);
    }
  }

  // 6 find moments
  let clips = readJson('clips.json');
  if (meta.steps[5] && clips) restore(5);
  else {
    startWork(); begin(5);
    const clipLen = { '15s': 15, '30s': 30, '45s': 45, '60s': 60, '90s': 90 }[job.clipLength] || 35;
    const r = await A.findClips(words, { count: job.targetClipsCount || 4, clipLen, gemini: job.gemini, log, userPrompt: (job.aiPrompt || '').trim(), filePath: job.filePath, workDir: work });
    clips = r.clips;
    if (!clips.length) throw new Error('Could not find any suitable moments.');
    writeJson('clips.json', clips);
    end(5, `${clips.length} clips · moments: ${r.engine === 'gemini' ? 'Gemini' : 'offline'} · titles: ${r.titleEngine === 'gemini' ? 'Gemini' : r.titleEngine === 'local' ? 'local' : 'Gemini + local'}`);
  }
  checkCancel();

  begin(6); end(6, 'cut during render (single pass)');

  // 8 reframe: real face tracking (only for Full Crop + AI reframing ON)
  const tracks = [];
  if (split) { begin(7, 'Building split screen'); end(7, `${split.mode === 'single' ? 'facecam on ' : split.mode === 'two' ? 'facecam + game on ' : 'video + background on '}${split.swap ? 'bottom' : 'top'}`); }
  else if (meta.steps[7]) restore(7);
  else {
    startWork(); begin(7);
    let trackedClips = 0;
    for (let i = 0; i < clips.length; i++) {
      checkCancel();
      const c = clips[i]; tracks[i] = null;
      const cache = readJson(`track_${i}.json`);
      if (cache) { tracks[i] = cache.expr ? cache : null; if (cache.expr) trackedClips++; setPct(7, (i + 1) / clips.length); continue; }
      if (wantTrack) {
        try {
          const fps = 3, frames = await R.extractFrames(job.filePath, c.start, c.end - c.start, path.join(work, `fr${i}`), fps);
          checkCancel();
          const dets = await deps.detectFaces(frames);
          let cutTimes = []; try { cutTimes = await R.detectCuts(job.filePath, c.start, c.end - c.start); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; }
          let hints = null;
          if (c.subject && gOk) {
            try { hints = await SUBJ.subjectHints(frames, fps, c.subject, job.gemini); log('AutoReframe', `Clip ${i + 1}: following "${c.subject}"`, 'success'); }
            catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('AutoReframe', `Clip ${i + 1}: could not locate "${c.subject}" (${String(e.message).slice(0, 80)}), using normal tracking`, 'warn'); }
          }
          const speech = frames.map((_, k) => { const t = c.start + k / fps; return words.some(w => t >= w.start - 0.1 && t <= w.end + 0.15); });   // who talks only matters while someone talks
          const kf = RF.buildPath(dets, { fps, vf, style: job.framing.trackingStyle || 'smooth-pan', hints, speech, cutTimes });
          if (kf) { tracks[i] = { expr: RF.centerExpr(kf) }; trackedClips++; }
          else log('AutoReframe', `Clip ${i + 1}: no face found, using centre crop`, 'warn');
          fs.rmSync(path.join(work, `fr${i}`), { recursive: true, force: true });
        } catch (e) {
          if (String(e.message) === 'CANCELLED') throw e;
          log('AutoReframe', `Clip ${i + 1}: face tracking failed (${String(e.message).slice(0, 120)}), using centre crop`, 'warn');
        }
      }
      writeJson(`track_${i}.json`, tracks[i] || {});
      setPct(7, (i + 1) / clips.length, true);
    }
    end(7, wantTrack ? `face tracking on ${trackedClips}/${clips.length} clips (${job.framing.trackingStyle || 'smooth-pan'})`
                     : (job.framing?.mode === 'fill-crop' ? 'manual crop (AI reframing off)' : `layout: ${job.framing?.mode || 'fit-blur'}`));
  }
  for (let i = 0; i < clips.length; i++) { const c = readJson(`track_${i}.json`); tracks[i] = c && c.expr ? c : null; }

  // 9 render each clip (each finished clip is a checkpoint)
  startWork(); begin(8);
  const result = [];
  const cap = job.captions || {};
  const k = Wd / 1080, capPx = (cap.fontSize || 24) * 3.4 * k, eSize = Math.round(capPx * 1.5);
  const emojiBox = { size: eSize, x: Math.round((cap.positionX ?? 50) / 100 * Wd - eSize / 2),
                     y: Math.max(0, Math.round((cap.positionY ?? 72) / 100 * Ht - capPx * 0.65 - eSize)) };
  // watermark image (copied into the work dir; .jfif is just a JPEG)
  let watermark = null;
  const br = job.branding || {};
  if (br.showWatermark && br.watermarkType === 'image' && br.watermarkImage?.path && fs.existsSync(br.watermarkImage.path)) {
    const ext = path.extname(br.watermarkImage.path).toLowerCase().replace('.jfif', '.jpg').replace('.jpeg', '.jpg');
    const wf = f(`wm${ext || '.png'}`); fs.copyFileSync(br.watermarkImage.path, wf);
    watermark = { file: wf, sizePct: br.watermarkImageSize ?? 20, opacity: br.watermarkOpacity ?? 100, x: br.watermarkPositionX ?? 20, y: br.watermarkPositionY ?? 92 };
  }
  // background music
  let music = null;
  const bm = br.bgMusic;
  if (bm?.path && fs.existsSync(bm.path)) {
    let dur = bm.duration || 0;
    if (!dur) { try { dur = (await R.probe(bm.path)).duration || 0; } catch {} }
    music = { file: bm.path, startSec: bm.startSec || 0, volumeDb: bm.volumeDb ?? -18, duration: dur, fade: bm.fade !== false };
  }
  const fontFamilies = ASS.fontsUsed({ captions: job.captions, branding: job.branding });
  const useEmoji = cap.enabled && cap.showEmoji && cap.style === 'capcut-emoji';
  for (let i = 0; i < clips.length; i++) {
    checkCancel();
    const c = clips[i], n = String(i + 1).padStart(2, '0');
    const out = path.join(outDir, `clip_${n}.mp4`);
    const done = readJson(`res_${n}.json`);
    if (done && fs.existsSync(out)) { result.push(done); setPct(8, (i + 1) / clips.length); continue; }
    log('FFmpeg', `Rendering clip ${i + 1}/${clips.length} (${(c.end - c.start).toFixed(0)}s)…`);
    const ass = ASS.build({ words: capWords, clipStart: c.start, clipEnd: c.end, W: Wd, H: Ht, captions: job.captions, branding: job.branding, title: c.hookText || c.title, hookText: c.hookText });
    const emojis = [...(useEmoji ? EMOJI.plan(capWords === words ? words : words, c.start, c.end, emojiBox).map(e => ({ ...e, x: Math.max(0, Math.min(Wd - emojiBox.size, e.x)) })) : []),
      ...ASS.titleEmojis({ title: c.hookText || c.title, branding: job.branding, W: Wd, H: Ht, dur: c.end - c.start })];
    const { note } = await R.renderClip({ input: job.filePath, start: c.start, end: c.end, out, assText: ass, ratio, framing: job.framing, grading: job.grading,
      workDir: path.join(work, `c${n}`), track: tracks[i], emojis, emojiBox, srcAspect: info.width / info.height, fontFamilies, watermark, music, split, fps: Math.round(info.fps || 30) || 30, onProgress: p => setPct(8, (i + p * 0.97) / clips.length) });
    if (note && i === 0) log('FFmpeg', note, 'warn');
    let thumb; try { thumb = await R.thumbnail(out, path.join(work, `t${n}.jpg`)); } catch {}
    const item = { ...c, outputPath: out, thumbnailUrl: thumb, words: capWords.filter(w => w.start >= c.start && w.start < c.end) };
    writeJson(`res_${n}.json`, item);
    result.push(item);
    setPct(8, (i + 1) / clips.length, true);
  }
  end(8, `${result.length} clips → ${outDir}`);
  pushProgress(true);
  log('System', `Done in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min. Saved to ${outDir}`, 'success');
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  return { clips: result, outDir, durationSec: info.duration };
}

// ---------------- Upload-short-clips mode: no moment finding / cutting; each file is one clip ----------------
async function runShortsInner(job, emit, deps = {}) {
  const t0 = Date.now();
  const log = (source, message, kind = 'info') => emit({ type: 'log', source, message, kind });
  const files = (job.files || []).filter(x => x && x.path);
  if (!files.length) throw new Error('No clips were selected.');
  if (files.length > 30) throw new Error('You can process at most 30 clips at once.');
  for (const x of files) if (!fs.existsSync(x.path)) throw new Error(`Source file not found: ${x.path}`);
  const outDir = job.outDir || uniqueDir(path.join(job.clipsBase || path.join(os.homedir(), 'Videos', 'ClipForge'), slug(job.name)), String(job.id || job.name));
  fs.mkdirSync(outDir, { recursive: true });
  try { fs.writeFileSync(path.join(outDir, '.clipforge.json'), JSON.stringify({ projectId: String(job.id || job.name) })); } catch {}
  const work = path.join(P.workRoot(), `job_${slug(job.id || job.name)}`);
  if (!job.resume) fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const f = n => path.join(work, n);
  const readJson = n => { try { return JSON.parse(fs.readFileSync(f(n), 'utf8')); } catch { return null; } };
  const writeJson = (n, v) => fs.writeFileSync(f(n), JSON.stringify(v));
  const meta = readJson('meta.json') || { steps: {} };
  const saveMeta = () => writeJson('meta.json', meta);
  const N = files.length;
  const [Wd, Ht] = R.ASPECT['9:16'];
  const ratio = '9:16';
  const pct = new Array(9).fill(0);
  let wantTrackAny = false;
  const wantTr = !!(job.captions?.enabled && job.captions.translateTo), wantRoman = !!(job.captions?.enabled && job.captions.romanScript);
  const weights = () => [1, 3, 45, wantTr ? 3 : 0, wantRoman ? 3 : 0, 6, 0, wantTrackAny ? 14 : 0, 30];
  let best = 0, tWork = null, f0 = 0, lastEmit = 0;
  const overall = () => { const w = weights(), sum = w.reduce((a, b) => a + b, 0); return w.reduce((a, x, i) => a + x * pct[i], 0) / sum; };
  const pushProgress = (force) => {
    const now = Date.now();
    if (!force && now - lastEmit < 350) return;
    lastEmit = now; best = Math.max(best, overall());
    let etaSec = null;
    if (tWork && best - f0 > 0.02 && now - tWork > 4000) etaSec = Math.max(0, Math.round((now - tWork) / 1000 * (1 - best) / (best - f0)));
    emit({ type: 'progress', percent: Math.min(100, Math.floor(best * 100)), etaSec });
  };
  const setPct = (i, p, force) => { pct[i] = Math.max(pct[i], Math.min(1, p)); emit({ type: 'stepProgress', index: i, percent: Math.round(pct[i] * 100) }); pushProgress(force); };
  const startWork = () => { if (!tWork) { tWork = Date.now(); f0 = best = Math.max(best, overall()); } };
  const timers = {};
  const begin = (i, name) => { timers[i] = Date.now(); emit({ type: 'step', index: i, status: 'running', name }); };
  const end = (i, detail) => {
    const duration = fmtDur((Date.now() - timers[i]) / 1000);
    meta.steps[i] = { duration, detail }; saveMeta();
    pct[i] = 1; emit({ type: 'stepProgress', index: i, percent: 100 });
    emit({ type: 'step', index: i, status: 'completed', duration, detail }); pushProgress(true);
  };
  const restore = (i, name) => {
    const m = meta.steps[i] || {};
    pct[i] = 1; emit({ type: 'stepProgress', index: i, percent: 100 });
    emit({ type: 'step', index: i, status: 'completed', name, duration: m.duration || '', detail: m.detail ? `${m.detail} (resumed)` : 'restored from checkpoint' });
    pushProgress(true);
  };
  if (job.resume) log('System', 'Resuming from the last checkpoint…');

  // 1 probe all
  begin(0);
  const infos = [];
  for (const x of files) {
    const info = await R.probe(x.path); infos.push(info);
    if (info.duration > 61) throw new Error(`"${x.name || path.basename(x.path)}" is longer than 60 seconds.`);
  }
  const isCustom = job.framing?.mode === 'custom-scale';
  const vfs = infos.map(info => isCustom ? Math.min(1, 100 / Math.max(30, job.framing.customScale || 100)) : (Wd / Ht) / (info.width / info.height));
  const wantTrack = infos.map((_, i) => !!((job.framing?.mode === 'fill-crop' || isCustom) && job.framing?.autoReframing && vfs[i] < 0.98 && deps.detectFaces));
  wantTrackAny = wantTrack.some(Boolean);
  end(0, `${N} clip${N > 1 ? 's' : ''}, ${infos.reduce((a, b) => a + b.duration, 0).toFixed(0)}s total`);
  checkCancel();

  // 2 audio  +  3 whisper (per clip, each one a checkpoint)
  const words = new Array(N).fill(null).map(() => []);
  if (meta.steps[1] && meta.steps[2]) { restore(1); restore(2); for (let i = 0; i < N; i++) words[i] = readJson(`words_${i}.json`) || []; }
  else {
    startWork(); begin(1);
    const wavs = [];
    for (let i = 0; i < N; i++) {
      checkCancel();
      wavs[i] = f(`audio_${i}.wav`);
      if (infos[i].hasAudio && !fs.existsSync(wavs[i])) await R.extractAudio(files[i].path, wavs[i]);
      setPct(1, (i + 1) / N);
    }
    end(1, '16 kHz mono PCM');
    begin(2);
    log('Whisper', `Transcribing ${N} clip${N > 1 ? 's' : ''} with model "${job.modelId}" on CPU. This is the slowest step.`);
    for (let i = 0; i < N; i++) {
      checkCancel();
      const cached = readJson(`words_${i}.json`);
      if (cached) { words[i] = cached; setPct(2, (i + 1) / N); continue; }
      if (!infos[i].hasAudio) { log('Whisper', `Clip ${i + 1} has no audio, skipped`, 'warn'); writeJson(`words_${i}.json`, []); setPct(2, (i + 1) / N); continue; }
      let w = [];
      try {
        const wd = f(`wk${i}`); fs.mkdirSync(wd, { recursive: true });
        w = await W.transcribe(wavs[i], { modelId: job.modelId, language: job.language || 'auto', workDir: wd, duration: infos[i].duration, chunkSec: 300, slice: R.sliceAudio, onProgress: p => setPct(2, (i + p) / N) });
        try { w = SYNC.refineWords(w, wavs[i]); } catch {}
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Whisper', `Clip ${i + 1}: ${String(e.message).slice(0, 120)}`, 'warn'); w = []; }
      if (!w.length) log('Whisper', `Clip ${i + 1}: no speech detected`, 'warn');
      words[i] = w; writeJson(`words_${i}.json`, w); setPct(2, (i + 1) / N, true);
    }
    end(2, `${words.reduce((a, b) => a + b.length, 0)} words with timestamps`);
  }
  checkCancel();

  // 4/5 translate / roman (on the merged word list; cached per project)
  let capWords = words.map(w => w);
  const gOk = !!(job.gemini && job.gemini.enabled && job.gemini.apiKey);
  const cachedCap = readJson('capwords_s.json');
  const flat = words.flatMap((w, i) => w.map(x => ({ ...x, _f: i })));
  let capFlat = flat;
  for (const [i, want, label] of [[3, wantTr, 'translate'], [4, wantRoman, 'roman']]) {
    if (!want) { emit({ type: 'step', index: i, status: 'skipped' }); pct[i] = 1; continue; }
    if (meta.steps[i] && cachedCap) { restore(i); capFlat = cachedCap; continue; }
    startWork(); begin(i);
    try {
      if (!gOk) throw new Error('needs AI Boost (Gemini API key)');
      if (label === 'translate') capFlat = await TR.translate(capFlat, job.captions.translateTo, job.gemini, p => setPct(i, p));
      else capFlat = await TR.toRoman(capFlat, job.gemini, p => setPct(i, p));
      writeJson('capwords_s.json', capFlat);
      end(i, label === 'translate' ? `translated to ${job.captions.translateTo}` : 'converted to Roman letters');
    } catch (e) {
      if (String(e.message) === 'CANCELLED') throw e;
      log('Gemini', `${label === 'translate' ? 'Translation' : 'Roman conversion'} skipped: ${String(e.message).slice(0, 120)}`, 'warn');
      end(i, `skipped (${String(e.message).slice(0, 40)})`);
    }
  }
  if (capFlat !== flat && capFlat.every(x => x._f !== undefined)) capWords = words.map((_, i) => capFlat.filter(x => x._f === i));
  else if (capFlat !== flat) { const cw = words.map(() => []); let k = 0; words.forEach((w, i) => w.forEach(() => { if (capFlat[k]) cw[i].push(capFlat[k]); k++; })); capWords = cw; }

  // 6 titles / description / hashtags (merged offset timeline so the existing writer can be reused)
  const names = files.map(x => x.name || path.basename(x.path, path.extname(x.path)));
  let clips = readJson('clips_s.json');
  const TNAME = 'Writing titles & descriptions';
  if (meta.steps[5] && clips) restore(5, TNAME);
  else {
    startWork(); begin(5, TNAME);
    const offs = []; let o = 0; infos.forEach((inf, i) => { offs[i] = o; o += inf.duration + 5; });
    const merged = words.flatMap((w, i) => w.map(x => ({ ...x, start: x.start + offs[i], end: x.end + offs[i] })));
    clips = files.map((x, i) => ({ start: 0, end: infos[i].duration, title: names[i], hookText: names[i], viralityScore: 0, reason: '', category: 'Storytelling', _o: offs[i] }));
    const tl = clips.map((c, i) => ({ ...c, start: c._o, end: c._o + infos[i].duration }));
    let eng = 'local';
    try { eng = await A.writeTitles(tl, merged, job.gemini, (m, k) => log('Titles', m, k)); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Titles', `Title writing failed: ${String(e.message).slice(0, 100)}`, 'warn'); }
    clips.forEach((c, i) => { const t = tl[i]; c.title = t.title; c.hookText = t.hookText || t.title; c.description = t.description || ''; c.hashtags = t.hashtags || []; c.category = t.category || c.category; c.sourceName = names[i]; delete c._o; });
    // a clip with no speech keeps its file name as the title
    clips.forEach((c, i) => { if (!words[i].length) { c.title = names[i]; c.hookText = names[i]; } });
    writeJson('clips_s.json', clips);
    end(5, `${N} titles · ${eng === 'gemini' ? 'Gemini' : eng === 'local' ? 'local' : 'Gemini + local'}`);
  }
  checkCancel();
  emit({ type: 'step', index: 6, status: 'skipped' }); pct[6] = 1;

  // 8 reframe only for clips that are not already vertical
  const tracks = new Array(N).fill(null);
  if (meta.steps[7]) restore(7);
  else if (!wantTrackAny) { emit({ type: 'step', index: 7, status: 'skipped' }); pct[7] = 1; }
  else {
    startWork(); begin(7);
    let tracked = 0;
    for (let i = 0; i < N; i++) {
      checkCancel();
      const cache = readJson(`track_${i}.json`);
      if (cache) { tracks[i] = cache.expr ? cache : null; if (cache.expr) tracked++; setPct(7, (i + 1) / N); continue; }
      if (wantTrack[i]) {
        try {
          const fps = 3, frames = await R.extractFrames(files[i].path, 0, infos[i].duration, path.join(work, `fr${i}`), fps);
          checkCancel();
          const dets = await deps.detectFaces(frames);
          let cutTimes = []; try { cutTimes = await R.detectCuts(files[i].path, 0, infos[i].duration); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; }
          const speech = frames.map((_, k) => { const t = k / fps; return words[i].some(w => t >= w.start - 0.1 && t <= w.end + 0.15); });
          const kf = RF.buildPath(dets, { fps, vf: vfs[i], style: job.framing.trackingStyle || 'smooth-pan', hints: null, speech, cutTimes });
          if (kf) { tracks[i] = { expr: RF.centerExpr(kf) }; tracked++; }
          else log('AutoReframe', `Clip ${i + 1}: no face found, using centre crop`, 'warn');
          fs.rmSync(path.join(work, `fr${i}`), { recursive: true, force: true });
        } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('AutoReframe', `Clip ${i + 1}: face tracking failed, using centre crop`, 'warn'); }
      }
      writeJson(`track_${i}.json`, tracks[i] || {});
      setPct(7, (i + 1) / N, true);
    }
    end(7, `face tracking on ${tracked}/${N} non-vertical clips`);
  }
  for (let i = 0; i < N; i++) { const c = readJson(`track_${i}.json`); tracks[i] = c && c.expr ? c : null; }

  // 9 render
  startWork(); begin(8);
  const result = [];
  const cap = job.captions || {};
  const k = Wd / 1080, capPx = (cap.fontSize || 24) * 3.4 * k, eSize = Math.round(capPx * 1.5);
  const emojiBox = { size: eSize, x: Math.round((cap.positionX ?? 50) / 100 * Wd - eSize / 2), y: Math.max(0, Math.round((cap.positionY ?? 72) / 100 * Ht - capPx * 0.65 - eSize)) };
  let watermark = null;
  const br = job.branding || {};
  if (br.showWatermark && br.watermarkType === 'image' && br.watermarkImage?.path && fs.existsSync(br.watermarkImage.path)) {
    const ext = path.extname(br.watermarkImage.path).toLowerCase().replace('.jfif', '.jpg').replace('.jpeg', '.jpg');
    const wf = f(`wm${ext || '.png'}`); fs.copyFileSync(br.watermarkImage.path, wf);
    watermark = { file: wf, sizePct: br.watermarkImageSize ?? 20, opacity: br.watermarkOpacity ?? 100, x: br.watermarkPositionX ?? 20, y: br.watermarkPositionY ?? 92 };
  }
  let music = null;
  const bm = br.bgMusic;
  if (bm?.path && fs.existsSync(bm.path)) {
    let dur = bm.duration || 0;
    if (!dur) { try { dur = (await R.probe(bm.path)).duration || 0; } catch {} }
    music = { file: bm.path, startSec: bm.startSec || 0, volumeDb: bm.volumeDb ?? -18, duration: dur, fade: bm.fade !== false };
  }
  const fontFamilies = ASS.fontsUsed({ captions: job.captions, branding: job.branding });
  const useEmoji = cap.enabled && cap.showEmoji && cap.style === 'capcut-emoji';
  for (let i = 0; i < N; i++) {
    checkCancel();
    const c = clips[i], n = String(i + 1).padStart(2, '0'), dur = infos[i].duration;
    const out = path.join(outDir, `clip_${n}.mp4`);
    const done = readJson(`res_${n}.json`);
    if (done && fs.existsSync(out)) { result.push(done); setPct(8, (i + 1) / N); continue; }
    log('FFmpeg', `Rendering clip ${i + 1}/${N} (${dur.toFixed(0)}s)…`);
    const cw = capWords[i];
    const ass = ASS.build({ words: cw, clipStart: 0, clipEnd: dur, W: Wd, H: Ht, captions: job.captions, branding: job.branding, title: c.hookText || c.title, hookText: c.hookText });
    const emojis = [...(useEmoji ? EMOJI.plan(words[i], 0, dur, emojiBox).map(e => ({ ...e, x: Math.max(0, Math.min(Wd - emojiBox.size, e.x)) })) : []),
      ...ASS.titleEmojis({ title: c.hookText || c.title, branding: job.branding, W: Wd, H: Ht, dur })];
    const { note } = await R.renderClip({ input: files[i].path, start: 0, end: dur, out, assText: ass, ratio, framing: job.framing, grading: job.grading,
      workDir: path.join(work, `c${n}`), track: tracks[i], emojis, emojiBox, srcAspect: infos[i].width / infos[i].height, hasAudio: infos[i].hasAudio, fontFamilies, watermark, music, onProgress: p => setPct(8, (i + p * 0.97) / N) });
    if (note && i === 0) log('FFmpeg', note, 'warn');
    let thumb; try { thumb = await R.thumbnail(out, path.join(work, `t${n}.jpg`)); } catch {}
    const item = { ...c, start: 0, end: dur, outputPath: out, thumbnailUrl: thumb, words: cw };
    writeJson(`res_${n}.json`, item);
    result.push(item);
    setPct(8, (i + 1) / N, true);
  }
  end(8, `${result.length} clips → ${outDir}`);
  pushProgress(true);
  log('System', `Done in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min. Saved to ${outDir}`, 'success');
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  return { clips: result, outDir, durationSec: infos.reduce((a, b) => a + b.duration, 0) };
}
async function runPipeline(job, emit, deps = {}) {
  try { return await (job.shorts ? runShortsInner : runInner)(job, emit, deps); }
  catch (e) {
    // cancelled (paused) => keep checkpoints for resume; real failure => clean up
    if (String(e.message) !== 'CANCELLED') { try { fs.rmSync(path.join(P.workRoot(), `job_${slug(job.id || job.name)}`), { recursive: true, force: true }); } catch {} }
    throw e;
  }
}
module.exports = { runPipeline, workDirFor: job => path.join(P.workRoot(), `job_${slug(job.id || job.name)}`) };
