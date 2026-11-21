// Gaming clips: finds the best moments of a gameplay video WITHOUT relying on speech.
//  1) signals: how loud the game gets (explosions, shots, crowd, music peaks) and how much the picture changes (action)
//  2) candidates: the strongest peaks, each with a lead-in and lead-out
//  3) the AI looks at frames of every candidate (+ the loudness), says what happens, picks the real highlights and writes title, hook, description
// Works for any game. If the video has a streamer talking, the words (when transcribed) add a small bonus for shouting / hype words.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const R = require('./render.cjs');
const G = require('./ai.cjs');
const HK = require('./hook.cjs');
const EM = require('./emoji.cjs');
const { checkCancel, track } = require('./proc.cjs');

const P = require('./paths.cjs');
const ffmpeg = () => P.binOrPath('ffmpeg');
const HYPE = /\b(no way|oh my god|omg|let'?s go|insane|crazy|clutch|ace|wow|what the|bro|yooo?|holy|unbelievable|nice|gg|boom|dead|ez|noo+|wait)\b/i;

// ---------- 1) signals ----------
function wavData(file) {                                  // find the PCM data chunk of a 16-bit mono wav
  const fd = fs.openSync(file, 'r'); const head = Buffer.alloc(4096); fs.readSync(fd, head, 0, 4096, 0);
  let off = 12, dataAt = 44, rate = 16000;
  while (off + 8 <= head.length) { const id = head.toString('ascii', off, off + 4), sz = head.readUInt32LE(off + 4); if (id === 'fmt ') rate = head.readUInt32LE(off + 12); if (id === 'data') { dataAt = off + 8; break; } off += 8 + sz + (sz & 1); }
  return { fd, dataAt, rate };
}
function loudness(wav, step = 0.5) {                      // dB per `step` seconds
  const { fd, dataAt, rate } = wavData(wav), per = Math.round(rate * step), buf = Buffer.alloc(per * 2), out = [];
  let pos = dataAt;
  for (;;) {
    const n = fs.readSync(fd, buf, 0, buf.length, pos); if (n < 4) break; pos += n;
    let s = 0; const cnt = n >> 1;
    for (let i = 0; i < cnt; i++) { const v = buf.readInt16LE(i * 2) / 32768; s += v * v; }
    out.push(20 * Math.log10(Math.sqrt(s / cnt) + 1e-6));
  }
  fs.closeSync(fd); return out;
}
function motion(file, duration, fps, onProgress) {          // mean frame difference of tiny grey frames, `fps` frames per second
  return new Promise((resolve, reject) => {
    const W = 64, H = 36, size = W * H, out = [];
    const child = spawn(ffmpeg(), ['-v', 'error', '-i', path.resolve(file), '-an', '-vf', `fps=${fps},scale=${W}:${H}:flags=fast_bilinear,format=gray`, '-f', 'rawvideo', '-'], { windowsHide: true });
    try { require('os').setPriority(child.pid, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* keep the app smooth */ }
    track(child);
    let prev = null, rest = Buffer.alloc(0), err = '';
    child.stdout.on('data', d => {
      rest = rest.length ? Buffer.concat([rest, d]) : d;
      while (rest.length >= size) {
        const fr = rest.subarray(0, size); rest = rest.subarray(size);
        if (prev) { let s = 0; for (let i = 0; i < size; i++) s += Math.abs(fr[i] - prev[i]); out.push(s / size); } else out.push(0);
        prev = Buffer.from(fr);
      }
      onProgress && duration && onProgress(Math.min(1, out.length / fps / duration));
    });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => reject(new Error('Cannot start ffmpeg: ' + e.message)));
    child.on('close', code => { if (code === 0 || out.length) resolve(out); else reject(new Error('motion analysis failed: ' + err.slice(-200))); });
  });
}
const median = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
function zscore(series, win) {                              // how far above the local normal each value is (0..5)
  const out = new Array(series.length).fill(0);
  for (let i = 0; i < series.length; i += 1) {
    const a = Math.max(0, i - win), b = Math.min(series.length, i + win), seg = series.slice(a, b), m = median(seg);
    const dev = median(seg.map(v => Math.abs(v - m))) * 1.4826 || 1e-3;
    out[i] = Math.max(0, Math.min(5, (series[i] - m) / (dev * 2)));
  }
  return out;
}

// ---------- 2) candidates ----------
function candidates({ dur, aud, mot, words, count, len }) {
  const step = 0.5, n = Math.floor(dur / step), score = new Array(n).fill(0);
  const A = zscore(aud, 120), M = zscore(mot, 120);          // normal = the last/next minute of the same video
  for (let i = 0; i < n; i++) {
    const a = A[Math.min(i, A.length - 1)] || 0, m = M[Math.min(Math.floor(i * step * (mot.length / dur)), M.length - 1)] || 0;
    score[i] = a * 1.0 + m * 0.8;
  }
  if (words && words.length) for (const w of words) if (HYPE.test(w.word)) { const i = Math.floor(w.start / step); for (let k = Math.max(0, i - 4); k < Math.min(n, i + 4); k++) score[k] += 0.9; }
  const sm = score.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) { s += score[k]; c++; } return s / c; });   // ~3 s smoothing: sustained action beats one click
  const lead = len * 0.5, picks = [], idx = sm.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
  const want = Math.min(90, Math.max(count * 2 + 2, count + 4, 12));      // used to stop at 12: asking for 30 clips could never work
  for (const pass of [0.35, -1]) {                                       // 1st pass: only real peaks. 2nd pass (only when too few): the next best places, so the count you asked for can be reached
    for (const [v, i] of idx) {
      if (picks.length >= want) break; if (v < pass) break;
      const t = i * step; if (picks.some(p => Math.abs(p.peak - t) < len * 0.92)) continue;
      let start = Math.max(0, t - lead); const end = Math.min(dur, start + len); start = Math.max(0, end - len);
      if (end - start < 6) continue;
      picks.push({ peak: t, start, end, signal: Math.max(0, v), aud: A[Math.min(i, A.length - 1)] || 0, mot: M[Math.min(Math.floor(t * (mot.length / dur)), M.length - 1)] || 0 });
    }
    if (picks.length >= count + 2) break;
  }
  return picks;
}

