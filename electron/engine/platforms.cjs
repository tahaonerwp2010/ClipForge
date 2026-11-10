// Titles, descriptions and hashtags for YouTube / Instagram / Facebook / X / TikTok, written in the voice-over's own language.
const fs = require('fs');
const path = require('path');
const AI = require('./ai.cjs');
const LIMIT = { youtubeTitle: 100, x: 280, tiktok: 150, instagram: 2200, facebook: 400 };
const clip = (s, n) => { s = String(s || '').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const tags = (arr, n) => [...new Set((arr || []).map(t => String(t).replace(/[\s#.,!?;:'"()\[\]{}<>@$%^&*+=|\\\/~`-]/g, '')).filter(Boolean))].slice(0, n).map(t => '#' + t);

function offline(ctx) {
  const tool = ctx.tool || '', headline = (ctx.title && ctx.title[0]) || tool || 'Watch this';
  const text = ctx.sentences.slice(0, 3).map(s => s.text).join(' ');
  const base = ['shorts', 'viral', 'fyp', 'trending', 'free', 'tips'];
  const T = tags(tool ? [tool.replace(/\s+/g, ''), ...base] : base, 6).join(' ');
  return {
    youtube: { title: clip(headline, LIMIT.youtubeTitle), description: clip(text, 400), tags: T },
    instagram: { title: clip(headline, 100), description: clip(text, 500), tags: T },
    facebook: { title: clip(headline, 100), description: clip(text, 300) + ' ' + T.split(' ').slice(0, 3).join(' '), tags: T },
    x: { title: '', description: clip(headline + ' ' + text, 230) + ' ' + T.split(' ').slice(0, 2).join(' '), tags: T },
    tiktok: { title: '', description: clip(headline, 90) + ' ' + T.split(' ').slice(0, 4).join(' '), tags: T },
    thumbTitles: ctx.title && ctx.title.length ? ctx.title : [headline]
  };
}
function fix(r, fb) {
  const out = {};
  for (const k of ['youtube', 'instagram', 'facebook', 'x', 'tiktok']) {
    const v = (r && r[k]) || {}, f = fb[k];
    const tg = Array.isArray(v.hashtags) ? tags(v.hashtags, 12).join(' ') : (typeof v.hashtags === 'string' ? v.hashtags : f.tags);
    let title = String(v.title || '').trim(), desc = String(v.description || '').trim();
    if (k === 'youtube') title = clip(title || f.title, LIMIT.youtubeTitle);
    if (k === 'x') desc = clip(desc || f.description, LIMIT.x - (tg ? 0 : 0));
    if (k === 'tiktok') desc = clip(desc || f.description, LIMIT.tiktok);
    if (k === 'instagram') desc = clip(desc || f.description, LIMIT.instagram);
    if (k === 'facebook') desc = clip(desc || f.description, LIMIT.facebook);
    if (!desc) desc = f.description;
    if (k === 'youtube' || k === 'instagram' || k === 'facebook') out[k] = { title: title || f.title, description: desc, tags: tg || f.tags };
    else out[k] = { title: '', description: desc, tags: tg || f.tags };
    if (k === 'x' && (out.x.description + ' ' + out.x.tags).length > LIMIT.x) out.x.tags = out.x.tags.split(' ').slice(0, 2).join(' ');
    if (k === 'x' && (out.x.description + ' ' + out.x.tags).length > LIMIT.x) out.x.description = clip(out.x.description, LIMIT.x - out.x.tags.length - 1);
  }
  out.thumbTitles = (Array.isArray(r && r.thumbTitles) && r.thumbTitles.length ? r.thumbTitles : fb.thumbTitles).map(x => String(x).slice(0, 48)).slice(0, 4);
  return out;
}
async function make(ctx) {
  const fb = offline(ctx); let res = null;
  if (AI.ready(ctx.gemini)) {
    try {
      const script = ctx.sentences.map(s => s.text).join(' ').slice(0, 3500);
      const prompt = `You write social media copy for a short vertical video. The voice-over (the script) is below. Write everything in ${ctx.lang && ctx.lang !== 'auto' ? ctx.lang : "the SAME language as the script"} (if the script is Roman Urdu / Hinglish, write in Roman Urdu / Hinglish).
Script: """${script}"""
${ctx.tool ? 'Promoted tool / product: ' + ctx.tool : ''}
${ctx.facts ? 'Facts from the creator and from the linked websites (use them, do not invent beyond them):\n' + ctx.facts : ''}
Be catchy and clickbait-style but honest: never promise things the script does not say. Match each platform:
- youtube: title (max 100 chars), description (2-4 short lines + call to action), hashtags (3-6)
- instagram: title (hook line), description (caption, line breaks, call to action), hashtags (8-12)
- facebook: title, description (max 400 chars), hashtags (2-4)
- x: description only (max 230 chars, punchy), hashtags (1-2)
- tiktok: description (max 120 chars with hook), hashtags (4-6, include fyp)
Also "thumbTitles": 4 different very short thumbnail headlines (2-5 words each, ALL different angles: shock, benefit, curiosity, number).
Hashtags are an array of words WITHOUT the # sign. JSON only: {"youtube":{"title":"","description":"","hashtags":[]},"instagram":{...},"facebook":{...},"x":{"description":"","hashtags":[]},"tiktok":{"description":"","hashtags":[]},"thumbTitles":[]}`;
      const r = await AI.generate(ctx.gemini, { prompt, json: true, timeoutMs: 60000 });
      res = fix(AI.parseJson(r.text), fb);
    } catch (e) { if (String(e.message) === 'CANCELLED') throw e; res = null; }
  }
  if (!res) res = fix(null, fb);
  try {
    fs.writeFileSync(path.join(ctx.outDir, 'platforms.json'), JSON.stringify(res, null, 1));
    const L = [];
    for (const [k, n] of [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['x', 'X'], ['tiktok', 'TikTok']]) { const v = res[k]; L.push(`===== ${n} =====`); if (v.title) L.push('Title: ' + v.title); L.push((v.title ? 'Description:\n' : '') + v.description); L.push(v.tags, ''); }
    fs.writeFileSync(path.join(ctx.outDir, 'platforms.txt'), L.join('\n'));
  } catch {}
  return res;
}
module.exports = { make, offline, fix, LIMIT };
