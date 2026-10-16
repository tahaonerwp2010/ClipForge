const HK = require('./hook.cjs');
const G = require('./ai.cjs');
// Viral moments: Gemini (if key) -> offline sentence-aware heuristic.
const HOOK = /\b(secret|mistake|never|always|truth|biggest|nobody|everyone|stop|why|how|worst|best|insane|crazy|million|billion|free|fail|lesson|warning|problem|actually|honestly)\b/i;

function sentences(words) {
  const out = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(i);
    const gap = words[i + 1] ? words[i + 1].start - w.end : 99;
    if (/[.!?]$/.test(w.word) || gap > 0.9) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  return out;
}

const STOP = new Set('the and for with that this from have what when where which clips clip want need show moments moment video part about into their them they you your first seconds second must should would could also more than very some only like make find give take where who whom'.split(' '));
const keywordsOf = p => [...new Set(String(p || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)))];
function offline(words, count, clipLen, keywords = []) {
  if (!words.length) return [];
  const sents = sentences(words);
  const min = clipLen * 0.7, max = clipLen * 1.35, cands = [];
  for (let a = 0; a < sents.length; a++) {
    const start = words[sents[a][0]].start;
    for (let b = a; b < sents.length; b++) {
      const last = sents[b][sents[b].length - 1];
      const end = words[last].end, d = end - start;
      if (d < min) continue;
      if (d > max) break;
      const slice = words.slice(sents[a][0], last + 1);
      const text = slice.map(w => w.word).join(' ');
      const density = slice.length / d;
      const lower = text.toLowerCase(), kw = keywords.filter(k => lower.includes(k)).length;
      const score = kw * 7 + density * 10 + (text.match(/[?!]/g) || []).length * 3 + (HOOK.test(text) ? 8 : 0) + (HOOK.test(slice.slice(0, 8).map(w => w.word).join(' ')) ? 6 : 0);
      cands.push({ start, end, score, text });
    }
  }
  cands.sort((x, y) => y.score - x.score);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= count) break;
    if (picked.every(p => c.end <= p.start || c.start >= p.end)) picked.push(c);
  }
  const maxScore = Math.max(...picked.map(p => p.score), 1);
  return picked.sort((x, y) => x.start - y.start).map(p => {
    const first = p.text.split(/\s+/).slice(0, 6).join(' ').replace(/[.,!?]+$/, '');
    return { start: p.start, end: p.end, title: first.toUpperCase(), hookText: first, reason: 'Dense, punchy speech (offline analysis)',
      viralityScore: Math.round(80 + 19 * (p.score / maxScore)), category: /[?!]/.test(p.text) ? 'High Energy' : 'Deep Insight' };
  });
}

function transcriptForLLM(words, step = 14) {
  const lines = [];
  for (let i = 0; i < words.length; i += step) {
    const ch = words.slice(i, i + step);
    lines.push(`[${ch[0].start.toFixed(1)}s] ${ch.map(w => w.word).join(' ')}`);
  }
  return lines.join('\n');
}

