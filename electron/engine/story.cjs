// "Script to Short": a voice-over (any language) + optional music / screen recordings -> a finished 9:16 short.
// Flow: words (Whisper) -> sentences -> beat plan (AI, or built-in rules without AI) -> pictures per beat (screen recording / stock b-roll / animated card)
//       -> character pop-ups on trigger words -> motion graphics + captions (one .ass) -> music under the voice + sound effects -> one mp4.
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const R = require('./render.cjs');
const W = require('./whisper.cjs');
const AI = require('./ai.cjs');
const ST = require('./stock.cjs');
const CH = require('./characters.cjs');
const MG = require('./mg.cjs');
const MO = require('./motion.cjs');
const FONTS = require('./fonts.cjs');
const { run, checkCancel } = require('./proc.cjs');
const ffmpeg = () => P.binOrPath('ffmpeg');
const slug = s => String(s || 'short').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'short';
const W_ = 1080, H_ = 1920, FPS = 30;
const nrm = w => String(w || '').toLowerCase().replace(/[.,!?;:"'()\[\]{}،۔؟।…\-]/g, '').trim();
const isNum = w => /\d/.test(w) || /[$€£₹]/.test(w);

// ---------------- sentences ----------------
function sentencesOf(words) {
  const out = []; let cur = [];
  const flush = () => { if (!cur.length) return; out.push({ i: out.length, a: cur[0], b: cur[cur.length - 1], text: cur.map(x => words[x].word).join(' '), start: words[cur[0]].start, end: words[cur[cur.length - 1]].end }); cur = []; };
  words.forEach((w, i) => {
    const prev = cur.length ? words[cur[cur.length - 1]] : null;
    if (prev && (w.start - prev.end > 0.7 || cur.length >= 16)) flush();
    cur.push(i);
    if (/[.!?؟۔।…]["')\]]*$/.test(w.word)) flush();
  });
  flush();
  return out;
}

// ---------------- plan ----------------
const STOPW = new Set('the and for are but not you your this that with have from they them then than what when where which will would there their about because just like really very been were into over also only some more most other such these those'.split(' '));
function bestWord(ws) {   // the strongest word of a beat for the big on-screen text
  let best = null, sc = 0;
  ws.forEach(w => { const t = nrm(w.word); if (!t) return; const latin = /^[a-z0-9]+$/.test(t); if (latin && (t.length < 5 || STOPW.has(t)) && !isNum(t)) return; if (!latin && t.length < 3) return; const s = (isNum(t) ? 100 : 0) + t.length; if (s > sc) { sc = s; best = w; } });
  return best;
}
function planOffline(sentences, words, o, menuId) {
  const beats = []; let cur = null;
  for (const s of sentences) {
    if (!cur) cur = { s: s.i, e: s.i, t0: s.start, t1: s.end };
    else { cur.e = s.i; cur.t1 = s.end; }
    if (cur.t1 - cur.t0 >= 2.4) { beats.push(cur); cur = null; }
  }
  if (cur) { if (beats.length && cur.t1 - cur.t0 < 1.4) { const b = beats[beats.length - 1]; b.e = cur.e; b.t1 = cur.t1; } else beats.push(cur); }
  const hasRec = (o.recordings || []).length > 0, hasStock = !!o.hasStock;
  beats.forEach((b, i) => {
    b.visual = hasRec && (i % 3 !== 2 || !hasStock) ? 'screen' : hasStock ? 'broll' : 'solid';
    const ws = inRange(words, b.s, b.e);
    b.query = ws.filter(w => /^[a-z]{5,}$/i.test(nrm(w.word)) && !STOPW.has(nrm(w.word))).slice(0, 3).map(w => nrm(w.word)).join(' ');
    if (b.visual === 'broll' && !b.query) b.visual = hasRec ? 'screen' : 'solid';
    const kw = (i % 3 === 0) ? bestWord(ws) : null;
    if (kw) b.kin = { text: nrm(kw.word), at: kw.start, kind: isNum(kw.word) ? 'stat' : 'word' };
  });
  return { beats, title: [], tool: '', checklist: [] };
}

function menuText(id) {
  const m = CH.menu(id); if (!m) return '';
  if (m.poses) return `Character poses: ${Object.entries(m.poses).map(([k, v]) => `${k} (${v.slice(0, 3).join('/')})`).join(', ')}.\nCharacter faces: ${Object.entries(m.faces).map(([k, v]) => `${k} (${v.slice(0, 3).join('/')})`).join(', ')}.`;
  return `Character looks: ${m.looks.map(l => l.id).join(', ')}.`;
}
async function planAI(g, sentences, words, o, total, log) {
  const list = sentences.slice(0, 90).map(s => `${s.i}. [${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.tt || s.text}`).join('\n');
  const rec = (o.recordings || []).length;
  const prompt = `You are a top short-form video editor (TikTok / Reels / Shorts). You get the transcript of a voice-over (it can be in ANY language; keep every on-screen word in the voice-over's own language, but write stock-footage search words in English).
The video is vertical 9:16 and ${total.toFixed(0)} seconds long. Sentences with their times:
${list}

${o.recDesc ? `What the screen recordings show (frame by frame, x and y are 0..1 positions of the important thing):\n${o.recDesc}\n` : ''}${o.notes ? `The editor answered your questions (treat these as facts, they are more important than guesses):\n${o.notes}\n` : ''}Available picture sources: ${rec ? `${rec} screen recording(s) of the thing being talked about ("screen"), ` : ''}${o.hasStock ? 'free stock footage ("broll"), ' : ''}and an animated colour card ("solid"). ${rec ? 'Use "screen" whenever the voice-over is describing or showing the product, tool, website or app. ' : ''}${o.hasStock ? 'Use "broll" for the emotional / story / context moments. ' : ''}
${o.character ? menuText(o.characterStyle) + '\nA cartoon character can pop in on a beat to react (e.g. a raised hand + surprised face on "wait", a wave on "hello", a pointing-down pose on "link in the comments", a $ face on money). Use him only where it adds something (at most about one beat in three), never twice in a row.' : 'Do not use a character.'}

Merge consecutive sentences into BEATS of about 2.2 to 5 seconds (each beat covers sentence numbers s..e, no gaps, no overlap, all sentences used in order). For every beat decide:
- "visual": ${['screen', 'broll', 'solid'].filter(v => v === 'solid' || (v === 'screen' && rec) || (v === 'broll' && o.hasStock)).map(v => `"${v}"`).join(' | ')}
- "query": 2-3 English words for stock footage when visual is "broll", else ""
${o.html ? `- "scene": you are also the MOTION DESIGNER. Design animated graphics like a professional product-explainer short: clean, playful, full of REAL content. Rules:
  * a beat whose visual is "solid" MUST get a full-screen scene built from real content: the real product / site name, real steps, real numbers and benefits taken from the voice-over, the editor's answers and the researched facts. Never generic filler.
  * a beat whose visual is "screen" or "broll" may get a small overlay or null: {"type":"callout","text":"Pick a campaign","x":0.5,"y":0.4} (ring + label pointing at a spot of the picture, x and y from 0 to 1; use the recording description to choose a real spot) or {"type":"badge","text":"Step 2"}.
  * full-screen scene types (every text short, in the transcript's language):
    {"type":"hero","title":"max 6 words","hi":"1-2 words of the title to highlight","sub":"optional short line"}
    {"type":"step","n":1,"label":"short action"}
    {"type":"flow","title":"","center":"the main thing","nodes":["3 to 5 short items around it"]}
    {"type":"compare","left":"Before","right":"After","caption":""}
    {"type":"checks","title":"","items":["2 to 4 benefits"]}
    {"type":"link","text":"Link copied","url":"the real link or site name"}
    {"type":"stat","value":"$1,000","label":"what it counts"}
  * vary the types and never use the same type twice in a row: "step" for numbered how-to moments, "flow" for features or options, "stat" for numbers, "link" when the voice-over says to click or open a link, "hero" for hooks and statements.
- "theme": {"mode":"light" or "dark","accent":"#hex","accent2":"#hex"} chosen to fit the brand and topic (use the product's own colours if the facts mention them). Light is the default look.
` : `- "kin": the 1-3 most powerful words of that beat, copied EXACTLY as spoken (big animated text), or "" if the beat has nothing worth stressing. "kind": "stat" for numbers / money / percentages, else "word".
`}
${o.character ? '- "char": null or {"pose": <pose>, "face": <face>}' : ''}
${o.html ? '' : '- "arrow": true when an arrow should point at the screen content (only on "screen" beats, at most twice in the video)'}
Also give: "title": 4 different clickbait thumbnail headlines (2-6 words each, in the voice-over language, curiosity or shock, no lies), "tool": the name of the website / product / app being promoted exactly as spoken ("" if none), "checklist": up to 3 short benefit phrases {"text","s"} where s is the sentence number in which the benefit is said (only if the voice-over lists benefits such as free / no sign up / all in one place).
Answer with JSON only: ${o.html ? '{"beats":[{"s":0,"e":1,"visual":"solid","query":"","scene":{"type":"hero","title":"...","hi":"..."},"char":null}],"theme":{"mode":"light","accent":"#FFD400","accent2":"#FFE45C"},"title":[],"tool":"","checklist":[]}' : '{"beats":[{"s":0,"e":1,"visual":"screen","query":"","kin":"","kind":"word","char":null,"arrow":false}],"title":[],"tool":"","checklist":[]}'}`;
  const r = await AI.generate(g, { prompt, json: true, timeoutMs: 90000 });
  return AI.parseJson(r.text);
}

// make any plan (AI or rules) valid: beats cover every sentence in order, times from the real words, trigger-word characters, sane limits
function finalize(plan, sentences, words, twords, o, total) {
  let beats = Array.isArray(plan.beats) ? plan.beats.filter(b => Number.isInteger(b.s) && Number.isInteger(b.e) && b.s <= b.e) : [];
  // Repair instead of throwing the AI plan away: sort, clamp, close gaps / overlaps, make the first start at 0 and the last end at the last sentence.
  const last = sentences.length - 1;
  beats = beats.map(b => ({ ...b, s: Math.max(0, Math.min(last, b.s)), e: Math.max(0, Math.min(last, b.e)) })).filter(b => b.s <= b.e).sort((x, y) => x.s - y.s);
  const fixed = [];
  for (const b of beats) {
    const prev = fixed[fixed.length - 1];
    if (prev && b.e <= prev.e) continue;                    // fully inside the previous beat
    if (prev) b.s = prev.e + 1;                             // closes gaps, trims overlaps
    else b.s = 0;
    fixed.push(b);
  }
  if (fixed.length) fixed[fixed.length - 1].e = last;
  beats = fixed;
  const ok = beats.length > 0;
  if (!ok) beats = planOffline(sentences, twords, o).beats;
  const hasRec = (o.recordings || []).length > 0;
  beats = beats.map((b, i) => {
    const s0 = sentences[Math.min(b.s, sentences.length - 1)], s1 = sentences[Math.min(b.e, sentences.length - 1)];
    let visual = ['screen', 'broll', 'solid'].includes(b.visual) ? b.visual : 'solid';
    if (visual === 'screen' && !hasRec) visual = o.hasStock ? 'broll' : 'solid';
    if (visual === 'broll' && (!o.hasStock || !String(b.query || '').trim())) visual = hasRec ? 'screen' : 'solid';
    let rec = null; const asg = (o.assign || []).find(a => Math.min(a.to, s1.end) - Math.max(a.from, s0.start) > 0.4 * Math.max(0.5, s1.end - s0.start));
    if (asg && asg.path) { visual = 'screen'; rec = asg.path; }
    return { ...b, rec, s: b.s, e: b.e, i, t0: i === 0 ? 0 : s0.start, t1: 0, a: s0.a, b: s1.b, visual, query: String(b.query || '').trim() };
  });
  beats.forEach((b, i) => { b.t1 = i + 1 < beats.length ? beats[i + 1].t0 : total; if (b.t1 - b.t0 < 0.8) b.t1 = b.t0 + 0.8; });
  // kinetic words: find the spoken word to get a real start time
  beats.forEach((b, i) => {
    const ws = inRange(twords, b.s, b.e);
    let k = b.kin; if (k && typeof k === 'string') k = { text: k, kind: b.kind || 'word' };
    if (k && k.text) {
      const toks = nrm(k.text).split(/\s+/).filter(Boolean), hit = ws.find(w => toks.includes(nrm(w.word)));
      const at = hit ? hit.start : b.t0 + 0.25;
      k = { text: String(k.text).slice(0, 40), at, dur: Math.min(2.2, Math.max(1.0, b.t1 - at - 0.1)), kind: isNum(k.text) ? 'stat' : (k.kind === 'stat' ? 'stat' : 'word') };
      if (o.motion === 'clean' && i % 2) k = null;
    } else k = null;
    b.kin = k; b.kinPos = b.visual === 'screen' ? 'top' : 'mid';
  });
  // characters: the AI picks the mood, a spoken trigger word (many languages) decides the exact look and moment
  const gap = { few: 6, normal: 3.6, many: 2.4 }[o.charLevel || 'normal'];
  let lastChar = -99; const st = o.characterStyle;
  if (o.character && st && st !== 'none' && CH.get(st)) {
    beats.forEach((b, i) => {
      const ws = words.slice(b.a, b.b + 1); let hit = null, hw = null;
      for (const w of ws) { const t = CH.trigger(st, w.word); if (t) { hit = t; hw = w; break; } }
      const want = hit ? { look: hit, at: Math.max(b.t0, hw.start - 0.05) } : (b.char && (b.char.pose || b.char.look || b.char.id) ? { look: b.char, at: b.t0 + 0.2 } : null);
      if (!want || want.at - lastChar < gap || (beats[i - 1] && beats[i - 1].char && !hit)) return;
      b.char = { ...want.look, at: want.at, dur: Math.min(2.8, b.t1 - want.at), side: (i % 2 ? 'right' : 'left') };
      if (b.char.dur < 0.9) { b.char = null; return; }
      lastChar = want.at;
    });
  }
  beats.forEach(b => { if (!b.char || !b.char.at) b.char = null; b.arrow = b.arrow === true && b.visual === 'screen' ? { at: b.t0 + 0.5 } : null; });
  let arrows = 0; beats.forEach(b => { if (b.arrow && ++arrows > 4) b.arrow = null; });
  if (o.html) {   // a recording never fills the whole video: at most two screen beats in a row (unless the editor gave a recording for that exact part) and about half of the time
    let run = 0, screenT = 0;
    beats.forEach(b => {
      if (b.visual === 'screen' && !b.rec) { if (run >= 2 || screenT > total * 0.5) { b.visual = 'solid'; b.scene = MO.FULL.includes(String((b.scene || {}).type)) ? b.scene : null; run = 0; return; } }
      if (b.visual === 'screen') { run++; screenT += b.t1 - b.t0; } else run = 0;
    });
  }
  if (o.html) beats.forEach(b => {
    b.kin = null; b.arrow = null;
    let sc = MO.normalize(b.scene);
    if (sc && MO.FULL.includes(sc.type)) b.visual = 'solid';
    else if (sc && b.visual !== 'screen' && b.visual !== 'broll') sc = null;
    b.scene = sc;
  });
  return beats;
}

// ---------------- pictures ----------------
async function detectCrop(file, dur, w, h) {
  const found = [];
  for (const f of [0.15, 0.45, 0.75]) {
    try {
      const r = await run(ffmpeg(), ['-ss', String(Math.max(0, dur * f)), '-i', file, '-t', '1.2', '-vf', 'cropdetect=limit=26:round=2:reset=0', '-an', '-f', 'null', '-']);
      const m = [...String(r.stderr).matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop(); if (m) found.push(m.slice(1).map(Number));
    } catch (e) { if (String(e.message) === 'CANCELLED') throw e; }
  }
  if (!found.length) return null;
  // keep the area that covers every sample (bars that really are bars stay out, moving content is never cut)
  const x0 = Math.min(...found.map(c => c[2])), y0 = Math.min(...found.map(c => c[3])), x1 = Math.max(...found.map(c => c[2] + c[0])), y1 = Math.max(...found.map(c => c[3] + c[1]));
  const cw = (x1 - x0) & ~1, ch = (y1 - y0) & ~1;
  if (cw < w * 0.3 || ch < h * 0.2 || (cw >= w - 4 && ch >= h - 4)) return null;
  return { w: cw, h: ch, x: x0 & ~1, y: y0 & ~1 };
}
let _hasGrad = null;
async function hasGradients() { if (_hasGrad == null) { try { _hasGrad = /\bgradients\b/.test((await run(ffmpeg(), ['-hide_banner', '-filters'])).stdout); } catch { _hasGrad = false; } } return _hasGrad; }

const VENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an'];
async function renderBeat(b, src, charPng, outFile, opt) {
  const D = +(b.t1 - b.t0).toFixed(3), args = ['-y'];
  let g = '', vi = 0;
  if (b.visual === 'screen' && src) {
    args.push('-ss', String(src.ss.toFixed(3)), '-t', String((D * src.speed + 0.2).toFixed(3)), ...(src.loop ? ['-stream_loop', '-1'] : []), '-i', src.path);
    const cw = src.crop ? src.crop.w : src.w, ch = src.crop ? src.crop.h : src.h;
    const fit = Math.min(1000 / cw, 1380 / ch), fw = Math.round(cw * fit / 2) * 2, fh = Math.round(ch * fit / 2) * 2;
    const crop = src.crop ? `crop=${src.crop.w}:${src.crop.h}:${src.crop.x}:${src.crop.y},` : '';
    g = `[0:v]setpts=PTS/${src.speed.toFixed(4)},fps=${FPS},${crop}split=2[a][c];` +
      `[a]scale=${W_}:${H_}:force_original_aspect_ratio=increase,crop=${W_}:${H_},boxblur=28:5,eq=brightness=-0.2:saturation=1.15[bg];` +
      `[c]scale=w='trunc(${fw}*(1+0.045*t/${D})/2)*2':h='trunc(${fh}*(1+0.045*t/${D})/2)*2':eval=frame[fg];` +
      `[bg][fg]overlay=x='(W-w)/2':y='(H-h)/2-70':eval=frame,format=yuv420p[v0]`;
  } else if (b.visual === 'broll' && src) {
    args.push('-ss', String(src.ss.toFixed(3)), '-t', String((D * src.speed + 0.2).toFixed(3)), ...(src.loop ? ['-stream_loop', '-1'] : []), '-i', src.path);
    g = `[0:v]setpts=PTS/${src.speed.toFixed(4)},fps=${FPS},scale=-2:2150:force_original_aspect_ratio=increase,crop=${W_}:${H_}:x='(iw-${W_})*(${b.i % 2 ? 0.65 : 0.35}+${b.i % 2 ? -0.3 : 0.3}*t/${D})':y='(ih-${H_})/2',eq=brightness=-0.06:saturation=1.12,format=yuv420p[v0]`;
  } else {
    const c = opt.accentDark || ['0d1b2a', '1b263b'];
    if (await hasGradients()) g = `gradients=s=${W_}x${H_}:c0=0x${c[0]}:c1=0x${c[1]}:x0=0:y0=0:x1=${W_}:y1=${H_}:speed=0.015:duration=${D}:rate=${FPS},format=yuv420p[v0]`;
    else g = `color=c=0x${c[0]}:s=${W_}x${H_}:r=${FPS}:d=${D},format=yuv420p[v0]`;
    vi = -1;
  }
  let last = 'v0';
  if (charPng && b.char) {
    args.push('-loop', '1', '-framerate', String(FPS), '-t', String(D), '-i', charPng);
    const ci = (vi === -1 ? 0 : 1), chH = opt.charH || 760, at = (b.char.at - b.t0).toFixed(3), cd = b.char.dur.toFixed(3);
    const cw = Math.round(chH * (opt.charAspect || 0.82));
    const x1 = b.char.side === 'right' ? W_ - cw + 40 : -40, x0 = b.char.side === 'right' ? W_ + 20 : -cw - 20;
    const p = `(t-${at})`, out = `(t-${at}-${cd}+0.25)`;
    const xe = `if(lt(${p},0.32),${x0}+(${x1}-${x0})*(1-pow(1-${p}/0.32,3)),if(gt(${p},${cd}-0.25),${x1}+(${x0}-${x1})*pow(${out}/0.25,2),${x1}))`;
    const ye = `H-h*0.9+8*sin(6*${p})`;
    g += `;[${ci}:v]format=rgba,scale=-2:${chH}[ch];[${last}][ch]overlay=x='${xe}':y='${ye}':enable='between(t,${at},${(+at + +cd).toFixed(3)})':eval=frame,format=yuv420p[v1]`;
    last = 'v1';
  }
  args.push('-filter_complex', g, '-map', `[${last}]`, '-t', String(D), ...VENC, outFile);
  await run(ffmpeg(), args);
}

// ---------------- main ----------------

const inRange = (tw, a, b) => tw.filter(w => w.si >= a && w.si <= b);
const mmss = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
// words with the sentence they belong to; a translated sentence gets its words spread over the sentence time
function phrasesOf(words, sentences) {   // short chunks of spoken words: the unit for translating / correcting captions
  sentences.forEach(sn => {
    sn.ph = []; let cur = [];
    const flush = () => { if (cur.length) { sn.ph.push({ a: cur[0], b: cur[cur.length - 1], start: words[cur[0]].start, end: words[cur[cur.length - 1]].end, tt: null }); cur = []; } };
    for (let k = sn.a; k <= sn.b; k++) { cur.push(k); const w = words[k], nx = words[k + 1]; if (cur.length >= 5 || /[,;:.!?؟،۔।…]$/.test(w.word) || (nx && k < sn.b && nx.start - w.end > 0.35)) flush(); }
    flush();
  });
  return sentences.flatMap(sn => sn.ph.map(p => (p.si = sn.i, p)));
}
// each phrase keeps the exact time of the spoken words it replaces, so captions stay in sync
function buildTwords(words, sentences) {
  const out = [];
  sentences.forEach(sn => {
    for (const ph of (sn.ph || [{ a: sn.a, b: sn.b, start: sn.start, end: sn.end, tt: null }])) {
      if (ph.tt) {
        const toks = ph.tt.split(/\s+/).filter(Boolean), tot = toks.reduce((a, t) => a + t.length + 1, 0) || 1, dur = Math.max(0.25, ph.end - ph.start); let t = ph.start;
        toks.forEach(tk => { const d = dur * (tk.length + 1) / tot; out.push({ word: tk, start: +t.toFixed(3), end: +(t + d).toFixed(3), si: sn.i }); t += d; });
      } else for (let k = ph.a; k <= ph.b; k++) out.push({ ...words[k], si: sn.i });
    }
    sn.tt = sn.ph && sn.ph.some(p => p.tt) ? sn.ph.map(p => p.tt || sn.text).join(' ') : null;
  });
  return out;
}
// lang set -> translate every phrase; lang empty -> only fix mis-heard words / names using the editor's notes
async function rewritePhrases(g, phrases, words, lang, notes, cta) {
  let newCta = cta, changed = 0;
  for (let off = 0; off < phrases.length; off += 140) {
    const part = phrases.slice(off, off + 140), txt = p => words.slice(p.a, p.b + 1).map(w => w.word).join(' ');
    // phrases grouped by their sentence: the AI reads the whole sentence for meaning, but must answer one text per numbered phrase
    const groups = []; part.forEach((p, i) => { const gI = groups[groups.length - 1]; if (gI && gI.si === p.si) gI.items.push([i, p]); else groups.push({ si: p.si, items: [[i, p]] }); });
    const list = groups.map(gr => `Sentence: ${gr.items.map(([, p]) => txt(p)).join(' ')}\n` + gr.items.map(([i, p]) => `  ${i}. ${txt(p)}`).join('\n')).join('\n');
    const prompt = lang
      ? `You subtitle a voice-over. The text was machine-transcribed, so some words may be mis-heard (Hindi/Urdu/English mixed speech especially): first understand each whole SENTENCE and the context, then translate into ${lang}. Output one ${lang} text for every numbered phrase, same order. Rules: each output translates ONLY its own numbered phrase (never move words between phrases, never leave a phrase empty), read in order the phrases of a sentence must form one natural sentence, spoken style, short. Keep names, brands, links as written. Write digits only where a number was really spoken. If a phrase is already in ${lang}, copy it.${notes && off === 0 ? '\nContext about the video (names and facts):\n' + notes.slice(0, 1500) : ''}${off === 0 ? '\nAlso translate this button text: ' + JSON.stringify(cta || '') : ''}\n${list}\nJSON only: {"t":["..."],"cta":""}`
      : `These phrases were machine-transcribed from a voice-over and may contain mis-heard words, wrong spellings or wrongly written names. Fix ONLY real mistakes, using this context and the whole sentence. Keep the same language and script, keep the same number of words where possible, one output per numbered phrase in the same order. If a phrase is fine, copy it exactly.\nContext (names, links, facts):\n${(notes || '').slice(0, 1800)}\n${list}\nJSON only: {"t":["..."]}`;
    const r = AI.parseJson((await AI.generate(g, { prompt, json: true, timeoutMs: 90000 })).text);
    // accept an array, or an object keyed by the phrase number; answers like "3. text" are matched by their number; the rest keep the original words
    const got = new Array(part.length).fill(null); const src = r && (r.t !== undefined ? r.t : r.translations !== undefined ? r.translations : r);
    if (Array.isArray(src)) {
      if (src.length === part.length) src.forEach((v, i) => { got[i] = v; });
      else src.forEach((v, i) => { const m = /^\s*(\d+)\s*[.):\-]\s*([\s\S]*)$/.exec(String(v)); if (m && +m[1] < part.length) got[+m[1]] = m[2]; else if (v && typeof v === 'object' && v.i !== undefined) got[+v.i] = v.t || v.text; });
    } else if (src && typeof src === 'object') Object.keys(src).forEach(k => { if (/^\d+$/.test(k) && +k < part.length) got[+k] = src[k]; });
    if (got.filter(v => v != null && String(v).trim()).length < part.length * 0.6) throw new Error('the AI answer did not match the phrases');
    part.forEach((p, i) => {
      const t = String(got[i] == null ? '' : got[i]).trim(), orig = words.slice(p.a, p.b + 1).map(w => w.word).join(' ');
      if (!t || t === orig) return;
      const ratio = t.split(/\s+/).length / Math.max(1, p.b - p.a + 1);
      if (!lang && (ratio < 0.5 || ratio > 2)) return;
      p.tt = t; changed++;
    });
    if (lang && off === 0 && r && r.cta) newCta = String(r.cta).slice(0, 28);
  }
  return { cta: newCta, changed };
}
// ---- questions the AI asks before it edits ----
const URLRE = /(https?:\/\/[^\s"')]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|app|co|me|fun|dev|tv|xyz|gg|so|to|in|pk|us|uk)\b(?:\/[^\s"')]*)?)/ig;
function questionsOffline(sentences) {
  const qs = []; const hit = /\b(link|links|website|web site|site|app|download|comment|click|tool|platform|software|dashboard|campaign|http|www|\.com)\b|लिंक|वेबसाइट|ऐप|डाउनलोड|कमेंट|لنک|لینک|ویب|ایپ|ڈاؤن/i;
  for (const s of sentences) {
    if (qs.length >= 6) break;
    if (!hit.test(s.text)) continue;
    const when = `${mmss(s.start)}-${mmss(s.end)}`, say = s.text.length > 70 ? s.text.slice(0, 67) + '...' : s.text;
    qs.push({ id: 'q' + qs.length, from: s.start, to: s.end, kind: 'recording', text: `At ${when} you say: "${say}". Do you have a screen recording for this part?` });
  }
  if (qs.length) qs.push({ id: 'q' + qs.length, from: 0, to: 0, kind: 'link', text: 'Which website, app or link is this video about? Write its name and link, so the app can read about it.' });
  return qs;
}
// AI answers are not always shaped exactly as asked: take the first list found
const listOf = (r, key) => Array.isArray(r) ? r : (r && typeof r === 'object' ? (Array.isArray(r[key]) ? r[key] : (Object.values(r).find(v => Array.isArray(v)) || (r[key] && typeof r[key] === 'object' ? Object.values(r[key]) : null))) : null) || [];
async function questionsAI(g, sentences, o) {
  const list = sentences.slice(0, 120).map(s => `${s.i}. [${mmss(s.start)}-${mmss(s.end)} | ${s.start.toFixed(1)}-${s.end.toFixed(1)}s] ${s.text}`).join('\n');
  const prompt = `You are the editor of a short vertical video made from the voice-over below (any language). Before editing you must remove every doubt. Read it carefully and ask the creator short questions about anything you cannot know from the words alone:
- a website, tool, app, product or link that is mentioned or clicked ("go to the link") -> ask for its name and link (kind "link")
- a moment where the viewer should SEE something on a screen (a website, app, steps, a result) -> ask if they have a screen recording for that part (kind "recording")
- unclear things, numbers, names, goals, who the audience is, what the viewer should do at the end -> kind "detail"
Rules: simple, easy ENGLISH only (even if the voice-over is in another language). Every question must point to the time it is about, like: You mention a website at 0:10-0:12. What is its name and link? Be specific, never generic. Between ${o.hasRec ? 3 : 2} and 8 questions, most important first, no duplicates, do not ask what is already clear. "from" and "to" are the start and end seconds (numbers) of the part it is about (0 and 0 if it is about the whole video).
Voice-over:\n${list}\nJSON only: {"questions":[{"from":10.2,"to":12.4,"kind":"link","text":"..."}]}`;
  let qs = [], last = '';
  for (let tries = 0; tries < 2 && !qs.length; tries++) {
    const raw = (await AI.generate(g, { prompt, json: true, timeoutMs: 90000 })).text; last = String(raw || '').slice(0, 80);
    qs = listOf(AI.parseJson(raw), 'questions').map(q => (typeof q === 'string' ? { text: q } : q)).filter(q => q && (q.text || q.question)).slice(0, 8)
      .map((q, i) => ({ id: 'q' + i, from: +q.from || 0, to: +q.to || 0, kind: ['link', 'recording', 'detail'].includes(q.kind) ? q.kind : 'detail', text: String(q.text || q.question).slice(0, 400) }));
  }
  if (!qs.length) throw new Error('no questions; the AI said: ' + last.replace(/\s+/g, ' '));
  return qs;
}
async function getWords(job, wav, vdur, work, log, stage, lo, hi) {
  let words = job.words || job.testWords || null;
  if (!words) {
    stage('Listening', lo, 'Transcribing the voice-over');
    words = await W.transcribe(wav, { hardware: job.hardware, log, prompt: '', modelId: job.modelId, language: job.language || 'auto', workDir: work, duration: vdur, chunkSec: 300, slice: R.sliceAudio, onProgress: p => stage('Listening', lo + p * (hi - lo), 'Transcribing the voice-over') });
    try { words = require('./sync.cjs').refineWords(words, wav); } catch {}
  }
  words = (words || []).filter(w => w.word && String(w.word).trim());
  if (!words.length) throw new Error('No speech detected in this voice-over.');
  return words;
}
// phase 1: listen + think, then hand the questions to the person
async function analyzeStory(job, emit) {
  const log = (src, msg, kind) => emit({ type: 'log', src, msg, kind: kind || 'info' });
  const stage = (st, pct, msg) => emit({ type: 'progress', stage: st, pct: Math.round(pct), msg });
  if (!job.voicePath || !fs.existsSync(job.voicePath)) throw new Error('Choose a voice-over file first.');
  const work = path.join(P.workRoot(), 'storyA_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)); fs.mkdirSync(work, { recursive: true });
  try {
    stage('Listening', 2, 'Reading the voice-over');
    const vinfo = await R.probe(job.voicePath); const vdur = vinfo.duration; if (!(vdur > 1)) throw new Error('The voice-over is empty or unreadable.');
    const wav = path.join(work, 'voice.wav'); await R.extractAudio(job.voicePath, wav); checkCancel();
    const words = await getWords(job, wav, vdur, work, log, stage, 4, 70); checkCancel();
    const sentences = sentencesOf(words);
    log('Script to Short', `${words.length} words, ${sentences.length} sentences, ${vdur.toFixed(1)} s`, 'success');
    stage('Understanding', 74, 'Understanding what the voice-over is about');
    const o = { hasRec: ((job.recordings || []).length) > 0 };
    let questions = null;
    if (AI.ready(job.gemini)) { try { questions = await questionsAI(job.gemini, sentences, o); log('AI editor', `${questions.length} question(s) ready`, 'success'); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('AI editor', 'The AI could not write questions (' + String(e.message).slice(0, 100) + '), using simple ones', 'warn'); } }
    if (!questions) questions = questionsOffline(sentences);
    const transcript = sentences.map(s => `[${mmss(s.start)}] ${s.text}`).join('\n');
    stage('Understanding', 100, 'Waiting for your answers');
    return { words, duration: vdur, questions, transcript };
  } finally { try { fs.rmSync(work, { recursive: true, force: true }); } catch {} }
}


function autoScene(b, ws, i) {   // used when the AI gave no usable scene (or there is no AI)
  const cl = w => String(w.word).replace(/[.,!?;:،۔؟]+$/g, ''), text = ws.map(cl).join(' ');
  const num = ws.find(w => { const d = String(w.word).replace(/\D/g, ''); return d.length >= 3 || (/\d/.test(w.word) && /[$€£₹%]|k\b/i.test(w.word)); });
  if (num) return { type: 'stat', value: cl(num), label: text.slice(0, 40) };
  const kw = bestWord(ws), short = ws.slice(0, 6).map(cl).join(' ');
  if (i % 3 === 1 && kw) return { type: 'step', n: Math.floor(i / 2) + 1, label: short.slice(0, 28) };
  return { type: 'hero', title: short.slice(0, 48), hi: kw ? cl(kw) : '', sub: '' };
}
function rectOf(src, visual) {   // where the recording sits inside the 1080x1920 frame (same maths as renderBeat)
  if (visual !== 'screen' || !src) return { x: 0, y: 0, w: 1080, h: 1920 };
  const cw = src.crop ? src.crop.w : src.w, ch = src.crop ? src.crop.h : src.h, fit = Math.min(1000 / cw, 1380 / ch), fw = Math.round(cw * fit / 2) * 2, fh = Math.round(ch * fit / 2) * 2;
  return { x: (W_ - fw) / 2, y: (H_ - fh) / 2 - 70, w: fw, h: fh };
}
// the AI looks at a few frames of each recording so it knows what is on screen and where
async function describeRecordings(g, files, work, log) {
  const out = [];
  for (let k = 0; k < Math.min(3, files.length); k++) {
    const f = files[k];
    try {
      const info = await R.probe(f), crop = await detectCrop(f, info.duration, info.width, info.height), n = 6, parts = [], times = [];
      for (let j = 0; j < n; j++) {
        const t = Math.max(0, Math.min(info.duration - 0.3, info.duration * (j + 0.5) / n)), jpg = path.join(work, `rd${k}_${j}.jpg`);
        await run(ffmpeg(), ['-y', '-ss', t.toFixed(2), '-i', f, '-frames:v', '1', '-vf', `${crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : ''}scale=640:-2`, '-q:v', '5', jpg]);
        times.push(t); parts.push({ text: `Frame ${j + 1} at ${t.toFixed(1)} s:` }, { inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(jpg).toString('base64') } });
      }
      parts.unshift({ text: `These ${n} frames come from a screen recording of an app or website. Say in one short sentence what it shows (name the app or site if you can read it). Then for each frame name the single most important button / area and its center as x,y from 0 to 1 (0,0 = top-left). JSON only: {"summary":"","frames":[{"t":0.0,"what":"","x":0.5,"y":0.5}]}` });
      const r = AI.parseJson((await AI.generate(g, { parts, json: true, timeoutMs: 90000 })).text);
      out.push(`Recording ${k + 1} (${path.basename(f)}, ${info.duration.toFixed(0)} s): ${String(r.summary || '').slice(0, 200)}\n` + (r.frames || []).slice(0, n).map((fr, j) => `  at ${(+fr.t || times[j] || 0).toFixed(1)} s: ${String(fr.what || '').slice(0, 60)} (x ${(+fr.x || 0.5).toFixed(2)}, y ${(+fr.y || 0.5).toFixed(2)})`).join('\n'));
    } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('AI editor', 'Could not look at ' + path.basename(f) + ': ' + String(e.message).slice(0, 80), 'warn'); }
  }
  return out.join('\n');
}
async function runStory(job, emit, hooks = {}) {
  let logFile = null; const logBuf = [];
  const log = (src, msg, kind) => { emit({ type: 'log', src, msg, kind: kind || 'info' }); const line = `[${new Date().toISOString().slice(11, 19)}] ${kind || 'info'} ${src}: ${msg}\n`; try { if (logFile) fs.appendFileSync(logFile, line); else logBuf.push(line); } catch {} };
  const stage = (st, pct, msg) => emit({ type: 'progress', stage: st, pct: Math.round(pct), msg });
  const o = { motion: 'bold', captions: true, accent: '#FFD400', character: true, characterStyle: 'suit', charLevel: 'normal', cta: 'COMMENT "LINK"', sfx: true, musicVol: 16, broll: true, ...(job.options || {}) };
  o.html = !!hooks.frames && o.motionHtml !== false;
  o.recordings = (job.recordings || []).filter(f => fs.existsSync(f));
  o.hasStock = !!(o.broll && job.stockKeys && Object.values(job.stockKeys).some(k => k && String(k).trim()));
  if (!job.voicePath || !fs.existsSync(job.voicePath)) throw new Error('Choose a voice-over file first.');
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const outDir = path.join(job.clipsBase || path.join(P.userDataDir(), 'out'), 'ScriptToShort', `${slug(job.name || path.basename(job.voicePath, path.extname(job.voicePath)))}_${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  logFile = path.join(outDir, 'log.txt'); try { fs.writeFileSync(logFile, logBuf.join('')); } catch {}
  const work = path.join(P.workRoot(), 'story_' + stamp + '_' + Math.random().toString(36).slice(2, 6)); fs.mkdirSync(work, { recursive: true });
  const t00 = Date.now();
  try {
    stage('Preparing', 2, 'Reading the voice-over');
    const vinfo = await R.probe(job.voicePath); const vdur = vinfo.duration; if (!(vdur > 1)) throw new Error('The voice-over is empty or unreadable.');
    const total = +(vdur + 0.9).toFixed(2);
    const wav = path.join(work, 'voice.wav'); await R.extractAudio(job.voicePath, wav);
    checkCancel();

    // 1) words (already known when the questions were asked)
    const words = await getWords(job, wav, vdur, work, log, stage, 5, 30);
    checkCancel();
    const sentences = sentencesOf(words);
    log('Script to Short', `${words.length} words, ${sentences.length} sentences, ${vdur.toFixed(1)} s`, 'success');

    // 1b) answers + links the editor gave
    const answers = (job.answers || []).filter(a => a && (String(a.text || '').trim() || a.rec));
    o.assign = answers.filter(a => a.rec && fs.existsSync(a.rec)).map(a => ({ from: +a.from || 0, to: +a.to || 0, path: a.rec })).filter(a => a.to > a.from);
    o.recordings = [...new Set([...o.recordings, ...o.assign.map(a => a.path)])];
    const urls = [...new Set(answers.flatMap(a => (String(a.text).match(URLRE) || []).map(u => u.replace(/[.,;]+$/, ''))))].slice(0, 4);
    let facts = [];
    if (urls.length) { stage('Researching', 31, 'Reading the links you gave'); try { facts = await require('./research.cjs').research(urls, log); } catch (e) { log('Research', 'Could not read the links: ' + String(e.message).slice(0, 100), 'warn'); } }
    o.notes = [...answers.map(a => `Q: ${a.q || ''}\nA: ${String(a.text || '').trim()}${a.rec ? ' (screen recording provided for this part)' : ''}`),
      ...facts.map(f => `About ${f.url}: "${f.title}". ${f.desc} ${f.text}`.slice(0, 900))].join('\n').slice(0, 5000);
    const tl = String(o.textLang || '').trim();
    const phrases = phrasesOf(words, sentences);
    if (AI.ready(job.gemini) && (tl || o.notes)) {
      stage(tl ? 'Translating' : 'Understanding', 33, tl ? 'Translating captions and texts to ' + tl : 'Checking the spelling of the captions');
      try { const rr = await rewritePhrases(job.gemini, phrases, words, tl, o.notes, o.cta); o.cta = rr.cta; if (tl) o.thumbCta = o.cta; log('AI editor', tl ? 'Translated to ' + tl : `Fixed ${rr.changed} mis-heard caption phrase(s)`, 'success'); }
      catch (e) { if (String(e.message) === 'CANCELLED') throw e; phrases.forEach(p => { p.tt = null; }); log('AI editor', (tl ? 'Translation' : 'Caption check') + ' failed (' + String(e.message).slice(0, 100) + '), keeping the original words', 'warn'); }
    } else if (tl) log('AI editor', 'Translating needs an AI key: keeping the voice-over language', 'warn');
    const twords = buildTwords(words, sentences);

    // 2) plan
    stage('Planning', 32, 'Planning the edit');
    let raw = null;
    if (o.html && AI.ready(job.gemini) && o.recordings.length) { stage('Planning', 34, 'Looking at your recordings'); try { o.recDesc = await describeRecordings(job.gemini, o.recordings, work, log); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; } }
    if (job.testPlan) raw = job.testPlan;
    else if (AI.ready(job.gemini)) { try { raw = await planAI(job.gemini, sentences, twords, o, total, log); log('AI editor', 'Edit plan ready', 'success'); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('AI editor', 'The AI plan failed (' + String(e.message).slice(0, 120) + '), using the built-in rules instead', 'warn'); } }
    else log('AI editor', 'No AI key: using the built-in editing rules (add an AI key in Settings for smarter cuts, hooks and headlines)', 'info');
    if (!raw) raw = planOffline(sentences, twords, o);
    const beats = finalize(raw, sentences, words, twords, o, total);
    if (!(raw.title && raw.title.length)) raw.title = beats.filter(b => b.kin && b.kin.text).slice(0, 4).map(b => b.kin.text.toUpperCase());
    const tool = String(raw.tool || job.options && job.options.toolName || '').trim().slice(0, 28);
    checkCancel();

    // 3) pictures
    stage('Footage', 38, 'Finding pictures');
    const recs = [];
    for (const f of o.recordings) { try { const info = await R.probe(f); const crop = await detectCrop(f, info.duration, info.width, info.height); recs.push({ path: f, dur: info.duration, w: info.width, h: info.height, crop, pos: 0 }); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Recordings', 'Could not read ' + path.basename(f), 'warn'); } }
    const seen = { q: new Map(), used: new Set() }; let ri = 0;
    const srcs = [];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i], D = b.t1 - b.t0; let src = null;
      if (b.visual === 'broll') {
        stage('Footage', 38 + 12 * i / beats.length, `Stock footage: ${b.query}`);
        try { const f = await ST.search(b.query, job.stockKeys, seen, log); if (f) { const sp = Math.min(2, Math.max(0.6, Math.min(f.dur, 14) / D)); src = { path: f.path, ss: 0, speed: f.dur >= D ? 1 : Math.max(0.5, f.dur / D), loop: f.dur < D * 0.6, w: f.w, h: f.h }; } } catch (e) { if (String(e.message) === 'CANCELLED') throw e; }
        if (!src) { b.visual = recs.length ? 'screen' : 'solid'; log('Stock footage', `No clip for "${b.query}", using ${b.visual === 'screen' ? 'your recording' : 'an animated card'}`, 'info'); }
      }
      if (b.visual === 'screen' && recs.length) {
        const pool = recs.filter(x => !(o.assign || []).some(a => a.path === x.path)), r = (b.rec && recs.find(x => x.path === b.rec)) || (pool.length ? pool[ri % pool.length] : recs[ri % recs.length]);
        // walk through the recording in order: each screen beat continues where the last one stopped, speeding up or slowing down to fit the sentence
        const left = r.dur - r.pos; let speed = 1, ss = r.pos;
        if (left < D * 0.55) { ss = 0; r.pos = 0; }
        const avail = r.dur - r.pos; speed = Math.min(2.2, Math.max(0.6, Math.min(avail, Math.max(D, 3)) / D));
        if (avail > D * 2.2) speed = 1.0 + Math.min(1.0, (avail / (D * 3)) * 0.25);
        src = { path: r.path, ss: r.pos, speed, w: r.w, h: r.h, crop: r.crop, loop: false };
        r.pos = Math.min(r.dur - 0.2, r.pos + D * speed); if (r.dur - r.pos < 1) { r.pos = 0; if (!b.rec) ri++; }
      } else if (b.visual === 'screen') b.visual = 'solid';
      srcs.push(src);
      checkCancel();
    }

    // 3b) every beat without footage gets an animated scene (the AI's own, or a simple one built from the words)
    if (o.html) beats.forEach((b, i) => {
      if (b.visual === 'solid' && !(b.scene && MO.FULL.includes(b.scene.type))) b.scene = autoScene(b, inRange(twords, b.s, b.e), i);
    });

    // 4) characters
    const charPngs = [];
    let charAspect = 0.82;
    if (o.character && o.characterStyle && o.characterStyle !== 'none') {
      for (const b of beats) {
        if (!b.char) { charPngs.push(null); continue; }
        try { const p = await CH.compose(o.characterStyle, b.char); charPngs.push(p); } catch (e) { log('Characters', 'Could not load a character picture: ' + e.message, 'warn'); b.char = null; charPngs.push(null); }
      }
      const sz = CH.sizeOf(o.characterStyle); if (sz.w) charAspect = sz.w / sz.h;
    } else beats.forEach(b => { b.char = null; charPngs.push(null); });

    // 5) pictures -> segments
    const segDir = path.join(work, 'seg'); fs.mkdirSync(segDir, { recursive: true });
    const accentDark = { '#FFD400': ['1a1400', '3a2e00'] }[String(o.accent).toUpperCase()] || ['0d1b2a', '1b263b'];
    const palettes = [['0d1b2a', '1b263b'], ['1a0f2e', '3a1d5c'], ['0b2a24', '14524a'], ['2b0f12', '5a1a22']];
    const segs = [];
    for (let i = 0; i < beats.length; i++) {
      stage('Editing', 52 + 26 * i / beats.length, `Editing scene ${i + 1} of ${beats.length}`);
      const f = path.join(segDir, `s${i}.mp4`);
      await renderBeat(beats[i], srcs[i], (o.html && beats[i].scene && MO.FULL.includes(beats[i].scene.type)) ? null : charPngs[i], f, { charH: o.charH || 760, charAspect, accentDark: palettes[i % palettes.length] });
      segs.push(f); checkCancel();
    }
    const list = path.join(work, 'list.txt'); fs.writeFileSync(list, segs.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const base = path.join(work, 'base.mp4'); await run(ffmpeg(), ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', base]);

    // 6) motion graphics (animated scenes) + captions
    stage('Graphics', 79, 'Adding motion graphics and captions');
    let motion = [];
    if (o.html) {
      const th = (raw.theme && typeof raw.theme === 'object') ? raw.theme : {}, acc = MO.hex(th.accent, o.accent), mode = ['light', 'dark'].includes(o.sceneMode) ? o.sceneMode : (['light', 'dark'].includes(th.mode) ? th.mode : (String(o.accent).toLowerCase() === '#ffffff' ? 'dark' : 'light'));
      const items = [];
      beats.forEach((b, i) => {
        if (!b.scene) return; const sc = { ...b.scene };
        if (sc.type === 'callout') { const r = rectOf(srcs[i], b.visual); sc.px = Math.round(r.x + Math.min(0.95, Math.max(0.05, +sc.x || 0.5)) * r.w); sc.py = Math.round(r.y + Math.min(0.95, Math.max(0.05, +sc.y || 0.45)) * r.h); }
        if (MO.FULL.includes(sc.type) && b.char && charPngs[i]) sc.ch = { src: charPngs[i], at: Math.max(0, b.char.at - b.t0), dur: b.char.dur, side: b.char.side, h: o.charH || 760 };
        items.push({ id: 'b' + i, scene: sc, t0: b.t0, t1: b.t1, dur: +(b.t1 - b.t0).toFixed(3) });
      });
      if (o.cta) { const t0 = Math.max(0, vdur - 2.4); items.push({ id: 'cta', scene: { type: 'cta', text: o.cta }, t0, t1: total, dur: +(total - t0).toFixed(3) }); }
      try {
        motion = await MO.renderAll(items, { mode, accent: acc, accent2: MO.hex(th.accent2, acc), fontsDir: P.fontsDir(), fps: 24 }, hooks, work, log, (k, n, ty) => { stage('Graphics', 79 + 10 * k / n, `Drawing motion graphics ${k + 1} of ${n}`); checkCancel(); });
        if (motion.some(m => m.over && !m.alpha)) { log('Motion graphics', 'This PC could not draw see-through graphics, so overlays on recordings were skipped', 'warn'); motion = motion.filter(m => !(m.over && !m.alpha)); }
        log('Motion graphics', `${motion.length} animated scene(s) drawn`, 'success');
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Motion graphics', 'Could not draw the animated scenes (' + String(e.message).slice(0, 100) + '), continuing without them', 'warn'); motion = []; }
    }
    const ctaDrawn = motion.some(m => m.id === 'cta');
    const lbl = tool && beats.length ? (() => { const w = words.find(x => nrm(x.word).includes(nrm(tool).split(/\s+/)[0])); return { text: tool, at: w ? Math.max(0.3, w.start - 0.1) : 0.6 }; })() : null;
    const checklist = (raw.checklist || []).filter(c => c && c.text && Number.isInteger(c.s) && sentences[c.s]).slice(0, 3).map(c => ({ text: String(c.text).slice(0, 26), at: sentences[c.s].start }));
    const mg = MG.build({ W: W_, H: H_, total, words: twords, beats, accent: o.accent, motion: o.motion, captions: o.captions, capFont: o.capFont, label: o.html ? null : lbl, checklist: o.html ? [] : checklist, cta: o.cta && !ctaDrawn ? { text: o.cta, at: Math.max(0, vdur - 2.2) } : null, charSpans: beats.filter(b => b.char).map(b => ({ a: b.char.at, b: b.char.at + b.char.dur })) });
    fs.writeFileSync(path.join(work, 'captions.ass'), mg.ass);
    FONTS.stageFonts(path.join(work, 'fonts'), mg.fonts);

    // 7) sound
    const sfx = [];
    if (o.sfx !== false) {
      let lib = null; try { lib = require('./sfxlib.cjs'); } catch {}
      const events = [];
      beats.forEach((b, i) => { if (i > 0) events.push({ t: b.t0, role: 'whoosh' }); if (b.kin) events.push({ t: b.kin.at, role: b.kin.kind === 'stat' ? 'hit' : 'pop' }); if (b.char) events.push({ t: b.char.at, role: 'pop' }); if (b.scene && motion.some(m => m.id === 'b' + i)) events.push({ t: b.t0 + (MO.FULL.includes(b.scene.type) ? 0.45 : 0.5), role: b.scene.type === 'stat' ? 'hit' : 'pop' }); });
      checklist.forEach(c => events.push({ t: c.at, role: 'pop' }));
      if (o.cta) events.push({ t: Math.max(0, vdur - 2.2), role: 'reward' });
      events.sort((a, c) => a.t - c.t); let lastT = -9; const cnt = {};
      for (const e of events) {
        if (e.t - lastT < 0.35) continue; lastT = e.t;
        try { const list = lib && lib.byRole ? lib.byRole(e.role) : []; if (!list.length) continue; const pick = list[(cnt[e.role] = (cnt[e.role] || 0) + 1) % list.length]; const file = pick.path; if (file && fs.existsSync(file)) sfx.push({ t: e.t, file, gainDb: pick.gainDb || 0, role: e.role }); } catch {}
      }
    }
    stage('Mixing', 90, 'Mixing voice, music and effects');
    const out = path.join(outDir, 'short.mp4');
    const inputs = ['-i', base, '-i', job.voicePath]; let mi = -1;
    if (job.musicPath && fs.existsSync(job.musicPath)) { inputs.push('-stream_loop', '-1', '-i', job.musicPath); mi = 2; }
    const sfxStart = mi === -1 ? 2 : 3; sfx.forEach(s => inputs.push('-i', s.file));
    const AF = 'aformat=sample_rates=44100:channel_layouts=stereo';
    let af = `[1:a]${AF},loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${total}[vo]`; const mix = [];
    if (mi !== -1) {
      af += `;[vo]asplit=2[v1][v2];[${mi}:a]${AF},atrim=0:${total},asetpts=N/SR/TB,volume=${(o.musicVol / 100).toFixed(3)},afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, total - 1.6)}:d=1.6[mus];[mus][v2]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=400[md]`; mix.push('[v1]', '[md]');
    } else mix.push('[vo]');
    sfx.forEach((s, k) => { const ms = Math.max(0, Math.round(s.t * 1000)); af += `;[${sfxStart + k}:a]${AF},adelay=${ms}|${ms},volume=${(Math.pow(10, (s.gainDb || 0) / 20) * 0.7).toFixed(3)}[x${k}]`; mix.push(`[x${k}]`); });
    af += `;${mix.join('')}amix=inputs=${mix.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95[aout]`;
    let ni = inputs.filter(x => x === '-i').length, cur = '0:v'; const vparts = [];
    motion.forEach((m, j) => {
      const T = m.t0.toFixed(3), en = `enable='between(t,${T},${m.t1.toFixed(3)})'`;
      if (m.bw) {   // overlay drawn on black + on white -> transparency from the difference
        inputs.push('-framerate', '24', '-i', path.join(m.dirB, '%05d.png'), '-framerate', '24', '-i', path.join(m.dirW, '%05d.png')); const ib = ni++, iw = ni++;
        vparts.push(`[${ib}:v]format=rgb24,setpts=PTS-STARTPTS+${T}/TB,split=2[kA${j}][kC${j}]`, `[${iw}:v]format=rgb24,setpts=PTS-STARTPTS+${T}/TB[wA${j}]`,
          `[wA${j}][kA${j}]blend=all_expr='255-(A-B)',format=gray[al${j}]`, `[kC${j}][al${j}]alphamerge[m${j}]`, `[${cur}][m${j}]overlay=alpha=premultiplied:eof_action=pass:repeatlast=0:${en}[o${j}]`);
      } else {
        inputs.push('-framerate', '24', '-i', path.join(m.dir, '%05d.png')); const ix = ni++;
        vparts.push(`[${ix}:v]format=rgba,setpts=PTS-STARTPTS+${T}/TB[m${j}]`, `[${cur}][m${j}]overlay=eof_action=pass:repeatlast=0:${en}[o${j}]`);
      }
      cur = 'o' + j;
    });
    const vf = `${vparts.length ? vparts.join(';') + ';' : ''}[${cur}]ass=captions.ass:fontsdir=fonts[vout]`;
    stage('Rendering', 92, 'Rendering the final video');
    await run(ffmpeg(), ['-y', ...inputs, '-filter_complex', `${vf};${af}`, '-map', '[vout]', '-map', '[aout]', '-t', String(total), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { cwd: work });
    checkCancel();
    log('Script to Short', `Video ready (${((Date.now() - t00) / 1000).toFixed(0)} s)`, 'success');

    // 8) thumbnails + platform texts (never fatal)
    const result = { outDir, video: out, duration: total, thumbs: [], platforms: null, plan: { beats: beats.length, tool, title: raw.title || [] } };
    stage('Packaging', 97, 'Making thumbnails and platform texts');
    let shot = null;
    try {
      const rsrc = recs[0] ? { f: recs[0].path, t: Math.min(recs[0].dur * 0.4, recs[0].dur - 0.5), crop: recs[0].crop } : null;
      const sp = path.join(outDir, 'screen.jpg');
      if (rsrc) await run(ffmpeg(), ['-y', '-ss', String(rsrc.t), '-i', rsrc.f, '-frames:v', '1', ...(rsrc.crop ? ['-vf', `crop=${rsrc.crop.w}:${rsrc.crop.h}:${rsrc.crop.x}:${rsrc.crop.y}`] : []), '-q:v', '2', sp]);
      else await run(ffmpeg(), ['-y', '-ss', String(Math.min(total * 0.3, total - 1)), '-i', base, '-frames:v', '1', '-q:v', '2', sp]);
      shot = sp;
    } catch {}
    try { result.platforms = await require('./platforms.cjs').make({ gemini: job.gemini, sentences, tool, title: raw.title || [], lang: o.textLang, facts: o.notes, outDir }); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Platform texts', 'Skipped: ' + String(e.message).slice(0, 120), 'warn'); }
    if (hooks.shot) {
      try {
        const titles = (result.platforms && result.platforms.thumbTitles && result.platforms.thumbTitles.length ? result.platforms.thumbTitles : (raw.title || [])).filter(Boolean).slice(0, 4);
        let charPng = null; if (o.character && o.characterStyle && o.characterStyle !== 'none') { try { charPng = await CH.compose(o.characterStyle, { pose: 'point', face: 'shock' }); } catch {} }
        result.thumbs = await require('./thumbs.cjs').make({ outDir, titles, tool, screenshot: shot, character: charPng, accent: o.accent, fontsDir: P.fontsDir(), cta: o.thumbCta || 'LINK IN COMMENTS', checklist: checklist.map(c => c.text) }, hooks.shot);
      } catch (e) { log('Thumbnails', 'Skipped: ' + String(e.message).slice(0, 120), 'warn'); }
    }
    try { fs.writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify({ beats: beats.map(({ i, t0, t1, visual, query, kin, char, arrow, scene, rec }) => ({ i, t0, t1, visual, query, kin, char, arrow, scene, rec })), tool, title: raw.title, checklist }, null, 1)); } catch {}
    stage('Done', 100, 'Finished');
    emit({ type: 'done', result });
    return result;
  } finally { try { fs.rmSync(work, { recursive: true, force: true }); } catch {} }
}
module.exports = { analyzeStory, runStory, sentencesOf, planOffline, finalize };
