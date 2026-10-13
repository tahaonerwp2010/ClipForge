import bundled from '../../public/fonts/fonts.json';

export type FontSource = 'bundled' | 'system' | 'user';
export interface FontEntry { family: string; category: string; source: FontSource; url?: string; }

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
    `@font-face{font-family:"${f.family}";src:url("${base}fonts/${f.file}") format("truetype");font-display:swap;}`).join('\n');
  const el = document.createElement('style');
  el.setAttribute('data-clipforge-fonts', '1');
  el.textContent = css;
  document.head.appendChild(el);
}

function registerUser(list: { family: string; url: string }[]) {
  for (const f of list) {
    if (loaded.has(f.family)) continue;
    loaded.add(f.family);
    try { const ff = new FontFace(f.family, `url("${f.url}")`); ff.load().then(x => document.fonts.add(x)).catch(() => {}); } catch { /* ignore */ }
  }
  userFonts = list.map(f => ({ family: f.family, category: 'My fonts', source: 'user' as const, url: f.url }));
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