// ---------- 3) the AI looks ----------
async function lookAt(cands, { filePath, workDir, g, log, aud, hookLines, words = [] }) {
  const out = new Map(); let game = '';
  for (let o = 0; o < cands.length; o += 4) {
    checkCancel();
    const part = cands.slice(o, o + 4), parts = [];
    parts.push({ text: `You are a short-video editor for GAMEPLAY videos (any game). Below are ${part.length} candidate moments. For each one you get frames spread over its length and a loudness note. Decide how good a highlight it is: kills, close fights, clutch plays, big explosions or crashes, funny fails, lucky escapes, victory or other clear peaks score high; menus, loading, walking or waiting score low.
For each candidate answer: "score" 0-10, "what" (one plain sentence about what happens), "peakAt" (seconds from the START of the candidate where the best moment happens), "title" (catchy, max 70 chars, no clickbait lies), "hookText" (max 9 words, a curiosity line about what is VISIBLE in these frames; never claim an outcome you cannot see), "description" (2 sentences for YouTube/Instagram), "hashtags" (5 without #), "keywords" (up to 6 plain words). Also "game": the game name if you can recognise it, else "".
Return ONLY JSON: {"game":"","c":[{"i":0,"score":0,"what":"","peakAt":0,"title":"","hookText":"","description":"","hashtags":[],"keywords":[]}]}` });
    parts.push({ text: `SCORING RULES (strict, be honest): 9-10 = a real peak that people would rewatch or share (a big crash/explosion, a chase with a payoff, a close escape, a kill or win, a truly funny fail or reaction, a story the streamer tells that ends with a payoff). 6-8 = good action or a funny/interesting moment. 3-5 = ordinary driving/walking/shooting with nothing special. 0-2 = NOT usable: the streamer reading chat or donations, giveaways, "like and subscribe", thanking people, talking about the stream itself, setup or settings, menus, loading, phone / tab-switching, idle or standing still, an empty road, pure small talk with nothing happening. A loud moment is NOT automatically good: shouting at chat or a giveaway is loud but scores 0-2. If the streamer talks, the words said are given: judge the moment by what is happening in the game AND by whether the talk is a funny / exciting / story moment or just chat-reading and housekeeping.` });
    for (let k = 0; k < part.length; k++) {
      const c = part[k], len = c.end - c.start, dir = path.join(workDir, `gm${o + k}`);
      const frames = await R.extractFrames(filePath, c.start, len, dir, Math.min(2, 7 / len));
      const pick = frames.filter((_, j) => j % Math.max(1, Math.round(frames.length / 7)) === 0).slice(0, 7);
      const db = aud.slice(Math.floor(c.start / 0.5), Math.floor(c.end / 0.5));
      const said = words.filter(w => w.end > c.start && w.start < c.end).map(w => w.word).join(' ').slice(0, 450);
      const mx = Math.max(...db), loudAt = db.indexOf(mx) * 0.5, base = median(db);
      parts.push({ text: `Candidate ${k} (length ${len.toFixed(0)} s). Loudness: normal ${base.toFixed(0)} dB, loudest ${mx.toFixed(0)} dB at ${loudAt.toFixed(0)} s. ${said ? ` The streamer says: "${said}".` : ''} Frames in time order:` });
      for (const f of pick) parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } });
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    let r = null;
    for (let attempt = 0; attempt < 2 && !r; attempt++) {
      try { r = G.parseJson((await G.generate(g, { parts, json: true, timeoutMs: 180000 })).text); }
      catch (e) { if (String(e.message) === 'CANCELLED') throw e; if (attempt) log(`AI could not look at candidates ${o + 1}-${o + part.length} (${String(e.message).slice(0, 90)})`, 'warn'); else await new Promise(s => setTimeout(s, 1500)); }
    }
    if (!r) continue;
    if (!game && r.game) game = String(r.game).slice(0, 60);
    const arr = Array.isArray(r) ? r : (Array.isArray(r.c) ? r.c : (Object.values(r).find(Array.isArray) || []));
    arr.forEach((x, k) => { const i = x && x.i != null ? +x.i : k; if (i >= 0 && i < part.length) out.set(o + i, x); });
  }
  return { out, game };
}


