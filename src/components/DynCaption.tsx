import React from 'react';
import { cssFont } from '../services/fontService';
import { DynTemplate, DynWord, dynLayout, dynPhrases } from '../utils/dynCaptions';

type W = { word: string; start: number; end: number };
const grad = (c: string[]) => `linear-gradient(180deg, ${c[0]} 0%, ${c[0]} 46%, ${c[1]} 54%, ${c[1]} 100%)`;
// smooth outline: a ring of shadows (no spiky corners like -webkit-text-stroke)
const ring = (r: number, color: string) => {
  if (r <= 0.2) return '0 2px 4px rgba(0,0,0,.6)';
  const a: string[] = [];
  for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; a.push(`${(Math.cos(t) * r).toFixed(2)}px ${(Math.sin(t) * r).toFixed(2)}px 0 ${color}`); }
  a.push(`0 ${(r * 0.9).toFixed(1)}px ${(r * 1.6).toFixed(1)}px rgba(0,0,0,.55)`);
  return a.join(',');
};

// the same arrivals as electron/engine/dyn.cjs (ANIMS), so the preview moves like the exported clip
const ANIM_CSS = `
@keyframes dynA-bounce{0%{transform:scale(.55)}40%{transform:scale(1.28)}73%{transform:scale(.92)}100%{transform:scale(1)}}
@keyframes dynA-slam{0%{transform:scale(2.3)}100%{transform:scale(1)}}
@keyframes dynA-stretch{0%{transform:scale(2.6,.65)}100%{transform:scale(1)}}
@keyframes dynA-squash{0%{transform:scale(.75,1.5)}30%{transform:scale(1.18,.84)}100%{transform:scale(1)}}
@keyframes dynA-flip{0%{transform:scaleY(0)}60%{transform:scaleY(1.18)}100%{transform:scaleY(1)}}
@keyframes dynA-wobble{0%{transform:rotate(-7deg) scale(.85)}33%{transform:rotate(6deg) scale(1.1)}66%{transform:rotate(-3deg) scale(1)}100%{transform:rotate(0) scale(1)}}
@keyframes dynA-shake{0%{transform:rotate(4deg)}25%{transform:rotate(-4deg)}50%{transform:rotate(3deg)}75%{transform:rotate(-2deg)}100%{transform:rotate(0)}}
@keyframes dynA-track{0%{letter-spacing:.35em}100%{letter-spacing:0}}
@keyframes dynA-glow{0%{filter:blur(8px);transform:scale(1.18)}100%{filter:blur(0);transform:scale(1)}}`;
const ANIM_MS: Record<string, number> = { bounce: 300, slam: 130, stretch: 150, squash: 180, flip: 240, wobble: 290, shake: 210, track: 240, glow: 230 };

function Word({ it, tpl, base, cur, vis, ecol }: { it: DynWord; tpl: DynTemplate; base: number; cur: boolean; vis: boolean; ecol: string[] }) {
  const st = tpl[it.cls] as any;
  const col: string[] = it.cls === 'emph' ? ecol : st.colors;
  const metal = tpl.metal && col[0] !== col[1];
  const act = tpl.active, boxed = !!act && act.mode === 'box' && cur, tinted = !!act && act.mode === 'color' && cur;
  const size = Math.max(4, base * st.scale);
  const hollow = tpl.hollow && it.cls !== 'emph';
  const common: React.CSSProperties = { fontFamily: `${cssFont(st.font)}, "Montserrat", Arial, sans-serif`, fontSize: size, fontStyle: st.italic ? 'italic' : 'normal', lineHeight: 1.05, display: 'inline-block', whiteSpace: 'pre', fontWeight: 400 };
  const ow = Math.max(0, st.ow * size / 38);
  const fillColor = boxed ? (act!.text || '#fff') : tinted ? act!.color : col[1];
  return (
    <span style={{ position: 'relative', display: 'inline-block', opacity: vis ? 1 : 0, transform: cur && tpl.anim === 'pop' ? 'scale(1.08)' : 'none', transition: 'transform .12s', animation: cur && tpl.anim !== 'pop' && ANIM_MS[tpl.anim] ? `dynA-${tpl.anim} ${ANIM_MS[tpl.anim]}ms ease-out` : undefined, margin: `0 ${size * 0.1}px`, fontSize: 0, lineHeight: 0, verticalAlign: 'middle',
      background: boxed ? act!.color : 'transparent', borderRadius: boxed ? size * 0.18 : 0, padding: boxed ? `0 ${size * 0.16}px` : 0 }}>
      {!boxed && <span aria-hidden style={{ ...common, position: 'absolute', left: 0, top: 0, color: hollow ? 'transparent' : st.outline, textShadow: ring(hollow ? 0 : ow, st.outline), ...(hollow ? { WebkitTextStroke: `${Math.max(1, ow)}px ${col[0]}` } : {}) }}>{it.text}</span>}
      <span style={{ ...common, position: 'relative',
        ...(metal && !boxed && !tinted ? { backgroundImage: grad(col), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }
          : { color: hollow && !tinted ? 'transparent' : fillColor }) }}>{it.text}</span>
    </span>
  );
}

