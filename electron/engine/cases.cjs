// Case-based effect planner. Every effect is the answer to a SITUATION in the speech (a right answer, a wrong answer, money, a warning, a question…),
// never a random pick: each case has one fixed, hand-chosen combination of video effect + sound (a few equivalent sounds alternate so it does not repeat).
//
//   case        what the speaker says                         video effect                    sound
//   affirm      "I was right", "exactly", "correct"           green flash 0.2 s               right_answer
//   wrong       "that was wrong", "mistake", "failed"         red flash 0.2 s + small shake   wrong_buzz
//   danger      "warning", "scam", "dangerous", "risk"        red flash 0.2 s + shake         alert
//   money       "$5,000", "a million", "profit", "paid"       gold flash 0.2 s + pulse        coin_collect
//   win         "we won", "success", "made it", "record"      gold glow + colour pop          level_up / power_up
//   stat        "90%", "300 people", "10x"                    punch zoom                      pop_high
//   listing     "first", "step two", "number one", "finally"  small punch zoom                tick
//   question    "why…?", "how…", "did you know"               pull (zoom-out settle)          swoop_up_fast
//   contrast    "but…", "however", "suddenly"                 whip-pan                        swoop_down
//   reveal      "the secret", "the truth", "nobody"           slow push-in                    swoop_up
//   emphasis    "never", "everything", "insane", "huge"       punch zoom                      pop_bubble / pop_high
//   shock       "overnight", "from zero", "no way", "wow"     white flash + punch             punch_hit
//   loss        "lost", "fired", "gave up", "rejected"        colour drain 0.8 s              swoop_down (womp in Wild)
//   speed       "fast", "instantly", "quick"                  whip-pan                        zip_quick
//   tech        "AI", "software", "app", "data"               cyan flash 0.14 s               click_soft
//   love        "love", "beautiful", "perfect", "dream"       soft glow                       sparkle
//   funny       "lol", "joke", "hilarious"  (Wild only)       small tilt                      boing / bloop
//   pause       a sentence after a long pause                 slow push-in                    swoop_up (soft)
//   intro       the very first second (balanced / wild)       pull                            soft whoosh
//
// Colours: green 22c55e (right) · red ef4444 (wrong / danger) · gold facc15 (money) · cyan 22d3ee (tech)
const GREEN = '22c55e', RED = 'ef4444', GOLD = 'facc15', CYAN = '22d3ee';