// ---------- 4) the final text is written from the FINAL clip (the cut can move away from the first candidate window) ----------
const HOOK_LEN = { 1: '3 to 5 words', 2: '6 to 9 words', 3: '9 to 13 words' };
async function writeText(clips, { filePath, workDir, g, log, game, words = [], hn = 2, userPrompt = '' }) {
  const head = `You write the on-screen text for short GAMEPLAY clips${game ? ' (game: ' + game + ')' : ''}. For each clip you get frames in time order with their time in seconds${words.length ? ' and, when the player or streamer talks, what is said' : ''}. Look at the frames carefully, then write ONLY what you can actually SEE (the speech only helps you understand the moment).
Rules:
- "what": 1-2 plain sentences describing the visible action (who/what does what, objects, places, results). No guessing about things not visible.
- "title": 5 to 10 words, specific to this clip (name the visible action or object), natural English, 1 fitting emoji at the end, no clickbait lies, not ALL CAPS.
- "hookText": the text shown on screen in the first seconds, ${HOOK_LEN[hn] || HOOK_LEN[2]} long. It must make a stranger NEED to keep watching THIS clip. First work out the real story of the clip (what happens and how it ends, using the frames AND what is said), then write the hook about THAT: a bold claim, a surprising result or a direct line to the viewer that matches the actual payoff. Natural English, a complete sentence, not ALL CAPS, never cut off. Write like a top YouTube Shorts editor: first person or "you" is great ("I did NOT expect this to work", "You won't believe how this chase ends", "This one move saved the whole run", "He almost lost everything here"). FORBIDDEN: vague questions about nothing in particular ("Where is this fast city drive taking him?", "Will the bouncers let him enter the club?", "What happens next?"), describing the scene like a caption, hooks that fit any clip, spoilers that kill the ending, and claims you cannot see in the clip. If the clip is only normal driving/walking, make the hook about the one specific thing that makes it interesting (a near-miss, a funny line, a decision) instead of the setting.
- "description": 2 sentences for YouTube/Instagram that describe the visible action. "hashtags": 5 without #. "keywords": up to 6 plain words about what is visible.
${userPrompt ? `EDITOR'S INSTRUCTIONS (highest priority, they override the style rules above for title, hook and description; follow them literally for every clip; they may be in any language): "${String(userPrompt).slice(0, 4000)}"\n` : ''}Return ONLY JSON: {"c":[{"i":0,"what":"","title":"","hookText":"","description":"","hashtags":[],"keywords":[]}]}`;
  const out = new Map(), BATCH = 4;
  for (let o = 0; o < clips.length; o += BATCH) {
    checkCancel();
    const part = clips.slice(o, o + BATCH), parts = [{ text: head }];
    for (let k = 0; k < part.length; k++) {
      const c = part[k], len = c.end - c.start, dir = path.join(workDir, `gt${o + k}`);
      try {
        const frames = await R.extractFrames(filePath, c.start, len, dir, Math.min(2, 8 / len));
        const step = Math.max(1, Math.round(frames.length / 8)), pick = frames.filter((_, j) => j % step === 0).slice(0, 8);
        const said = words.filter(w => w.end > c.start && w.start < c.end).map(w => w.word).join(' ').slice(0, 800);
        parts.push({ text: `Clip ${k} (${len.toFixed(0)} s). Frames at: ${pick.map((_, j) => (j * step * (len / Math.max(1, frames.length))).toFixed(0) + 's').join(', ')}${said ? `. Said in this clip: "${said}"` : ''}` });
        for (const f of pick) parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } });
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = G.parseJson((await G.generate(g, { parts, json: true, timeoutMs: 180000 })).text);
        const arr = Array.isArray(r) ? r : (Array.isArray(r.c) ? r.c : (Object.values(r).find(Array.isArray) || []));
        arr.forEach((x, k) => { const i = x && x.i != null ? +x.i : k; if (x && x.title && i >= 0 && i < part.length) out.set(o + i, x); });
        break;
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; if (attempt) log(`Could not re-check clips ${o + 1}-${o + part.length} (${String(e.message).slice(0, 90)}), keeping the first texts`, 'warn'); else await new Promise(s => setTimeout(s, 1500)); }
    }
  }
  return out;
}


