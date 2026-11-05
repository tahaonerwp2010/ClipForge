import React from 'react';
import DATA from '../../electron/engine/classic-styles.json';
import { cssFont } from '../services/fontService';
import { ANIM_CSS, ANIM_MS } from './DynCaption';

/** Extra classic caption styles (shared with the video engine through electron/engine/classic-styles.json). */
export interface ClassicSpec {
  id: string; name: string; tagline: string; font: string; base: string; active: string[]; outline: number; outlineColor: string; sample: string[];
  upper?: boolean; anim?: string; glow?: boolean; box?: { color: string; text: string; pad: number }; rot?: number; sizeMul?: number; emoji?: boolean; lines?: number;
}
export const CLASSIC_EXTRA = (DATA as any).styles as ClassicSpec[];
// "Crimson Punch" is built into the engine; it only needs a phone-preview spec
const RED_PUNCH: ClassicSpec = { id: 'red-punch', name: 'Crimson Punch Outline', tagline: '', font: 'Arial Black', base: '#FFFFFF', active: ['#EF4444'], outline: 6, outlineColor: '#000000', sample: ['STOP', 'THIS', 'NOW'], upper: true, anim: 'pop' };
export const getClassic = (id?: string) => CLASSIC_EXTRA.find(c => c.id === id) || (id === 'red-punch' ? RED_PUNCH : undefined);

const ring = (r: number, color: string) => {
  const a: string[] = [];
  for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; a.push(`${(Math.cos(t) * r).toFixed(2)}px ${(Math.sin(t) * r).toFixed(2)}px 0 ${color}`); }
  a.push(`0 ${(r * 0.9).toFixed(1)}px ${(r * 1.6).toFixed(1)}px rgba(0,0,0,.55)`);
  return a.join(',');
};

/** Live preview of an extra classic style: words in a row, the spoken one coloured / boxed / animated like the exported video. */
export function ClassicCaption({ spec, words, active, colorIdx = 0, size, uppercase, fontOverride }: { spec: ClassicSpec; words: string[]; active: number; colorIdx?: number; size: number; uppercase?: boolean; fontOverride?: string }) {
  const px = Math.max(4, size * (spec.sizeMul || 1));
  const up = spec.upper === true ? true : spec.upper === false ? false : !!uppercase;
  const ow = Math.max(0, spec.outline * px / 34);
  const col = spec.active[Math.max(0, colorIdx) % spec.active.length];
  const anim = spec.anim && spec.anim !== 'none' && spec.anim !== 'pop' && ANIM_MS[spec.anim] ? `dynA-${spec.anim} ${ANIM_MS[spec.anim]}ms ease-out` : undefined;
  return (
    <div className="flex flex-wrap items-center justify-center text-center" style={{ gap: `${px * 0.04}px ${px * 0.28}px`, transform: spec.rot ? `rotate(${spec.rot}deg)` : undefined }}>
      <style>{ANIM_CSS}</style>
      {words.map((w, i) => {
        const brk = spec.lines === 2 && words.length >= 3 && i === Math.ceil(words.length / 2);
        const on = i === active, boxed = on && !!spec.box;
        const glow = on && spec.glow ? `, 0 0 ${px * 0.35}px ${col}, 0 0 ${px * 0.7}px ${col}` : '';
        return (
          <React.Fragment key={i}>{brk && <span style={{ flexBasis: '100%', height: 0 }} />}<span style={{
            fontFamily: `${cssFont(fontOverride || spec.font)}, "Montserrat", Arial, sans-serif`, fontSize: px, lineHeight: 1.1, fontWeight: 400, whiteSpace: 'pre', display: 'inline-block',
            color: boxed ? spec.box!.text : on ? col : spec.base,
            background: boxed ? spec.box!.color : 'transparent', borderRadius: boxed ? px * 0.16 : 0, padding: boxed ? `0 ${px * 0.14}px` : 0,
            textShadow: boxed ? 'none' : ring(ow, spec.outlineColor) + glow,
            transform: on && (!anim || spec.anim === 'pop') ? 'scale(1.1)' : undefined, transition: 'transform .12s',
            animation: on ? anim : undefined,
          }}>{up ? w.toUpperCase() : w}</span></React.Fragment>
        );
      })}
    </div>
  );
}
