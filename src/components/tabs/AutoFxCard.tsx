import React from 'react';

export const DEFAULT_FX = { enabled: false, intensity: 'subtle' as 'subtle' | 'balanced' | 'wild', zoom: true, flash: true, shake: true, glitch: true, color: true, sfx: true, sfxDb: -6 };
export type FxState = typeof DEFAULT_FX;

export const AutoFxCard: React.FC<{ fx: FxState; setFx: (patch: Partial<FxState>) => void }> = ({ fx, setFx }) => (
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
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.zoom} onChange={e => setFx({ zoom: e.target.checked })} /> Zoom effects (punch, push, pull, pulse)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.flash} onChange={e => setFx({ flash: e.target.checked })} /> Flash (flash, dip, strobe, negative)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.shake} onChange={e => setFx({ shake: e.target.checked })} /> Motion (shake, tilt, whip-pan)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.glitch} onChange={e => setFx({ glitch: e.target.checked })} /> Glitch (glitch, VHS, chromatic)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.color !== false} onChange={e => setFx({ color: e.target.checked })} /> Colour looks (mono, colour pop, glow, blur)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={fx.sfx} onChange={e => setFx({ sfx: e.target.checked })} /> Sound effects</label>
          </div>
          {fx.sfx && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-300"><span>Sound effects volume</span><span className="font-mono text-[#8fd0a4]">{fx.sfxDb} dB</span></div>
              <input type="range" min={-18} max={0} value={fx.sfxDb} onChange={e => setFx({ sfxDb: parseInt(e.target.value) })} className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer" />
            </div>
          )}
          <p className="text-[10px] text-neutral-500">ClipForge picks from 76 built-in sound effects (whooshes, hits, risers, reward sounds, camera clicks, glitches, memes). Effects are applied while rendering (a little extra time) and show up in the finished clip, not in the preview.</p>
        </>)}
    </section>
);
