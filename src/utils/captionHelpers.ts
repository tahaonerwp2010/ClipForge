import { cssFont, fontCell } from '../services/fontService';
import { EXTRA_EMOJI_KEYWORDS } from '../data/emojiKeywords';
import { CaptionPresetStyle, TranscriptWord } from '../types/clipper';

const EMOJI_KEYWORD_MAP: Record<string, string> = {
  // Impact & Virality
  fire: '🔥',
  hot: '🔥',
  lit: '🔥',
  viral: '🔥',
  crazy: '🔥',
  wild: '🔥',
  insane: '🤯',
  mistake: '🤯',
  worst: '🤯',
  wrong: '🤯',
  shock: '🤯',
  blown: '🤯',
  unbelievable: '🤯',

  // Brain & Secrets
  mind: '💡',
  brain: '🧠',
  secret: '💡',
  idea: '💡',
  smart: '💡',
  thinking: '🤔',
  think: '🤔',
  thought: '💡',
  truth: '💡',

  // Money & Wealth
  money: '💰',
  cash: '💰',
  dollar: '💵',
  wealth: '💰',
  rich: '💰',
  revenue: '💰',
  profit: '📈',
  cost: '💸',
  price: '🏷️',
  crypto: '🪙',
  bitcoin: '🪙',

  // Speed & Growth
  fast: '🚀',
  speed: '⚡',
  rocket: '🚀',
  launch: '🚀',
  grow: '📈',
  growth: '📈',
  scale: '🚀',
  shoots: '🚀',
  retention: '🚀',
  roof: '📈',

  // Urgency & Danger
  stop: '🚨',
  alert: '🚨',
  warning: '⚠️',
  danger: '⚠️',
  never: '🛑',
  ban: '🚫',
  illegal: '🚨',
  police: '🚨',

  // Winning & Royalty
  win: '🏆',
  winner: '🏆',
  best: '🏆',
  top: '👑',
  king: '👑',
  owning: '👑',
  boss: '👑',
  unique: '💎',
  voice: '🎙️',
  target: '🎯',
  goal: '🎯',
  focus: '🎯',

  // Tech & AI
  ai: '🤖',
  algorithm: '🤖',
  algorithms: '🤖',
  robot: '🤖',
  code: '💻',
  computer: '💻',
  future: '⚡',
  changes: '⚡',

  // Numbers & Stats
  look: '👀',
  watch: '👀',
  see: '👀',
  numbers: '📊',
  percent: '💯',
  first: '🥇',
  three: '3️⃣',
  seconds: '⏱️',
  compete: '⚔️'
};

/**
 * Returns contextual emoji for a word (Only used for CapCut style)
 */
export function getContextualEmoji(wordItem?: TranscriptWord): string | undefined {
  if (!wordItem) return undefined;
  if (wordItem.emoji) return wordItem.emoji;

  const clean = wordItem.word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (EMOJI_KEYWORD_MAP[clean]) {
    return EMOJI_KEYWORD_MAP[clean];
  }
  if (EXTRA_EMOJI_KEYWORDS[clean]) {
    return EXTRA_EMOJI_KEYWORDS[clean];
  }

  for (const [key, emoji] of Object.entries(EMOJI_KEYWORD_MAP)) {
    if (key.length >= 4 && clean.includes(key)) {
      return emoji;
    }
  }

  return undefined;
}

// Dynamic rotating viral colors for the CapCut Auto-Emoji template
export const CAPCUT_DYNAMIC_COLORS = [
  '#bef264', // Lime
  '#facc15', // Vibrant Yellow
  '#38bdf8', // Sky Cyan
  '#fb7185', // Coral Pink
  '#fb923c', // Electric Amber
  '#c084fc'  // Lavender
];

export interface PresetStyleMeta {
  id: CaptionPresetStyle;
  name: string;
  tagline: string;
  previewText: string;
  sampleEmoji?: string;
  highlight: string;
  fontFamily: string;
  fontLabel: string;
  hasEmoji: boolean;
}

/**
 * Templates list: ONLY 1 template with Emojis (CapCut),
 * All others are distinct typography styles WITHOUT emojis and WITHOUT background banners.
 */
