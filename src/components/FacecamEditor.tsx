import React, { useRef, useState } from 'react';
import { Rect01 } from '../types/clipper';
import { Check, X } from 'lucide-react';

interface Props {
  frame: string;                 // a frame of the video (data URL)
  dims?: [number, number];       // source size, only used for the aspect ratio
  rect: Rect01 | null;
  onApply: (r: Rect01) => void;
  onClose: () => void;
}
const MIN = 0.06;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Drag the box over the facecam; drag the corner dots to resize it. */
export const FacecamEditor: React.FC<Props> = ({ frame, dims, rect, onApply, onClose }) => {
  const [r, setR] = useState<Rect01>(rect || { x: 0.7, y: 0.05, w: 0.28, h: 0.28 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: string; sx: number; sy: number; r0: Rect01 } | null>(null);

  const start = (kind: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { kind, sx: e.clientX, sy: e.clientY, r0: { ...r } };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, el = box.current; if (!d || !el) return;
    const b = el.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / b.width, dy = (e.clientY - d.sy) / b.height;
    let { x, y, w, h } = d.r0;
    if (d.kind === 'move') { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - h); }
    else {
      let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (d.kind.includes('l')) x0 = clamp(x0 + dx, 0, x1 - MIN);
      if (d.kind.includes('r')) x1 = clamp(x1 + dx, x0 + MIN, 1);
      if (d.kind.includes('t')) y0 = clamp(y0 + dy, 0, y1 - MIN);
      if (d.kind.includes('b')) y1 = clamp(y1 + dy, y0 + MIN, 1);
      x = x0; y = y0; w = x1 - x0; h = y1 - y0;
    }
    setR({ x, y, w, h });
  };
  const end = () => { drag.current = null; };
  const aspect = dims ? dims[0] / dims[1] : 16 / 9;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const dot = (kind: string, style: React.CSSProperties, cursor: string) => (
    <div onPointerDown={start(kind)} style={{ ...style, cursor }} className="absolute w-3.5 h-3.5 rounded-full bg-[#bef264] border-2 border-black -translate-x-1/2 -translate-y-1/2 touch-none" />
  );

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b0e12] border border-[#1e2533] rounded-2xl p-4 w-full max-w-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">Select the facecam area</div>
            <div className="text-[11px] text-neutral-400">Drag the box over the facecam. Drag a corner dot to resize it.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#1a1f27] text-neutral-400 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div ref={box} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
          className="relative w-full select-none bg-black rounded-lg overflow-hidden touch-none" style={{ aspectRatio: String(aspect) }}>
          <img src={frame} alt="" draggable={false} className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
          {/* dim everything outside the box */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)', clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(r.x)} ${pct(r.y)},${pct(r.x)} ${pct(r.y + r.h)},${pct(r.x + r.w)} ${pct(r.y + r.h)},${pct(r.x + r.w)} ${pct(r.y)},${pct(r.x)} ${pct(r.y)})` }} />
          <div onPointerDown={start('move')} className="absolute border-2 border-[#bef264] cursor-move touch-none" style={{ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) }} />
          {dot('tl', { left: pct(r.x), top: pct(r.y) }, 'nwse-resize')}
          {dot('tr', { left: pct(r.x + r.w), top: pct(r.y) }, 'nesw-resize')}
          {dot('bl', { left: pct(r.x), top: pct(r.y + r.h) }, 'nesw-resize')}
          {dot('br', { left: pct(r.x + r.w), top: pct(r.y + r.h) }, 'nwse-resize')}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#14181f] border border-[#222834] text-xs text-neutral-300 cursor-pointer">Cancel</button>
          <button onClick={() => onApply(r)} className="px-5 py-2 rounded-lg bg-[#bef264] hover:bg-[#a3e635] text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"><Check className="w-4 h-4" /> Use this area</button>
        </div>
      </div>
    </div>
  );
};
