// AI sound chooser: the planner (fx.cjs) decides WHEN a sound goes in; this asks the AI WHICH sound fits the sentence best.
// Any failure (no key, bad answer, timeout) leaves the planner's own picks untouched.
const AI = require('./ai.cjs');
const SFX = require('./sfxlib.cjs');
const CAP = { whoosh: 0.9, hit: 1.0, funny: 1.3, fail: 1.3, reward: 1.1, pop: 0.8, tech: 1.0, glitch: 0.9, camera: 0.6, riser: 1.8 };
const GROUP = { whoosh: ['whoosh', 'riser'], riser: ['riser', 'whoosh'], hit: ['hit', 'pop'], pop: ['pop', 'hit', 'tech'], reward: ['reward', 'pop'], tech: ['tech', 'pop'], glitch: ['glitch', 'tech'], camera: ['camera'], fail: ['fail', 'funny'], funny: ['funny', 'fail'] };

function sentenceAround(words, t) {
  const i = words.findIndex(w => w.end >= t - 0.05 && w.start <= t + 0.3);
  if (i < 0) return '';
  let a = i, b = i;
  while (a > 0 && i - a < 8 && !/[.!?]$/.test(words[a - 1].word || words[a - 1].text || '')) a--;
  while (b < words.length - 1 && b - i < 6 && !/[.!?]$/.test(words[b].word || words[b].text || '')) b++;
  return words.slice(a, b + 1).map(w => w.word || w.text || '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}

async function refine(plan, words, gemini, log) {
  if (!plan || !plan.sfx || plan.sfx.length < 1 || !AI.ready(gemini)) return plan;
  const lib = SFX.list(); if (!lib.length) return plan;
  const byName = Object.fromEntries(lib.map(x => [x.name, x]));
  const ev = plan.sfx.slice(0, 40).map((s, n) => ({ n, role: s.role, current: s.name, said: sentenceAround(words, s.t0 ?? s.t) }));
  const catalog = lib.map(x => `${x.name} [${x.roles.join('/')}${x.tier === 'fun' ? ', joke-only' : ''}]: ${x.desc || ''}`).join('\n');
  const prompt = `You are the sound designer for a short vertical video. A planner already decided WHEN a sound effect plays. Pick WHICH sound from the catalog fits what the speaker is saying at that moment.\n\nCATALOG:\n${catalog}\n\nMOMENTS (n, planned role, current sound, what is said):\n${ev.map(e => `${e.n}. role=${e.role} current=${e.current} said="${e.said}"`).join('\n')}\n\nRULES:\n- Subtle is better than loud. Transitions and zooms get swoop/whoosh sounds; strong claims, numbers and key statements get hits; light moments get pops or ticks; wins and good news get reward chimes; flashes get camera sounds; glitch moments get glitch sounds.\n- Sounds marked joke-only (womp, trombone, boing, bonk, bloop, slide whistle) only for clearly funny or failing moments, otherwise never.\n- Never use the same sound for two moments in a row, and vary the sounds across the clip.\n- Use "none" when no sound would help that moment.\n\nReply with JSON only: {"picks":[{"n":0,"sound":"catalog_name_or_none"}]}`;
  try {
    const r = await AI.generate(gemini, { prompt, json: true, timeoutMs: 25000 });
    const j = AI.parseJson ? AI.parseJson(r.text !== undefined ? r.text : r) : r;
    const picks = (j && j.picks) || [];
    let changed = 0, removed = 0; const drop = new Set(); let prev = null;
    for (const p of picks) {
      const s = plan.sfx[p.n]; if (!s) continue;
      if (/^none$/i.test(p.sound)) { drop.add(s); removed++; continue; }
      const f = byName[p.sound]; if (!f || f.name === s.name) continue;
      if (f.tier === 'fun' && !['funny', 'fail'].includes(s.role)) continue;           // jokes only where the planner thought a joke fits
      if (!(GROUP[s.role] || [s.role]).some(r => f.roles.includes(r))) continue;       // keep the sound family sane
      if (prev === f.name) continue;
      const role = f.roles.includes(s.role) ? s.role : f.roles[0];
      const d = Math.min(f.dur || 1, CAP[role] || 1.2), t0 = s.t0 ?? s.t;
      let at = t0 - 0.02;
      if (s.align === 'peak') at = t0 - d * (role === 'whoosh' ? 0.5 : 0.3);
      if (s.align === 'end') at = t0 - d;
      s.file = f.path; s.name = f.name; s.role = role; s.dur = d; s.t = Math.max(0, +at.toFixed(2));
      s.db = +((s.baseDb ?? -6) + (f.gainDb || 0) + (s.extra || 0)).toFixed(1);
      prev = f.name; changed++;
    }
    if (drop.size) plan.sfx = plan.sfx.filter(s => !drop.has(s));
    plan.sfx.sort((a, b) => a.t - b.t);
    if (log) log('FFmpeg', `AI sound choice: ${changed} changed, ${removed} removed, ${plan.sfx.length} total`, 'info');
  } catch (e) { if (log) log('FFmpeg', 'AI sound choice skipped (' + String(e && e.message || e).slice(0, 80) + '), using the built-in choice', 'info'); }
  return plan;
}
module.exports = { refine };
