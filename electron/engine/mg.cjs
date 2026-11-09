// Motion graphics + captions for "Script to Short", written as ONE .ass file (libass draws the animations while the video is encoded).
// Elements: word-by-word captions, kinetic key words, tool-name label, checklist, bouncing arrow, cut flashes, progress bar and the end call-to-action button.
const FONTS = require('./fonts.cjs');
const bgr = hex => { const h = String(hex || '#FFFFFF').replace('#', '').padStart(6, '0'); return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`; };
const esc = t => String(t).replace(/[{}\\]/g, '').replace(/\r?\n/g, ' ');
const ts = s => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${x.toFixed(2).padStart(5, '0')}`; };
const hasLatin = t => /[A-Za-z]/.test(t);
const up = t => hasLatin(t) ? String(t).toUpperCase() : String(t);
const rect = (w, h) => `m 0 0 l ${w} 0 l ${w} ${h} l 0 ${h}`;
const rrect = (w, h, r) => `m ${r} 0 l ${w - r} 0 b ${w} 0 ${w} 0 ${w} ${r} l ${w} ${h - r} b ${w} ${h} ${w} ${h} ${w - r} ${h} l ${r} ${h} b 0 ${h} 0 ${h} 0 ${h - r} l 0 ${r} b 0 0 0 0 ${r} 0`;