// ---- Gemini moment finding: the transcript is split in time windows so the WHOLE video is searched (not just the start) ----
function chunkWords(words, maxCalls = 8) {
  const total = words[words.length - 1].end;
  if (total <= 720) return [words];
  const chunkSec = Math.max(480, total / maxCalls), n = Math.ceil(total / chunkSec), out = [];
  for (let i = 0; i < n; i++) {
    const a = i * chunkSec - 20, b = (i + 1) * chunkSec + 20;
    const part = words.filter(w => w.end > a && w.start < b);
    if (part.length > 20) out.push(part);
  }
  return out;
}
async function gemini(words, count, clipLen, g, log = () => {}, userPrompt = '') {
  const chunks = chunkWords(words);
  const per = chunks.length === 1 ? Math.min(count * 2, count + 4) : Math.max(2, Math.min(4, Math.ceil(count / chunks.length) + 1));
  const req = userPrompt ? `\nTOP PRIORITY — THE EDITOR'S REQUEST: "${userPrompt}"\nThis request overrides every other rule below (virality, hooks, variety). Only pick moments that really match it; a moment that does not match must not be returned, even if it is exciting. If fewer moments match than asked for, return only the matching ones. Give every moment a "fit" score 0-10 = how exactly it satisfies the request (10 = exactly what was asked, 0 = unrelated). Judge only what is SAID / the topic here (anything about how people look or what is on screen is checked separately).\n` : '';
  const all = []; let used = '';
  for (let ci = 0; ci < chunks.length; ci++) {
    const ch = chunks[ci];
    const where = chunks.length > 1 ? `This is part ${ci + 1} of ${chunks.length} of a longer video (${Math.round(ch[0].start / 60)}–${Math.round(ch[ch.length - 1].end / 60)} min). ` : '';
    const prompt = `You are a viral short-form video editor. ${where}Transcript with timestamps below.${req}
Pick the ${per} most engaging, self-contained moments, each about ${clipLen} seconds (start at a sentence start, end at a sentence end, no overlaps).
Score honestly and strictly on the same scale for every part of the video: 90+ only for exceptional moments, most moments are 55-80.
Return ONLY a JSON array of objects: {${userPrompt ? '"fit":0-10,' : ''}"start":number,"end":number,"title":"punchy hook title max 8 words","hookText":"first-3-seconds hook line","viralityScore":1-99,"reason":"short","category":"High Energy|Deep Insight|Storytelling|Shocking Truth"}

${transcriptForLLM(ch)}`;
    try {
      const r = await G.generate(g, { prompt, json: true });
      if (r.providerName) r.model = r.providerName + ' · ' + r.model;
      used = r.model;
      const out = G.parseJson(r.text);
      all.push(...(Array.isArray(out) ? out : (out.clips || out.moments || [])));
    } catch (e) {
      if (ci === 0 && !all.length && chunks.length === 1) throw e;
      log(`Part ${ci + 1}/${chunks.length} failed (${String(e.message).slice(0, 80)})`, 'warn');
      if (e.kind === 'quota' || e.kind === 'invalid_key') break;
    }
  }
  if (!all.length) throw new Error('Gemini returned no moments');
  log(`AI answered with ${used} (${chunks.length} part${chunks.length > 1 ? 's' : ''} of the video searched)`, 'success');
  return all;
}

// never two clips from the same place: keep the best, drop anything that overlaps it
function dedupe(clips, keepFrom = []) {
  const kept = [...keepFrom];
  for (const c of [...clips].sort((x, y) => (y.rank ?? y.viralityScore ?? 0) - (x.rank ?? x.viralityScore ?? 0))) {
    const clash = kept.some(k => Math.min(k.end, c.end) - Math.max(k.start, c.start) > 0.3);
    if (!clash) kept.push(c);
  }
  return kept.filter(k => !keepFrom.includes(k));
}