// pattern groups use (?<k>…) for the word the effect lands on; without it the first word of the match is used
const CASES = [
  { id: 'affirm', pri: 9, cool: 2.5, min: 'subtle',
    re: [/\b(?:i was|i am|i'm|i were|you were|you are|you're|you was|that's|that is|that was|he was|he is|he's|she was|she is|she's|they were|they are|we were|we are|it was|it is|it's|was|is|am|are)\s+(?:absolutely |totally |completely |100% |dead |exactly |so |very |actually )?(?<k>right|correct)\b(?!\s+(?:now|here|there|away|side|next|behind|in front|after|before|to|of|at|below|above|over|around|outside|inside|up|down|back|through|into|onto|hand|foot|eye|lane|turn|corner|angle)\b)/g, /\b(?<k>right) (?:answer|choice|call|decision|guess)\b/g, /\b(?<k>exactly)\b(?!\s+(?:what|how|why|where|when|who|which|the same))/g, /\b(?<k>correct)\b/g, /\b(?<k>spot) on\b/g, /\b(?<k>nailed) it\b/g],
    vfx: [{ k: 'tint', c: GREEN }], sfx: ['right_answer'], db: -1 },
  { id: 'wrong', pri: 9, cool: 2.5, min: 'subtle',
    re: [/\b(?:was|is|were|are|am|you're|that's|i was|it's|i'm|completely|totally|dead|so)\s+(?:completely |totally |dead |so |very |absolutely )?(?<k>wrong|incorrect|mistaken)\b/g, /\b(?<k>wrong|incorrect) (?:answer|choice|call|decision|move|way|idea)\b/g, /\b(?<k>mistake|mistakes|blunder|failed|failure|bankrupt|worst)\b/g, /\b(?<k>wasn't|isn't) (?:right|true|correct)\b/g],
    vfx: [{ k: 'tint', c: RED }, { k: 'shake', amp: 0.5, from: 'balanced' }], sfx: ['wrong_buzz'], db: 0 },
  { id: 'danger', pri: 8, cool: 3, min: 'subtle',
    re: [/\b(?<k>warning|danger|dangerous|careful|scam|scammed|trap|deadly|risky|threat|disaster|catastrophe|collapse|crashed|lethal)\b/g, /\b(?<k>risk) (?:of|losing|everything)\b/g],
    vfx: [{ k: 'tint', c: RED }, { k: 'shake', amp: 0.7 }], sfx: ['alert'], db: -3 },
  { id: 'money', pri: 8, cool: 3, min: 'subtle',
    re: [/(?<k>\$\s?\d[\d,\.]*(?:\s?(?:k|m|million|billion|thousand))?)/g, /\b(?<k>\d[\d,\.]*\s?(?:million|billion|thousand|k|grand|dollars|bucks))\b/g, /\b(?<k>millionaire|billionaire|million|billion|cash|salary|income|revenue|profit|profits|paid|rich|wealthy|wealth|dollars|money)\b/g],
    vfx: [{ k: 'tint', c: GOLD }, { k: 'pulse', from: 'balanced' }], sfx: ['coin_collect'], db: -1 },
  { id: 'shock', pri: 7, cool: 4, min: 'balanced',
    re: [/\b(?<k>overnight)\b/g, /\b(?<k>in (?:one|a single) (?:day|night|week|month))\b/g, /\b(?<k>from zero|from nothing|out of nowhere)\b/g, /\b(?<k>no way|oh my god|oh my gosh|unbelievable|mind.?blowing|jaw.?dropping)\b/g, /\b(?<k>wow|boom|bam)\b/g],
    vfx: [{ k: 'flash' }, { k: 'punch', amp: 1.3 }], sfx: ['punch_hit'], db: -5 },
  { id: 'win', pri: 7, cool: 3.5, min: 'subtle',
    re: [/\b(?<k>won|win|winner|winning|success|successful|achieved|accomplished|promotion|promoted|champion|record|breakthrough|victory|made it|passed|graduated)\b/g],
    vfx: [{ k: 'glow' }, { k: 'colorpop', from: 'balanced' }], sfx: ['level_up', 'power_up'], db: -2 },
  { id: 'reveal', pri: 6, cool: 5, min: 'balanced',
    re: [/\b(?<k>secret|secrets|truth|hidden|nobody|no one|real reason|trick|hack|actually|here's the thing|most people)\b/g, /\bthe (?:real |big |main |biggest |only )?(?<k>problem|catch|key)\b/g],
    vfx: [{ k: 'push' }], sfx: ['swoop_up'], db: -3, align: 'peak' },
  { id: 'stat', pri: 6, cool: 3, min: 'balanced',
    re: [/(?<k>\d[\d,\.]*\s?(?:%|percent|x|times)\b)/g, /\b(?<k>\d{2,}[\d,\.]*)\b/g, /\b(?<k>(?:ninety|eighty|seventy|sixty|fifty|forty|thirty|twenty|hundred|thousand)(?:[- ]\w+)?)\b/g],
    vfx: [{ k: 'punch', amp: 1 }], sfx: ['pop_high'], db: -2 },
  { id: 'emphasis', pri: 5, cool: 4.5, min: 'balanced',
    re: [/\b(?<k>never|always|everything|nothing|everyone|literally|insane|crazy|impossible|massive|huge|biggest|incredible|shocking|unbelievable|extremely|ridiculous)\b/g],
    vfx: [{ k: 'punch', amp: 1 }], sfx: ['pop_bubble', 'pop_high'], db: -2 },
  { id: 'question', pri: 5, cool: 5, min: 'balanced', sentence: 'question',
    re: [/^(?:so |and |well |okay |now |oh |yeah |but )?(?<k>why|how|what if|did you know|have you ever|what|who|where|when|do you|are you|can you|would you|is it|isn't)\b/g],
    vfx: [{ k: 'pull' }], sfx: ['swoop_up_fast'], db: -4, align: 'peak' },
  { id: 'contrast', pri: 5, cool: 4, min: 'balanced', sentence: 'start',
    re: [/^(?:so |and |well |okay |now |oh |yeah )?(?<k>but|however|except|suddenly|instead|until|plot twist|then everything)\b/g],
    vfx: [{ k: 'pan' }], sfx: ['swoop_down'], db: -4, align: 'peak' },
  { id: 'listing', pri: 5, cool: 3, min: 'balanced',
    re: [/\b(?<k>first|second|third|fourth|fifth|finally|lastly)\b/g, /\b(?<k>number (?:one|two|three|four|five)|step (?:one|two|three|four|five|\d+))\b/g],
    vfx: [{ k: 'punch', amp: 0.7 }], sfx: ['tick'], db: -2 },
  { id: 'loss', pri: 5, cool: 5, min: 'balanced',
    re: [/\b(?<k>lost|losing|broke|fired|quit|gave up|give up|rejected|laid off|ruined|destroyed|alone|depressed)\b/g],
    vfx: [{ k: 'mono' }], sfx: ['swoop_down'], sfxWild: ['womp'], db: -4 },
  { id: 'speed', pri: 4, cool: 5, min: 'balanced',
    re: [/\b(?<k>fast|faster|fastest|quick|quickly|instantly|immediately|speed|rush|hurry)\b/g],
    vfx: [{ k: 'pan' }], sfx: ['zip_quick'], db: -3, align: 'peak' },
  { id: 'tech', pri: 3, cool: 9, min: 'wild',
    re: [/\b(?<k>ai|artificial intelligence|software|algorithm|website|internet|computer|robot|chatgpt|startup|app|code|coding|data)\b/g],
    vfx: [{ k: 'tint', c: CYAN, d: 0.14 }], sfx: ['click_soft'], db: -2 },
  { id: 'love', pri: 3, cool: 8, min: 'wild',
    re: [/\b(?<k>love|beautiful|perfect|dream|magic|magical|happy|grateful)\b/g],
    vfx: [{ k: 'glow' }], sfx: ['sparkle'], db: -4 },
  { id: 'funny', pri: 3, cool: 8, min: 'wild',
    re: [/\b(?<k>lol|haha|funny|hilarious|joke|kidding|embarrassing|stupid|dumb|silly)\b/g],
    vfx: [{ k: 'tilt' }], sfx: ['boing', 'bloop'], db: -3 },
];
const LEVEL_RANK = { subtle: 0, balanced: 1, wild: 2 };
const LEVEL = {
  subtle:   { gap: 5.0, amp: 0.05, minPri: 7 },
  balanced: { gap: 3.0, amp: 0.08, minPri: 4 },
  wild:     { gap: 1.9, amp: 0.12, minPri: 3 },
};
const clean = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9$%'.,\-]/g, '').replace(/[.,]+$/, '');

// sentences of a clip: [{ a, b, text, startIdx }] (word index range) using punctuation, or pauses when the transcript has no punctuation
function sentencesOf(cw) {
  const punct = cw.filter(w => /[.!?…]["'”’)\]]*$/.test(String(w.word || '').trim())).length / (cw.length || 1) >= 0.03;
  const out = []; let a = 0;
  cw.forEach((w, i) => {
    const nx = cw[i + 1];
    const end = !nx || (punct && /[.!?…]["'”’)\]]*$/.test(String(w.word || '').trim())) || nx.start - w.end > (punct ? 0.6 : 0.3);
    if (end) { out.push({ a, b: i }); a = i + 1; }
  });
  return out;
}

// every case that happens in the clip, with the time of the key word: [{ id, t, pri, idx, sentence }]
function detect(cw, clipStart) {
  const toks = cw.map(w => clean(w.word));
  const sents = sentencesOf(cw), found = [];
  sents.forEach((s, si) => {
    const parts = []; let text = '';
    for (let i = s.a; i <= s.b; i++) { parts.push({ i, o: text.length }); text += (text ? ' ' : '') + toks[i]; }
    const idxAt = (off) => { let r = parts[0].i; for (const p of parts) { if (p.o <= off) r = p.i; else break; } return r; };
    const isQ = /[?]["'”’)\]]*$/.test(String(cw[s.b].word || '').trim());
    for (const c of CASES) {
      if (c.sentence === 'question' && !isQ && !/^(why|how|what if|did you know|have you ever)\b/.test(text)) continue;
      for (const re of c.re) {
        re.lastIndex = 0; let m;
        while ((m = re.exec(text))) {
          if (m[0] === '') { re.lastIndex++; continue; }
          const kOff = m.groups && m.groups.k ? m.index + m[0].indexOf(m.groups.k) : m.index;
          const idx = idxAt(kOff);
          found.push({ id: c.id, pri: c.pri, idx, t: cw[idx].start - clipStart, si });
          if (!re.global) break;
        }
      }
    }
    // a sentence that follows a long pause: the line the speaker was building up to
    const prev = cw[s.a - 1];
    if (prev && cw[s.a].start - prev.end >= 0.9 && s.b - s.a >= 3) found.push({ id: 'pause', pri: 4, idx: s.a, t: cw[s.a].start - clipStart, si });
  });
  return found;
}

const SPEC = { pause: { vfx: [{ k: 'push' }], sfx: ['swoop_up'], db: -6, cool: 6, min: 'balanced', align: 'peak' } };
function plan(words, clipStart, clipEnd, opt = {}, seed = 1, SFX) {
  const out = { zoom: [], push: [], pull: [], pulse: [], shake: [], tilt: [], pan: [], flashes: [], dip: [], strobe: [], negate: [], glitch: [], vhs: [], chroma: [], mono: [], colorpop: [], glow: [], blur: [], tint: [], sfx: [], events: 0, kinds: {}, cases: {} };
  if (!opt || !opt.enabled) return out;
  const lv = LEVEL[opt.intensity] || LEVEL.balanced, rank = LEVEL_RANK[opt.intensity] ?? 1, dur = clipEnd - clipStart;
  const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd);
  if (cw.length < 4 || dur < 3) return out;
  const fam = { zoom: opt.zoom !== false, motion: opt.shake !== false, flash: opt.flash !== false, glitch: opt.glitch !== false, color: opt.color !== false };
  const FAM = { punch: 'zoom', push: 'zoom', pull: 'zoom', pulse: 'zoom', shake: 'motion', tilt: 'motion', pan: 'motion', flash: 'flash', tint: 'flash', glitch: 'glitch', glow: 'color', colorpop: 'color', mono: 'color' };
  const useSfx = opt.sfx !== false && SFX;
  const base = opt.sfxDb ?? -6;

  // 1) cases in the speech, best first, spaced out
  const byId = Object.fromEntries(CASES.map(c => [c.id, c])); byId.pause = { id: 'pause', ...SPEC.pause };
  let cands = detect(cw, clipStart).filter(e => e.t >= 0.35 && e.t <= dur - 0.6);
  cands = cands.filter(e => { const c = byId[e.id]; return e.pri >= lv.minPri && rank >= LEVEL_RANK[c.min || 'subtle']; });
  cands.sort((a, b) => b.pri - a.pri || a.t - b.t);
  const chosen = [], lastOf = {};
  const maxN = Math.max(1, Math.ceil(dur / lv.gap));
  for (const e of cands) {
    if (chosen.length >= maxN) break;
    const c = byId[e.id];
    if (lastOf[e.id] !== undefined && Math.abs(e.t - lastOf[e.id]) < (c.cool || 3)) continue;
    const gap = e.pri >= 8 ? Math.min(1.6, lv.gap) : lv.gap;                       // strong moments (right / wrong / money / danger) may sit closer
    if (chosen.some(o => Math.abs(o.t - e.t) < Math.max(gap, o.pri >= 8 ? 1.6 : 0))) continue;
    chosen.push(e); lastOf[e.id] = e.t;
  }
  chosen.sort((a, b) => a.t - b.t);

  // 2) intro: first second, balanced / wild only
  const useCount = {}, recent = [];
  const addSfxByName = (names, t, extra, align) => {
    if (!useSfx) return false;
    const pool = names.map(n => SFX.list().find(x => x.name === n)).filter(Boolean);
    if (!pool.length) return false;
    const least = Math.min(...pool.map(x => useCount[x.name] || 0));
    const f = pool.filter(x => (useCount[x.name] || 0) === least && x.name !== recent[recent.length - 1])[0] || pool[0];
    const role = f.roles[0], d = Math.min(f.dur || 1, 1.4);
    let at = t - 0.02; if (align === 'peak') at = t - d * 0.5;
    at = Math.max(0, +at.toFixed(2));
    if (out.sfx.some(s => Math.abs(s.t - at) < 0.25)) return false;
    out.sfx.push({ file: f.path, t: at, db: +(base + (f.gainDb || 0) + extra).toFixed(1), dur: d, role, name: f.name, t0: t, align: align || 'start', baseDb: base, extra, fixed: true });
    useCount[f.name] = (useCount[f.name] || 0) + 1; recent.push(f.name); if (recent.length > 4) recent.shift();
    return true;
  };
  const applyV = (v, t) => {
    if (!fam[FAM[v.k]]) return false;
    switch (v.k) {
      case 'tint': out.tint.push({ t, c: v.c, d: v.d || 0.2 }); break;
      case 'flash': out.flashes.push(t); break;
      case 'punch': out.zoom.push({ t, amp: +(lv.amp * (v.amp || 1)).toFixed(3) }); break;
      case 'push': out.push.push({ t, t2: +(t + Math.min(2.4, Math.max(1.3, dur * 0.1))).toFixed(2), amp: +(lv.amp * 0.9).toFixed(3) }); break;
      case 'pull': out.pull.push({ t, amp: +(lv.amp * 1.3).toFixed(3) }); break;
      case 'pulse': out.pulse.push({ t, amp: +(lv.amp * 1.1).toFixed(3) }); break;
      case 'shake': out.shake.push({ t, amp: v.amp || 0.7 }); break;
      case 'tilt': out.tilt.push({ t, dir: (seed + Math.round(t)) % 2 ? 1 : -1 }); break;
      case 'pan': out.pan.push({ t, dir: (seed + Math.round(t * 3)) % 2 ? 1 : -1 }); break;
      case 'glow': out.glow.push(t); break; case 'colorpop': out.colorpop.push(t); break; case 'mono': out.mono.push(t); break;
      case 'glitch': out.glitch.push(t); break;
      default: return false;
    }
    out.kinds[v.k] = (out.kinds[v.k] || 0) + 1; return true;
  };
  if (dur >= 6 && rank >= 1 && fam.zoom && !chosen.some(e => e.t < 1.2)) {
    out.pull.push({ t: 0.05, amp: +(lv.amp * 0.9).toFixed(3) }); out.kinds.pull = 1;
    addSfxByName(['swoop_up_fast'], 0.05, -5, 'peak'); out.events++; out.cases.intro = 1;
  }
  // 3) the cases
  for (const e of chosen) {
    const c = byId[e.id], t = +e.t.toFixed(2);
    let did = 0;
    for (const v of c.vfx) { if (v.from && rank < LEVEL_RANK[v.from]) continue; if (applyV(v, t)) did++; }
    const names = (opt.intensity === 'wild' && c.sfxWild) ? c.sfxWild : c.sfx;
    if (useSfx && (did || !fam[FAM[c.vfx[0].k]])) addSfxByName(names, t, c.db || 0, c.align);
    out.events++; out.cases[e.id] = (out.cases[e.id] || 0) + 1;
  }
  // 4) a clip is never left bare: quiet picture-only beats (slow push / pull, no sound) on the sentences that got nothing
  if (fam.zoom) {
    const want = Math.max(1, Math.floor(dur / (opt.intensity === 'subtle' ? 12 : opt.intensity === 'wild' ? 5 : 8)));
    let have = out.events, k = 0;
    const sents = sentencesOf(cw).filter(s => s.b - s.a >= 5);
    for (const s of sents) {
      if (have >= want) break;
      const t = +(cw[s.a].start - clipStart).toFixed(2);
      if (t < 1.2 || t > dur - 2) continue;
      const near = [...out.zoom, ...out.push, ...out.pull, ...out.pulse, ...out.tint].some(x => Math.abs((x.t ?? x) - t) < lv.gap * 0.8) || out.flashes.some(x => Math.abs(x - t) < lv.gap * 0.8);
      if (near) continue;
      if ((k++ + seed) % 2) out.push.push({ t, t2: +(t + 1.8).toFixed(2), amp: +(lv.amp * 0.8).toFixed(3) }); else out.pull.push({ t, amp: +(lv.amp * 1.0).toFixed(3) });
      out.kinds[(k + seed) % 2 ? 'pull' : 'push'] = (out.kinds[(k + seed) % 2 ? 'pull' : 'push'] || 0) + 1; out.cases.beat = (out.cases.beat || 0) + 1; have++; out.events++;
    }
  }
  return out;
}
module.exports = { plan, detect, sentencesOf, CASES, LEVEL };