export const POPULAR_CAPTION_PRESETS: PresetStyleMeta[] = [
  {
    id: 'capcut-emoji',
    name: 'CapCut Dynamic Emoji Pop',
    tagline: 'Only style with contextual emojis and rotating multicolor dynamic highlights on spoken words.',
    previewText: 'BIGGEST 🤯 MISTAKE',
    sampleEmoji: '🤯',
    highlight: '#bef264',
    fontFamily: '"Montserrat", "Plus Jakarta Sans", sans-serif',
    fontLabel: 'Montserrat 900',
    hasEmoji: true
  },
  {
    id: 'capcut-pop',
    name: 'CapCut Word Pop',
    tagline: 'One word at a time, pure white with a thick black outline. Every word pops in exactly as it is spoken.',
    previewText: 'MISTAKE',
    highlight: '#ffffff',
    fontFamily: '"Montserrat", "Plus Jakarta Sans", sans-serif',
    fontLabel: 'Montserrat 900',
    hasEmoji: false
  },
  {
    id: 'hormozi',
    name: 'Alex Hormozi Yellow',
    tagline: 'Clean punchy yellow spoken word highlight with crisp white typography and heavy drop shadow.',
    previewText: 'REVENUE SECRET TODAY',
    highlight: '#facc15',
    fontFamily: '"Bebas Neue", "Plus Jakarta Sans", Impact, sans-serif',
    fontLabel: 'Bebas Neue Ultra',
    hasEmoji: false
  },
  {
    id: 'mrbeast',
    name: 'MrBeast Heavy Outline',
    tagline: 'Thick black outer stroke outline with bouncy green zoom on the active word. No box.',
    previewText: 'INSANE CHALLENGE EVER',
    highlight: '#22c55e',
    fontFamily: '"Syne", "Plus Jakarta Sans", Impact, sans-serif',
    fontLabel: 'Syne Heavy 900',
    hasEmoji: false
  },
  {
    id: 'neon',
    name: 'Neon Cyber Bloom',
    tagline: 'Floating electric cyan neon bloom with atmospheric multi-stage text-shadow glow.',
    previewText: 'FUTURE MATRIX WORLD',
    highlight: '#38bdf8',
    fontFamily: '"Righteous", "Plus Jakarta Sans", sans-serif',
    fontLabel: 'Righteous Glow',
    hasEmoji: false
  },
  {
    id: 'karaoke',
    name: 'Karaoke Underline Flow',
    tagline: 'Clean progressive word-by-word highlight with energetic underline accent.',
    previewText: 'SPEECH FLOW VELOCITY',
    highlight: '#facc15',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontLabel: 'Jakarta Sans Bold',
    hasEmoji: false
  },
  {
    id: 'red-punch',
    name: 'Crimson Punch Outline',
    tagline: 'High-urgency crimson text with heavy drop shadow for viral hook retention.',
    previewText: 'STOP THIS NOW FAST',
    highlight: '#ef4444',
    fontFamily: '"Montserrat", "Plus Jakarta Sans", sans-serif',
    fontLabel: 'Montserrat Heavy',
    hasEmoji: false
  },
  {
    id: 'cinematic',
    name: 'Cinematic Minimalist',
    tagline: 'Refined editorial typography with letter-spacing and gold highlight, ideal for podcasts.',
    previewText: 'ELEGANT MINDSET SHIFT',
    highlight: '#facc15',
    fontFamily: '"Plus Jakarta Sans", serif',
    fontLabel: 'Editorial Sans',
    hasEmoji: false
  },
  {
    id: 'comic-pop',
    name: 'Comic Action Bold',
    tagline: 'Playful comic-style pop lettering with tilted angle and heavy black drop shadow.',
    previewText: 'UNREAL ACTION LEVEL',
    highlight: '#fbbf24',
    fontFamily: '"Righteous", "Bebas Neue", cursive',
    fontLabel: 'Comic Action',
    hasEmoji: false
  },
  {
    id: 'glitch',
    name: 'Cyber Glitch Split',
    tagline: 'Monospace typography with offset cyan and magenta chromatic text split.',
    previewText: 'SYSTEM CRACK ONLINE',
    highlight: '#06b6d4',
    fontFamily: '"JetBrains Mono", monospace',
    fontLabel: 'Mono Glitch',
    hasEmoji: false
  }
];

