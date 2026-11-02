import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles, X, ChevronRight } from 'lucide-react';
import { CaptionConfig } from '../../types/clipper';
import { DynCaption } from '../DynCaption';
import { DYN_TEMPLATES, getDyn, DynTemplate } from '../../utils/dynCaptions';
import { POPULAR_CAPTION_PRESETS } from '../../utils/captionHelpers';
import { ProTag } from '../common/ProTag';
import personUrl from '../../assets/behind-person.png';

type Preset = typeof POPULAR_CAPTION_PRESETS[number];
type Cat = 'all' | 'classic' | 'dynamic' | 'behind';
const isBehind = (t: DynTemplate) => !!t.behind;

/** Classic style preview (small live sample, no box) */
const ClassicPreview: React.FC<{ preset: Preset }> = ({ preset }) => (
  <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
        {/* PRESET 1: CapCut Auto-Emoji Pop (ONLY one with emojis + dynamic multicolor word highlight) */}
        {preset.id === 'capcut-emoji' && (
          <div className="flex items-center gap-1.5 font-black uppercase text-xs" style={{ fontFamily: preset.fontFamily }}>
            <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">BIGGEST</span>
            <span className="text-[#8fd0a4] flex items-center gap-1 scale-110 drop-shadow-[0_2px_8px_rgba(190,242,100,0.6)]">
              <span>MISTAKE</span>
              <span className="text-sm">🤯</span>
            </span>
          </div>
        )}

        {preset.id === 'capcut-pop' && (
          <div className="flex items-center gap-1.5 font-black uppercase text-sm" style={{ fontFamily: preset.fontFamily }}>
            <span className="text-white" style={{ WebkitTextStroke: '3px #000', paintOrder: 'stroke fill' as any }}>MISTAKE</span>
          </div>
        )}

        {/* PRESET 2: Alex Hormozi Viral Yellow (NO BOX) */}
        {preset.id === 'hormozi' && (
          <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase" style={{ fontFamily: preset.fontFamily }}>
            <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">REVENUE</span>
            <span className="text-[#facc15] font-black scale-110 drop-shadow-[0_2px_8px_rgba(250,204,21,0.7)]">SECRET</span>
            <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">TODAY</span>
          </div>
        )}

        {/* PRESET 3: MrBeast Heavy Outline (NO BOX) */}
        {preset.id === 'mrbeast' && (
          <div 
            className="text-xs font-black uppercase tracking-wide flex items-center gap-1 text-white" 
            style={{ 
              fontFamily: preset.fontFamily,
              textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.9)'
            }}
          >
            <span>INSANE</span>
            <span className="text-[#22c55e] scale-115 inline-block">CHALLENGE</span>
            <span>EVER</span>
          </div>
        )}

        {/* PRESET 4: Neon Cyber Bloom (NO BOX) */}
        {preset.id === 'neon' && (
          <div 
            className="text-xs font-extrabold uppercase tracking-widest text-[#38bdf8]"
            style={{ 
              fontFamily: preset.fontFamily,
              textShadow: '0 0 8px #38bdf8, 0 0 16px rgba(56, 189, 248, 0.7)'
            }}
          >
            FUTURE MATRIX WORLD
          </div>
        )}

        {/* PRESET 5: Karaoke Underline Flow (NO BOX) */}
        {preset.id === 'karaoke' && (
          <div className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ fontFamily: preset.fontFamily }}>
            <span className="text-[#facc15] font-black underline underline-offset-4 decoration-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">SPEECH</span>
            <span className="text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">FLOW</span>
            <span className="text-white/60 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">NOW</span>
          </div>
        )}

        {/* PRESET 6: Crimson Punch Outline (NO BOX) */}
        {preset.id === 'red-punch' && (
          <div className="font-black text-[11px] uppercase tracking-wide flex items-center gap-1" style={{ fontFamily: preset.fontFamily }}>
            <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">STOP</span>
            <span className="text-[#ef4444] scale-110 drop-shadow-[0_2px_8px_rgba(239,68,68,0.8)]">THIS</span>
            <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">NOW</span>
          </div>
        )}

        {/* PRESET 7: Cinematic Minimalist (NO BOX) */}
        {preset.id === 'cinematic' && (
          <div className="text-xs font-medium tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ fontFamily: preset.fontFamily }}>
            <span className="text-neutral-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">ELEGANT</span>
            <span className="text-[#facc15] font-bold drop-shadow-[0_2px_6px_rgba(250,204,21,0.6)]">MINDSET</span>
          </div>
        )}

        {/* PRESET 8: Comic Action Bold (NO BOX) */}
        {preset.id === 'comic-pop' && (
          <div 
            className="text-xs font-black uppercase tracking-wide text-amber-300 transform -rotate-2"
            style={{ 
              fontFamily: preset.fontFamily,
              textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 2px 2px 0 #000'
            }}
          >
            UNREAL ACTION LEVEL
          </div>
        )}
  </div>
);

