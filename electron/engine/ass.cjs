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
const EM = require('./emoji.cjs');
const HK = require('./hook.cjs');
const plain = t => EM.splitTitle(t).text;
const LEGACY = { 'Montserrat': 'Montserrat Black', 'Syne': 'Syne ExtraBold', 'JetBrains Mono': 'JetBrains Mono ExtraBold' };
const fam = f => LEGACY[f] || f;
function fontsUsed({ captions = {}, branding = {} }) {
  const preset = PRESETS[captions.style] || PRESETS['capcut-emoji'];
  const at = branding.autoTitle || {};
  return [captions.fontFamily || preset.font, at.fontFamily || 'Montserrat Black', branding.hookFontFamily || 'Montserrat Black', branding.watermarkFontFamily || 'Arial'].map(fam);
}
function build({ words, clipStart, clipEnd, W, H, captions, branding, title, hookText }) {
  const preset = PRESETS[captions.style] || PRESETS['capcut-emoji'];
  const k = W / 1080;
  const size = Math.round(captions.fontSize * 3.4 * k);
  const outline = Math.round((captions.outlineWidth || 3) * (preset.outline / 4) * k);
  const actives = (USER_COLOR_STYLES.has(captions.style) && captions.highlightColor) ? [captions.highlightColor, ...preset.active.slice(1)] : preset.active;
  const at = branding.autoTitle || {};
  const [capFont, titleFont, hookFont, markFont] = fontsUsed({ captions, branding });
  const L = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 2', '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    `Style: Cap,${capFont},${size},${bgr(preset.base)},&H000000&,&H000000&,&H64000000,${FONTS.boldFlag(capFont)},0,0,0,100,100,0,0,1,${outline},2,5,40,40,40,1`,
    `Style: Title,${titleFont},${Math.round((at.fontSize || 16) * 4.5 * k)},${bgr(at.color || '#FFFFFF')},&H000000&,&H000000&,&H64000000,${FONTS.boldFlag(titleFont)},0,0,0,100,100,0,0,1,${Math.round(5 * k)},2,5,60,60,40,1`,
    `Style: Hook,${hookFont},${Math.round(54 * k)},${bgr(branding.hookTextColor || (branding.bannerShowBackground ? '#000000' : '#FFFFFF'))},&H000000&,${bgr(branding.hookBgColor || '#BEF264')},&H000000&,${FONTS.boldFlag(hookFont)},0,0,0,100,100,0,0,${branding.bannerShowBackground ? 3 : 1},${Math.round(14 * k)},0,5,60,60,40,1`,
    `Style: Mark,${markFont},${Math.round((branding.watermarkFontSize || 40) * k)},&HCC${bgr(branding.watermarkColor || '#FFFFFF').slice(2)},&H000000&,&H000000&,&H64000000,${FONTS.boldFlag(markFont)},0,0,0,100,100,0,0,1,${Math.round(3 * k)},1,5,40,40,40,1`,
    '', '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ];
  const dur = clipEnd - clipStart;
  const pos = (x, y) => `{\\pos(${Math.round(x / 100 * W)},${Math.round(y / 100 * H)})}`;
  const tShow = (at.showSeconds > 0) ? Math.min(dur, at.showSeconds) : dur;
  if (at.enabled && title) {
    const ai = at.animIn || 'none', ao = at.animOut || 'none', ms = Math.round(tShow * 1000);
    const px = Math.round((at.positionX ?? 50) / 100 * W), py = Math.round((at.positionY ?? 10) / 100 * H);
    let place = `{\\pos(${px},${py})}`, fx = '';
    if (ai === 'slide-up') place = `{\\move(${px},${py + Math.round(70 * k)},${px},${py},0,260)}`;
    if (ai === 'pop') fx += '\\fscx60\\fscy60\\t(0,200,\\fscx110\\fscy110)\\t(200,330,\\fscx100\\fscy100)';
    const fin = (ai === 'fade' || ai === 'slide-up') ? 320 : 0, fout = ao === 'fade' ? 350 : 0;
    if (fin || fout) fx += `\\fad(${fin},${fout})`;
    if (ao === 'shrink') fx += `\\t(${Math.max(0, ms - 300)},${ms},\\fscx10\\fscy10\\alpha&HFF&)`;
    const hk = HK.hookTwoLines(title).split('\n');
    const hs = HK.hookFontPx(hk.join('\n'), W);
    L.push(`Dialogue: 2,${ts(0)},${ts(tShow)},Title,,0,0,0,,${place}{\\fs${hs}}${fx ? '{' + fx + '}' : ''}${hk.map(l => esc(l.toUpperCase())).join('\\N')}`);
  }
  if (branding.showHookTitle && branding.hookTitle)
    L.push(`Dialogue: 2,${ts(0)},${ts(dur)},Hook,,0,0,0,,${pos(branding.bannerPositionX ?? 50, branding.bannerPositionY ?? 8)}${wrap(esc(plain(branding.hookTitle).toUpperCase()), Math.round(54 * k), W)}`);
  if (branding.showWatermark && branding.watermarkType !== 'image' && branding.creatorHandle)
    L.push(`Dialogue: 2,${ts(0)},${ts(dur)},Mark,,0,0,0,,${pos(branding.watermarkPositionX ?? 20, branding.watermarkPositionY ?? 92)}${esc(branding.creatorHandle)}`);
  if (captions.enabled) {
    const off = Math.max(-0.5, Math.min(0.5, Number(captions.syncOffset) || 0));
    const cw = words.filter(w => w.start >= clipStart && w.start < clipEnd).map(w => (off ? { ...w, start: w.start + off, end: w.end + off } : w));
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
          const t = esc(captions.uppercase ? x.word.toUpperCase() : x.word);
          return q === j ? (preset.single ? `{\\c${col}}${t}` : `{\\c${col}\\fscx82\\fscy82\\t(0,110,\\fscx114\\fscy114)}${t}{\\c${bgr(preset.base)}\\fscx100\\fscy100}`) : t;
        }).join(' ');
        if (preset.glow && captions.glow !== false) {          // neon glow under the active word (2 blurred layers)
          const ghost = (bord, blur, alpha) => g.map((x, q) => {
            const t = esc(captions.uppercase ? x.word.toUpperCase() : x.word);
            return q === j ? `{\\alpha&H${alpha}&\\1c${col}\\3c${col}\\bord${Math.round(bord * k)}\\blur${Math.round(blur * k)}\\fscx82\\fscy82\\t(0,110,\\fscx114\\fscy114)}${t}{\\alpha&HFF&\\fscx100\\fscy100}` : `{\\alpha&HFF&}${t}`;
          }).join(' ');
          L.push(`Dialogue: 0,${ts(s)},${ts(e)},Cap,,0,0,0,,${pos(captions.positionX, captions.positionY)}${ghost(22, 26, '70')}`);
          L.push(`Dialogue: 0,${ts(s)},${ts(e)},Cap,,0,0,0,,${pos(captions.positionX, captions.positionY)}${ghost(9, 10, '20')}`);
        }
        L.push(`Dialogue: 1,${ts(s)},${ts(e)},Cap,,0,0,0,,${pos(captions.positionX, captions.positionY)}${txt}`);
      });
    }
  }
  return L.join('\n');
}
// Where the title's emoji go (Twemoji PNG overlays, centred just above the title text)
function titleEmojis({ title, branding = {}, W, H, dur = 9999 }) {
  const at = branding.autoTitle || {};
  if (!at.enabled || !title) return [];
  const hk = HK.hookTwoLines(title), { emojis } = EM.splitTitle(String(title));
  const list = emojis.map(EM.pngForChar).filter(Boolean).slice(0, 3);
  if (!list.length) return [];
  const k = W / 1080, size = HK.hookFontPx(hk, W);
  const em = Math.round(size * 1.1), gap = Math.round(em * 0.1);
  const total = list.length * em + (list.length - 1) * gap;
  const cx = (at.positionX ?? 50) / 100 * W, cy = (at.positionY ?? 10) / 100 * H;
  const above = Math.round(cy - size * 1.2 - em - 6 * k);
  const y = above >= 0 ? above : Math.min(H - em, Math.round(cy + size * 1.2 + 6 * k));
  const endT = at.showSeconds > 0 ? Math.min(dur, at.showSeconds) : dur;
  return list.map((png, i) => ({ png, size: em, start: 0, end: endT, x: Math.max(0, Math.min(W - em, Math.round(cx - total / 2 + i * (em + gap)))), y }));
}
module.exports = { build, fontsUsed, titleEmojis };
