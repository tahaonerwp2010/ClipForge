import { ProTag } from '../common/ProTag';
import React, { useState } from 'react';
import { CaptionConfig } from '../../types/clipper';
import { 
  ChevronDown, 
  ChevronUp, 
  Move, 
  Type,
  Maximize2
} from 'lucide-react';
import { FontPicker } from '../common/FontPicker';
import { isDynStyle } from '../../utils/dynCaptions';
import { CaptionStylePicker } from './CaptionStylePicker';

interface CaptionsTabProps {
  captions: CaptionConfig;
  onCaptionsChange: (captions: CaptionConfig) => void;
  hideLanguage?: boolean;
}

export const CaptionsTab: React.FC<CaptionsTabProps> = ({
  captions,
  onCaptionsChange,
  hideLanguage
}) => {
  // Independent collapsible category states
  const [openPosition, setOpenPosition] = useState(false);
  const [openLang, setOpenLang] = useState(false);

  return (
    <div className="space-y-4 text-neutral-200 text-xs">
      
      {/* ========================================================
          1. MASTER CAPTIONS ON / OFF SWITCH
      ======================================================== */}
      <section className="p-4 rounded-xl bg-[#0b1410] border border-[#172820] flex items-center justify-between shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Type className="w-4 h-4 text-[#8fd0a4]" />
              <span>Captions</span>
            </h2>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase transition-colors ${
              captions.enabled 
                ? 'bg-[#3f9a5a]/20 text-[#8fd0a4] border border-[#3f9a5a]/40 shadow-[0_0_10px_rgba(190,242,100,0.2)]' 
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}>
              {captions.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 max-w-md">
            {captions.enabled 
              ? 'Subtitles are active and will render on exported clips and the mobile preview screen.'
              : 'Captions are disabled. Clips will render clean without subtitles and they are hidden from preview.'}
          </p>
        </div>

        {/* Master Toggle Switch */}
        <button
          type="button"
          onClick={() => onCaptionsChange({ ...captions, enabled: !captions.enabled })}
          className={`w-14 h-7 rounded-full p-1 transition-all duration-300 cursor-pointer relative shadow-inner focus:outline-none focus:ring-2 focus:ring-[#3f9a5a]/40 ${
            captions.enabled ? 'bg-[#bef264]' : 'bg-[#1d3228]'
          }`}
          title={captions.enabled ? 'Turn Captions OFF' : 'Turn Captions ON'}
        >
          <div className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform duration-300 flex items-center justify-center ${
            captions.enabled ? 'translate-x-7' : 'translate-x-0'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${captions.enabled ? 'bg-[#bef264]' : 'bg-neutral-500'}`} />
          </div>
        </button>
      </section>

      {/* When Captions are Off, show a clean informative banner */}
      {!captions.enabled && (
        <div className="p-6 rounded-xl bg-[#0c1712] border border-[#1b2e25] text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-neutral-800/80 flex items-center justify-center mx-auto text-neutral-400">
            <Type className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-xs font-bold text-neutral-200">Captions are turned OFF</p>
          <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
            Switch Captions to <span className="text-[#8fd0a4] font-semibold">ON</span> above to enable subtitle templates, scale, and live drag on the phone preview.
          </p>
          <button
            type="button"
            onClick={() => onCaptionsChange({ ...captions, enabled: true })}
            className="mt-2 px-4 py-1.5 rounded-lg bg-[#bef264] text-black font-extrabold text-[11px] hover:bg-[#d9f99d] transition-colors cursor-pointer"
          >
            Enable Captions Now
          </button>
        </div>
      )}

      {/* When Captions are ON, render closeable Templates and Position/Scale categories */}
      {captions.enabled && (
        <>
          <CaptionStylePicker captions={captions} onCaptionsChange={onCaptionsChange} />

          {/* Caption font */}
          {isDynStyle(captions.style) ? (
          <section className="rounded-xl bg-[#0b1410] border border-[#172820] shadow-md p-4">
            <div className="text-xs font-black uppercase tracking-wider text-white">Caption Font</div>
            <p className="text-[11px] text-neutral-400 mt-1.5">Locked: Dynamic Captions use their own fonts. Pick a classic style to choose a custom font.</p>
          </section>
          ) : <section className="rounded-xl bg-[#0b1410] border border-[#172820] shadow-md p-4">
            <FontPicker
              label="Caption Font"
              value={captions.fontFamily}
              defaultLabel="Style default"
              onChange={(f) => onCaptionsChange({ ...captions, fontFamily: f })}
            />
            <p className="text-[10px] text-neutral-500 mt-2">Pick any font for your captions. "Style default" keeps the font that comes with the caption style.</p>
          </section>}

{!hideLanguage && <section className="rounded-xl bg-[#0b1410] border border-[#172820] overflow-hidden shadow-md">
            <button type="button" onClick={() => setOpenLang(!openLang)} className="w-full p-4 flex items-center justify-between cursor-pointer">
              <span className="text-xs font-black uppercase tracking-wider text-white">Language {(captions.translateTo || captions.romanScript) && <span className="ml-2 text-[10px] text-[#8fd0a4]">ON</span>}</span>
              {openLang ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {openLang && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300">Translate captions to</label>
                  <select value={captions.translateTo || (captions.romanScript ? 'Hinglish' : '')} onChange={e => onCaptionsChange({ ...captions, translateTo: e.target.value, romanScript: false })}
                    className="mt-1 w-full bg-[#09100d] border border-[#20322a] rounded-lg px-3 py-2 text-xs text-white outline-none">
                    <option value="">Off (keep spoken language)</option>
                    <option value="Hinglish">Hinglish (Hindi / Urdu in English letters)</option>
                    {['English', 'Urdu', 'Hindi', 'Arabic', 'Spanish', 'French', 'German', 'Turkish', 'Indonesian'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <p className="text-[10px] text-neutral-500">Uses AI Boost (Gemini). Without a working API key these are skipped and captions stay as spoken.</p>
              </div>
            )}
          </section>}

{/* ========================================================
              CATEGORY 2: POSITION & SCALE (Closeable / Collapsible)
              No lower limit on scale (can go down to 0)!
          ======================================================== */}
          <section className="rounded-xl bg-[#0b1410] border border-[#172820] overflow-hidden shadow-md">
            <div
              onClick={() => setOpenPosition(!openPosition)}
              className="p-3.5 px-4 flex items-center justify-between cursor-pointer hover:bg-[#111e18] transition-colors border-b border-[#172820]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#3f9a5a]/10 border border-[#3f9a5a]/30 flex items-center justify-center">
                  <Move className="w-3.5 h-3.5 text-[#8fd0a4]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                      Position & Scale Controls
                    </h3>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      (X: {captions.positionX}%, Y: {captions.positionY}%, Scale: {captions.fontSize}px)
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Adjust placement on screen & scale without restrictions (down to 0) or drag directly in preview
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="w-7 h-7 rounded-lg bg-[#12201a] flex items-center justify-center text-neutral-400 hover:text-white"
              >
                {openPosition ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {openPosition && (
              <div className="p-4 space-y-4">
                
                {/* Horizontal Position (X-Axis) Slider */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0e1a15] border border-[#1a2c24]">
                  <div className="flex justify-between items-center text-[11px] text-neutral-300">
                    <span className="font-semibold">Horizontal Position (X-Axis)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={captions.positionX}
                        onChange={(e) => onCaptionsChange({ 
                          ...captions, 
                          positionX: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) 
                        })}
                        className="w-12 px-1.5 py-0.5 rounded bg-black border border-[#263b31] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                      />
                      <span className="font-mono text-neutral-400 text-[10px]">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={captions.positionX}
                    onChange={(e) => onCaptionsChange({ ...captions, positionX: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[#1d3228] rounded appearance-none accent-[#bef264] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                    <span>Left (0%)</span>
                    <span className="text-neutral-400">Center (50%)</span>
                    <span>Right (100%)</span>
                  </div>
                </div>

                {/* Vertical Position (Y-Axis) Slider */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0e1a15] border border-[#1a2c24]">
                  <div className="flex justify-between items-center text-[11px] text-neutral-300">
                    <span className="font-semibold">Vertical Position (Y-Axis)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={captions.positionY}
                        onChange={(e) => onCaptionsChange({ 
                          ...captions, 
                          positionY: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) 
                        })}
                        className="w-12 px-1.5 py-0.5 rounded bg-black border border-[#263b31] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                      />
                      <span className="font-mono text-neutral-400 text-[10px]">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={captions.positionY}
                    onChange={(e) => onCaptionsChange({ ...captions, positionY: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[#1d3228] rounded appearance-none accent-[#bef264] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                    <span>Top (0%)</span>
                    <span className="text-neutral-400">Center (50%)</span>
                    <span className="text-[#8fd0a4]">Lower Third (72%)</span>
                    <span>Bottom (100%)</span>
                  </div>
                </div>

                {/* Caption timing fine-tune */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0e1a15] border border-[#1a2c24]">
                  <div className="flex justify-between items-center text-[11px] text-neutral-300">
                    <span className="font-semibold">Caption timing</span>
                    <span className="font-mono text-[#8fd0a4] text-[10px]">{(captions.syncOffset || 0) > 0 ? '+' : ''}{(captions.syncOffset || 0).toFixed(2)}s</span>
                  </div>
                  <input type="range" min={-0.3} max={0.3} step={0.05} value={captions.syncOffset || 0}
                    onChange={(e) => onCaptionsChange({ ...captions, syncOffset: parseFloat(e.target.value) })} className="w-full accent-[#bef264]" />
                  <p className="text-[10px] text-neutral-500 leading-relaxed">Captions too early? Move right (+). Too late? Move left (−). Each step is 0.05 seconds.</p>
                </div>

                {/* Scale / Font Size Slider (CAN GO DOWN TO 0 - NO BOTTOM LIMIT!) */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0e1a15] border border-[#1a2c24]">
                  <div className="flex justify-between items-center text-[11px] text-neutral-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Scale / Size (Can reduce down to 0)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onCaptionsChange({ ...captions, fontSize: Math.max(0, captions.fontSize - 2) })}
                        className="w-6 h-6 rounded bg-[#1a2c24] hover:bg-[#263b31] text-neutral-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                        title="Decrease Size"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={captions.fontSize}
                        onChange={(e) => onCaptionsChange({ 
                          ...captions, 
                          fontSize: Math.max(0, Math.min(80, parseInt(e.target.value) || 0)) 
                        })}
                        className="w-12 px-1 py-0.5 rounded bg-black border border-[#263b31] text-center font-mono text-[#8fd0a4] text-xs font-bold"
                      />
                      <span className="font-mono text-neutral-400 text-[10px]">px</span>
                      <button
                        type="button"
                        onClick={() => onCaptionsChange({ ...captions, fontSize: captions.fontSize + 2 })}
                        className="w-6 h-6 rounded bg-[#1a2c24] hover:bg-[#263b31] text-neutral-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                        title="Increase Size"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={captions.fontSize}
                    onChange={(e) => onCaptionsChange({ ...captions, fontSize: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[#1d3228] rounded appearance-none accent-[#bef264] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                    <span className="text-[#8fd0a4]">Zero / Hidden (0px)</span>
                    <span>Compact (14px)</span>
                    <span>Standard (22px)</span>
                    <span>Large (40px+)</span>
                  </div>
                </div>

                {/* Quick alignment preset buttons */}
                <div className="pt-1 space-y-1.5">
                  <span className="text-[11px] text-neutral-400 font-medium">Quick Alignment:</span>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => onCaptionsChange({ ...captions, positionX: 50, positionY: 20 })}
                      className="px-2 py-1.5 rounded-lg bg-[#111e18] hover:bg-[#1c3026] border border-[#20322a] text-neutral-300 hover:text-white text-[11px] font-semibold text-center cursor-pointer transition-colors"
                    >
                      Top Hook
                    </button>
                    <button
                      type="button"
                      onClick={() => onCaptionsChange({ ...captions, positionX: 50, positionY: 50 })}
                      className="px-2 py-1.5 rounded-lg bg-[#111e18] hover:bg-[#1c3026] border border-[#20322a] text-neutral-300 hover:text-white text-[11px] font-semibold text-center cursor-pointer transition-colors"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() => onCaptionsChange({ ...captions, positionX: 50, positionY: 72 })}
                      className="px-2 py-1.5 rounded-lg bg-[#13211a] hover:bg-[#1b2f26] border border-[#3f9a5a]/40 text-[#8fd0a4] font-bold text-[11px] text-center cursor-pointer transition-colors shadow-sm"
                    >
                      Lower 3rd ⭐
                    </button>
                    <button
                      type="button"
                      onClick={() => onCaptionsChange({ ...captions, positionX: 50, positionY: 86 })}
                      className="px-2 py-1.5 rounded-lg bg-[#111e18] hover:bg-[#1c3026] border border-[#20322a] text-neutral-300 hover:text-white text-[11px] font-semibold text-center cursor-pointer transition-colors"
                    >
                      Bottom
                    </button>
                  </div>
                </div>

                {/* Interactive Phone Drag Notice */}
                <div className="p-3 rounded-lg bg-[#0f1c16] border border-[#3f9a5a]/30 text-[11px] text-neutral-300 flex items-start gap-2.5 shadow-sm">
                  <div className="w-5 h-5 rounded bg-[#3f9a5a]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Move className="w-3.5 h-3.5 text-[#8fd0a4]" />
                  </div>
                  <div className="space-y-0.5 leading-snug">
                    <p className="font-bold text-white">Direct On-Screen Drag & Scale</p>
                    <p className="text-[10px] text-neutral-400">
                      You can also click and drag the captions directly inside the mobile phone preview to position anywhere, and drag the corner handle to scale as small or large as you want (down to 0). Long lines will automatically wrap to the next line.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