/** A stand-in person (face hidden by a question mark) so the card shows how the big word sits behind the speaker */
const PersonSilhouette: React.FC = () => (
  <img src={personUrl} alt="" draggable={false} className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[80%] w-auto z-10 select-none pointer-events-none" />
);

/** Behind-the-person preview: big word behind the person, small caption in front below, like the rendered clip */
const BehindPreview: React.FC<{ tpl: DynTemplate }> = ({ tpl }) => (
  <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#34414f] to-[#141a22]">
    <div className="absolute inset-x-0 top-[6%] flex justify-center z-0 px-1"><DynCaption tpl={tpl} base={11} sample part="behind" fitW={150} /></div>
    <PersonSilhouette />
    <div className="absolute inset-x-0 bottom-[7%] flex justify-center z-20"><DynCaption tpl={tpl} base={14} sample part="front" /></div>
  </div>
);

const NOTE = 'No live preview for Dynamic and Behind-the-person captions: the phone preview only shows a simple sample. The real animation, fonts and the big word behind the speaker appear after the clip is rendered (Generate clips). These captions are font locked, so the font can not be changed.';

export const CaptionStylePicker: React.FC<{ captions: CaptionConfig; onCaptionsChange: (c: CaptionConfig) => void }> = ({ captions, onCaptionsChange }) => {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Cat>('all');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick(x => x + 1), 2600);            // replay the previews' animations
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    return () => { clearInterval(t); window.removeEventListener('keydown', k); };
  }, [open]);

  const cur = captions.style as string;
  const curDyn = getDyn(cur);
  const curPreset = POPULAR_CAPTION_PRESETS.find(p => p.id === cur);
  const curName = curDyn ? curDyn.name : curPreset?.name || 'Pick a style';
  const curKind = curDyn ? (isBehind(curDyn) ? 'Behind the person' : 'Dynamic') : 'Classic';

  const pickPreset = (p: Preset) => onCaptionsChange({ ...captions, style: p.id, highlightColor: p.highlight });
  const pickDyn = (t: DynTemplate) => onCaptionsChange({ ...captions, style: t.id as any, fontFamily: undefined });

  const showClassic = cat === 'all' || cat === 'classic';
  const dyn = DYN_TEMPLATES.filter(t => cat === 'all' || (cat === 'behind' ? isBehind(t) : cat === 'dynamic' ? !isBehind(t) : false));
  const total = POPULAR_CAPTION_PRESETS.length + DYN_TEMPLATES.length;
  const cards = 'grid grid-cols-2 lg:grid-cols-3 gap-3';
  const card = (sel: boolean) => `relative rounded-2xl border-2 p-2.5 cursor-pointer transition-all text-left ${sel ? 'border-[#bef264] bg-[#12231a] shadow-[0_0_0_3px_rgba(190,242,100,0.18)]' : 'border-[#1d3128] bg-[#0d1813] hover:border-[#3a5a49]'}`;
  const tick_ = (sel: boolean) => sel ? <span className="absolute top-2 right-2 z-30 w-5 h-5 rounded-full bg-[#bef264] text-black flex items-center justify-center shadow"><Check className="w-3.5 h-3.5 stroke-[3]" /></span> : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="group w-full text-left rounded-2xl p-[1.5px] bg-gradient-to-r from-[#bef264] via-[#3f9a5a] to-[#8fd0a4] hover:shadow-[0_0_24px_rgba(190,242,100,0.25)] transition-shadow cursor-pointer">
        <div className="rounded-[15px] bg-[#0b1410] p-3.5 flex items-center gap-3.5">
          <div className="w-20 h-14 rounded-xl border border-[#1c3127] bg-black/50 overflow-hidden shrink-0 flex items-center justify-center">
            {curDyn ? (isBehind(curDyn) ? <BehindPreview tpl={curDyn} /> : <DynCaption tpl={curDyn} base={9} sample />) : curPreset ? <div className="w-full h-full"><ClassicPreview preset={curPreset} /></div> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-[#bef264]" /><span className="text-[10px] font-mono uppercase tracking-widest text-[#8fd0a4]">Caption style</span>{curDyn && <ProTag />}</div>
            <div className="text-sm font-extrabold text-white truncate mt-0.5">{curName}</div>
            <div className="text-[10px] text-neutral-400">{curKind}{curDyn ? ' · font locked' : ''} · tap to browse all {total} styles</div>
          </div>
          <span className="shrink-0 px-3 py-2 rounded-xl bg-[#bef264] text-black text-[11px] font-extrabold flex items-center gap-1 group-hover:bg-[#d9f99d]">Choose <ChevronRight className="w-3.5 h-3.5" /></span>
        </div>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0a120e] border border-[#20322a] shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-[#172820]">
              <div>
                <h3 className="text-base font-black text-white tracking-tight">Caption styles</h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">{total} styles. The one with the green outline is selected.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} title="Close" className="w-8 h-8 rounded-xl bg-[#13211a] text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 pt-3 flex flex-wrap gap-1.5">
              {([['all', 'All'], ['classic', 'Classic'], ['dynamic', 'Dynamic'], ['behind', 'Behind the person']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setCat(id)} className={`px-3 py-1.5 rounded-full text-[11px] cursor-pointer ${cat === id ? 'bg-[#bef264] text-black font-extrabold' : 'bg-[#0f1c16] text-neutral-300 hover:text-white border border-[#1d3128]'}`}>{label}</button>
              ))}
            </div>
            <div className="overflow-y-auto p-5 pt-3 space-y-4">
              {cat !== 'classic' && <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-200 flex items-start gap-2"><span className="text-sm leading-none">ⓘ</span><span>{NOTE}</span></div>}
              {cat === 'behind' && <p className="text-[11px] text-neutral-400">The big word is drawn behind the speaker (the person with the question mark is only a stand-in) and the small caption sits in front, below. ClipForge sizes the big word so it stays visible beside the head and shoulders.</p>}
              {showClassic && <div className="space-y-2">
                {cat === 'all' && <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Classic · you can pick any font</div>}
                <div className={cards}>
                  {POPULAR_CAPTION_PRESETS.map(p => { const sel = cur === p.id; return (
                    <div key={p.id} onClick={() => pickPreset(p)} className={card(sel)}>
                      {tick_(sel)}
                      <div className="h-24 rounded-xl bg-black/60 border border-[#1c3127] overflow-hidden mb-2"><ClassicPreview preset={p} /></div>
                      <div className="text-xs font-extrabold text-white truncate">{p.name}</div>
                      <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-2">{p.tagline}</p>
                    </div>); })}
                </div>
              </div>}
              {dyn.length > 0 && <div className="space-y-2">
                {cat === 'all' && <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2">Dynamic and behind the person <ProTag /></div>}
                <div className={cards}>
                  {dyn.map(t => { const sel = cur === t.id; const b = isBehind(t); return (
                    <div key={t.id} onClick={() => pickDyn(t)} className={card(sel)}>
                      {tick_(sel)}
                      <div className={`${b ? 'h-40' : 'h-24'} rounded-xl border border-[#1c3127] overflow-hidden mb-2 ${b ? '' : 'bg-gradient-to-b from-[#2a3440] to-[#0d1117] flex items-center justify-center'}`}>
                        {b ? <BehindPreview key={tick} tpl={t} /> : <DynCaption key={tick} tpl={t} base={14} sample />}
                      </div>
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold text-white truncate">{t.name}</span><span className="text-[8px] text-neutral-500 uppercase tracking-wider shrink-0">{b ? 'behind person' : 'dynamic'} · locked</span></div>
                      <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-2">{t.tagline}</p>
                    </div>); })}
                </div>
              </div>}
            </div>
            <div className="p-4 border-t border-[#172820] flex items-center justify-between gap-3">
              <span className="text-[11px] text-neutral-400 truncate">Selected: <b className="text-white">{curName}</b></span>
              <button type="button" onClick={() => setOpen(false)} className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#d9f99d] text-black font-extrabold text-xs cursor-pointer">Done</button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
};
