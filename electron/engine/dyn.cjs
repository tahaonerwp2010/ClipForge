// "Dynamic captions": templates with their own fonts (locked), mixed word sizes, metallic / shiny colours on the important words.
// Each phrase is stacked in lines; the important word gets its own bigger line. Metal = outline layer + base colour + lighter
// top-half layer (clip) so it looks like a bevelled, shiny surface. Pure ASS, so it renders everywhere FFmpeg does.
const DATA = require('./dyn-templates.json');
const FONTS = require('./fonts.cjs');
const POWER = new Set(DATA.words.power), STOP = new Set(DATA.words.stop);
const byId = Object.fromEntries(DATA.templates.map(t => [t.id, t]));
const isDyn = id => !!byId[id];
const get = id => byId[id] || null;
const fontsOf = tpl => [...new Set([tpl.plain.font, tpl.fill.font, tpl.emph.font])];
const bgr = hex => { const h = hex.replace('#', ''); return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`; };
const esc = t => String(t).replace(/[{}\\]/g, '');
const ts = sec => { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
const clean = w => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
// Only genuinely special words get the big treatment: strong words from the list, numbers, or the clip's own AI keywords.
// Ordinary words (even long ones) never do, and contractions like "that's" never do.
const score = (w, kw) => { const n = clean(w); if (n.length < 4 || STOP.has(n) || n.includes("'")) return -1; let s = 0; if (POWER.has(n)) s += 3; if (/\d/.test(n)) s += 3; if (kw && kw.has(n)) s += 3; return s; };

// words -> phrases (end at . ? ! , a pause, or maxWords)
function phrases(cw, tpl) {
  const out = []; let cur = [];
  cw.forEach((w, i) => {
    cur.push(i);
    const nx = cw[i + 1];
    const brk = !nx || cur.length >= tpl.maxWords || /[.!?]$/.test(w.word) || (nx.start - w.end > 0.55) || (/[,;:]$/.test(w.word) && cur.length >= 2);
    if (brk) { out.push(cur); cur = []; }
  });
  return out;
}
// one phrase -> lines of {idx, cls, text}; cls: emph | plain | fill
function layout(ws, tpl, W, base, H, kw, allowEmph = true) {
  let emph = -1, best = 2.9;
  if (allowEmph) ws.forEach((w, j) => { const s = score(w, kw); if (s > best) { best = s; emph = j; } });
  const items = ws.map((w, j) => {
    const cls = j === emph ? 'emph' : (STOP.has(clean(w)) && clean(w).length <= 4 ? 'fill' : 'plain');
    const st = tpl[cls], t = st.upper ? String(w).toUpperCase() : String(w);
    return { j, cls, text: esc(t), st };
  });
  const widthOf = it => it.text.length * base * it.st.scale * tpl.cw;
  const lines = []; let line = [], lw = 0;
  for (const it of items) {
    const w = widthOf(it) + base * 0.3;
    const split = line.length && (it.cls === 'emph' || line[line.length - 1].cls === 'emph' || lw + w > W * 0.88 || line.length >= tpl.maxPerLine);
    if (split) { lines.push(line); line = []; lw = 0; }
    line.push(it); lw += w;
  }
  if (line.length) lines.push(line);
  return lines.map(l => {
    const est = l.reduce((a, it) => a + widthOf(it) + base * 0.3, 0);
    let fit = Math.min(1, (W * 0.9) / Math.max(1, est));
    if (tpl.behind && l[0].cls === 'emph') {                       // the word behind the person is made as wide as the screen, so it shows on both sides of the speaker
      const sz = base * l[0].st.scale;
      fit = Math.max(0.5, Math.min((W * 0.96) / Math.max(1, est), (0.27 * H) / sz));
    }
    return { items: l, fit, size: Math.max(...l.map(it => it.st.scale)) * base * fit };
  });
}

function build({ words, clipStart, clipEnd, W, H, captions, tpl, part = 'all', keywords, behindBox }) {
  const k = W / 1080, base = Math.round(captions.fontSize * 3.4 * k * tpl.sizeMul * 1.15);
  const off = Math.max(-0.5, Math.min(0.5, Number(captions.syncOffset) || 0));
  const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd).map(w => (off ? { ...w, start: w.start + off, end: w.end + off } : w));
  const L = [], LEAD = 0.02, tS = [];
  cw.forEach((w, i) => { tS[i] = Math.max(0, w.start - clipStart - LEAD); if (i && tS[i] < tS[i - 1] + 0.04) tS[i] = tS[i - 1] + 0.04; });
  const cx = Math.round((captions.positionX ?? 50) / 100 * W), cy = (captions.positionY ?? 72) / 100 * H;
  const ph = phrases(cw, tpl);
  let emphN = 0, lastEmphT = -99;
  const kw = new Set((keywords || []).map(x => clean(String(x))).filter(Boolean));
  ph.forEach((idxs, pi) => {
    const first = idxs[0], last = idxs[idxs.length - 1], nxt = ph[pi + 1];
    let pEnd = (cw[last].end - clipStart) + 0.18;
    if (nxt) pEnd = Math.min(pEnd, tS[nxt[0]]);
    pEnd = Math.max(pEnd, tS[last] + 0.12);
    const pStart = tS[first], gapNeeded = tpl.behind ? 2.4 : 1.6;
    const lines = layout(idxs.map(i => cw[i].word), tpl, W, base, H, kw, pStart - lastEmphT >= gapNeeded);
    if (lines.some(l => l.items[0].cls === 'emph')) lastEmphT = pStart;
    const isEm = lines.map(l => !!(tpl.behind && l.items[0].cls === 'emph'));          // behind-the-person: the big word is drawn on its own layer, higher up
    const hs = lines.map((l, i) => isEm[i] ? 0 : l.size * 1.02 * tpl.lh), total = hs.reduce((a, b) => a + b, 0);
    let y0 = Math.max(total / 2 + 20 * k, Math.min(H - total / 2 - 20 * k, cy)) - total / 2;
    const emY = Math.round(behindBox && behindBox.bottom > behindBox.top ? Math.max(0.18 * H, Math.min(0.55 * H, H * (behindBox.top + 0.28 * (behindBox.bottom - behindBox.top)))) : 0.35 * H);   // inside the speaker: upper chest / head area
    const ecol = (() => { const pal = tpl.emph.colors; return pal[emphN++ % pal.length]; })();
    lines.forEach((ln, li) => {
      const yc = isEm[li] ? emY : Math.round(y0 + hs[li] / 2); y0 += hs[li];
      if (part === 'behind' && !isEm[li]) return;
      if (part === 'front' && isEm[li]) return;
      const fsOf = it => Math.round(base * it.st.scale * ln.fit);
      const lineIdx = ln.items.map(it => idxs[it.j]);
      lineIdx.forEach((gi, q) => {
        const s = tS[gi], e = q + 1 < lineIdx.length ? tS[lineIdx[q + 1]] : pEnd;
        if (e - s < 0.03) return;
        const runs = (layer) => ln.items.map((it, t) => {
          const st = it.st, vis = t <= q, cur = t === q, act = tpl.active;
          let col = it.cls === 'emph' ? ecol : st.colors;
          const metal = tpl.metal && col[0] !== col[1];
          let tags = `\\fn${st.font}\\fs${fsOf(it)}\\b${FONTS.boldFlag(st.font)}\\i${st.italic ? 1 : 0}\\alpha&H${vis ? '00' : 'FF'}&`;
          const boxed = act && act.mode === 'box' && cur, tinted = act && act.mode === 'color' && cur;
          if (layer === 'outline') {
            const ow = Math.round((boxed ? act.pad : st.ow) * k * ln.fit);
            const oc = boxed ? act.color : st.outline;
            tags += `\\bord${ow}\\3c${bgr(oc)}\\1c${bgr(oc)}\\shad${ow ? Math.round(3 * k) : Math.round(4 * k)}\\4c&H000000&\\blur${boxed ? 0 : 0.6}`;
            if (tpl.hollow && it.cls !== 'emph') tags = tags.replace(/\\1c&H[0-9A-F]+&/, '').replace(`\\3c${bgr(oc)}`, `\\3c${bgr(col[0])}`) + '\\1a&HFF&\\shad0';
            if (!ow && !boxed) tags += '\\1a&HFF&';
          } else {
            const c = boxed ? act.text : tinted ? act.color : (layer === 'shine' ? col[0] : col[1]);
            tags += `\\bord0\\shad0\\blur0\\1c${bgr(c)}`;
            if (tpl.hollow && it.cls !== 'emph') tags += '\\1a&HFF&';
          }
          const flat = !metal || boxed || tinted;
          if (layer === 'shine' && flat) tags += '\\alpha&HFF&';
          if (cur && tpl.anim === 'pop') tags += '\\fscx70\\fscy70\\t(0,110,\\fscx110\\fscy110)\\t(110,210,\\fscx100\\fscy100)';
          else if (cur) tags += '\\fscx100\\fscy100';
          return `{${tags}}${it.text}{\\fscx100\\fscy100}`;
        }).join(`{\\fscx100\\fscy100} `);
        const pos = `\\an5\\pos(${cx},${yc})`;
        const S = ln.size;
        L.push(`Dialogue: 0,${ts(s)},${ts(e)},Cap,,0,0,0,,{${pos}}${runs('outline')}`);
        L.push(`Dialogue: 1,${ts(s)},${ts(e)},Cap,,0,0,0,,{${pos}}${runs('fill')}`);
        if (tpl.metal) L.push(`Dialogue: 2,${ts(s)},${ts(e)},Cap,,0,0,0,,{${pos}\\clip(0,${Math.round(yc - S * 0.62)},${W},${Math.round(yc - S * 0.02)})}${runs('shine')}`);
      });
    });
  });
  return L;
}
module.exports = { isDyn, get, build, fontsOf, templates: DATA.templates };
