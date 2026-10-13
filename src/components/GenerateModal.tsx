import React, { useState } from 'react';
import { OuterCanvasRatio } from '../types/clipper';
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
  onStartGeneration: (resolution: '1080p' | '720p' | 'auto') => void;
  canvasRatio: OuterCanvasRatio;
}

export const GenerateModal: React.FC<GenerateModalProps> = ({
  isOpen,
  onClose,
  onStartGeneration,
  canvasRatio
}) => {
  const [selectedRes, setSelectedRes] = useState<'1080p' | '720p' | 'auto'>('auto');

  if (!isOpen) return null;

  const resolutionOptions = [
    {
      id: 'auto' as const,
      label: 'Auto',
      dimensions: '1080×1920',
      badge: 'RECOMMENDED',
      desc: 'Matches native source pixels 1:1 without upscaling artifacts.'
    },
    {
      id: '1080p' as const,
      label: '1080p',
      dimensions: '1080×1920',
      desc: 'Full HD vertical master for YouTube Shorts & Instagram.'
    },
    {
      id: '720p' as const,
      label: '720p',
      dimensions: '720×1280',
      desc: 'Faster rendering, smaller disk size (~60% smaller).'
    }
  ];

  const getTargetDims = () => {
    if (selectedRes === '720p') return '720×1280';
    return '1080×1920';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-neutral-800/80">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">How big should the clips be?</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Your source is 1920×1080 (16:9). Target output is {canvasRatio} Mobile Canvas.
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
          <div className="grid grid-cols-3 gap-2.5">
            {resolutionOptions.map((opt) => {
              const isSelected = selectedRes === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedRes(opt.id)}
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
                      {opt.badge && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          BEST
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-neutral-400 mt-1">
                      {opt.dimensions}
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
              Auto keeps the footage's own crisp pixels — never stretched, never interpolated. All clips render directly in your browser with hardware acceleration.
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
            onClick={() => onStartGeneration(selectedRes)}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Generate at {getTargetDims()}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
