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
export const hookTwoLines = (text: string): string[] => hookLines(text, 2);
/** font size in px for a screen that is `screenW` px wide (1080 = the real video width). userSize = the size the user chose. */
export function hookFontPx(lines: string[], screenW: number, userSize?: number): number {
  const maxLen = Math.max(4, ...lines.map(l => l.length));
  const fit = (1080 * 0.92) / (maxLen * 0.64);
  if (userSize && userSize > 0) return Math.max(24, Math.min(userSize, fit)) * screenW / 1080;
  return Math.max(52, Math.min(124, (1080 * 0.88) / (maxLen * 0.64))) * screenW / 1080;
}