// Optional visual check (only when the editor wrote a prompt): Gemini looks at the first seconds of each candidate.
async function visualRank(cands, { filePath, workDir, userPrompt, g, log }) {
  const R = require('./render.cjs');
  const parts = [{ text: `The editor wants short clips matching this request: "${userPrompt}"
First decide if the request contains VISUAL conditions (who or what must be visible on screen, or when). If it does not, answer hasVisualCondition=false.
If it does: "subject" = a short description of the person/object to keep in frame (empty string if none), and for every candidate give "match" 0-10 = how well its frames satisfy the visual conditions (for example: the described person is clearly visible in the first 5 seconds).
Return ONLY JSON: {"hasVisualCondition":boolean,"subject":string,"candidates":[{"id":number,"match":number}]}` }];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    const frames = await R.extractFrames(filePath, c.start, Math.min(5, c.end - c.start), require('path').join(workDir, `vr${i}`), 1);
    parts.push({ text: `Candidate ${i}: its first seconds, one frame per second:` });
    for (const f of frames.slice(0, 5)) parts.push({ inlineData: { mimeType: 'image/jpeg', data: require('fs').readFileSync(f).toString('base64') } });
    try { require('fs').rmSync(require('path').join(workDir, `vr${i}`), { recursive: true, force: true }); } catch {}
  }
  const r = await G.generate(g, { parts, json: true, timeoutMs: 180000 });
  const out = G.parseJson(r.text);
  if (!out || !out.hasVisualCondition) { log('The prompt has no on-screen condition → using it for topic only', 'info'); return { cands, subject: '' }; }
  const match = new Map((out.candidates || []).map(x => [+x.id, Math.max(0, Math.min(10, +x.match || 0))]));
  cands.forEach((c, i) => { c.match = match.has(i) ? match.get(i) : 5; c.rank = (c.fit != null ? c.fit * 6 : 0) + c.match * 5 + (c.viralityScore || 60) * 0.2; });
  log(`Visual check done: ${cands.map(c => c.match).join(', ')} (0-10 per candidate)`, 'success');
  return { cands, subject: String(out.subject || '').slice(0, 120), visual: true };
}

function sanitize(clips, words) {
  const total = words[words.length - 1].end;
  const snapStart = t => (words.find(w => w.end > t) || words[0]).start;
  const snapEnd = t => ([...words].reverse().find(w => w.start < t) || words[words.length - 1]).end;
  const cats = ['High Energy', 'Deep Insight', 'Storytelling', 'Shocking Truth'];
  return clips.map(c => ({ ...c, start: snapStart(Math.max(0, +c.start)), end: snapEnd(Math.min(total, +c.end)) }))
    .filter(c => c.end - c.start >= 5 && c.end - c.start <= 150)
    .map(c => ({ ...c, category: cats.includes(c.category) ? c.category : 'Deep Insight',
      viralityScore: Math.max(60, Math.min(99, Math.round(c.viralityScore || 85))), fit: c.fit == null ? undefined : Math.max(0, Math.min(10, +c.fit || 0)),
      title: String(c.title || c.hookText || 'Highlight').slice(0, 70), hookText: String(c.hookText || c.title || '') }));
}


// ---------- LOCAL title generation (no Gemini) ----------
const FILLER = /^(so|and|but|yeah|yes|well|okay|ok|like|um|uh|you know|i mean|right|now|then|because|actually|basically)\b[\s,]*/i;
function titleFromText(text) {
  const sents = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.split(' ').length >= 4);
  let best = '', bs = -1;
  for (const x of sents) {
    const sc = (HOOK.test(x) ? 6 : 0) + (/[?!]/.test(x) ? 3 : 0) + (/\d/.test(x) ? 2 : 0) - Math.abs(x.split(' ').length - 7) * 0.4;
    if (sc > bs) { bs = sc; best = x; }
  }
  let t = (best || text).replace(FILLER, '').replace(FILLER, '').replace(/[.,;:]+$/, '');
  const w = t.split(' ');
  if (w.length > 8) t = w.slice(0, 8).join(' ') + '…';
  return t.toUpperCase();
}
async function ollamaModel() {
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    const names = ((await r.json()).models || []).map(m => m.name);
    return names.find(n => /qwen2\.5|llama3\.2|gemma|phi|mistral|qwen/i.test(n)) || names[0] || null;
  } catch { return null; }
}
// Local AI (Ollama): same system prompt as Gemini, one clip at a time, JSON answer.
async function ollamaMeta(model, text, n = 2) {
  const system = metaSystem(n).replace('a JSON array with one object per clip, in the same order:', 'ONE JSON object for this clip:');
  const r = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', signal: AbortSignal.timeout(180000),
    body: JSON.stringify({ model, system, prompt: `Clip transcript:\n${text.slice(0, 1400)}`, stream: false, format: 'json', options: { num_predict: 400, temperature: 0.7 } }) });
  const j = await r.json();
  const o = G.parseJson(j.response || '{}');
  return Array.isArray(o) ? o[0] : o;
}
const EM = require('./emoji.cjs');
const clipText = (c, words) => words.filter(w => w.start >= c.start && w.end <= c.end + 0.2).map(w => w.word).join(' ');
const hasEmoji = t => EM.splitTitle(t).emojis.length > 0;