function build(o) {
  const W = o.W || 1080, H = o.H || 1920, total = o.total, accent = o.accent || '#FFD400', level = o.motion || 'bold';
  const capFont = o.capFont || 'Montserrat Black', kinFont = 'Anton', lblFont = 'Montserrat ExtraBold';
  const used = new Set([capFont, kinFont, lblFont]);
  const fb = f => (FONTS.boldFlag ? FONTS.boldFlag(f) : 0);
  const ev = [];
  const line = (layer, a, b, style, extra, text, mv = 0) => ev.push({ a, layer, line: `Dialogue: ${layer},${ts(a)},${ts(Math.max(b, a + 0.05))},${style},,0,0,${mv},,${extra}${text}` });
  const fnOf = t => { const f = FONTS.scriptFont && FONTS.scriptFont(t); if (f) { used.add(f); return `\\fn${f}`; } return ''; };
  const width = (font, text, size) => { try { const m = FONTS.measurerFor(font); if (m) return m(text) * size; } catch {} return String(text).length * size * 0.52; };

  // ---- captions: 3 words per line, the spoken word lights up ----
  if (o.captions !== false) {
    const ws = (o.words || []).filter(w => w.word && w.end > w.start);
    const groups = []; let cur = [];
    const flush = () => { if (cur.length) groups.push(cur); cur = []; };
    ws.forEach((w, i) => {
      const prev = cur[cur.length - 1];
      if (prev && (w.start - prev.end > 0.5 || /[.!?؟۔।…]$/.test(prev.word) || cur.length >= 3 || (cur.map(x => x.word).join(' ') + ' ' + w.word).length > 22)) flush();
      cur.push(w);
    });
    flush();
    groups.forEach((g, gi) => {
      const gStart = g[0].start, gEnd = Math.min(g[g.length - 1].end + 0.12, gi + 1 < groups.length ? groups[gi + 1][0].start : total);
      const withChar = (o.charSpans || []).some(c => gStart < c.b && gEnd > c.a);
      g.forEach((w, k) => {
        const a = k === 0 ? gStart : w.start, b = k + 1 < g.length ? g[k + 1].start : gEnd;
        const txt = g.map((x, j) => j === k ? `{\\c${bgr(accent)}\\fscx110\\fscy110}${esc(up(x.word))}{\\c&HFFFFFF&\\fscx100\\fscy100}` : esc(up(x.word))).join(' ');
        const fn = fnOf(g.map(x => x.word).join(' '));
        const pop = k === 0 ? '\\fscx88\\fscy88\\t(0,90,\\fscx100\\fscy100)' : '';
        line(5, a, b, 'Cap', `{\\an2${fn}${pop}}`, txt, withChar ? 770 : 610);
      });
    });
  }

  // ---- kinetic words ----
  const beats = o.beats || [];
  beats.forEach((b, i) => {
    const k = b.kin; if (!k || !k.text) return;
    const text = up(esc(k.text)).trim(); if (!text) return;
    const at = Math.max(b.t0, k.at != null ? k.at - 0.05 : b.t0), dur = Math.min(2.3, Math.max(1.0, (k.dur || 1.4)));
    const stat = k.kind === 'stat';
    let size = stat ? 210 : 165; const maxW = W * 0.88;
    let lines = [text];
    if (width(kinFont, text, size) > maxW) { const w = text.split(/\s+/); if (w.length > 1) { let best = 1, d = 1e9; for (let c = 1; c < w.length; c++) { const x = Math.abs(w.slice(0, c).join(' ').length - w.slice(c).join(' ').length); if (x < d) { d = x; best = c; } } lines = [w.slice(0, best).join(' '), w.slice(best).join(' ')]; } }
    const widest = Math.max(...lines.map(l => width(kinFont, l, size)));
    if (widest > maxW) size = Math.max(80, Math.floor(size * maxW / widest));
    const y = b.kinPos === 'top' ? 330 : 700, x = W / 2, lh = size * 1.02, th = lh * lines.length;
    const tilt = (i % 2 ? 3 : -3) * (level === 'wild' ? 1.6 : 1);
    const fn = fnOf(text);
    if (level !== 'clean') {      // highlight bar behind the word
      const bw = Math.min(W - 60, widest + 90), bh = th + 40;
      line(3, at, at + dur, 'Dr', `{\\an7\\pos(${x - bw / 2},${y - bh / 2})\\p1\\bord0\\shad0\\1c${stat ? bgr('#E11D2E') : '&H101010&'}\\1a&H18&\\fscx0\\t(0,140,\\fscx100)\\t(${Math.max(0, dur * 1000 - 120)},${dur * 1000},\\alpha&HFF&)\\frz${tilt}}`, rrect(bw, bh, 22));
    }
    const out = `{\\an5\\pos(${x},${y})${fn}\\fs${size}\\c${bgr(stat ? '#FFFFFF' : accent)}\\bord${Math.round(size * 0.06)}\\3c&H000000&\\shad5\\fscx35\\fscy35\\alpha&HFF&\\frz${tilt}\\t(0,130,\\fscx${level === 'wild' ? 128 : 118}\\fscy${level === 'wild' ? 128 : 118}\\alpha&H00&)\\t(130,260,\\fscx100\\fscy100)\\t(${Math.max(300, dur * 1000 - 130)},${dur * 1000},\\fscx90\\fscy90\\alpha&HFF&)}`;
    line(4, at, at + dur, 'Kin', out, lines.join('\\N'));
  });

  // ---- tool name / label (slides in from the left) ----
  if (level !== 'clean' && o.label && o.label.text) {
    const t = up(esc(o.label.text)), a = o.label.at, b = Math.min(total, a + 3.0), size = 56, tw = width(lblFont, t, size) + 90, bh = 96, y = 215;
    const x0 = 0;
    line(3, a, b, 'Dr', `{\\an7\\move(${-tw - 40},${y},${x0},${y},0,240)\\p1\\bord0\\shad0\\1c${bgr(accent)}\\t(${Math.max(0, (b - a) * 1000 - 200)},${(b - a) * 1000},\\alpha&HFF&)}`, rect(Math.ceil(tw), bh));
    line(4, a, b, 'Lbl', `{\\an4\\move(${-tw - 40 + 40},${y + bh / 2},${x0 + 40},${y + bh / 2},0,240)${fnOf(t)}\\fs${size}\\c&H101010&\\bord0\\shad0\\t(${Math.max(0, (b - a) * 1000 - 200)},${(b - a) * 1000},\\alpha&HFF&)}`, t);
  }

  // ---- checklist: each line pops in when it is said ----
  if (level !== 'clean' && o.checklist && o.checklist.length) {
    const items = o.checklist.slice(0, 4), end = Math.min(total, Math.max(...items.map(i => i.at)) + 2.4);
    items.forEach((it, i) => {
      const t = up(esc(it.text)); const a = it.at, y = 760 + i * 118, size = 58, tw = Math.min(W - 160, width(lblFont, t, size) + 150);
      const x = 70;
      line(3, a, end, 'Dr', `{\\an7\\pos(${x},${y})\\p1\\bord0\\shad0\\1c&H101010&\\1a&H20&\\fscx0\\t(0,150,\\fscx100)}`, rrect(Math.ceil(tw), 96, 24));
      line(4, a, end, 'Dr', `{\\an7\\pos(${x + 18},${y + 14})\\p1\\bord0\\shad0\\1c&H5EDC3D&\\fscx0\\fscy0\\t(60,220,\\fscx100\\fscy100)}`, rrect(68, 68, 34));
      line(5, a, end, 'Dr', `{\\an7\\pos(${x + 18},${y + 14})\\p1\\bord0\\shad0\\1c&HFFFFFF&\\fscx0\\fscy0\\t(120,260,\\fscx100\\fscy100)}`, 'm 16 36 l 28 48 l 54 20 l 48 14 l 28 36 l 22 30');
      line(5, a, end, 'Lbl', `{\\an4\\pos(${x + 106},${y + 48})${fnOf(t)}\\fs${size}\\c&HFFFFFF&\\bord0\\shad0\\alpha&HFF&\\t(80,220,\\alpha&H00&)}`, t);
    });
  }

  // ---- arrow that bobs toward the screen ----
  beats.forEach(b => {
    if (level === 'clean' || !b.arrow) return;
    const a = b.arrow.at, end = Math.min(b.t1, a + 2.2); let t = a, f = 0;
    const x = b.arrow.x || 880, y = b.arrow.y || 900;
    while (t < end - 0.05) {
      const t2 = Math.min(end, t + 0.28), d = f % 2 ? [x, y, x - 34, y + 20] : [x - 34, y + 20, x, y];
      line(4, t, t2, 'Dr', `{\\an5\\move(${d[0]},${d[1]},${d[2]},${d[3]},0,${Math.round((t2 - t) * 1000)})\\p1\\1c&H2D2DFF&\\3c&H000000&\\bord6\\shad3\\frz${b.arrow.rot || 150}\\fscx${t === a ? 40 : 100}\\fscy${t === a ? 40 : 100}${t === a ? '\\t(0,120,\\fscx100\\fscy100)' : ''}}`, 'm 0 30 l 90 30 l 90 0 l 150 50 l 90 100 l 90 70 l 0 70');
      t = t2; f++;
    }
  });

  // ---- white flash on every cut (wild only) ----
  if (level === 'wild') beats.slice(1).forEach(b => { if (b.flash !== false) line(6, b.t0, b.t0 + 0.12, 'Dr', `{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&HFFFFFF&\\1a&H70&\\t(0,110,\\1a&HFF&)}`, rect(W, H)); });

  // ---- progress bar on top ----
  line(7, 0, total, 'Dr', `{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c${bgr(accent)}\\fscx0\\t(0,${Math.round(total * 1000)},\\fscx100)}`, rect(W, 12));

  // ---- end call-to-action button ----
  if (o.cta && o.cta.text) {
    const t = up(esc(o.cta.text)), a = Math.max(0, o.cta.at != null ? o.cta.at : total - 2.6), b = total, size = 74, bw = Math.min(W - 90, width(kinFont, t, size) + 150), bh = 150, x = (W - bw) / 2, y = 1470;
    line(6, a, b, 'Dr', `{\\an7\\pos(${x},${y})\\p1\\bord0\\shad0\\1c${bgr(accent)}\\fscx0\\fscy0\\t(0,200,\\fscx100\\fscy100)}`, rrect(Math.ceil(bw), bh, 36));
    line(7, a, b, 'Kin', `{\\an5\\pos(${W / 2},${y + bh / 2 + 4})${fnOf(t)}\\fs${size}\\c&H101010&\\bord0\\shad0\\alpha&HFF&\\t(120,260,\\alpha&H00&)}`, t);
  }

  const hdr = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`
    + `Style: Cap,${capFont},${o.capSize || 78},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,${fb(capFont)},0,0,0,100,100,0,0,1,${o.capOutline || 7},3,2,50,50,610,1\n`
    + `Style: Kin,${kinFont},150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,${fb(kinFont)},0,0,0,100,100,0,0,1,9,4,5,40,40,40,1\n`
    + `Style: Lbl,${lblFont},56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,${fb(lblFont)},0,0,0,100,100,0,0,1,0,0,4,40,40,40,1\n`
    + `Style: Dr,${capFont},40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  ev.sort((x, y) => x.a - y.a);
  return { ass: hdr + ev.map(e => e.line).join('\n') + '\n', fonts: [...used] };
}
module.exports = { build };
