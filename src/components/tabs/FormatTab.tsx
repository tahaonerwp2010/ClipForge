import React, { useState } from 'react';
import { 
  OuterCanvasRatio, 
  InnerFramingConfig, 
  InnerFramingMode 
} from '../../types/clipper';
import { 
  Layers, 
  Crop, 
  Split, 
  AlertCircle,
  SlidersHorizontal,
  UserCheck
} from 'lucide-react';

import { SplitConfig } from '../../types/clipper';
import { FacecamEditor } from '../FacecamEditor';
interface FormatTabProps {
  canvasRatio: OuterCanvasRatio;
  onCanvasRatioChange: (ratio: OuterCanvasRatio) => void;
  framing: InnerFramingConfig;
  onFramingChange: (framing: InnerFramingConfig) => void;
  clipLength: 'auto' | '15s' | '30s' | '45s' | '60s' | '90s';
  onClipLengthChange: (length: 'auto' | '15s' | '30s' | '45s' | '60s' | '90s') => void;
  clipsCount: number;
  onClipsCountChange: (count: number) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  aiPrompt: string;
  shortsMode?: boolean;
  split?: SplitConfig | null;
  onSplitChange?: (s: SplitConfig) => void;
  onAiPromptChange: (v: string) => void;
}


const SliderRow: React.FC<{ label: string; value: number; unit: string; min: number; max: number; onChange: (v: number) => void }> =
  ({ label, value, unit, min, max, onChange }) => (
  <div>
    <div className="flex justify-between text-neutral-300 mb-1 text-[11px]">
      <span>{label}</span>
      <span className="font-mono text-[#8fd0a4]">{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1 bg-[#1d3228] rounded appearance-none accent-[#bef264]" />
  </div>
);

const BackgroundPicker: React.FC<{ framing: InnerFramingConfig; onFramingChange: (f: InnerFramingConfig) => void }> = ({ framing, onFramingChange }) => {
  const bg = framing.fitBackground || 'blur';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-neutral-300 text-[11px]">
        <span>Background</span>
        <div className="flex gap-1.5">
          {(['blur', 'black'] as const).map(opt => (
            <button key={opt} type="button"
              onClick={(e) => { e.stopPropagation(); onFramingChange({ ...framing, fitBackground: opt }); }}
              className={`px-3 py-1 rounded-full text-[11px] capitalize cursor-pointer transition-colors ${
                bg === opt ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`}>
              {opt === 'blur' ? 'Blurred' : 'Black'}
            </button>
          ))}
        </div>
      </div>
      {bg === 'blur' && (
        <SliderRow label="Backdrop Blur" value={framing.blurIntensity} unit="px" min={6} max={32}
          onChange={(v) => onFramingChange({ ...framing, blurIntensity: v })} />
      )}
    </div>
  );
};

const AutoReframeControls: React.FC<{ framing: InnerFramingConfig; onFramingChange: (f: InnerFramingConfig) => void }> = ({ framing, onFramingChange }) => {
  const on = Boolean(framing.autoReframing);
  return (
    <div className="space-y-2 text-[11px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-white font-semibold flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-[#8fd0a4]" />AI Auto-Reframing</div>
          <div className="text-neutral-400">Follows the speaker's face and keeps them centred.</div>
        </div>
        <button type="button" onClick={() => onFramingChange({ ...framing, autoReframing: !on })}
          className={`w-11 h-6 rounded-full p-0.5 transition-all cursor-pointer shrink-0 ${on ? 'bg-[#bef264]' : 'bg-[#1d3228]'}`}
          title={on ? 'Turn off AI auto-reframing' : 'Turn on AI auto-reframing'}>
          <div className={`w-5 h-5 rounded-full bg-black transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      {on && (
        <div className="grid grid-cols-2 gap-2">
          {([['smart-cut', 'Smart Cut (instant)'], ['smooth-pan', 'Smooth Pan']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => onFramingChange({ ...framing, trackingStyle: id })}
              className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                (framing.trackingStyle || 'smart-cut') === id ? 'bg-[#bef264] text-black border-[#3f9a5a]' : 'bg-[#0d1712] text-neutral-300 border-[#1b2f26] hover:border-[#2c4439]'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const FormatTab: React.FC<FormatTabProps> = ({
  canvasRatio,
  onCanvasRatioChange,
  framing,
  onFramingChange,
  clipLength,
  onClipLengthChange,
  clipsCount,
  onClipsCountChange,
  language,
  onLanguageChange,
  aiPrompt,
  onAiPromptChange,
  shortsMode = false,
  split = null,
  onSplitChange
}) => {
  const [fcEditor, setFcEditor] = useState(false);
  const [useHardware, setUseHardware] = useState<'gpu' | 'cpu'>('cpu');
  const [clipInputError, setClipInputError] = useState<string | null>(null);

  // All 5 Aspect Ratios are active & functional!
  const aspectRatios: Array<{ id: OuterCanvasRatio; label: string; desc: string }> = [
    { id: '9:16', label: '9:16', desc: '1080×1920 · Vertical (Shorts/Reels/TikTok)' },
    { id: '4:5', label: '4:5', desc: '1080×1350 · Instagram Portrait Feed' },
    { id: '1:1', label: '1:1', desc: '1080×1080 · Square Feed' },
    { id: '4:3', label: '4:3', desc: '1440×1080 · Standard Video' },
    { id: '16:9', label: '16:9', desc: '1920×1080 · Widescreen Landscape' }
  ];

  const handleClipsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      onClipsCountChange(1);
      setClipInputError(null);
      return;
    }

    const num = parseInt(rawVal, 10);
    if (isNaN(num)) return;

    if (num > 50) {
      onClipsCountChange(50);
      setClipInputError('Maximum limit is 50 clips. You cannot generate more than 50 clips at once.');
    } else if (num < 1) {
      onClipsCountChange(1);
      setClipInputError('At least 1 clip is required.');
    } else {
      onClipsCountChange(num);
      setClipInputError(null);
    }
  };

  const getDimensionLabel = () => {
    const matched = aspectRatios.find(a => a.id === canvasRatio);
    return matched ? matched.desc : `up to 1080×1920 · ${canvasRatio}`;
  };

  return (
    <div className="space-y-4 text-neutral-200 text-xs">
      
      {/* 1. PROCESSING SECTION */}
      <section className="space-y-2 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
        <h3 className="font-bold uppercase tracking-wider text-neutral-400 text-[11px]">
          Processing
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-xs mr-1">Use</span>
          <button
            type="button"
            onClick={() => setUseHardware('gpu')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              useHardware === 'gpu'
                ? 'bg-[#bef264] text-black font-bold'
                : 'bg-[#122019] text-neutral-400 hover:text-white border border-[#1d3228]'
            }`}
          >
            Graphics card
          </button>
          <button
            type="button"
            onClick={() => setUseHardware('cpu')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              useHardware === 'cpu'
                ? 'bg-[#bef264] text-black font-bold shadow-sm'
                : 'bg-[#122019] text-neutral-400 hover:text-white border border-[#1d3228]'
            }`}
          >
            Processor only
          </button>
        </div>

        <div className="space-y-0.5 text-[11px] text-neutral-400 font-mono">
          <div>Cutting and reframing: <span className="text-neutral-300">the processor, because you chose that</span></div>
          <div>Transcribing speech: <span className="text-neutral-300">the processor, because you chose that</span></div>
        </div>
      </section>

      {split && onSplitChange && (
        <section className="space-y-3 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
          <h3 className="font-bold uppercase tracking-wider text-neutral-400 text-[11px]">Split screen layout</h3>
          <p className="text-[11px] text-neutral-500 leading-relaxed">Drag the lime bar in the phone preview to resize the two sections. Drag inside a section to move its picture, and scroll over it to zoom.</p>
          {(() => {
            const set = (patch: Partial<SplitConfig>) => onSplitChange({ ...split, ...patch });
            const chip = (on: boolean) => `px-3 py-1 rounded-full text-xs cursor-pointer transition-colors ${on ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`;
            const view = (pos: 'top' | 'bottom', label: string) => (
              <div className="flex items-center gap-2">
                <span className="w-28 text-neutral-400">{label} zoom</span>
                <input type="range" min={1} max={3} step={0.05} value={split[pos].zoom} onChange={(e) => set({ [pos]: { ...split[pos], zoom: parseFloat(e.target.value) } } as any)} className="flex-1 accent-[#bef264]" />
                <span className="w-10 text-right font-mono text-[#8fd0a4]">{split[pos].zoom.toFixed(2)}x</span>
                <button type="button" onClick={() => set({ [pos]: { zoom: 1, panX: 0, panY: 0 } } as any)} className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer">Reset</button>
              </div>
            );
            const topIsFace = !split.swap;
            return (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-28 text-neutral-400">Top section</span>
                  <span className="text-white font-semibold">{topIsFace ? (split.mode === 'single' ? 'Facecam' : split.mode === 'two' ? 'Facecam video' : 'Your video') : (split.mode === 'single' ? 'Game / screen' : split.mode === 'two' ? 'Game video' : 'Background footage')}</span>
                  <button type="button" onClick={() => set({ swap: !split.swap })} className={chip(false) + ' ml-auto'}>Swap top / bottom</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 text-neutral-400">Top height</span>
                  <input type="range" min={25} max={75} step={1} value={split.splitPct} onChange={(e) => set({ splitPct: parseInt(e.target.value) })} className="flex-1 accent-[#bef264]" />
                  <span className="w-20 text-right font-mono text-[#8fd0a4]">{split.splitPct}% / {100 - split.splitPct}%</span>
                </div>
                {view('top', 'Top')}
                {view('bottom', 'Bottom')}
                <div className="flex items-center gap-2">
                  <span className="w-28 text-neutral-400">Divider</span>
                  <input type="range" min={0} max={24} step={1} value={split.gap} onChange={(e) => set({ gap: parseInt(e.target.value) })} className="flex-1 accent-[#bef264]" />
                  <span className="w-10 text-right font-mono text-[#8fd0a4]">{split.gap}px</span>
                  <input type="color" value={split.gapColor || '#000000'} onChange={(e) => set({ gapColor: e.target.value })} className="w-7 h-7 bg-transparent border border-[#1d3228] rounded cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 text-neutral-400">Facecam corners</span>
                  <input type="range" min={0} max={80} step={2} value={split.radius} onChange={(e) => set({ radius: parseInt(e.target.value) })} className="flex-1 accent-[#bef264]" />
                  <span className="w-10 text-right font-mono text-[#8fd0a4]">{split.radius}px</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-28 text-neutral-400">{split.mode === 'single' ? 'Game view' : 'Second video'}</span>
                  <button type="button" onClick={() => set({ gameFit: 'fill' })} className={chip(split.gameFit === 'fill')}>Fill (crop)</button>
                  <button type="button" onClick={() => set({ gameFit: 'fit' })} className={chip(split.gameFit === 'fit')}>Fit (blurred backdrop)</button>
                </div>
                {split.mode === 'two' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-28 text-neutral-400">Sound</span>
                    {([['face', 'Facecam'], ['game', 'Game'], ['mix', 'Both']] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => set({ audio: v })} className={chip(split.audio === v)}>{l}</button>
                    ))}
                    <span className="ml-2 text-neutral-400">Offset</span>
                    <input type="number" step={0.1} value={split.offset} onChange={(e) => set({ offset: parseFloat(e.target.value) || 0 })} className="w-20 bg-[#0f1c16] border border-[#1d3228] rounded-lg px-2 py-1 font-mono text-white text-center focus:outline-none" />
                    <span className="text-neutral-400">s</span>
                  </div>
                )}
                {split.mode === 'single' && split.frame && (
                  <button type="button" onClick={() => setFcEditor(true)} className={chip(false)}>Adjust facecam area</button>
                )}
                {fcEditor && split.frame && (
                  <FacecamEditor frame={split.frame} dims={split.mainDims} rect={split.facecam} onApply={(r) => { set({ facecam: r }); setFcEditor(false); }} onClose={() => setFcEditor(false)} />
                )}
              </div>
            );
          })()}
        </section>
      )}

      {!split && (<>
      {/* 2. FORMAT / ASPECT RATIO (Every button works and updates preview immediately!) */}
      <section className="space-y-2.5 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
        <h3 className="font-bold uppercase tracking-wider text-neutral-400 text-[11px]">
          Format
        </h3>

        {!shortsMode && (<div>
          <span className="text-neutral-400 block mb-1.5 font-medium">ASPECT RATIO</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {aspectRatios.map((item) => {
              const isSelected = canvasRatio === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onCanvasRatioChange(item.id)}
                  className={`px-3.5 py-1 rounded-full text-xs transition-all cursor-pointer font-semibold ${
                    isSelected
                      ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] shadow-sm ring-1 ring-[#3f9a5a]/40 scale-105'
                      : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white hover:border-[#324f41]'
                  }`}
                  title={item.desc}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-[#8fd0a4] font-mono mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#bef264]" />
            <span>Target frame: {getDimensionLabel()}</span>
          </div>
        </div>)}

        {/* INNER VIDEO FRAMING */}
        <div className="space-y-2 pt-2">
          <span className="text-neutral-300 block font-bold text-xs">
            INNER VIDEO FRAMING & LAYOUT
          </span>

          <div className="grid grid-cols-1 gap-2">
            {/* Mode A: Fit */}
            <div
              onClick={() => onFramingChange({ ...framing, mode: 'fit-blur' })}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                framing.mode === 'fit-blur'
                  ? 'bg-[#0e1b15] border-[#3f9a5a] ring-1 ring-[#3f9a5a]/40'
                  : 'bg-[#0d1813] border-[#182921] hover:border-[#263c32]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#8fd0a4]" />
                  <span>Fit</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#3f9a5a]/20 text-[#8fd0a4] font-bold">
                  POPULAR
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Shows the full widescreen video inside the frame. Great for podcasts and interviews.
              </p>

              {framing.mode === 'fit-blur' && (
                <div className="mt-3 pt-2.5 border-t border-[#1d3228] space-y-3 text-[11px]">
                  <BackgroundPicker framing={framing} onFramingChange={onFramingChange} />
                  <SliderRow label="Corner Radius" value={framing.innerBorderRadius} unit="px" min={0} max={24}
                    onChange={(v) => onFramingChange({ ...framing, innerBorderRadius: v })} />
                </div>
              )}
            </div>

            {/* Mode B: Full Crop & Pan */}
            <div
              onClick={() => onFramingChange({ ...framing, mode: 'fill-crop' })}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                framing.mode === 'fill-crop'
                  ? 'bg-[#0e1b15] border-[#3f9a5a] ring-1 ring-[#3f9a5a]/40'
                  : 'bg-[#0d1813] border-[#182921] hover:border-[#263c32]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Crop className="w-3.5 h-3.5 text-[#8fd0a4]" />
                  <span>Full Crop & Pan (Face Focus)</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Fills the full canvas frame. Pan left or right to frame the talking speaker.
              </p>

              {framing.mode === 'fill-crop' && (
                <div className="mt-3 pt-2.5 border-t border-[#1d3228] space-y-3">
                  <AutoReframeControls framing={framing} onFramingChange={onFramingChange} />
                  {!framing.autoReframing && (
                    <SliderRow label="Horizontal Pan" value={framing.panX} unit="%" min={-50} max={50}
                      onChange={(v) => onFramingChange({ ...framing, panX: v })} />
                  )}
                </div>
              )}
            </div>

            {/* Mode D: Custom */}
            <div
              onClick={() => onFramingChange({ ...framing, mode: 'custom-scale' })}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                framing.mode === 'custom-scale'
                  ? 'bg-[#0e1b15] border-[#3f9a5a] ring-1 ring-[#3f9a5a]/40'
                  : 'bg-[#0d1813] border-[#182921] hover:border-[#263c32]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#8fd0a4]" />
                  <span>Custom</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Set the zoom, position and rounded corners yourself. You can also drag the video in the preview.
              </p>

              {framing.mode === 'custom-scale' && (
                <div className="mt-3 pt-2.5 border-t border-[#1d3228] space-y-3 text-[11px]">
                  <SliderRow label="Zoom" value={framing.customScale} unit="%" min={50} max={250}
                    onChange={(v) => onFramingChange({ ...framing, customScale: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    {!framing.autoReframing && (
                      <SliderRow label="Horizontal Position" value={framing.offsetX ?? 0} unit="%" min={-50} max={50}
                        onChange={(v) => onFramingChange({ ...framing, offsetX: v })} />
                    )}
                    <SliderRow label="Vertical Position" value={framing.offsetY} unit="%" min={-50} max={50}
                      onChange={(v) => onFramingChange({ ...framing, offsetY: v })} />
                  </div>
                  <SliderRow label="Corner Radius" value={framing.innerBorderRadius} unit="px" min={0} max={24}
                    onChange={(v) => onFramingChange({ ...framing, innerBorderRadius: v })} />
                  <BackgroundPicker framing={framing} onFramingChange={onFramingChange} />
                  <div className="pt-2 border-t border-[#1d3228]">
                    <AutoReframeControls framing={framing} onFramingChange={onFramingChange} />
                  </div>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); onFramingChange({ ...framing, customScale: 100, offsetX: 0, offsetY: 0 }); }}
                    className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer">
                    Reset zoom & position
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      </>)}

      {!shortsMode && (<>
      {/* 3. CLIP LENGTH */}
      <section className="space-y-2 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-neutral-300 text-[11px]">CLIP LENGTH</span>
          <span className="text-[11px] text-neutral-500">a target, not a hard cut</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['auto', '15s', '30s', '45s', '60s', '90s'] as const).map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => onClipLengthChange(len)}
              className={`px-3 py-1 rounded-full text-xs capitalize transition-colors cursor-pointer ${
                clipLength === len
                  ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold'
                  : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'
              }`}
            >
              {len}
            </button>
          ))}
        </div>
      </section>

      {/* 4. NUMBER OF CLIPS (INPUT ONLY, MAX 50 LIMIT AS REQUESTED!) */}
      <section className="space-y-2 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-neutral-300 text-[11px]">NUMBER OF CLIPS</span>
            <span className="text-[11px] text-neutral-500">Choose your desired number of clips (Max 50)</span>
          </div>
          <span className="font-mono text-[10px] text-neutral-400">Limit: 1 - 50</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <input
                type="number"
                min={1}
                max={50}
                value={clipsCount}
                onChange={handleClipsInputChange}
                className="w-28 bg-[#0f1c16] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-1.5 text-sm font-bold text-white font-mono text-center focus:outline-none transition-colors"
              />
              <span className="ml-2 text-xs text-neutral-400 font-medium">clips</span>
            </div>
          </div>

          {/* Warning banner if user tries to exceed 50 */}
          {clipInputError && (
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[11px] text-rose-300 flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{clipInputError}</span>
            </div>
          )}
        </div>
      </section>

      {/* AI PROMPT (optional) */}
      <section className="space-y-2 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-neutral-300 text-[11px]">AI PROMPT</span>
          <span className="text-[10px] text-neutral-500">optional</span>
        </div>
        <textarea
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value.slice(0, 600))}
          rows={3}
          placeholder="Tell the AI the scenario or scene you want, e.g. “funny moments about money” or “the podcast host (curly hair) must appear in the first 5 seconds”"
          className="w-full bg-[#0f1c16] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none resize-none transition-colors"
        />
        <p className="text-[10px] text-neutral-500 leading-relaxed">Leave it empty and ClipForge picks the best moments by itself. With a prompt, AI Boost (Gemini) finds, cuts and reframes clips to match it. Without a Gemini key only the topic words are used.</p>
      </section>

      </>)}

      {/* 5. CAPTION LANGUAGE */}
      <section className="space-y-2 p-4 rounded-2xl bg-[#0b1611] border border-[#17291f]">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-neutral-300 text-[11px]">CAPTION LANGUAGE</span>
          <span className="text-[11px] text-neutral-500">Spoken language is detected automatically</span>
        </div>

        {(() => {
          const OTHER: [string, string][] = [['ur', 'Urdu'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['bn', 'Bengali'], ['pa', 'Punjabi'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['tr', 'Turkish'], ['ru', 'Russian'], ['id', 'Indonesian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['fa', 'Persian'], ['ta', 'Tamil'], ['te', 'Telugu'], ['nl', 'Dutch'], ['pl', 'Polish']];
          const cur = ['auto', 'As spoken', 'Hinglish', 'hinglish', 'English', 'en'].includes(language) ? (language === 'Hinglish' ? 'hinglish' : language === 'English' ? 'en' : language === 'As spoken' ? 'auto' : language) : 'other';
          const chip = (active: boolean) => `px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${active ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => onLanguageChange('auto')} className={chip(cur === 'auto')}>As spoken</button>
              <button type="button" onClick={() => onLanguageChange('hinglish')} className={chip(cur === 'hinglish')}>Hinglish</button>
              <button type="button" onClick={() => onLanguageChange('en')} className={chip(cur === 'en')}>English</button>
              <select value={cur === 'other' ? language : ''} onChange={(e) => e.target.value && onLanguageChange(e.target.value)}
                className={`${chip(cur === 'other')} appearance-none pr-6`}>
                <option value="">Other language…</option>
                {OTHER.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </div>
          );
        })()}

        <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
          Hinglish = Hindi/Urdu speech written in English letters (Roman). Other languages are written in their own script.
          The spoken language is detected from the first 30 seconds — that is all the model reads. If the video changes language part-way through, set it by hand above.
        </p>
      </section>
    </div>
  );
};