// Title step (required): Gemini first; if it fails -> local AI (Ollama) -> built-in heuristic. Every title ends up with >= 1 emoji.
const HOOK_LEN = { 1: '3 to 5 words, ONE short line', 2: '6 to 9 words, written as TWO balanced short lines', 3: '9 to 13 words, written as THREE short lines' };
const META_BASE = `You are a professional YouTube Shorts metadata writer for a creator targeting English-speaking viewers, especially in the United States. Based ONLY on the clip analysis and shared context given, generate one strong title, a concise description, a small number (3-6) of highly relevant hashtags (always include the # symbol), and relevant discovery keywords. Rules: natural American English; the title must accurately represent the clip and create genuine curiosity without being misleading, include 1-2 well-placed relevant emojis to make it feel lively, avoid ALL CAPS and excessive punctuation; no fake claims; no keyword stuffing; do not add generic filler like "VIRAL" or "USA" or "FYP" unless truly relevant; do not invent facts not present in the analysis/context. Return only the structured JSON. The hashtags you generate should EXIST ON YOUTUBE and should be HIGHLY US BASED since the user wants US views; at most 3 hashtags.`;
const hookRules = (n) => `
HOOK (field "hookText") is the text shown on screen in the first seconds. Its only job is to make a scrolling viewer stop and keep watching. Length: ${HOOK_LEN[n] || HOOK_LEN[2]}. Write it as EITHER (a) a curiosity question that this exact clip answers, or (b) a bold, specific statement that creates an open loop (a surprising claim, a number, a warning, a contradiction, "nobody tells you…" style). Never a plain summary or a topic label. It must be true to what is said in the clip and make the viewer need the payoff. Use the clip's own strongest words/numbers. Good examples: "Why do 90% of startups die in year one?", "This one habit made him a millionaire", "Stop doing this before it costs you everything", "She lost everything. Then this happened.". Bad examples: "A talk about startups", "Interesting thoughts on money", "Watch this video". Add one fitting emoji at the end. Do not use hashtags in the hook.`;
const metaSystem = (n) => META_BASE + hookRules(n) + `
Output format: a JSON array with one object per clip, in the same order: {"title":"...","hookText":"...","description":"...","hashtags":["#a","#b","#c"],"keywords":["..."]}.` + (n === 1 ? '' : ` Separate the hook lines with a \\n character.`);

