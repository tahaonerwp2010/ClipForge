import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { PhonePreview } from './PhonePreview';
import { CaptionsTab } from './tabs/CaptionsTab';
import { FontPicker } from './common/FontPicker';
import { ColorPicker } from './common/ColorPicker';
import { hookLines } from '../utils/captionHelpers';
import { BrandingConfig, CaptionConfig, GeneratedClip, InnerFramingConfig, VideoGradingConfig } from '../types/clipper';

interface Props {
  clip: GeneratedClip;
  index: number;
  outDir: string;
  onClose: () => void;
  total: number;
  onSaved: (index: number, r: { outputPath: string; thumbnailUrl?: string }) => void;
  fallback: { captions: CaptionConfig; branding: BrandingConfig; grading: VideoGradingConfig; framing: InnerFramingConfig };
}

export const ClipEditor: React.FC<Props> = ({ clip, index, outDir, total, onClose, onSaved, fallback }) => {
  const api: any = (window as any).electronAPI;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');
  const [captions, setCaptions] = useState<CaptionConfig>(fallback.captions);
  const [branding, setBranding] = useState<BrandingConfig>(fallback.branding);
  const [saving, setSaving] = useState(false);
  const [pct, setPct] = useState(0);
  const [job, setJob] = useState('');
  const cur = useRef(0);
  const doneBefore = useRef(0);
  const span = useRef(1);
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
        const b = st.branding || fallback.branding;
        const h = st.clips?.[index]?.hookText || clip.hookText;
        setBranding({ ...fallback.branding, ...b, autoTitle: { ...fallback.branding.autoTitle, ...(b.autoTitle || {}), enabled: true, title: h } });
        const r = await api.editPrepare(outDir, index);
        if (!r?.ok) throw new Error(r?.error || 'Could not prepare the preview.');
        setUrl(r.url); setState('ready');
      } catch (e: any) { setErr(String(e.message || e)); setState('error'); }
    })();
    off = api?.onEditProgress?.((d: any) => { if (d.index === cur.current) { const f = d.p <= 1 ? d.p : d.p / 100; setPct(Math.round((doneBefore.current + f) / span.current * 100)); } });
    return () => { try { off && off(); } catch {} };
  }, []);

  const setHook = (patch: any) => setBranding(b => ({ ...b, autoTitle: { ...b.autoTitle, enabled: true, ...patch } }));
  const save = async (all: boolean) => {
    setSaving(true); setPct(0); setErr('');
    const idx = all ? Array.from({ length: total }, (_, i) => i) : [index];
    span.current = idx.length;
    const at = { ...branding.autoTitle, enabled: true };
    for (let n = 0; n < idx.length; n++) {
      const i = idx[n]; cur.current = i; doneBefore.current = n; setJob(all ? `Clip ${n + 1} of ${idx.length}` : '');
      const own = i === index;
      const { title: _t, ...atNoTitle } = at as any;
      const r = await api.editRender(outDir, i, own ? { captions, hookText, autoTitle: at } : { captions, autoTitle: atNoTitle });
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

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-0 md:p-4">
      <div className="w-full max-w-5xl h-full md:h-[92vh] bg-[#060b09] border border-[#172820] md:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#13211a]">
          <div className="text-sm font-black text-white uppercase tracking-wider">Edit clip <span className="text-[#8fd0a4] normal-case font-semibold ml-2 truncate">{clip.title}</span></div>
          <button onClick={onClose} disabled={saving} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {state === 'loading' && <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparing preview…</div>}
        {state === 'error' && <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-300 text-sm p-8 text-center"><p>{err}</p><button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#12201a] text-white cursor-pointer">Close</button></div>}
        {state === 'ready' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
            <div className="w-full md:w-[380px] shrink-0 flex items-center justify-center p-2 md:p-4 border-b md:border-b-0 md:border-r border-[#13211a] overflow-hidden">
              <PhonePreview
                videoUrl={url} canvasRatio={'9:16' as any} framing={base.current.framing} captions={captions} grading={base.current.grading} branding={branding}
                words={clip.words || []} currentTime={t} duration={dur} isPlaying={playing} onTimeUpdate={setT} onDurationChange={setDur} onTogglePlay={() => setPlaying(p => !p)}
                safeZone={safe} onSafeZoneChange={setSafe} onPanChange={() => {}} onFramingChange={() => {}} onCaptionsChange={setCaptions} onBrandingChange={setBranding}
                clipTitle={hookText} split={undefined as any} onSplitChange={() => {}}
              />
            </div>
            <div className="flex-1 md:overflow-y-auto p-3 md:p-4 space-y-4">
              <CaptionsTab captions={captions} onCaptionsChange={setCaptions} hideLanguage />
              <section className="p-4 rounded-xl bg-[#0b1410] border border-[#172820] space-y-3 text-xs">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Hook</h3>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300">Hook text</label>
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
            </div>
          </div>
        )}
        {state === 'ready' && (
          <div className="px-5 py-3 border-t border-[#13211a] flex items-center justify-between">
            {saving ? (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[#13211a] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: pct + '%' }} /></div>
                <span className="text-xs text-[#8fd0a4] font-mono whitespace-nowrap">{job ? job + ' · ' : ''}Rendering {pct}%</span>
              </div>
            ) : (<>
              <span className="text-[10px] text-neutral-500">Only captions and hook change. Each clip keeps its own hook text when applying to all.</span>
              <div className="flex gap-2">
                <button onClick={() => save(false)} className="px-4 py-2 rounded-lg bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] text-xs font-black flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" /> Apply to this clip</button>
                {total > 1 && <button onClick={() => save(true)} className="px-4 py-2 rounded-lg bg-[#bef264] text-black text-xs font-black cursor-pointer">Apply to all clips ({total})</button>}
              </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  );
};
