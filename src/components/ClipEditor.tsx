import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Save, Type, Sparkles, PanelTop, Stamp, Music, ListChecks } from 'lucide-react';
import { PhonePreview } from './PhonePreview';
import { CaptionsTab } from './tabs/CaptionsTab';
import { BrandingTab } from './tabs/BrandingTab';
import { FontPicker } from './common/FontPicker';
import { ColorPicker } from './common/ColorPicker';
import { hookLines } from '../utils/captionHelpers';
import { fileUrl } from '../utils/fileUrl';
import { BrandingConfig, CaptionConfig, GeneratedClip, InnerFramingConfig, VideoGradingConfig } from '../types/clipper';

interface Props {
  clip: GeneratedClip;
  index: number;
  outDir: string;
  total: number;
  allIdx: number[];          // engine indexes of every clip still in the project (a clip keeps its number after others are deleted)
  onClose: () => void;
  onSaved: (index: number, r: { outputPath: string; thumbnailUrl?: string }) => void;
  fallback: { captions: CaptionConfig; branding: BrandingConfig; grading: VideoGradingConfig; framing: InnerFramingConfig };
}

type Cat = 'captions' | 'hook' | 'banner' | 'watermark' | 'music';
const CATS: { id: Cat; label: string; Icon: React.ElementType }[] = [
  { id: 'captions', label: 'Captions', Icon: Type },
  { id: 'hook', label: 'Hook', Icon: Sparkles },
  { id: 'banner', label: 'Banner', Icon: PanelTop },
  { id: 'watermark', label: 'Watermark', Icon: Stamp },
  { id: 'music', label: 'Music', Icon: Music },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const ClipEditor: React.FC<Props> = ({ clip, index, outDir, total, allIdx, onClose, onSaved, fallback }) => {
  const api: any = (window as any).electronAPI;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');
  const [captions, setCaptions] = useState<CaptionConfig>(fallback.captions);
  const [branding, setBranding] = useState<BrandingConfig>(fallback.branding);
  const [cat, setCat] = useState<Cat>('captions');
  const [showTx, setShowTx] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pct, setPct] = useState(0);
  const [job, setJob] = useState('');
  const cur = useRef(0), doneBefore = useRef(0), span = useRef(1);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(clip.duration || 0);
  const [playing, setPlaying] = useState(true);
  const [safe, setSafe] = useState<any>('none');
  const base = useRef<{ grading: VideoGradingConfig; framing: InnerFramingConfig }>({
    grading: { ...fallback.grading, brightness: 100, contrast: 100, saturation: 100, warmth: 100, grain: false, vignette: false, speedBoost: 1, fx: undefined } as any,
    framing: { ...fallback.framing, mode: 'fill-crop', panX: 0, autoReframing: false } as any,
  });
  const hook = branding.autoTitle || ({} as any);
  const hookText = hook.title || clip.hookText || clip.title || '';

  useEffect(() => {
    let off: any;
    (async () => {
      try {
        const st = await api?.editLoad?.(outDir);
        if (!st?.ok) throw new Error('This project was made with an older version, so its clips cannot be edited. Generate it again to enable editing.');
        if (st.captions) setCaptions({ ...fallback.captions, ...st.captions });
        const b = { ...fallback.branding, ...(st.branding || {}) } as any;
        if (b.watermarkImage?.path && !b.watermarkImage.dataUrl) b.watermarkImage = { ...b.watermarkImage, dataUrl: fileUrl(b.watermarkImage.path) };
        const h = st.clips?.[index]?.hookText || clip.hookText;
        setBranding({ ...b, autoTitle: { ...fallback.branding.autoTitle, ...(b.autoTitle || {}), enabled: true, title: h } });
        const r = await api.editPrepare(outDir, index);
        if (!r?.ok) throw new Error(r?.error || 'Could not prepare the preview.');
        setUrl(r.url); setState('ready');
      } catch (e: any) { setErr(String(e.message || e)); setState('error'); }
    })();
    off = api?.onEditProgress?.((d: any) => { if (d.index === cur.current) { const f = d.p <= 1 ? d.p : d.p / 100; setPct(Math.round((doneBefore.current + f) / span.current * 100)); } });
    return () => { try { off && off(); } catch {} };
  }, []);

  const setHook = (patch: any) => setBranding(b => ({ ...b, autoTitle: { ...b.autoTitle, enabled: true, ...patch } }));
  const brandingOut = () => {
    const b: any = { ...branding };
    if (b.watermarkImage) b.watermarkImage = { path: b.watermarkImage.path, name: b.watermarkImage.name };
    if (!b.bgMusic) b.bgMusic = null;                                   // null = remove the music
    delete b.autoTitle;
    return b;
  };
  const save = async (all: boolean) => {
    setSaving(true); setPct(0); setErr('');
    const idx = all ? allIdx : [index];
    span.current = idx.length;
    const at = { ...branding.autoTitle, enabled: true };
    const bo = brandingOut();
    for (let n = 0; n < idx.length; n++) {
      const i = idx[n]; cur.current = i; doneBefore.current = n; setJob(all ? `Clip ${n + 1} of ${idx.length}` : '');
      const own = i === index;
      const { title: _t, ...atNoTitle } = at as any;
      const r = await api.editRender(outDir, i, own ? { captions, hookText, autoTitle: at, branding: bo } : { captions, autoTitle: atNoTitle, branding: bo });
      if (!r?.ok) { setSaving(false); setErr(r?.error || 'Render failed.'); setState('error'); return; }
      onSaved(i, { outputPath: r.outputPath, thumbnailUrl: r.thumbnailUrl });
      setPct(Math.round((n + 1) / idx.length * 100));
    }
    setSaving(false); onClose();
  };

  const ls = hookLines(hookText || 'THE VIRAL TRUTH', hook.lines || 2);
  const maxLen = Math.max(4, ...ls.map((l: string) => l.length));
  const fitMax = Math.max(40, Math.min(140, Math.floor((1080 * 0.92) / (maxLen * 0.64))));
  const Chip = (p: { on: boolean; onClick: () => void; children: any }) => (
    <button type="button" onClick={p.onClick} className={`px-3 py-1 rounded-full text-[11px] cursor-pointer ${p.on ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`}>{p.children}</button>
  );
  const Slider = (p: { label: string; v: number; min: number; max: number; on: (n: number) => void }) => (
    <div><div className="flex justify-between text-[11px] text-neutral-300"><span>{p.label}</span><span className="text-[#8fd0a4] font-mono">{p.v}</span></div>
      <input type="range" min={p.min} max={p.max} value={p.v} onChange={e => p.on(parseInt(e.target.value))} className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer" /></div>
  );

  // transcript lines with timestamps (CapCut style)
  const lines = (() => {
    const w = clip.words || []; const out: { t: number; text: string }[] = []; let cur: string[] = [], st = 0;
    w.forEach((x, i) => {
      if (!cur.length) st = x.start;
      cur.push(x.word.trim());
      const next = w[i + 1];
      if (!next || next.start - x.end > 0.6 || cur.length >= 9 || /[.!?؟।]$/.test(x.word.trim())) { out.push({ t: st, text: cur.join(' ') }); cur = []; }
    });
    return out;
  })();

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-5xl h-full md:h-[92vh] bg-[#060b09] border border-[#172820] md:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#13211a]">
          <div className="text-sm font-black text-white uppercase tracking-wider truncate">Edit clip <span className="text-[#8fd0a4] normal-case font-semibold ml-2">{clip.title}</span></div>
          <button onClick={onClose} disabled={saving} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {state === 'loading' && <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparing preview…</div>}
        {state === 'error' && <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-300 text-sm p-8 text-center"><p>{err}</p><button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#12201a] text-white cursor-pointer">Close</button></div>}
        {state === 'ready' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
            <div className="w-full md:w-[380px] shrink-0 flex items-center justify-center p-2 md:p-4 border-b md:border-b-0 md:border-r border-[#13211a]">
              <PhonePreview
                videoUrl={url} canvasRatio={'9:16' as any} framing={base.current.framing} captions={captions} grading={base.current.grading} branding={branding}
                words={clip.words || []} currentTime={t} duration={dur} isPlaying={playing} onTimeUpdate={setT} onDurationChange={setDur} onTogglePlay={() => setPlaying(p => !p)}
                safeZone={safe} onSafeZoneChange={setSafe} onPanChange={() => {}} onFramingChange={() => {}} onCaptionsChange={setCaptions} onBrandingChange={setBranding}
                clipTitle={hookText} split={undefined as any} onSplitChange={() => {}}
              />
            </div>
            <div className="flex-1 flex flex-col md:overflow-hidden min-w-0">
              <div className="flex gap-1 px-3 pt-3 border-b border-[#13211a] overflow-x-auto shrink-0">
                {CATS.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => setCat(id)}
                    className={`px-3.5 py-2 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap transition-colors ${cat === id ? 'border-[#bef264] text-[#bef264]' : 'border-transparent text-neutral-400 hover:text-white'}`}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>
              <div className="flex-1 md:overflow-y-auto p-3 md:p-4 space-y-4">
                {cat === 'captions' && (<>
                  <button type="button" onClick={() => setShowTx(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] text-xs font-bold hover:bg-[#183024] cursor-pointer">
                    <ListChecks className="w-4 h-4" /> See transcript of this clip
                  </button>
                  <CaptionsTab captions={captions} onCaptionsChange={setCaptions} hideLanguage />
                </>)}
                {cat === 'hook' && (
                  <section className="p-4 rounded-xl bg-[#0b1410] border border-[#172820] space-y-3 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300">Hook text (this clip)</label>
                      <textarea value={hookText} rows={2} onChange={e => setHook({ title: e.target.value })} className="mt-1 w-full bg-[#09100d] border border-[#20322a] rounded-lg px-3 py-2 text-xs text-white outline-none resize-none" />
                    </div>
                    <FontPicker label="Hook Font" value={hook.fontFamily} onChange={f => setHook({ fontFamily: f || 'Montserrat Black' })} />
                    <ColorPicker label="Hook Colour" value={hook.color || '#ffffff'} onChange={hex => setHook({ color: hex })} />
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] text-neutral-300">Lines</span>
                      {[1, 2, 3].map(n => <Chip key={n} on={(hook.lines || 2) === n} onClick={() => setHook({ lines: n })}>{n}</Chip>)}</div>
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] text-neutral-300">Size</span>
                      <Chip on={!hook.size} onClick={() => setHook({ size: hook.size ? undefined : 90 })}>Auto</Chip>
                      {hook.size ? <><input type="range" min={30} max={fitMax} value={Math.min(hook.size, fitMax)} onChange={e => setHook({ size: parseInt(e.target.value) })} className="w-40 h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer" /><span className="text-[#8fd0a4] font-mono text-[11px]">{Math.min(hook.size, fitMax)}</span></> : null}</div>
                    <Slider label="Position X (%)" v={hook.positionX ?? 50} min={0} max={100} on={n => setHook({ positionX: n })} />
                    <Slider label="Position Y (%)" v={hook.positionY ?? 10} min={0} max={100} on={n => setHook({ positionY: n })} />
                  </section>
                )}
                {cat === 'banner' && <BrandingTab branding={branding} onBrandingChange={setBranding} clipTitle={hookText} only="banner" />}
                {cat === 'watermark' && <BrandingTab branding={branding} onBrandingChange={setBranding} clipTitle={hookText} only="watermark" />}
                {cat === 'music' && <BrandingTab branding={branding} onBrandingChange={setBranding} clipTitle={hookText} only="music" />}
              </div>
            </div>
          </div>
        )}
        {state === 'ready' && (
          <div className="px-5 py-3 border-t border-[#13211a] flex items-center justify-between gap-3 flex-wrap">
            {saving ? (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[#13211a] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: pct + '%' }} /></div>
                <span className="text-xs text-[#8fd0a4] font-mono whitespace-nowrap">{job ? job + ' · ' : ''}Rendering {pct}%</span>
              </div>
            ) : (<>
              <span className="text-[10px] text-neutral-500 max-w-xs">Applying to all keeps each clip's own hook text; style, banner, watermark and music are shared.</span>
              <div className="flex gap-2">
                <button onClick={() => save(false)} className="px-4 py-2 rounded-lg bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] text-xs font-black flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" /> Apply to this clip</button>
                {total > 1 && <button onClick={() => save(true)} className="px-4 py-2 rounded-lg bg-[#bef264] text-black text-xs font-black cursor-pointer">Apply to all clips ({total})</button>}
              </div>
            </>)}
          </div>
        )}
        {showTx && (
          <div className="fixed inset-0 z-[310] bg-black/70 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setShowTx(false); }}>
            <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-[#0a130f] border border-[#172820] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#13211a]">
                <span className="text-xs font-black uppercase tracking-wider text-white">Transcript</span>
                <button onClick={() => setShowTx(false)} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto p-2">
                {lines.length === 0 && <p className="p-4 text-xs text-neutral-400">No transcript for this clip.</p>}
                {lines.map((l, i) => (
                  <button key={i} type="button" onClick={() => { setT(l.t); setShowTx(false); }} className="w-full flex gap-3 text-left px-3 py-2 rounded-lg hover:bg-[#12201a] cursor-pointer">
                    <span className="text-[11px] font-mono text-[#bef264] w-10 shrink-0 pt-0.5">{clock(l.t)}</span>
                    <span className="text-[13px] text-neutral-200 leading-snug">{l.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
