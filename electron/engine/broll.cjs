// B-roll: short muted cut-away clips from the USER'S OWN videos, placed where the speaker talks about something they show.
// Rules: only 2-3 s per piece, never more than ~25% of a clip, never in the first/last seconds, spaced apart. Any failure = no b-roll (the clip is rendered as normal).
const fs = require('fs');
const path = require('path');
const AI = require('./ai.cjs');
const R = require('./render.cjs');

const MAX_SHARE = 25, MIN_T = 2.0, TAIL = 1.5, GAP = 2.5;
const info = new Map();          // path|size|mtime -> { duration, desc }
const keyOf = (p) => { try { const s = fs.statSync(p); return `${p}|${s.size}|${s.mtimeMs}`; } catch { return null; } };
const tokens = (t) => String(t || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);

// Probe every file and (when an AI key exists) let the AI look at a few frames and describe what each video shows.
async function prepare(files, gemini, workDir, log) {
  const list = [];
  for (const f of (files || []).slice(0, 24)) {
    const k = f && f.path && keyOf(f.path); if (!k) continue;
    let rec = info.get(k);
    if (!rec) {
      let duration = 0; try { duration = (await R.probe(f.path)).duration || 0; } catch {}
      if (duration < 1.2) { log('B-roll', `Skipped "${f.name || path.basename(f.path)}" (too short or unreadable)`, 'warn'); continue; }
      rec = { duration, desc: '' }; info.set(k, rec);
    }
    list.push({ path: f.path, name: f.name || path.basename(f.path), key: k, rec });
  }
  if (AI.ready(gemini)) {
    const todo = list.filter(x => !x.rec.desc);
    for (let o = 0; o < todo.length; o += 6) {
      const part = todo.slice(o, o + 6);
      try {
        const parts = [{ text: 'For each numbered video below you see 2-3 frames. Describe in 6-14 words what the video shows (subject, place, action, mood) so an editor can match it to what a speaker says. Reply with JSON only: [{"id":0,"desc":"..."}]' }];
        for (let i = 0; i < part.length; i++) {
          const d = path.join(workDir, `brd${o + i}`);
          const fr = await R.extractFrames(part[i].path, 0, part[i].rec.duration, d, Math.min(2, 2.6 / part[i].rec.duration));
          parts.push({ text: `Video ${i} ("${part[i].name}"):` });
          for (const f of fr.slice(0, 3)) parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } });
          try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
        }
        const r = await AI.generate(gemini, { parts, json: true, timeoutMs: 120000 });
        const j = AI.parseJson(r.text !== undefined ? r.text : r);
        (Array.isArray(j) ? j : []).forEach(x => { const t = part[+x.id]; if (t && x.desc) t.rec.desc = String(x.desc).slice(0, 160); });
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('B-roll', `AI could not look at the videos (${String(e.message).slice(0, 80)}); matching by file name instead`, 'warn'); break; }
    }
  }
  return list;
}

function segmentsOf(words, s, e) {
  const dur = e - s, segs = []; let cur = [];
  const flush = () => { if (cur.length) { segs.push({ t: Math.max(0, cur[0].start - s), end: Math.min(dur, cur[cur.length - 1].end - s), text: cur.map(w => w.word || w.text || '').join(' ').replace(/\s+/g, ' ').trim() }); cur = []; } };
  for (const w of words) {
    if (w.end < s || w.start > e) continue;
    cur.push(w);
    const t = String(w.word || w.text || '');
    if (cur.length >= 12 || (cur.length >= 5 && /[.!?,;:]$/.test(t))) flush();
  }
  flush();
  return segs.filter(g => g.text.split(' ').length >= 3);
}

