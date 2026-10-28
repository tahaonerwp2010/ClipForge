import React, { useState, useEffect } from 'react';
import { OuterCanvasRatio } from '../types/clipper';
import { ProTag } from './common/ProTag';
import { 
  Check, 
  Sparkles, 
  Cpu, 
  HardDrive, 
  X,
  Layers,
  ArrowRight
} from 'lucide-react';

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGeneration: (quality: number) => void;
  canvasRatio: OuterCanvasRatio;
  filePath?: string;
  shortsPath?: string;
  shortsPaths?: string[];
  extraPaths?: string[];
  mainDims?: [number, number];
}

const CLASSES: { q: number; label: string; dims: string }[] = [
  { q: 2160, label: '4K', dims: '3840×2160' },
  { q: 1440, label: '1440p', dims: '2560×1440' },
  { q: 1080, label: '1080p', dims: '1920×1080' },
  { q: 720, label: '720p', dims: '1280×720' },
  { q: 480, label: '480p', dims: '854×480' },
];

export const GenerateModal: React.FC<GenerateModalProps> = ({
  isOpen,
  onClose,
  onStartGeneration,
  canvasRatio,
  filePath,
  shortsPath,
  shortsPaths,
  extraPaths,
  mainDims
}) => {
  const [selected, setSelected] = useState<number>(0);   // 0 = Auto
  const [src, setSrc] = useState<[number, number] | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  // Look at every video that will be used (long video, all short clips, split-screen partner) and offer only sizes ALL of them can really provide.
  const pathKey = JSON.stringify([filePath, shortsPath, shortsPaths, extraPaths]);
  useEffect(() => {
    if (!isOpen) return;
    let dead = false;
    setSelected(0); setSrc(null); setFailed(false);
    const paths = Array.from(new Set([filePath, shortsPath, ...(shortsPaths || []), ...(extraPaths || [])].filter(Boolean) as string[])).slice(0, 40);
    const dims: [number, number][] = mainDims ? [mainDims] : [];
    if (!paths.length || !window.electronAPI?.probeVideo) { if (dims.length) setSrc(dims[0]); else setFailed(true); return; }
    setChecking(true);
    (async () => {
      const q = paths.slice();
      const worker = async () => { while (q.length) { const p = q.shift()!; try { const i = await window.electronAPI!.probeVideo!(p); if (i?.width && i?.height) dims.push([i.width, i.height]); } catch { /* skip this file */ } } };
      await Promise.all([worker(), worker(), worker()]);
      if (dead) return;
      if (dims.length) { dims.sort((a, b) => Math.min(a[0], a[1]) - Math.min(b[0], b[1])); setSrc(dims[0]); setFailed(false); }   // the smallest video decides, so nothing gets upscaled
      else setFailed(true);
      setChecking(false);
    })();
    return () => { dead = true; };
  }, [isOpen, pathKey, mainDims]);

  if (!isOpen) return null;

  // Quality = the source's shorter side (1080 for a 1920×1080 video, 2160 for 4K). Only sizes up to the source are offered, so nothing is upscaled.
  const srcShort = src ? Math.min(src[0], src[1]) : 1080;   // unknown size (could not be read): offer the safe sizes up to 1080p
  let avail = CLASSES.filter(c => srcShort >= c.q * 0.93);
  if (!avail.length) avail = [{ q: Math.max(240, Math.round(srcShort / 2) * 2), label: `${srcShort}p`, dims: src ? `${Math.max(src[0], src[1])}×${srcShort}` : '' }];
  const autoQ = (avail.find(c => c.q <= 1080) || avail[avail.length - 1]).q;
  const options = [{ q: 0, label: 'Auto', dims: (avail.find(c => c.q === autoQ) || avail[0]).dims, badge: true }, ...avail.map(c => ({ ...c, badge: false }))];
  const effective = selected === 0 ? autoQ : selected;
  const effLabel = (avail.find(c => c.q === effective) || avail[0]).label;
  const srcText = src ? `${Math.max(src[0], src[1])}×${Math.min(src[0], src[1])}` : checking ? 'being checked…' : 'unknown size';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-neutral-800/80">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">How big should the clips be?</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Your source is {srcText}. Clips are exported as {canvasRatio} (vertical).
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resolution Options */}
        <div className="p-6 space-y-4">
          {failed && !checking && <p className="text-[11px] text-amber-300">ClipForge could not read the video size, so the safe sizes are shown.</p>}
          <div className={`grid grid-cols-3 gap-2.5 ${checking ? 'opacity-50 pointer-events-none' : ''}`}>
            {options.map((opt) => {
              const isSelected = selected === opt.q;
              return (
                <button
                  key={opt.q}
                  onClick={() => setSelected(opt.q)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-neutral-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                        {opt.label}
                      </span>
                      {opt.q > 1080 && <ProTag />}
                      {opt.badge && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          BEST
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-neutral-400 mt-1">
                      {opt.dims}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-[11px] text-neutral-400 space-y-1">
            <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Cloud Local Processing</span>
            </div>
            <p>
              Auto picks the best size for your computer (up to 1080p). Higher sizes such as 4K look sharper but take much longer to render. Only sizes your video can really provide are shown, so nothing is stretched.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-neutral-950/60 border-t border-neutral-800/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            Back
          </button>

          <button
            disabled={checking}
            onClick={() => onStartGeneration(effective)}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>{checking ? 'Checking your video…' : `Generate at ${effLabel}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
