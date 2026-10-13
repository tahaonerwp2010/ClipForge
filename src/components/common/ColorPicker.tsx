import React, { useEffect, useRef, useState } from 'react';

// CapCut-style colour picker: big saturation/brightness rectangle + hue strip + quick swatches + hex field.
const SWATCHES = ['#ffffff', '#000000', '#facc15', '#bef264', '#22c55e', '#38bdf8', '#3b82f6', '#8b5cf6',
  '#f472b6', '#f43f5e', '#f97316', '#a3a3a3'];

function hexToHsv(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return [hue, max ? d / max : 0, max];
}
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  const x = (n: number) => Math.round(f(n) * 255).toString(16).padStart(2, '0');
  return `#${x(5)}${x(3)}${x(1)}`;
}

interface Props { value: string; onChange: (hex: string) => void; label?: string; }

export const ColorPicker: React.FC<Props> = ({ value, onChange, label }) => {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value || '#ffffff'));
  const [text, setText] = useState((value || '#ffffff').toLowerCase());
  const area = useRef<HTMLDivElement>(null), strip = useRef<HTMLDivElement>(null);

  // follow outside changes (e.g. clicking a swatch / loading a template)
  useEffect(() => {
    if ((value || '').toLowerCase() !== hsvToHex(...hsv)) { setHsv(hexToHsv(value || '#ffffff')); }
    setText((value || '#ffffff').toLowerCase());
  }, [value]);

  const commit = (next: [number, number, number]) => { setHsv(next); const hex = hsvToHex(...next); setText(hex); onChange(hex); };
  const drag = (el: React.RefObject<HTMLDivElement | null>, fn: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
    move(e.nativeEvent);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {label && <span className="text-[11px] font-semibold text-neutral-300">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map(c => (
          <button key={c} type="button" onClick={() => { setHsv(hexToHsv(c)); setText(c); onChange(c); }}
            style={{ backgroundColor: c }} title={c}
            className={`w-6 h-6 rounded-md border border-white/10 cursor-pointer transition-transform ${(value || '').toLowerCase() === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`} />
        ))}
      </div>
      <div className="flex gap-2 items-stretch">
        <div ref={area} onPointerDown={drag(area, (x, y) => commit([hsv[0], x, 1 - y]))}
          className="relative h-28 flex-1 rounded-lg cursor-crosshair touch-none select-none"
          style={{ backgroundColor: `hsl(${hsv[0]},100%,50%)`, backgroundImage: 'linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent)' }}>
          <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, backgroundColor: hsvToHex(...hsv) }} />
        </div>
        <div ref={strip} onPointerDown={drag(strip, (_x, y) => commit([y * 359.9, hsv[1] || 0.0001, hsv[2] || 0.0001]))}
          className="relative w-4 rounded-lg cursor-pointer touch-none select-none"
          style={{ backgroundImage: 'linear-gradient(to bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}>
          <div className="absolute left-0 right-0 h-1.5 border-2 border-white rounded -translate-y-1/2 pointer-events-none" style={{ top: `${(hsv[0] / 360) * 100}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: value }} />
        <input value={text} maxLength={7}
          onChange={e => { const t = e.target.value; setText(t); if (/^#[0-9a-fA-F]{6}$/.test(t)) { setHsv(hexToHsv(t)); onChange(t.toLowerCase()); } }}
          className="w-24 bg-[#0a0d11] border border-[#232832] focus:border-[#bef264] rounded-lg px-2 py-1 text-[11px] font-mono text-white focus:outline-none" />
      </div>
    </div>
  );
};