async function geminiTitles(clips, words, g, log, n = 2) {
  const items = clips.map((c, i) => `#${i} (${Math.round(c.end - c.start)}s): ${clipText(c, words).slice(0, 700)}`).join('\n\n');
  const prompt = `Clip analysis and context for each clip (write metadata for EACH one, same order):\n\n${items}`;
  const r = await G.generate(g, { system: metaSystem(n), prompt, json: true });
  const out = G.parseJson(r.text);
  const arr = Array.isArray(out) ? out : (out.titles || out.clips || []);
  if (arr.length < clips.length) throw new Error('Gemini returned too few titles');
  return arr;
}
async function localTitles(clips, words, log, n = 2) {
  const model = await ollamaModel();
  log(model ? `Local AI (Ollama: ${model}) writing title, hook, description and hashtags…` : 'AI providers unavailable and no local AI running → the built-in writer reads each transcript and writes the title, hook, description and hashtags', 'info');
  const LW = require('./localwriter.cjs');
  for (const c of clips) {
    const text = clipText(c, words);
    const base = LW.write(text);                                   // always available, based on what is really said
    let o = null;
    if (model) { try { o = await ollamaMeta(model, text, n); } catch (e) { log(`Ollama failed (${String(e.message).slice(0, 60)}), using the built-in writer`, 'warn'); } }
    const ok = (v, min) => typeof v === 'string' && v.trim().length >= min;
    c.title = (ok(o && o.title, 6) ? o.title.trim() : base.title).slice(0, 90);
    c.hookText = ok(o && o.hookText, 8) ? o.hookText.trim() : base.hookText;
    c.description = ok(o && o.description, 15) ? o.description.trim().slice(0, 300) : base.description;
    c.hashtags = Array.isArray(o && o.hashtags) && o.hashtags.length ? o.hashtags : undefined;      // finalTags fills the rest from the topic
    c.keywords = Array.isArray(o && o.keywords) && o.keywords.length ? o.keywords.map(String).slice(0, 12) : base.keywords;
    c.__topic = base.topic;
  }
}
// ---- description + hashtags (offline helpers) ----
const TAGS = { ai: '#ai', crypto: '#crypto', bitcoin: '#bitcoin', money: '#money', business: '#business', startup: '#startup', startups: '#startup', invest: '#investing', investing: '#investing', stock: '#stockmarket', stocks: '#stockmarket', luck: '#mindset', mindset: '#mindset', success: '#success', motivation: '#motivation', health: '#health', fitness: '#fitness', gym: '#fitness', relationship: '#relationships', career: '#career', school: '#education', learn: '#learning', learning: '#learning', science: '#science', tech: '#tech', technology: '#tech', podcast: '#podcast', marketing: '#marketing', sales: '#sales', education: '#education', politics: '#politics', history: '#history', food: '#food', travel: '#travel', game: '#gaming', gaming: '#gaming', music: '#music', islam: '#islam', quran: '#islam', cricket: '#cricket', football: '#football', decisions: '#decisionmaking', psychology: '#psychology', productivity: '#productivity', leadership: '#leadership', finance: '#finance', future: '#future' };
function finalTags(given, text) {
  const out = [];
  const add = t => { t = '#' + String(t).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, '').toLowerCase(); if (/^#[a-z0-9_]{2,30}$/.test(t) && !out.includes(t)) out.push(t); };
  (Array.isArray(given) ? given : []).forEach(add);
  for (const w of String(text).toLowerCase().split(/[^a-z0-9]+/)) { if (out.length >= 3) break; if (TAGS[w]) add(TAGS[w]); }
  for (const t of ['#shorts', '#youtubeshorts', '#podcast']) { if (out.length >= 3) break; add(t); }
  return out.slice(0, 3);
}
function localDescription(text) {
  const sents = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.split(' ').length >= 5);
  let d = (sents.slice(0, 2).join(' ') || text).slice(0, 180).replace(/[,;:\s]+$/, '');
  return d + (/[.!?]$/.test(d) ? '' : '.');
}
async function writeTitles(clips, words, g, log, hookLines = 2) {
  const HN = hookLines === 1 || hookLines === 3 ? hookLines : 2;
  let engine = 'local';
  if (G.ready(g)) {
    try {
      const arr = await geminiTitles(clips, words, g, log, HN);
      clips.forEach((c, i) => {
        const t = arr[i] || {};
        if (t.title && String(t.title).trim().length > 3) {
          c.title = String(t.title).trim().slice(0, 90); if (t.hookText) c.hookText = String(t.hookText).trim();
          if (Array.isArray(t.keywords)) c.keywords = t.keywords.map(k => String(k).trim()).filter(Boolean).slice(0, 12);
          if (t.description) c.description = String(t.description).trim().slice(0, 400);
          if (Array.isArray(t.hashtags)) c.hashtags = t.hashtags;
        } else c.__weak = true;
      });
      engine = 'gemini'; log('Titles written by AI', 'success');
    } catch (e) { log(`AI title writing failed (${String(e.message).slice(0, 100)}) → local fallback`, 'warn'); clips.forEach(c => { c.__weak = true; }); }
  } else clips.forEach(c => { c.__weak = true; });
  const weak = clips.filter(c => c.__weak);
  if (weak.length) { await localTitles(weak, words, log, HN); if (weak.length < clips.length) engine = 'gemini+local'; }
  for (const c of clips) {
    delete c.__weak;
    const txt = clipText(c, words);
    if (!c.description || c.description.length < 15) c.description = localDescription(txt);
    c.hashtags = finalTags(c.hashtags, (c.__topic || '') + ' ' + c.title + ' ' + txt); delete c.__topic;
    { const he = EM.splitTitle(String(c.hookText || '')).emojis; c.hookText = HK.hookLines(c.hookText, c.title, HN); if (he && he.length) c.hookText += ' ' + he.slice(0, 2).join(''); }
    if (!hasEmoji(c.title)) c.title = `${c.title} ${EM.emojiForText(clipText(c, words) + ' ' + c.title)}`;
  }
  return engine;
}