async function plan(words, s, e, cfg, seed, gemini, log, prepared) {
  const dur = e - s;
  if (!cfg || !cfg.enabled || !prepared || !prepared.length || dur < 8) return undefined;
  const share = Math.max(5, Math.min(MAX_SHARE, +cfg.pct || 20));
  const budget = Math.min(dur * share / 100, dur * MAX_SHARE / 100);
  const n = Math.min(8, Math.max(dur >= 16 ? 2 : dur >= 10 ? 1 : 0, Math.floor(budget / 2.6)));   // several cut-aways per clip, at different moments
  if (!n) return undefined;
  const segs = segmentsOf(words, s, e).filter(g => g.t >= MIN_T && g.t <= dur - TAIL - 1.5);
  if (!segs.length) return undefined;
  segs.forEach((g, i) => { g.i = i; });

  // 1) who matches whom: the AI reads the sentences and the video descriptions; without AI the words in the file names / descriptions are matched
  let picks = [];
  const hasDesc = prepared.some(x => x.rec.desc);
  if (AI.ready(gemini) && hasDesc) {
    try {
      const vids = prepared.map((x, i) => `${i}. ${x.rec.desc || x.name}`).join('\n');
      const lines = segs.slice(0, 60).map(g => `${g.i}. [${g.t.toFixed(0)}s] ${g.text}`).join('\n');
      const prompt = `You are a video editor adding B-roll cut-aways (muted, 2-3 seconds) over a speaker in a short vertical clip.\n\nB-ROLL VIDEOS:\n${vids}\n\nSPOKEN SENTENCES (index, time, text):\n${lines}\n\nPick ${n} DIFFERENT moments (aim for exactly ${n} when possible, at least ${Math.max(1, n - 1)}) where one of the B-roll videos clearly illustrates what is being said at that moment. Only use a video that really fits the words. Spread the moments across the WHOLE clip (beginning, middle and end), never two close together, and use different videos when possible.\nReply with JSON only: {"picks":[{"seg":0,"video":0}]}`;
      const r = await AI.generate(gemini, { prompt, json: true, timeoutMs: 40000 });
      const j = AI.parseJson(r.text !== undefined ? r.text : r);
      picks = ((j && j.picks) || []).map(p => ({ seg: segs[+p.seg], v: prepared[+p.video] })).filter(p => p.seg && p.v);
    } catch (err) { if (String(err.message) === 'CANCELLED') throw err; log('B-roll', `AI matching failed (${String(err.message).slice(0, 80)}); matching by words`, 'warn'); }
  }
  if (!picks.length) {                                           // word matching (file names + AI descriptions), then an even spread if nothing matches
    const scored = [];
    for (const g of segs) {
      const gw = new Set(tokens(g.text));
      for (const v of prepared) { const vw = tokens(v.name + ' ' + v.rec.desc); const sc = vw.filter(w => gw.has(w)).length; if (sc) scored.push({ seg: g, v, sc }); }
    }
    scored.sort((a, b) => b.sc - a.sc); picks = scored;
    if (!picks.length && !hasDesc) {
      const step = Math.max(1, Math.floor(segs.length / n));
      picks = []; for (let i = Math.floor(step / 2), k = 0; i < segs.length && picks.length < n; i += step, k++) picks.push({ seg: segs[i], v: prepared[(seed + k) % prepared.length] });
    }
  }

  // 2) place them: spaced apart, inside the allowed window, never more than the share of the clip
  const out = [], used = new Map(); let total = 0;
  for (const p of picks) {
    if (out.length >= n) break;
    const k = out.length;
    let L = 2 + (((seed || 1) * 7 + k * 5) % 15) / 10;           // 2.0 - 3.4 s
    L = Math.min(L, p.v.rec.duration - 0.2);
    if (L < 1.2) continue;
    const t = Math.min(p.seg.t, dur - TAIL - L);
    if (t < MIN_T) continue;
    if (out.some(o => t < o.t + o.dur + GAP && o.t < t + L + GAP)) continue;
    if (total + L > dur * MAX_SHARE / 100) continue;
    const u = used.get(p.v.key) || 0; used.set(p.v.key, u + 1);
    const room = Math.max(0, p.v.rec.duration - L - 0.1);
    const ss = room > 0 ? +((u * (L + 0.6)) % (room + 0.01)).toFixed(2) : 0;
    out.push({ file: p.v.path, name: p.v.name, t: +t.toFixed(2), dur: +L.toFixed(2), ss });
    total += L;
  }
  // not enough matches? fill the empty parts of the clip (one cut-away per zone) with the least-used video, so a clip gets several b-roll moments
  if (out.length < n) {
    const zones = Array.from({ length: n }, (_, z) => MIN_T + (dur - TAIL - MIN_T) * (z + 0.5) / n);
    for (const zc of zones) {
      if (out.length >= n) break;
      const g = segs.slice().sort((a, b) => Math.abs(a.t - zc) - Math.abs(b.t - zc)).find(sg => !out.some(o => sg.t < o.t + o.dur + GAP && o.t < sg.t + 3.4 + GAP));
      if (!g) continue;
      const v = prepared.slice().sort((a, b) => (used.get(a.key) || 0) - (used.get(b.key) || 0))[0];
      const L = Math.min(2 + (((seed || 1) * 3 + out.length * 5) % 12) / 10, v.rec.duration - 0.2);
      const t = Math.min(g.t, dur - TAIL - L);
      if (L < 1.2 || t < MIN_T || out.some(o => t < o.t + o.dur + GAP && o.t < t + L + GAP) || total + L > dur * MAX_SHARE / 100) continue;
      const u = used.get(v.key) || 0; used.set(v.key, u + 1);
      const room = Math.max(0, v.rec.duration - L - 0.1);
      out.push({ file: v.path, name: v.name, t: +t.toFixed(2), dur: +L.toFixed(2), ss: room > 0 ? +((u * (L + 0.6)) % (room + 0.01)).toFixed(2) : 0 });
      total += L;
    }
  }
  out.sort((a, b) => a.t - b.t);
  if (out.length) log('B-roll', `${out.length} b-roll cut-away${out.length === 1 ? '' : 's'} (${total.toFixed(1)} s of ${dur.toFixed(0)} s = ${Math.round(total / dur * 100)}%)`, 'info');
  else log('B-roll', 'No good moment found for b-roll in this clip', 'info');
  return out.length ? out : undefined;
}
module.exports = { prepare, plan };
