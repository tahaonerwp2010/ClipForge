import React from 'react';
import { VideoGradingConfig, InnerFramingConfig } from '../../types/clipper';
import { 
  SunMedium, 
  Contrast, 
  Droplets, 
  RotateCcw, 
  Sparkles, 
  Lock, 
  Unlock, 
  Crop, 
  Zap, 
  Thermometer,
  UserCheck
} from 'lucide-react';

interface VideoGradeTabProps {
  grading: VideoGradingConfig;
  onGradingChange: (grading: VideoGradingConfig) => void;
  framing?: InnerFramingConfig;
  onFramingChange?: (framing: InnerFramingConfig) => void;
}

export const VideoGradeTab: React.FC<VideoGradeTabProps> = ({
  grading,
  onGradingChange,
  framing,
  onFramingChange
}) => {
  const isFillCropActive = framing?.mode === 'fill-crop';
  const isAutoReframingOn = Boolean(framing?.autoReframing);

  const handleToggleAutoReframing = () => {
    if (!framing || !onFramingChange || !isFillCropActive) return;
    onFramingChange({
      ...framing,
      autoReframing: !isAutoReframingOn
    });
  };

  const fx = { enabled: false, intensity: 'subtle' as const, zoom: true, flash: true, sfx: true, sfxDb: -6, ...(grading.fx || {}) };
  const setFx = (patch: Partial<typeof fx>) => onGradingChange({ ...grading, fx: { ...fx, ...patch } });
  const handleSwitchToFillCrop = () => {
    if (!framing || !onFramingChange) return;
    onFramingChange({
      ...framing,
      mode: 'fill-crop',
      autoReframing: true
    });
  };

  const handleReset = () => {
    onGradingChange({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      warmth: 100,
      grain: false,
      vignette: false,
      speedBoost: 1.0,
      fx: grading.fx
    });
  };

  return (
    <div className="space-y-6 text-neutral-200 text-xs">
      
      {/* ========================================================
          2. COLOR GRADING (ALL RANGES 0% TO 200%)
      ======================================================== */}
      <section className="space-y-4">
        {/* Header with Reset */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Footage Color Grading & Effects
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Adjust exposure, punchy contrast, saturation and warmth from 0% to 200%.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111e18] hover:bg-[#1c3026] text-neutral-300 hover:text-white text-xs border border-[#20322a] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-[#8fd0a4]" />
            <span>Reset (100%)</span>
          </button>
        </div>

        {/* Sliders from 0% to 200% */}
        <div className="space-y-4">
          
          {/* Exposure / Brightness (0% to 200%) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#0b1410] border border-[#172820]">
            <div className="flex justify-between items-center text-[11px] text-neutral-300">
              <span className="flex items-center gap-2 font-semibold">
                <SunMedium className="w-3.5 h-3.5 text-amber-400" />
                <span>Exposure / Brightness</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={grading.brightness}
                  onChange={(e) => onGradingChange({ 
                    ...grading, 
                    brightness: Math.max(0, Math.min(200, parseInt(e.target.value) || 0)) 
                  })}
                  className="w-12 px-1.5 py-0.5 rounded bg-black border border-[#23372e] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                />
                <span className="font-mono text-neutral-400 text-[10px]">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={grading.brightness}
              onChange={(e) => onGradingChange({ ...grading, brightness: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>0% (Dark)</span>
              <span className="text-neutral-400">100% (Default)</span>
              <span>200% (High Bright)</span>
            </div>
          </div>

          {/* Punchy Contrast (0% to 200%) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#0b1410] border border-[#172820]">
            <div className="flex justify-between items-center text-[11px] text-neutral-300">
              <span className="flex items-center gap-2 font-semibold">
                <Contrast className="w-3.5 h-3.5 text-cyan-400" />
                <span>Punchy Contrast</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={grading.contrast}
                  onChange={(e) => onGradingChange({ 
                    ...grading, 
                    contrast: Math.max(0, Math.min(200, parseInt(e.target.value) || 0)) 
                  })}
                  className="w-12 px-1.5 py-0.5 rounded bg-black border border-[#23372e] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                />
                <span className="font-mono text-neutral-400 text-[10px]">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={grading.contrast}
              onChange={(e) => onGradingChange({ ...grading, contrast: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>0% (Flat)</span>
              <span className="text-neutral-400">100% (Default)</span>
              <span>200% (Deep Contrast)</span>
            </div>
          </div>

          {/* Color Saturation (0% to 200%) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#0b1410] border border-[#172820]">
            <div className="flex justify-between items-center text-[11px] text-neutral-300">
              <span className="flex items-center gap-2 font-semibold">
                <Droplets className="w-3.5 h-3.5 text-rose-400" />
                <span>Color Saturation</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={grading.saturation}
                  onChange={(e) => onGradingChange({ 
                    ...grading, 
                    saturation: Math.max(0, Math.min(200, parseInt(e.target.value) || 0)) 
                  })}
                  className="w-12 px-1.5 py-0.5 rounded bg-black border border-[#23372e] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                />
                <span className="font-mono text-neutral-400 text-[10px]">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={grading.saturation}
              onChange={(e) => onGradingChange({ ...grading, saturation: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>0% (Black & White)</span>
              <span className="text-neutral-400">100% (Natural)</span>
              <span>200% (Vibrant Pop)</span>
            </div>
          </div>

          {/* Color Temperature / Warmth (0% to 200%, 100% is Neutral) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#0b1410] border border-[#172820]">
            <div className="flex justify-between items-center text-[11px] text-neutral-300">
              <span className="flex items-center gap-2 font-semibold">
                <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                <span>Color Temperature (Warmth)</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={grading.warmth}
                  onChange={(e) => onGradingChange({ 
                    ...grading, 
                    warmth: Math.max(0, Math.min(200, parseInt(e.target.value) || 0)) 
                  })}
                  className="w-12 px-1.5 py-0.5 rounded bg-black border border-[#23372e] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                />
                <span className="font-mono text-neutral-400 text-[10px]">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={grading.warmth}
              onChange={(e) => onGradingChange({ ...grading, warmth: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>0% (Cool Blue)</span>
              <span className="text-neutral-400">100% (Balanced Neutral)</span>
              <span>200% (Warm Golden)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Optical Effects & Speed Boost */}
      <section className="space-y-3 pt-3 border-t border-[#172820]">
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
          Cinematic Finish & Retention Boost
        </label>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Vignette */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0b1410] border border-[#1a2c24] hover:border-[#273d32] cursor-pointer transition-colors">
            <div>
              <div className="text-xs font-bold text-white">Cinematic Dark Vignette</div>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Darkens edges subtly to concentrate eye attention on the center speaker.
              </p>
            </div>
            <input
              type="checkbox"
              checked={grading.vignette}
              onChange={(e) => onGradingChange({ ...grading, vignette: e.target.checked })}
              className="w-4 h-4 accent-[#bef264] rounded cursor-pointer"
            />
          </label>

          {/* 1.05x Speed Ramping */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0b1410] border border-[#1a2c24] hover:border-[#273d32] cursor-pointer transition-colors">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>1.05x Viral Pacing Boost</span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Tightens dead micro-pauses between sentences without altering pitch, boosting retention.
              </p>
            </div>
            <input
              type="checkbox"
              checked={grading.speedBoost === 1.05}
              onChange={(e) => onGradingChange({ ...grading, speedBoost: e.target.checked ? 1.05 : 1.0 })}
              className="w-4 h-4 accent-[#bef264] rounded cursor-pointer"
            />
          </label>
        </div>
      </section>


      {/* AUTO EFFECTS */}
      <section className="space-y-3 p-4 rounded-xl bg-[#0b1410] border border-[#172820]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Auto Effects (VFX + SFX)</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">Adds punch-in zoom, flash and sound effects on the strongest moments of each clip.</p>
          </div>
          <button type="button" onClick={() => setFx({ enabled: !fx.enabled })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${fx.enabled ? 'bg-[#3f9a5a] border-[#3f9a5a] text-black' : 'bg-[#111e18] border-[#20322a] text-neutral-300'}`}>{fx.enabled ? 'ON' : 'OFF'}</button>
        </div>
        {fx.enabled && (<>
          <div className="flex gap-2">
            {([['subtle', 'Subtle'], ['balanced', 'Balanced'], ['wild', 'Wild']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFx({ intensity: id })}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${fx.intensity === id ? 'bg-[#1c3026] border-[#3f9a5a] text-[#8fd0a4]' : 'bg-[#111e18] border-[#20322a] text-neutral-400'}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-neutral-300">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.zoom} onChange={e => setFx({ zoom: e.target.checked })} /> Punch-in zoom</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.flash} onChange={e => setFx({ flash: e.target.checked })} /> Flash (Balanced / Wild)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.sfx} onChange={e => setFx({ sfx: e.target.checked })} /> Sound effects</label>
          </div>
          {fx.sfx && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-300"><span>Sound effects volume</span><span className="font-mono text-[#8fd0a4]">{fx.sfxDb} dB</span></div>
              <input type="range" min={-18} max={0} value={fx.sfxDb} onChange={e => setFx({ sfxDb: parseInt(e.target.value) })} className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer" />
            </div>
          )}
          <p className="text-[10px] text-neutral-500">Your own sounds live in Settings → Sounds. Effects are applied while rendering (a little extra time) and show up in the finished clip, not in the preview.</p>
        </>)}
      </section>
    </div>
  );
};