/** Live preview of a dynamic caption (same layout rules as the exported video).
 *  part: 'front' = normal words, 'behind' = the big word that goes behind the speaker (Behind templates only). */
export function DynCaption({ tpl, words, currentTime, base, sample, part = 'all', fitW }: { tpl: DynTemplate; words?: W[]; currentTime?: number; base: number; sample?: boolean; part?: 'all' | 'front' | 'behind'; fitW?: number }) {
  let lines: DynWord[][] = [], curJ = 0;
  const ecol = tpl.emph.colors[0];
  if (sample || !words || !words.length) {
    const ws = tpl.sample, emphJ = ws.findIndex(w => w === w.toUpperCase() && w.length > 2);
    lines = dynLayout(ws.map(w => w), tpl, emphJ >= 0 ? emphJ : ws.length - 1); curJ = ws.length - 1;
  } else {
    const t = currentTime || 0, ph = dynPhrases(words, tpl);
    let pi = ph.findIndex(p => t >= words[p[0]].start - 0.05 && t <= words[p[p.length - 1]].end + 0.3);
    if (pi < 0) { let b = 1e9; ph.forEach((p, i) => { const d = Math.abs(words[p[0]].start - t); if (d < b) { b = d; pi = i; } }); }
    const idxs = ph[Math.max(0, pi)] || [];
    lines = dynLayout(idxs.map(i => words[i].word), tpl);
    curJ = 0; idxs.forEach((gi, j) => { if (t >= words[gi].start - 0.02) curJ = j; });
    // paused before / between words: show the whole phrase so placement can always be judged
    if (!currentTime || t < words[idxs[0]]?.start) curJ = idxs.length - 1;
  }
  const isEm = (ln: DynWord[]) => !!tpl.behind && ln[0].cls === 'emph';
  const shown = lines.filter(ln => part === 'all' || (part === 'behind' ? isEm(ln) : !isEm(ln)));
  if (!shown.length) return null;
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: base * 0.02 * tpl.lh }}>
      <style>{ANIM_CSS}</style>
      {shown.map((ln, li) => (
        <div key={li} className="flex items-center justify-center flex-nowrap" style={isEm(ln) ? { opacity: 0.92 } : tpl.rot ? { transform: `rotate(${tpl.rot}deg)` } : undefined}>
          {ln.map(it => <Word key={it.j} it={it} tpl={tpl} base={isEm(ln) ? (fitW ? Math.min(fitW * 1.0 / (Math.max(1, ln.reduce((a, x) => a + x.text.length, 0)) * tpl.cw), fitW * 16 / 9 * 0.36) / tpl.emph.scale : base * 0.62) : base} cur={it.j === curJ} vis={it.j <= curJ} ecol={ecol} />)}
        </div>
      ))}
    </div>
  );
}
