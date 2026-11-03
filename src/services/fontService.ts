import bundled from '../../public/fonts/fonts.json';

export type FontSource = 'bundled' | 'system' | 'user';
export interface FontEntry { family: string; category: string; source: FontSource; url?: string; cell?: number; }

// Windows system fonts (libass gets a copy of the real file at render time, see electron/engine/fonts.cjs)
export const SYSTEM_FONTS = ['Arial', 'Arial Black', 'Impact', 'Segoe UI', 'Georgia', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Times New Roman', 'Comic Sans MS', 'Consolas', 'Calibri', 'Courier New'];

let userFonts: FontEntry[] = [];
const listeners = new Set<() => void>();
const loaded = new Set<string>();
let styleInjected = false;

function injectBundledFaces() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const base = (import.meta as any).env?.BASE_URL || './';
  const css = (bundled as any[]).map(f =>
    `@font-face{font-family:"${f.family}";src:url("${base}fonts/${f.file}") format("truetype");font-weight:100 900;font-display:swap;}`).join('\n');
  const el = document.createElement('style');
  el.setAttribute('data-clipforge-fonts', '1');
  el.textContent = css;
  document.head.appendChild(el);
}

function registerUser(list: { family: string; url: string; cell?: number | null }[]) {
  for (const f of list) {
    if (loaded.has(f.family)) continue;
    loaded.add(f.family);
    try { const ff = new FontFace(f.family, `url("${f.url}")`); ff.load().then(x => document.fonts.add(x)).catch(() => {}); } catch { /* ignore */ }
  }
  userFonts = list.map(f => ({ family: f.family, category: 'My fonts', source: 'user' as const, url: f.url, cell: f.cell || undefined }));
  listeners.forEach(l => l());
}

export const FontService = {
  init() {
    injectBundledFaces();
    window.electronAPI?.listUserFonts?.().then(registerUser).catch(() => {});
  },
  async addFonts(): Promise<number> {
    const before = userFonts.length;
    const list = await window.electronAPI?.importFont?.();
    if (list) registerUser(list);
    return userFonts.length - before;
  },
  async removeFont(family: string) {
    await window.electronAPI?.removeUserFont?.(family);
    const list = await window.electronAPI?.listUserFonts?.();
    if (list) { loaded.delete(family); registerUser(list); }
  },
  all(): FontEntry[] {
    return [
      ...userFonts,
      ...(bundled as any[]).map(f => ({ family: f.family, category: f.category, source: 'bundled' as const })),
      ...SYSTEM_FONTS.map(f => ({ family: f, category: 'System', source: 'system' as const })),
    ];
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
};

// legacy names saved by older versions
const LEGACY: Record<string, string> = { 'Montserrat': 'Montserrat Black', 'Syne': 'Syne ExtraBold', 'JetBrains Mono': 'JetBrains Mono ExtraBold' };
export const normalizeFamily = (f?: string) => (f ? (LEGACY[f] || f) : f);
export const cssFont = (f?: string, fallback = 'sans-serif') => (f ? `"${normalizeFamily(f)}", ${fallback}` : fallback);

// Windows system fonts: line-cell height in em (OS/2 winAscent + winDescent), same number the video renderer uses
const SYSTEM_CELL: Record<string, number> = { 'Arial': 1.117, 'Arial Black': 1.41, 'Impact': 1.22, 'Segoe UI': 1.33, 'Georgia': 1.136, 'Verdana': 1.215, 'Tahoma': 1.207, 'Times New Roman': 1.107, 'Calibri': 1.22, 'Courier New': 1.133 };
/** How much taller libass makes a font's text box than its size: video text size (ASS) / this = the CSS size that looks the same in the preview. */
export const fontCell = (family?: string): number => {
  const f = normalizeFamily(family) || '';
  const hit = (bundled as any[]).find(x => x.family === f)?.cell || userFonts.find(x => x.family === f)?.cell || SYSTEM_CELL[f];
  return hit && hit > 0.8 && hit < 2.6 ? hit : 1.22;
};