// ---- Auto Hook: 1, 2 or 3 lines chosen by the user (mirrors electron/engine/hook.cjs) ----
const HOOK_MAXW: Record<number, number> = { 1: 5, 2: 10, 3: 14 };
export function hookLines(text: string, n: number = 2): string[] {
  const N = n === 1 || n === 3 ? n : 2;
  const raw = String(text || '').replace(/\\n/g, '\n');
  let words: string[];
  if (/\n/.test(raw)) { const p = raw.split(/\n+/).map(x => x.trim()).filter(Boolean); if (p.length === N) return p; words = p.join(' ').split(' ').filter(Boolean); }
  else words = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  words = words.slice(0, HOOK_MAXW[N]);
  if (words.length < N) words = ['WATCH', 'THIS', 'NOW'].slice(0, Math.max(N, 2));
  if (N === 1) return [words.join(' ')];
  const len = (i: number, j: number) => words.slice(i, j).join(' ').length;
  const W = words.length;
  let best: { sc: number; cuts: number[] } | null = null;
  if (N === 2) { for (let i = 1; i < W; i++) { const m = Math.max(len(0, i), len(i, W)), d = Math.abs(len(0, i) - len(i, W)); if (!best || m * 10 + d < best.sc) best = { sc: m * 10 + d, cuts: [i] }; } }
  else { for (let i = 1; i < W - 1; i++) for (let j = i + 1; j < W; j++) { const a = len(0, i), b = len(i, j), c = len(j, W), m = Math.max(a, b, c), d = m - Math.min(a, b, c); if (!best || m * 10 + d < best.sc) best = { sc: m * 10 + d, cuts: [i, j] }; } }
  const cuts = [0, ...(best ? best.cuts : [Math.ceil(W / 2)]), W];
  return cuts.slice(1).map((c, i) => words.slice(cuts[i], c).join(' '));
}
// ---- Per-word hook colours (CapCut style). A "word" is a whitespace-separated piece of the hook text without emoji / quotes; its index is
// the same in the studio preview and in the real render (electron/engine/ass.cjs), so a colour stays on the word it was chosen for.
const HOOK_EMOJI_RE = (() => { try { return new RegExp('\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|[\\u{1F3FB}-\\u{1F3FF}])*|\\uFE0F', 'gu'); } catch { return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\uFE0F/gu; } })();
export const hookWordTokens = (text: string): { w: string; s: number; e: number }[] => {
  const raw = String(text || '').replace(/\\n/g, '\n'); const out: { w: string; s: number; e: number }[] = []; const re = /\S+/g; let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) { const w = m[0].replace(HOOK_EMOJI_RE, '').replace(/[“”"]/g, ''); if (w.trim()) out.push({ w, s: m.index, e: m.index + m[0].length }); }
  return out;
};
/** keeps the colours on the right words when the hook text is edited */
export const remapHookColors = (oldText: string, newText: string, colors?: (string | null)[]): (string | null)[] | undefined => {
  if (!colors || !colors.some(Boolean)) return undefined;
  const a = hookWordTokens(oldText).map(x => x.w), b = hookWordTokens(newText).map(x => x.w);
  let out: (string | null)[];
  if (a.length === b.length) out = b.map((_, i) => colors[i] ?? null);
  else {
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
    out = b.map((_, i) => i < p ? (colors[i] ?? null) : i >= b.length - q ? (colors[a.length - (b.length - i)] ?? null) : null);
  }
  return out.some(Boolean) ? out : undefined;
};
export const hookTwoLines = (text: string): string[] => hookLines(text, 2);
/** font size in px for a screen that is `screenW` px wide (1080 = the real video width). userSize = the size the user chose. */
const _cv = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const _hkEm = (lines: string[], fam: string): number => {
  if (!_cv) return 0;
  _cv.font = `900 1000px ${cssFont(fam)}`;      // the preview draws the hook in weight 900, so measure it the same way
  return Math.max(0, ...lines.map(l => _cv.measureText(l.toUpperCase()).width / 1000));   // the hook is drawn in capitals
};
export type FootageBand = { y: number; h: number } | null | undefined;   // footage position as fractions of the screen height
/** The hook "supervisor" (same maths as electron/engine/hook.cjs placeHook): keeps the user's size/position as far as possible and only changes
 *  what is needed so the hook fits the screen width, stays above/below the footage the way the user put it, and leaves room for the emoji row.
 *  Works on a 1080x1920 canvas; returns video px. */
export function placeHook(o: { lines: string[]; userSize?: number; px: number; py: number; family?: string; footage?: FootageBand; emoji?: boolean }) {
  const W = 1080, H = 1920, fam = o.family || 'Montserrat Black', n = Math.max(1, o.lines.length), outline = 5;
  const maxLen = Math.max(4, ...o.lines.map(l => l.length));
  let em = 0; try { em = _hkEm(o.lines, fam); } catch { /* estimate below */ }
  const cell = fontCell(fam) || 1.22, sideM = W * 0.02;
  const fsW = em > 0.1 ? Math.floor((W - 2 * sideM - 2 * outline) * cell / em) : Math.floor(W * 0.9 / (maxLen * 0.62));
  let size = o.userSize && o.userSize > 0 ? o.userSize : Math.min(124, W * 0.88 / (maxLen * 0.64));
  size = Math.min(size, fsW);
  let lo = Math.round(H * 0.04), hi = Math.round(H * 0.94); const gap = Math.round(H * 0.012);
  const f = o.footage; const fy = f ? f.y * H : 0, fh = f ? f.h * H : H;
  if (f && fh < H * 0.97) { if (o.py <= fy) hi = Math.max(lo + H * 0.06, fy - gap); else if (o.py >= fy + fh) lo = Math.min(hi - H * 0.06, fy + fh + gap); }
  const exF = o.emoji ? 1.2 : 0;
  size = Math.max(20, Math.min(size, (hi - lo - 2 * outline) / (n + exF)));
  const extra = exF * size, totalH = n * size + 2 * outline + extra;
  const top = Math.min(hi - totalH, Math.max(lo, o.py - n * size / 2 - outline - extra));
  const half = em > 0.1 ? em * size / cell / 2 + outline : W * 0.4;
  return { fs: Math.round(size), px: Math.min(W - sideM - half, Math.max(sideM + half, o.px)), py: top + extra + outline + n * size / 2, top, extra, cell };
}
/** Biggest hook size (video px at 1080 wide) that still fits: the width of the longest line (capitals) and, when the footage is known, the free band it sits in. */
export function hookFitMax(lines: string[], family?: string, py?: number, footage?: FootageBand, emoji?: boolean): number {
  const maxLen = Math.max(4, ...lines.map(l => l.length));
  const est = Math.floor((1080 * 0.94) / (maxLen * 0.55));
  try {
    const fam = family || 'Montserrat Black';
    const em = _hkEm(lines, fam);
    if (!(em > 0.1)) return est;
    let m = Math.floor((1080 * 0.96 - 10) * fontCell(fam) / em);
    if (py != null && footage && footage.h < 0.97) {
      const H = 1920, fy = footage.y * H, fh = footage.h * H, n = Math.max(1, lines.length);
      const band = py <= fy ? fy - 0.012 * H - 0.04 * H : py >= fy + fh ? 0.94 * H - (fy + fh + 0.012 * H) : H * 0.9;
      m = Math.min(m, Math.floor((band - 10) / (n + (emoji ? 1.2 : 0))));
    }
    return Math.max(30, m);
  } catch { return est; }
}
/** Where the footage sits on a 9:16 screen for the chosen framing (same maths as the engine's brollRect), as fractions of the height; null = full screen. */
export function footageRectFor(framing: any, srcAspect: number): FootageBand {
  const f = framing || {}, W = 1080, H = 1920, mode = f.mode || 'fit-blur';
  if (mode === 'fill-crop') return null;
  const ar = srcAspect || 16 / 9;
  let fgW: number, fgH: number;
  if (mode === 'custom-scale') { fgW = W * Math.max(0.3, (f.customScale || 100) / 100); fgH = fgW / ar; }
  else { fgW = W; fgH = W / ar; if (fgH > H) { fgH = H; fgW = H * ar; } }
  const y = (H - fgH) / 2 + ((f.offsetY || 0) / 100) * H;
  const y0 = Math.max(0, y), y1 = Math.min(H, y + fgH);
  if (y1 - y0 < 8 || (y1 - y0) >= H * 0.97) return null;
  return { y: y0 / H, h: (y1 - y0) / H };
}