// The clip should not start or stop in the middle of a sentence: move both edges to the nearest pause in the speech (small shift only).
function snapToSpeech({ start, end }, words, len, duration) {
  if (!words || words.length < 8) return { start, end };
  const ws = words.filter(w => w.end > start - 8 && w.start < end + 8); if (ws.length < 4) return { start, end };
  const starts = [], ends = [];
  for (let i = 0; i < ws.length; i++) { const gapBefore = i ? ws[i].start - ws[i - 1].end : 1, gapAfter = i < ws.length - 1 ? ws[i + 1].start - ws[i].end : 1; if (gapBefore >= 0.45) starts.push(ws[i].start); if (gapAfter >= 0.45 || /[.!?]$/.test(ws[i].word)) ends.push(ws[i].end); }
  const near = (arr, t, r) => arr.filter(x => Math.abs(x - t) <= r).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0];
  const s2 = near(starts, start, 4);
  const ns = s2 != null ? Math.max(0, s2 - 0.15) : start;
  const e2 = near(ends.filter(x => x - ns >= len * 0.75 && x - ns <= len * 1.3), ns + len, 6);
  const ne = e2 != null ? Math.min(duration, e2 + 0.25) : Math.min(duration, ns + len);
  return ne - ns >= len * 0.7 ? { start: ns, end: ne } : { start, end };
}

// ---------- local fallback (no AI key) ----------
function localText(c, n) {
  const loud = c.aud >= c.mot;
  const T = loud ? [['THIS GOT SO LOUD', 'Wait for the sound'], ['BIGGEST MOMENT OF THE MATCH', 'You will not expect this']] : [['THE ACTION NEVER STOPS', 'Watch how fast this gets'], ['NON-STOP CHAOS', 'Try to follow this']];
  const t = T[n % T.length];
  return { title: t[0], hookText: t[1], description: 'A highlight from the gameplay. Watch till the end and tell us what you would have done.', hashtags: ['gaming', 'gameplay', 'highlights', 'shorts', 'fyp'], keywords: ['gaming', 'gameplay', 'highlight'] };
}

