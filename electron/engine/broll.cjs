// B-roll: short muted cut-aways taken from the USER'S OWN videos, placed on the right word of the right sentence.
// Every uploaded video is first cut into its shots (scene detection); the AI looks at one frame of every shot and writes what it shows and how good it is.
// A long video therefore offers its best shots, many short videos offer all of theirs, and the planner picks the best shot for each sentence.
// A cut-away never contains a camera cut (it stays inside one shot), is 2-3.4 s long, and never covers more than about a third of the clip.
const fs = require('fs');
const path = require('path');
const AI = require('./ai.cjs');
const R = require('./render.cjs');
const P = require('./paths.cjs');
const { run } = require('./proc.cjs');

const MAX_SHARE = 32, MIN_T = 2.0, TAIL = 1.5, GAP = 2.5, EDGE = 0.2;
const MAX_SCAN = 600, MAX_SHOTS = 24, MAX_FRAMES = 60;
const cache = new Map();          // path|size|mtime -> { duration, shots:[{a,b,mid,desc,q,uses}] }
const keyOf = (p) => { try { const s = fs.statSync(p); return `${p}|${s.size}|${s.mtimeMs}`; } catch { return null; } };
const tokens = (t) => String(t || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);

async function frameAt(file, t, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await run(P.binOrPath('ffmpeg'), ['-y', '-ss', String(Math.max(0, t)), '-i', path.resolve(file), '-frames:v', '1', '-vf', 'scale=384:-2', '-q:v', '5', out]);
  return out;
}
// the shots of a video (only the parts of it that are long enough to hold a cut-away)
async function shotsOf(file, duration) {
  const scan = Math.min(duration, MAX_SCAN);
  let cuts = [];
  try { cuts = await R.detectCuts(file, 0, scan, 0.3, 6); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; }
  const edges = [0, ...cuts.filter(c => c > 0.3 && c < scan - 0.3), scan], shots = [];
  for (let i = 0; i + 1 < edges.length; i++) if (edges[i + 1] - edges[i] >= 1.8) shots.push({ a: +edges[i].toFixed(2), b: +edges[i + 1].toFixed(2), uses: 0, q: 3, desc: '' });
  if (!shots.length) shots.push({ a: 0, b: +scan.toFixed(2), uses: 0, q: 3, desc: '' });
  // too many shots (a long video): keep the longest ones, spread over the whole video
  if (shots.length > MAX_SHOTS) {
    const keep = shots.map((s, i) => ({ s, i, w: s.b - s.a })).sort((x, y) => y.w - x.w).slice(0, MAX_SHOTS * 2).sort((x, y) => x.i - y.i);
    const step = keep.length / MAX_SHOTS; return Array.from({ length: MAX_SHOTS }, (_, k) => keep[Math.floor(k * step)].s);
  }
  shots.forEach(s => { s.mid = +((s.a + s.b) / 2).toFixed(2); });
  return shots;
}

async function prepare(files, gemini, workDir, log) {
  const vids = [];
  for (const f of (files || []).slice(0, 24)) {
    const k = f && f.path && keyOf(f.path); if (!k) continue;
    let rec = cache.get(k);
    if (!rec) {
      let duration = 0; try { duration = (await R.probe(f.path)).duration || 0; } catch {}
      if (duration < 1.5) { log('B-roll', `Skipped "${f.name || path.basename(f.path)}" (too short or unreadable)`, 'warn'); continue; }
      const shots = await shotsOf(f.path, duration); shots.forEach(s => { s.mid = +((s.a + s.b) / 2).toFixed(2); });
      rec = { duration, shots }; cache.set(k, rec);
      log('B-roll', `"${f.name || path.basename(f.path)}": ${shots.length} usable shot${shots.length === 1 ? '' : 's'}${duration > MAX_SCAN ? ` (first ${Math.round(MAX_SCAN / 60)} min analysed)` : ''}`, 'info');
    }
    vids.push({ path: f.path, name: f.name || path.basename(f.path), key: k, rec });
  }
  // let the AI look at one frame per shot
  if (AI.ready(gemini)) {
    const todo = []; vids.forEach((v, vi) => v.rec.shots.forEach((s, si) => { if (!s.desc) todo.push({ v, vi, s, si }); }));
    const use = todo.slice(0, MAX_FRAMES);
    for (let o = 0; o < use.length; o += 12) {
      const part = use.slice(o, o + 12);
      try {
        const parts = [{ text: 'These are frames from stock / b-roll videos, one frame per shot. For EVERY numbered frame answer: "desc" = what it shows in 6-12 words (subject, place, action), "q" = visual quality 1-5 (5 = sharp, well lit, clear interesting subject; 1 = blurry, dark, empty, or a screen full of text). Reply with JSON only: [{"id":0,"desc":"...","q":4}]' }];
        for (let i = 0; i < part.length; i++) {
          const jp = await frameAt(part[i].v.path, part[i].s.mid, path.join(workDir, `bf${o + i}.jpg`));
          parts.push({ text: `Frame ${i}:` }); parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(jp).toString('base64') } });
          try { fs.unlinkSync(jp); } catch {}
        }
        const r = await AI.generate(gemini, { parts, json: true, timeoutMs: 120000 });
        const j = AI.parseJson(r.text !== undefined ? r.text : r);
        (Array.isArray(j) ? j : []).forEach(x => { const t = part[+x.id]; if (t && x.desc) { t.s.desc = String(x.desc).slice(0, 160); t.s.q = Math.max(1, Math.min(5, +x.q || 3)); } });
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('B-roll', `AI could not look at the videos (${String(e.message).slice(0, 80)}); matching by file name`, 'warn'); break; }
    }
  }
  return vids;
}