async function findClips(words, { hookLines = 2, count = 4, clipLen = 30, gemini: g, log = () => {}, userPrompt = '', filePath = '', workDir = '' }) {
  if (!words.length) return { clips: [], engine: 'none' };
  const kws = keywordsOf(userPrompt);
  const topUp = (picked) => {                                  // fewer than asked (after removing duplicates)? fill from the offline finder, never overlapping
    if (picked.length >= count) return picked;
    const extra = dedupe(sanitize(offline(words, count * 4, clipLen, kws), words), picked).slice(0, count - picked.length);
    return [...picked, ...extra];
  };
  if (G.ready(g)) {
    try {
      let cands = dedupe(sanitize(await gemini(words, count, clipLen, g, (m, k) => log('AI', m, k), userPrompt), words));
      let subject = '';
      if (userPrompt && cands.some(c => c.fit != null)) {                       // the request comes first: fit decides, virality only breaks ties
        cands.forEach(c => { c.rank = (c.fit ?? 5) * 10 + (c.viralityScore || 60) * 0.2; });
        const good = cands.filter(c => (c.fit ?? 5) >= 5);
        cands = (good.length >= count ? good : cands).sort((a, b) => b.rank - a.rank);
        log('AI', `Your prompt decides the order: ${cands.slice(0, count).map(c => c.fit ?? '?').join(', ')} (fit 0-10)`, 'info');
      }
      if (userPrompt && cands.length && filePath) {
        try {
          const pool = cands.slice(0, Math.min(cands.length, Math.max(count * 2, count + 4), 12));
          const vr = await visualRank(pool, { filePath, workDir, userPrompt, g, log: (m, k) => log('AI', m, k) });
          if (vr.visual) {
            const good = vr.cands.filter(c => c.match >= 4);
            cands = (good.length >= count ? good : vr.cands).sort((a, b) => b.rank - a.rank);
            subject = vr.subject;
          }
        } catch (e) { log('AI', `Visual check skipped (${String(e.message).slice(0, 90)}); the prompt is used for the topic only`, 'warn'); }
      }
      let picked = topUp(cands.slice(0, count));
      picked = picked.slice(0, count);
      if (picked.length) {
        if (subject) picked.forEach(c => { c.subject = subject; });
        picked.sort((a, b) => a.start - b.start);
        const te = await writeTitles(picked, words, g, log, hookLines);
        return { clips: picked, engine: 'gemini', titleEngine: te };
      }
      log('Gemini returned no usable clips, using offline analysis', 'warn');
    } catch (e) { log(`AI failed (${e.message}) → offline analysis`, 'warn'); }
  }
  if (userPrompt) log('Offline mode: only the topic words of your prompt are used (on-screen conditions need AI Boost)', 'warn');
  const local = sanitize(offline(words, count, clipLen, kws), words);
  const te = await writeTitles(local, words, g, log, hookLines);
  return { clips: local, engine: 'offline', titleEngine: te };
}
module.exports = { findClips, offline, writeTitles };
