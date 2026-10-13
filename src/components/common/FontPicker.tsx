import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { FontService, FontEntry, normalizeFamily } from '../../services/fontService';

interface Props {
  value?: string;                 // current family (undefined = style default)
  onChange: (family: string | undefined) => void;
  defaultLabel?: string;          // when set, shows a "style default" option that clears the font
  label?: string;
}

const CATS = ['All', 'My fonts', 'Impact', 'Clean', 'Fun', 'Script', 'Serif', 'Mono', 'System'];

export const FontPicker: React.FC<Props> = ({ value, onChange, defaultLabel, label = 'Font' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [, force] = useState(0);
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { FontService.init(); return FontService.subscribe(() => force(n => n + 1)); }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const all = FontService.all();
  const list = useMemo(() => all.filter(f =>
    (cat === 'All' || f.category === cat) && f.family.toLowerCase().includes(q.toLowerCase())), [all.length, q, cat]);
  const current = normalizeFamily(value);

  const add = async () => {
    const n = await FontService.addFonts();
    setNote(n > 0 ? `${n} font${n > 1 ? 's' : ''} added` : '');
    if (n > 0) setCat('My fonts');
  };

  const row = (f: FontEntry) => (
    <div key={f.source + f.family} className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer ${current === f.family ? 'bg-[#bef264] text-black' : 'hover:bg-[#161b24] text-neutral-200'}`}
      onClick={() => { onChange(f.family); setOpen(false); }}>
      <span className="text-[15px] truncate" style={{ fontFamily: `"${f.family}", sans-serif` }}>{f.family}</span>
      {f.source === 'user' && (
        <button type="button" title="Remove this font" className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500"
          onClick={(e) => { e.stopPropagation(); FontService.removeFont(f.family); }}>
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-1.5" ref={box}>
      <span className="text-[11px] font-semibold text-neutral-300">{label}:</span>
      <div className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between bg-[#0a0d11] border border-[#232832] hover:border-[#2d3644] rounded-lg px-3 py-2 text-left cursor-pointer">
          <span className="text-[14px] text-white truncate" style={{ fontFamily: current ? `"${current}", sans-serif` : undefined }}>
            {current || defaultLabel || 'Select a font'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-[#0b0e12] border border-[#232832] rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-[#1a1f28] space-y-2">
              <div className="flex items-center gap-2 bg-[#0a0d11] border border-[#232832] rounded-lg px-2">
                <Search className="w-3 h-3 text-neutral-500" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${all.length} fonts…`}
                  className="w-full bg-transparent py-1.5 text-[11px] text-white placeholder-neutral-500 focus:outline-none" autoFocus />
              </div>
              <div className="flex flex-wrap gap-1">
                {CATS.map(c => (
                  <button key={c} type="button" onClick={() => setCat(c)}
                    className={`px-2 py-0.5 rounded-full text-[10px] cursor-pointer ${cat === c ? 'bg-[#bef264] text-black font-bold' : 'bg-[#12151c] text-neutral-400 hover:text-white border border-[#232832]'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {defaultLabel && (
                <div className={`px-3 py-1.5 text-[12px] cursor-pointer ${!current ? 'bg-[#bef264] text-black' : 'hover:bg-[#161b24] text-neutral-300'}`}
                  onClick={() => { onChange(undefined); setOpen(false); }}>{defaultLabel}</div>
              )}
              {list.length ? list.map(row) : <div className="px-3 py-4 text-[11px] text-neutral-500">No fonts match.</div>}
            </div>
            <div className="p-2 border-t border-[#1a1f28] space-y-1">
              <button type="button" onClick={add}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#182116] border border-[#bef264]/40 text-[#bef264] text-[11px] font-bold hover:bg-[#22331e] cursor-pointer">
                <Plus className="w-3 h-3" /> Add your own font (.ttf / .otf)
              </button>
              <p className="text-[10px] text-neutral-500 leading-snug">
                Need Jovial, CC-Moderno or any other font? Add its file here. Fonts are saved on this computer and used in your clips.
                {note && <span className="text-[#bef264]"> {note}.</span>}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
