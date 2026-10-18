// Dynamic caption templates (shared with the video engine through electron/engine/dyn-templates.json).
import DATA from '../../electron/engine/dyn-templates.json';

export interface DynStyle { font: string; scale: number; colors: string[]; outline: string; ow: number; upper: boolean; italic: number }
export interface DynTemplate {
  id: string; name: string; tagline: string; sample: string[]; maxWords: number; maxPerLine: number; cw: number; sizeMul: number; lh: number;
  anim: string; behind?: boolean; metal: boolean; hollow: boolean; active: null | { mode: 'box' | 'color'; color: string; text?: string; pad?: number };
  plain: DynStyle; fill: DynStyle; emph: Omit<DynStyle, 'colors'> & { colors: string[][] };
}
export const DYN_TEMPLATES = (DATA as any).templates as DynTemplate[];
export const isDynStyle = (id?: string) => !!id && DYN_TEMPLATES.some(t => t.id === id);
export const getDyn = (id?: string) => DYN_TEMPLATES.find(t => t.id === id);
const POWER = new Set<string>((DATA as any).words.power), STOP = new Set<string>((DATA as any).words.stop);
const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const score = (w: string) => { const n = clean(w); if (n.length < 3 || STOP.has(n)) return -1; let s = 0; if (POWER.has(n)) s += 3; if (/\d/.test(n)) s += 3; if (n.length >= 7) s += 1.5; else if (n.length >= 5) s += 1; return s; };

export interface DynWord { j: number; text: string; cls: 'emph' | 'plain' | 'fill' }
/** phrase of words -> lines (the important word gets its own bigger line) */
export function dynLayout(ws: string[], tpl: DynTemplate, emphIndex?: number): DynWord[][] {
  let emph = emphIndex ?? -1, best = 1;
  if (emphIndex === undefined) {
    ws.forEach((w, j) => { const s = score(w); if (s > best) { best = s; emph = j; } });
    if (emph < 0) { let L = 0; ws.forEach((w, j) => { const n = clean(w); if (n.length >= 5 && !STOP.has(n) && n.length > L) { L = n.length; emph = j; } }); }
  }
  const lines: DynWord[][] = []; let line: DynWord[] = [];
  ws.forEach((w, j) => {
    const cls: DynWord['cls'] = j === emph ? 'emph' : (STOP.has(clean(w)) && clean(w).length <= 4 ? 'fill' : 'plain');
    const st = tpl[cls];
    const it = { j, cls, text: st.upper ? w.toUpperCase() : w };
    if (line.length && (cls === 'emph' || line[line.length - 1].cls === 'emph' || line.length >= tpl.maxPerLine)) { lines.push(line); line = []; }
    line.push(it);
  });
  if (line.length) lines.push(line);
  return lines;
}
/** phrase boundaries over the transcript words */
export function dynPhrases(words: { word: string; start: number; end: number }[], tpl: DynTemplate): number[][] {
  const out: number[][] = []; let cur: number[] = [];
  words.forEach((w, i) => {
    cur.push(i); const nx = words[i + 1];
    if (!nx || cur.length >= tpl.maxWords || /[.!?]$/.test(w.word) || nx.start - w.end > 0.55 || (/[,;:]$/.test(w.word) && cur.length >= 2)) { out.push(cur); cur = []; }
  });
  return out;
}
