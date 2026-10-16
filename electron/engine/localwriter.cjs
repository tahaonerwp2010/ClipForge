// Offline "writer": reads the clip transcript and writes title, hook, description, hashtags and keywords from what is really said.
// No AI model needed. Works by finding the clip's topic words and its strongest sentences, then phrasing them like a human creator would.
const STOP = new Set(`a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just let me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your yours yeah yes okay ok well like really actually basically literally gonna gotta kind sort thing things stuff lot got get getting go going goes went know think thought say said says see saw want need make made one two three way back even still much many every always never right mean something anything everything someone people guy guys man dude cuz cause im ive id youre theyre thats theres dont doesnt didnt cant wont isnt arent wasnt`.split(/\s+/));
const FILLER = /\b(um+|uh+|erm|you know|i mean|kind of|sort of|basically|literally|actually)\b[,\s]*/gi;
const POWER = /\b(secret|truth|mistake|mistakes|wrong|myth|never|nobody|everyone|biggest|worst|best|hidden|real|actually|stop|why|how|first|only|free|fast|easy|simple|changed|changes|changing|lost|failed|failure|success|rich|money|million|billion|dangerous|shocking|crazy|insane|warning|truth)\b/i;
const MAP = require('./emoji.cjs');

const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const pick = (arr, seed) => arr[seed % arr.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s) => s.replace(/\b([a-z])([a-z']*)/gi, (m, a, b, i) => (i > 0 && /^(a|an|the|and|or|but|of|to|in|on|at|for|with|vs|is|are)$/i.test(m)) ? m.toLowerCase() : a.toUpperCase() + b.toLowerCase());

function sentencesOf(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  let parts = t.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) {                                         // speech with no punctuation: cut into ~14 word pieces
    const w = t.split(' '); parts = [];
    for (let i = 0; i < w.length; i += 14) parts.push(w.slice(i, i + 14).join(' '));
  }
  return parts.filter(x => x.split(' ').length >= 3);
}
const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
const isTerm = (w) => w.length > 2 && !STOP.has(w.replace(/'/g, '')) && !/^\d+$/.test(w);

function analyze(text) {
  const sents = sentencesOf(text);
  const freq = new Map(), big = new Map();
  for (const s of sents) {
    const tk = tokens(s);
    tk.forEach((w, i) => {
      if (!isTerm(w)) return;
      freq.set(w, (freq.get(w) || 0) + 1);
      const n = tk[i + 1]; if (n && isTerm(n)) { const k = w + ' ' + n; big.set(k, (big.get(k) || 0) + 1); }
    });
  }
  const terms = [...freq.entries()].map(([w, c]) => [w, c * (1 + Math.min(w.length, 9) / 12)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const bigrams = [...big.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const score = (s) => {
    const tk = tokens(s).filter(isTerm); if (!tk.length) return -9;
    let sc = tk.reduce((a, w) => a + (freq.get(w) || 0), 0) / Math.sqrt(tk.length);
    if (POWER.test(s)) sc += 3; if (/\d/.test(s)) sc += 2; if (/\?/.test(s)) sc += 2;
    const n = s.split(' ').length; sc -= Math.abs(n - 12) * 0.25;
    return sc;
  };
  const ranked = sents.map((s, i) => ({ s, i, sc: score(s) })).sort((a, b) => b.sc - a.sc);
  const topic = bigrams[0] || terms[0] || 'this';
  return { sents, terms, bigrams, ranked, topic };
}

// shorten a sentence to a clean phrase of at most n words, never ending on a dangling word
function clip(s, n) {
  let w = s.replace(/^(so|and|but|well|now|then|because|like|yeah|okay)\b[\s,]*/i, '').replace(/[.,;:!?]+$/, '').split(' ');
  const ci = w.findIndex((x, i) => i >= 5 && /,$/.test(x)); if (ci >= 0 && ci + 1 <= n) w = w.slice(0, ci + 1);
  if (w.length > n) { w = w.slice(0, n); while (w.length > 3 && STOP.has(w[w.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) w.pop(); }
  return w.join(' ').replace(/[.,;:!?]+$/, '').replace(/\bi\b/g, 'I');
}
const kind = (text) => /\b(how to|step|steps|tutorial|learn|guide|tips?|ways? to)\b/i.test(text) ? 'how'
  : /\b(mistake|mistakes|wrong|myth|lie|lies|never do)\b/i.test(text) ? 'mistake'
  : /\b(secret|nobody|hidden|no one|truth|real reason|they don'?t)\b/i.test(text) ? 'secret'
  : /\?/.test(text) ? 'question'
  : /\b(story|happened|when i|years ago|i was|i remember)\b/i.test(text) ? 'story'
  : /\b(why|because|reason)\b/i.test(text) ? 'why' : 'general';

function write(text) {
  const A = analyze(text);
  const seed = hash(String(text).slice(0, 200));
  const k = kind(text);
  const best = A.ranked[0] ? A.ranked[0].s : String(text);
  const topic = A.topic;
  const T = titleCase(topic);
  const q = A.sents.find(s => /\?$/.test(s) && s.split(' ').length >= 4 && s.split(' ').length <= 14);
  const claimText = clip(best, 11);

  // title: human, specific, accurate (built from the real topic / real sentence)
  const tmpl = {
    how: [`How To Get Better At ${T}`, `${T}: A Simple Way To Start`, `The Easiest Way To Understand ${T}`],
    mistake: [`The Biggest ${T} Mistake Most People Make`, `Stop Getting ${T} Wrong`, `What Most People Miss About ${T}`],
    secret: [`The ${T} Secret Nobody Talks About`, `What They Don't Tell You About ${T}`, `The Truth About ${T}`],
    question: [q ? cap(clip(q, 12)).replace(/[?]*$/, '?') : `Is ${T} Really Worth It?`],
    story: [`How ${T} Changed Everything`, `The ${T} Story You Need To Hear`, `What ${T} Taught Me`],
    why: [`Why ${T} Matters More Than You Think`, `The Real Reason ${T} Works`, `Why Everyone Is Talking About ${T}`],
    general: [`What Nobody Tells You About ${T}`, `${T}: What You Need To Know`, `The Truth About ${T} Right Now`],
  }[k];
  let title = pick(tmpl, seed);
  if (title.length > 62) title = titleCase(claimText).slice(0, 62).replace(/\s+\S*$/, '');

  // hook: 8-12 words, from the strongest real sentence, or a pattern built on the topic
  const stmt = A.ranked.find(r => !/\?$/.test(r.s) && r.s.split(' ').length >= 6);
  let hook = cap(clip(k === 'question' ? best : (stmt ? stmt.s : best), 12));
  if (hook.split(' ').length < 6) {
    hook = pick([`Nobody explains ${topic} like this`, `This is what most people get wrong about ${topic}`, `Here is the truth about ${topic} in under a minute`, `Watch this before you ignore ${topic} again`], seed + 1);
  }
  if (hook.split(' ').length < 8) hook += ' and why it matters';
  hook = hook.split(' ').slice(0, 12).join(' ');
  if (!/[?!]$/.test(hook) && seed % 2 === 0) hook = pick([`Why does nobody talk about ${topic}?`, `Did you know this about ${topic}?`, `Is this why ${topic} never works?`], seed + 3);

  // description: what the clip says, in natural words
  const leadS = stmt ? stmt.s : best;
  const second = A.ranked.find(r => r.s !== leadS && !/\?$/.test(r.s));
  let d = cap(clip(leadS, 22)) + '.';
  if (second && d.length < 110) d += ' ' + cap(clip(second.s, 18)) + '.';
  d += ' ' + pick([`Follow for more on ${topic}.`, `Share this with someone who needs it.`, `More ${topic} tips coming soon.`], seed + 2);
  const description = d.replace(/\s+/g, ' ').slice(0, 300);

  const keywords = [...new Set([topic, ...A.bigrams.slice(0, 4), ...A.terms.slice(0, 8)])].slice(0, 10);
  return { title, hookText: hook, description, keywords, topic };
}
module.exports = { write, analyze, STOP };