function segmentsOf(words, s, e) {
  const dur = e - s, segs = []; let cur = [];
  const flush = () => { if (cur.length) { segs.push({ t: Math.max(0, cur[0].start - s), end: Math.min(dur, cur[cur.length - 1].end - s), words: cur.map(w => ({ w: String(w.word || w.text || ''), t: w.start - s })), text: cur.map(w => w.word || w.text || '').join(' ').replace(/\s+/g, ' ').trim() }); cur = []; } };
  for (const w of words) {
    if (w.end < s || w.start > e) continue;
    cur.push(w);
    const t = String(w.word || w.text || '');
    if (cur.length >= 12 || (cur.length >= 5 && /[.!?,;:]$/.test(t))) flush();
  }
  flush();
  return segs.filter(g => g.text.split(' ').length >= 3);
}
const wordTime = (seg, word) => {
  const w = String(word || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (!w) return seg.t;
  const hit = seg.words.find(x => x.w.toLowerCase().replace(/[^a-z0-9]/g, '') === w) || seg.words.find(x => x.w.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(w.slice(0, 5)) && w.length >= 4);
  return hit ? hit.t : seg.t;
};

async function plan(words, s, e, cfg, seed, gemini, log, prepared) {
  const dur = e - s;
  if (!cfg || !cfg.enabled || !prepared || !prepared.length || dur < 8) return undefined;
  const share = Math.max(5, Math.min(MAX_SHARE, +cfg.pct || 20));
  const budget = Math.min(dur * share / 100, dur * MAX_SHARE / 100);
  const n = Math.min(9, Math.max(dur >= 16 ? 2 : dur >= 10 ? 1 : 0, Math.floor(budget / 2.6)) + 1);
  if (!n) return undefined;
  const segs = segmentsOf(words, s, e).filter(g => g.t >= MIN_T - 0.3 && g.t <= dur - TAIL - 1.5);
  if (!segs.length) return undefined;
  segs.forEach((g, i) => { g.i = i; });
  const cands = []; prepared.forEach(v => v.rec.shots.forEach((sh, si) => cands.push({ id: cands.length, v, sh, si })));
  const hasDesc = cands.some(c => c.sh.desc);

  // 1) which shot belongs to which sentence
  let picks = [];
  if (AI.ready(gemini) && hasDesc) {
    try {
      const list = cands.filter(c => c.sh.desc && c.sh.q >= 2).sort((a, b) => (a.sh.uses - b.sh.uses) || (b.sh.q - a.sh.q)).slice(0, 80);
      const vids = list.map(c => `${c.id}. [q${c.sh.q}, ${(c.sh.b - c.sh.a).toFixed(0)}s] ${c.sh.desc}`).join('\n');
      const lines = segs.slice(0, 60).map(g => `${g.i}. [${g.t.toFixed(0)}s] ${g.text}`).join('\n');
      const prompt = `You are a video editor adding B-roll cut-aways (muted, 2-3 seconds) over a speaker in a short vertical clip.\n\nAVAILABLE SHOTS (id, quality 1-5, length, what it shows):\n${vids}\n\nSPOKEN SENTENCES (index, time, text):\n${lines}\n\nChoose ${n} DIFFERENT moments (aim for exactly ${n}, at least ${Math.max(1, n - 1)}). For each, pick the shot whose picture literally illustrates what is said at that moment, and the exact spoken WORD the picture should appear on (the word that names or shows the thing).\nRules: the picture must really relate to the words (a poor match is worse than none); prefer quality 4-5; spread the moments over the WHOLE clip (beginning, middle, end), never two close together; use different shots (and different videos when possible).\nReply with JSON only: {"picks":[{"seg":0,"shot":12,"word":"money"}]}`;
      const r = await AI.generate(gemini, { prompt, json: true, timeoutMs: 45000 });
      const j = AI.parseJson(r.text !== undefined ? r.text : r);
      picks = ((j && j.picks) || []).map(p => ({ seg: segs[+p.seg], c: cands[+p.shot], word: p.word })).filter(p => p.seg && p.c);
    } catch (err) { if (String(err.message) === 'CANCELLED') throw err; log('B-roll', `AI matching failed (${String(err.message).slice(0, 80)}); matching by words`, 'warn'); }
  }
  if (!picks.length) {                                          // word match on file name + shot description; then the best shots spread evenly
    const scored = [];
    for (const g of segs) {
      const gw = new Set(tokens(g.text));
      for (const c of cands) { const cw = tokens(c.v.name + ' ' + c.sh.desc); const sc = cw.filter(w => gw.has(w)).length; if (sc) scored.push({ seg: g, c, sc: sc * 2 + c.sh.q * 0.1 - c.sh.uses * 0.5, word: cw.find(w => gw.has(w)) }); }
    }
    scored.sort((a, b) => b.sc - a.sc); picks = scored;
    if (!picks.length && !hasDesc) {
      const step = Math.max(1, Math.floor(segs.length / n)), pool = cands.slice().sort((a, b) => (a.sh.uses - b.sh.uses) || ((b.sh.b - b.sh.a) - (a.sh.b - a.sh.a)));
      for (let i = Math.floor(step / 2), k = 0; i < segs.length && picks.length < n; i += step, k++) picks.push({ seg: segs[i], c: pool[(seed + k) % pool.length] });
    }
  }

  // 2) place them: on the keyword, inside ONE shot (no camera cut), spaced apart, within the share
  const out = [], usedShot = new Set(); let total = 0;
  const place = (p, k) => {
    const sh = p.c.sh, room = sh.b - sh.a - 2 * EDGE;
    let L = 2 + (((seed || 1) * 7 + k * 5) % 15) / 10;                  // 2.0 - 3.4 s
    L = Math.min(L, room);
    if (L < 1.4) return false;
    let t = wordTime(p.seg, p.word) - 0.05;
    t = Math.max(p.seg.t - 0.1, Math.min(t, p.seg.end));
    t = Math.min(t, dur - TAIL - L);
    if (t < MIN_T) return false;
    if (out.some(o => t < o.t + o.dur + GAP && o.t < t + L + GAP)) return false;
    if (total + L > dur * MAX_SHARE / 100) return false;
    const key = `${p.c.v.key}#${p.c.si}`; if (usedShot.has(key)) return false;
    usedShot.add(key);
    // a different part of the shot each time it is used
    const slack = Math.max(0, room - L), ss = +(sh.a + EDGE + (slack > 0 ? ((sh.uses * (L + 0.4)) % (slack + 0.01)) : 0)).toFixed(2);
    sh.uses++;
    out.push({ file: p.c.v.path, name: p.c.v.name, t: +t.toFixed(2), dur: +L.toFixed(2), ss, why: p.c.sh.desc || '' });
    total += L; return true;
  };
  for (const p of picks) { if (out.length >= n) break; place(p, out.length); }
  // not enough good matches: fill the empty parts of the clip with the best remaining shot
  if (out.length < n) {
    const zones = Array.from({ length: n }, (_, z) => MIN_T + (dur - TAIL - MIN_T) * (z + 0.5) / n);
    for (const zc of zones) {
      if (out.length >= n) break;
      const g = segs.slice().sort((a, b) => Math.abs(a.t - zc) - Math.abs(b.t - zc)).find(sg => !out.some(o => sg.t < o.t + o.dur + GAP && o.t < sg.t + 3.4 + GAP));
      if (!g) continue;
      const c = cands.filter(c => !usedShot.has(`${c.v.key}#${c.si}`) && c.sh.q >= 2).sort((a, b) => (a.sh.uses - b.sh.uses) || (b.sh.q - a.sh.q) || ((b.sh.b - b.sh.a) - (a.sh.b - a.sh.a)))[0];
      if (c) place({ seg: g, c, word: '' }, out.length);
    }
  }
  out.sort((a, b) => a.t - b.t);
  if (out.length) log('B-roll', `${out.length} b-roll cut-away${out.length === 1 ? '' : 's'} (${total.toFixed(1)} s of ${dur.toFixed(0)} s = ${Math.round(total / dur * 100)}%)`, 'info');
  else log('B-roll', 'No good moment found for b-roll in this clip', 'info');
  return out.length ? out : undefined;
}
module.exports = { prepare, plan };
