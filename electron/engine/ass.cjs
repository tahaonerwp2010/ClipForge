// Builds .ass subtitles from the app's CaptionConfig / BrandingConfig.
const PRESETS = {
  'capcut-emoji': { glow: true, font: 'Montserrat Black', base: '#FFFFFF', active: ['#BEF264', '#FACC15', '#38BDF8', '#F472B6'], outline: 6 },
  'capcut-pop':   { single: true, font: 'Montserrat Black', base: '#FFFFFF', active: ['#FFFFFF'], outline: 9 },
  hormozi:        { font: 'Bebas Neue',       base: '#FFFFFF', active: ['#FACC15'], outline: 5 },
  mrbeast:        { font: 'Impact',           base: '#FFFFFF', active: ['#22C55E'], outline: 10 },
  neon:           { font: 'Arial Black',      base: '#22D3EE', active: ['#FFFFFF'], outline: 3 },
  karaoke:        { font: 'Arial Black',      base: '#FFFFFF', active: ['#F97316'], outline: 5 },
  'red-punch':    { font: 'Arial Black',      base: '#FFFFFF', active: ['#EF4444'], outline: 6 },
  cinematic:      { font: 'Georgia',          base: '#F5F5F5', active: ['#FFFFFF'], outline: 2 },
  'comic-pop':    { font: 'Comic Sans MS',    base: '#FFFFFF', active: ['#FDE047'], outline: 7 },
  glitch:         { font: 'Consolas',         base: '#FFFFFF', active: ['#22D3EE', '#F43F5E'], outline: 4 },
};
for (const c of require('./classic-styles.json').styles) PRESETS[c.id] = { font: c.font, base: c.base, active: c.active, outline: c.outline, outlineColor: c.outlineColor, upper: c.upper, anim: c.anim, glow: !!c.glow, box: c.box, rot: c.rot || 0, sizeMul: c.sizeMul || 1 };   // more classic styles (same list the app uses for previews)
const USER_COLOR_STYLES = new Set(['capcut-emoji', 'hormozi', 'karaoke']);
const bgr = hex => { const h = hex.replace('#', ''); return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`; };
const esc = t => String(t).replace(/[{}\\]/g, '');
function ts(sec) { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; }

function wrap(text, size, W) {
  const maxChars = Math.max(8, Math.floor((W * 0.86) / (size * 0.62)));
  const lines = []; let cur = '';
  for (const w of String(text).split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join('\\N');
}

const FONTS = require('./fonts.cjs');
const DYN = require('./dyn.cjs');
const EM = require('./emoji.cjs');
const HK = require('./hook.cjs');
const plain = t => EM.splitTitle(t).text;
const LEGACY = { 'Montserrat': 'Montserrat Black', 'Syne': 'Syne ExtraBold', 'JetBrains Mono': 'JetBrains Mono ExtraBold' };
const fam = f => LEGACY[f] || f;
const _meas = {};
function hookMeasure(fam) {
  if (!(fam in _meas)) { const em = FONTS.measurerFor(fam); _meas[fam] = em ? { em, cell: em.cell || cellOf(fam) } : null; }
  return _meas[fam];
}
function cellOf(fam) { try { const f = FONTS.bundled().concat(FONTS.userFonts()).find(x => x.family === fam); return f && f.cell || 1.22; } catch { return 1.22; } }
function fontsUsed({ captions = {}, branding = {} }) {
  const preset = PRESETS[captions.style] || PRESETS['capcut-emoji'];
  const at = branding.autoTitle || {};
  const dyn = DYN.get(captions.style);
  if (dyn) return [...DYN.fontsOf(dyn), at.fontFamily || 'Montserrat Black', branding.hookFontFamily || 'Montserrat Black', branding.watermarkFontFamily || 'Arial'].map(fam);   // dynamic templates: their own fonts, not changeable
  return [captions.fontFamily || preset.font, at.fontFamily || 'Montserrat Black', branding.hookFontFamily || 'Montserrat Black', branding.watermarkFontFamily || 'Arial'].map(fam);
}
// The hook words in their lines; words with their own colour (the user selected them in the editor) get an inline colour that is switched back right after.
function hookColored(lines, at) {
  const wc = Array.isArray(at.wordColors) ? at.wordColors : null, base = /^#[0-9a-f]{6}$/i.test(at.color || '') ? at.color : '#FFFFFF';
  let wi = 0;
  return lines.map(l => l.split(' ').filter(t => t !== '').map(tok => {
    const c = wc && wc[wi++]; const t = esc(tok.toUpperCase());
    return c && /^#[0-9a-f]{6}$/i.test(c) ? `{\\1c${bgr(c)}}${t}{\\1c${bgr(base)}}` : t;
  }).join(' ')).join('\\N');
}
function build({ words, clipStart, clipEnd, W, H, captions, branding, title, hookText, part = 'all', keywords, behindBox, rect = null }) {
  const preset = PRESETS[captions.style] || PRESETS['capcut-emoji'];
  const k = W / 1080;
  const size = Math.round(captions.fontSize * 3.4 * k * (preset.sizeMul || 1));
  const outline = Math.round((captions.outlineWidth || 3) * (preset.outline / 4) * k);
  const actives = (USER_COLOR_STYLES.has(captions.style) && captions.highlightColor) ? [captions.highlightColor, ...preset.active.slice(1)] : preset.active;
  const at = branding.autoTitle || {};
  const dynTpl = DYN.get(captions.style);
  const [capFont, titleFont, hookFont, markFont] = dynTpl ? [DYN.fontsOf(dynTpl)[0], ...fontsUsed({ captions, branding }).slice(-3)].map(fam) : fontsUsed({ captions, branding });
  const L = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 2', '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    `Style: Cap,${capFont},${size},${bgr(preset.base)},&H000000&,${bgr(preset.outlineColor || '#000000')},&H64000000,${FONTS.boldFlag(capFont)},0,0,0,100,100,0,0,1,${outline},2,5,40,40,40,1`,
    `Style: Title,${titleFont},${Math.round((at.fontSize || 16) * 4.5 * k)},${bgr(at.color || '#FFFFFF')},&H000000&,&H000000&,&H64000000,${FONTS.boldFlag(titleFont)},0,0,0,100,100,0,0,1,${Math.round(5 * k)},2,5,60,60,40,1`,
    `Style: Hook,${hookFont},${Math.round(54 * k)},${bgr(branding.hookTextColor || (branding.bannerShowBackground ? '#000000' : '#FFFFFF'))},&H000000&,${bgr(branding.hookBgColor || '#BEF264')},&H000000&,${FONTS.boldFlag(hookFont)},0,0,0,100,100,0,0,${branding.bannerShowBackground ? 3 : 1},${Math.round(14 * k)},0,5,60,60,40,1`,
    `Style: Mark,${markFont},${Math.round((branding.watermarkFontSize || 40) * k)},&HCC${bgr(branding.watermarkColor || '#FFFFFF').slice(2)},&H000000&,&H000000&,&H64000000,${FONTS.boldFlag(markFont)},0,0,0,100,100,0,0,1,${Math.round(3 * k)},1,5,40,40,40,1`,
    '', '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ];
  const sw = t => { const f = FONTS.scriptFont(t); return f ? `{\\fn${f}\\b0\\fs${Math.round(size * 1.25)}}${t}{\\fn${capFont}\\b${FONTS.boldFlag(capFont)}\\fs${size}}` : t; };   // script font for Urdu / Arabic / Hindi words
  const dur = clipEnd - clipStart;
  const pos = (x, y) => `{\\pos(${Math.round(x / 100 * W)},${Math.round(y / 100 * H)})}`;
  const cpos = (x, y) => `{\\pos(${Math.round(x / 100 * W)},${Math.round(y / 100 * H)})${preset.rot ? '\\frz' + preset.rot : ''}}`;
  const tShow = (at.showSeconds > 0) ? Math.min(dur, at.showSeconds) : dur;
  if (at.enabled && title && part !== 'behind') {
    const ai = at.animIn || 'none', ao = at.animOut || 'none', ms = Math.round(tShow * 1000);
    const hk = HK.hookLines(title, '', at.lines).split('\n');
    const pl = HK.placeHook({ lines: hk, W, H, userSize: at.size, px: (at.positionX ?? 50) / 100 * W, py: (at.positionY ?? 10) / 100 * H, measure: hookMeasure(titleFont), rect, emoji: at.showEmoji !== false && EM.splitTitle(String(title)).emojis.length > 0 });
    const px = pl.px, py = pl.py;
    let place = `{\\pos(${px},${py})}`, fx = '';
    if (ai === 'slide-up') place = `{\\move(${px},${py + Math.round(70 * k)},${px},${py},0,260)}`;
    if (ai === 'pop') fx += '\\fscx60\\fscy60\\t(0,200,\\fscx110\\fscy110)\\t(200,330,\\fscx100\\fscy100)';
    const fin = (ai === 'fade' || ai === 'slide-up') ? 320 : 0, fout = ao === 'fade' ? 350 : 0;
    if (fin || fout) fx += `\\fad(${fin},${fout})`;
    if (ao === 'shrink') fx += `\\t(${Math.max(0, ms - 300)},${ms},\\fscx10\\fscy10\\alpha&HFF&)`;
    const hs = pl.fs;
    L.push(`Dialogue: 2,${ts(0)},${ts(tShow)},Title,,0,0,0,,${place}{\\fs${hs}}${fx ? '{' + fx + '}' : ''}${hookColored(hk, at)}`);
  }
  const pb = branding.barOverlay;                                   // a thin bar that fills along the clip (watch-time booster)
  if (pb && pb.enabled && part !== 'behind' && dur > 1) {
    const bh = Math.max(4, Math.round((pb.height || 8) * k)), y = pb.position === 'top' ? Math.round(H * 0.035) : H - bh - Math.round(H * 0.012);
    const col = bgr(/^#[0-9a-f]{6}$/i.test(pb.color || '') ? pb.color : '#BEF264');
    L.push(`Dialogue: 0,${ts(0)},${ts(dur)},Mark,,0,0,0,,{\\an7\\pos(0,${y})\\bord0\\shad0\\1c${col}\\1a&H00&\\fscx1\\t(0,${Math.round(dur * 1000)},\\fscx100)\\p1}m 0 0 l ${W} 0 ${W} ${bh} 0 ${bh}{\\p0}`);
  }
  if (branding.showHookTitle && branding.hookTitle && part !== 'behind')
    L.push(`Dialogue: 2,${ts(0)},${ts(dur)},Hook,,0,0,0,,${pos(branding.bannerPositionX ?? 50, branding.bannerPositionY ?? 8)}${wrap(esc(plain(branding.hookTitle).toUpperCase()), Math.round(54 * k), W)}`);
  if (branding.showWatermark && branding.watermarkType !== 'image' && branding.creatorHandle && part !== 'behind')
    L.push(`Dialogue: 2,${ts(0)},${ts(dur)},Mark,,0,0,0,,${pos(branding.watermarkPositionX ?? 20, branding.watermarkPositionY ?? 92)}${esc(branding.creatorHandle)}`);
  if (captions.enabled && dynTpl) {
    DYN.build({ words, clipStart, clipEnd, W, H, captions, tpl: dynTpl, part, keywords, behindBox }).forEach(l => L.push(l));
  } else if (captions.enabled && part !== 'behind') {
    const off = Math.max(-0.5, Math.min(0.5, Number(captions.syncOffset) || 0));
    const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd).map(w => (off ? { ...w, start: w.start + off, end: w.end + off } : w));
    const up = preset.upper === true ? true : preset.upper === false ? false : !!captions.uppercase;
    const n = preset.single ? 1 : Math.max(1, captions.maxWordsPerBeat || 2);
    let ci = 0;
    // Timing: a word appears when it is spoken (tiny lead) and never overlaps the next one.
    const LEAD = 0.02, tS = [], tE = [];
    cw.forEach((w, i) => { tS[i] = Math.max(0, w.start - clipStart - LEAD); if (i && tS[i] < tS[i - 1] + 0.04) tS[i] = tS[i - 1] + 0.04; });
    cw.forEach((w, i) => {
      const nx = cw[i + 1];
      let hold = (nx && nx.start - w.end < 0.25) ? tS[i + 1] : (w.end - clipStart) + 0.15;   // bridge only tiny gaps; real pauses clear the caption
      if (nx) hold = Math.min(hold, tS[i + 1]);
      tE[i] = Math.max(tS[i] + 0.04, hold);
    });
    for (let i = 0; i < cw.length; i += n) {
      const g = cw.slice(i, i + n);
      g.forEach((w, j) => {
        const s = tS[i + j], e = tE[i + j];
        const col = bgr(actives[ci++ % actives.length]);
        const txt = g.map((x, q) => {
          const t = sw(esc(up ? x.word.toUpperCase() : x.word));
          if (q !== j) return t;
          if (preset.single) return `{\\c${col}}${t}`;
          const rot = preset.rot || 0, an = preset.anim === 'none' ? '' : (preset.anim && preset.anim !== 'pop' && DYN.ANIMS[preset.anim]) ? DYN.ANIMS[preset.anim].replace(/\\frz(-?\d+)/g, (_, n) => '\\frz' + (+n + rot)) : '\\fscx82\\fscy82\\t(0,110,\\fscx114\\fscy114)';
          const bx = preset.box ? `\\1c${bgr(preset.box.text)}\\3c${bgr(preset.box.color)}\\bord${Math.round(preset.box.pad * k)}` : `\\c${col}`;
          return `{${bx}${an}}${t}{\\c${bgr(preset.base)}\\3c${bgr(preset.outlineColor || '#000000')}\\bord${outline}\\fscx100\\fscy100\\fsp0\\blur0\\frz${rot}}`;
        }).join(' ');
        if (preset.glow && captions.glow !== false) {          // neon glow under the active word (2 blurred layers)
          const ghost = (bord, blur, alpha) => g.map((x, q) => {
            const t = sw(esc(up ? x.word.toUpperCase() : x.word));
            return q === j ? `{\\alpha&H${alpha}&\\1c${col}\\3c${col}\\bord${Math.round(bord * k)}\\blur${Math.round(blur * k)}\\fscx82\\fscy82\\t(0,110,\\fscx114\\fscy114)}${t}{\\alpha&HFF&\\fscx100\\fscy100}` : `{\\alpha&HFF&}${t}`;
          }).join(' ');
          L.push(`Dialogue: 0,${ts(s)},${ts(e)},Cap,,0,0,0,,${pos(captions.positionX, captions.positionY)}${ghost(22, 26, '70')}`);
          L.push(`Dialogue: 0,${ts(s)},${ts(e)},Cap,,0,0,0,,${pos(captions.positionX, captions.positionY)}${ghost(9, 10, '20')}`);
        }
        L.push(`Dialogue: 1,${ts(s)},${ts(e)},Cap,,0,0,0,,${cpos(captions.positionX, captions.positionY)}${txt}`);
      });
    }
  }
  return L.join('\n');
}
// Where the title's emoji go (Twemoji PNG overlays, centred just above the title text)
function titleEmojis({ title, branding = {}, W, H, dur = 9999, rect = null }) {
  const at = branding.autoTitle || {};
  if (!at.enabled || !title || at.showEmoji === false) return [];
  const { emojis } = EM.splitTitle(String(title));
  const list = emojis.map(EM.pngForChar).filter(Boolean).slice(0, 3);
  if (!list.length) return [];
  const k = W / 1080, hl = HK.hookLines(plain(String(title)), '', at.lines).split('\n');
  const pl = HK.placeHook({ lines: hl, W, H, userSize: at.size, px: (at.positionX ?? 50) / 100 * W, py: (at.positionY ?? 10) / 100 * H, measure: hookMeasure(fam(at.fontFamily || 'Montserrat Black')), rect, emoji: true });
  const size = pl.fs, em = Math.round(size * 1.1), gap = Math.round(em * 0.1);
  const total = list.length * em + (list.length - 1) * gap;
  const cx = pl.px, y = Math.max(0, pl.top + Math.round((pl.extra - em) / 2));
  const endT = at.showSeconds > 0 ? Math.min(dur, at.showSeconds) : dur;
  return list.map((png, i) => ({ png, size: em, start: 0, end: endT, x: Math.max(0, Math.min(W - em, Math.round(cx - total / 2 + i * (em + gap)))), y }));
}
module.exports = { build, fontsUsed, titleEmojis };