async function findGamingClips({ filePath, wav, duration, words = [], count = 4, clipLen = 0, gemini: g, log = () => {}, workDir, hookLines = 2, onProgress, userPrompt = '' }) {
  const len = clipLen || 35, HN = hookLines === 1 || hookLines === 3 ? hookLines : 2;
  log('Gaming', 'Measuring the sound and the action of the video…');
  const aud = wav && fs.existsSync(wav) ? loudness(wav) : [];
  checkCancel();
  const fps = duration > 5400 ? 1 : 2;
  let mot = [];
  try { mot = await motion(filePath, duration, fps, p => onProgress && onProgress(p)); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Gaming', 'Could not measure the action (' + String(e.message).slice(0, 80) + '), using the sound only', 'warn'); }
  checkCancel();
  if (!aud.length && !mot.length) throw new Error('Could not analyse this video.');
  const audSeries = aud.length ? aud : new Array(Math.floor(duration / 0.5)).fill(-40);
  const motZ = mot.length ? mot : new Array(Math.floor(duration)).fill(0);
  const cands = candidates({ dur: duration, aud: audSeries, mot: motZ, words, count, len });
  if (!cands.length) throw new Error('Could not find any suitable moments.');
  log('Gaming', `${cands.length} candidate moments found from sound and action`, 'success');
  let game = '', verdict = new Map(), engine = 'local';
  if (G.ready(g)) {
    const look = cands.slice().sort((a, b) => b.signal - a.signal).slice(0, Math.min(cands.length, 28, Math.max(16, Math.ceil(count * 2.2))));   // the strongest ones; the rest keep their sound/action rank
    try { const r = await lookAt(look, { filePath, workDir, g, log: (m, k) => log('AI', m, k), aud: audSeries, hookLines: HN, words }); game = r.game; look.forEach((c, k) => { const v = r.out.get(k); if (v) verdict.set(cands.indexOf(c), v); }); if (verdict.size) engine = 'gemini'; }
    catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('AI', 'Could not look at the frames (' + String(e.message).slice(0, 100) + '), choosing by sound and action only', 'warn'); }
  } else log('AI', 'No AI key: moments are chosen from sound and action only, titles are generic (add a key in Settings for real titles)', 'info');
  cands.forEach((c, i) => { const v = verdict.get(i); c.ai = v || null; c.rank = (v ? (+v.score || 0) * 10 : 30) + c.signal * 6; });
  let ranked = cands.slice().sort((a, b) => b.rank - a.rank);
  if (engine === 'gemini') {
    const seen = ranked.filter(c => c.ai);                                                                    // moments the AI actually looked at
    const usable = ranked.filter(c => !c.ai || +c.ai.score >= 3);                                             // 0-2 = chat reading, giveaways, menus, idle: never used
    const good = ranked.filter(c => c.ai && +c.ai.score >= 6);
    if (good.length >= count) ranked = good;
    else if (usable.length) ranked = usable.filter(c => c.ai || good.length < count);
    if (seen.length > usable.length) log('Gaming', `${seen.length - usable.length} moment(s) skipped: chat reading, giveaway talk, menus or idle time`, 'info');
    ranked = [...ranked.filter(c => c.ai), ...ranked.filter(c => !c.ai)];                                      // moments the AI did not look at only fill the count after the checked ones
  }
  const picked = []; for (const c of ranked) { if (picked.length >= count) break; if (!picked.some(p => Math.abs(p.peak - c.peak) < len * 0.92)) picked.push(c); }
  if (picked.length < count) log('Gaming', `Only ${picked.length} clip(s) of ${count} fit in this video without overlapping (${Math.round(len)} s each). Use a shorter clip length or fewer clips to get more.`, 'warn');
  const windows = picked.map(c => {
    let { start, end } = c; const v = c.ai;
    if (v && Number.isFinite(+v.peakAt) && +v.peakAt > 0) { const t = c.start + Math.min(len, +v.peakAt), s = Math.max(0, t - len * 0.5); start = s; end = Math.min(duration, s + len); start = Math.max(0, end - len); }
    return snapToSpeech({ start, end }, words, len, duration);
  });
  let fin = new Map();
  if (engine === 'gemini') { log('AI', 'Writing title and hook from the final clips…'); fin = await writeText(windows.map(w => ({ start: w.start, end: w.end })), { filePath, workDir, g, log: (m, k) => log('AI', m, k), game, words, hn: HN, userPrompt }); }
  const clips = picked.map((c, n) => {
    let { start, end } = windows[n]; const v = fin.get(n) ? { ...(c.ai || {}), ...fin.get(n) } : c.ai;
    const x = v && v.title ? { title: String(v.title).slice(0, 70), hookText: String(v.hookText || v.title), description: String(v.description || '').slice(0, 400) || localText(c, n).description, hashtags: Array.isArray(v.hashtags) ? v.hashtags : localText(c, n).hashtags, keywords: Array.isArray(v.keywords) ? v.keywords.map(String).slice(0, 12) : [] } : localText(c, n);
    const tags = [...new Set([...(x.hashtags || []).map(h => '#' + String(h).replace(/^#/, '').replace(/\s+/g, '')), '#gaming'])].slice(0, 8);
    let hook = x.hookText; try { const he = EM.splitTitle(String(hook || '')).emojis; hook = HK.hookLines(hook, x.title, HN); if (he && he.length) hook += ' ' + he.slice(0, 2).join(''); } catch {}
    let title = x.title; try { if (!/\p{Extended_Pictographic}/u.test(title)) title = `${title} ${EM.emojiForText(title + ' ' + (x.keywords || []).join(' ')) || '🎮'}`; } catch {}
    return { start: +start.toFixed(2), end: +end.toFixed(2), title, hookText: hook, description: x.description, hashtags: tags, keywords: x.keywords || [], category: 'High Energy', viralityScore: Math.max(60, Math.min(99, Math.round(60 + (v ? (+v.score || 0) * 3.5 : c.signal * 4)))), what: v && v.what ? String(v.what).slice(0, 160) : '' };
  }).sort((a, b) => a.start - b.start);
  return { clips, engine: engine === 'gemini' ? 'gemini' : 'offline', titleEngine: engine === 'gemini' ? 'gemini' : 'local', game };
}

module.exports = { findGamingClips, __t: { loudness, zscore, candidates } };
