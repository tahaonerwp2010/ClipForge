import React from 'react';
import { cssFont } from '../services/fontService';
import { DynTemplate, DynWord, dynLayout, dynPhrases } from '../utils/dynCaptions';

type W = { word: string; start: number; end: number };
const grad = (c: string[]) => `linear-gradient(180deg, ${c[0]} 0%, ${c[0]} 42%, ${c[1]} 58%, ${c[1]} 100%)`;

function Word({ it, tpl, base, cur, vis, ecol }: { it: DynWord; tpl: DynTemplate; base: number; cur: boolean; vis: boolean; ecol: string[] }) {
  const st = tpl[it.cls] as any;
  const col: string[] = it.cls === 'emph' ? ecol : st.colors;
  const metal = tpl.metal && col[0] !== col[1];
  const act = tpl.active, boxed = !!act && act.mode === 'box' && cur, tinted = !!act && act.mode === 'color' && cur;
  const size = Math.max(4, base * st.scale);
  const common: React.CSSProperties = { fontFamily: cssFont(st.font), fontSize: size, fontStyle: st.italic ? 'italic' : 'normal', lineHeight: 1.05, display: 'inline-block', whiteSpace: 'pre' };
  const ow = Math.max(0, st.ow * size / 38);
  const fillColor = boxed ? (act!.text || '#fff') : tinted ? act!.color : col[1];
  return (
    <span style={{ position: 'relative', display: 'inline-block', opacity: vis ? 1 : 0, transform: cur && tpl.anim === 'pop' ? 'scale(1.1)' : 'none', transition: 'transform .12s', margin: '0 0.12em',
      background: boxed ? act!.color : 'transparent', borderRadius: boxed ? size * 0.18 : 0, padding: boxed ? `0 ${size * 0.18}px` : 0 }}>
      {!boxed && <span aria-hidden style={{ ...common, position: 'absolute', left: 0, top: 0, color: tpl.hollow && it.cls !== 'emph' ? 'transparent' : st.outline, WebkitTextStroke: `${ow * 2}px ${tpl.hollow && it.cls !== 'emph' ? col[0] : st.outline}`, textShadow: '0 3px 6px rgba(0,0,0,.55)' }}>{it.text}</span>}
      <span style={{ ...common, position: 'relative',
        ...(metal && !boxed && !tinted ? { backgroundImage: grad(col), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }
          : { color: tpl.hollow && it.cls !== 'emph' && !tinted ? 'transparent' : fillColor }) }}>{it.text}</span>
    </span>
  );
}

/** Live preview of a dynamic caption (same layout rules as the exported video). `sample` shows the template's demo words. */
export function DynCaption({ tpl, words, currentTime, base, sample }: { tpl: DynTemplate; words?: W[]; currentTime?: number; base: number; sample?: boolean }) {
  let lines: DynWord[][] = [], idxs: number[] = [], curJ = 0, visMax = 99;
  const ecol = tpl.emph.colors[0];
  if (sample || !words || !words.length) {
    const ws = tpl.sample, emphJ = ws.findIndex(w => w === w.toUpperCase() && w.length > 2);
    lines = dynLayout(ws.map(w => w), tpl, emphJ >= 0 ? emphJ : ws.length - 1); curJ = ws.length - 1;
  } else {
    const t = currentTime || 0, ph = dynPhrases(words, tpl);
    let pi = ph.findIndex(p => t >= words[p[0]].start - 0.05 && t <= words[p[p.length - 1]].end + 0.3);
    if (pi < 0) { let b = 1e9; ph.forEach((p, i) => { const d = Math.abs(words[p[0]].start - t); if (d < b) { b = d; pi = i; } }); }
    idxs = ph[Math.max(0, pi)] || [];
    lines = dynLayout(idxs.map(i => words[i].word), tpl);
    curJ = 0; idxs.forEach((gi, j) => { if (t >= words[gi].start - 0.02) curJ = j; });
  }
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: base * 0.02 * tpl.lh }}>
      {lines.map((ln, li) => (
        <div key={li} className="flex items-center justify-center flex-nowrap">
          {ln.map(it => <Word key={it.j} it={it} tpl={tpl} base={base} cur={it.j === curJ} vis={it.j <= curJ} ecol={ecol} />)}
        </div>
      ))}
    </div>
  );
}
