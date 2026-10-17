import { LicenseService } from '../../services/licenseService';
import { hookLines } from '../../utils/captionHelpers';
import React, { useEffect, useRef, useState } from 'react';
import { BrandingConfig } from '../../types/clipper';
import { 
  Sparkles, 
  Flame, 
  AtSign, 
  Type, 
  Move, 
  Palette, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Upload,
  Trash2,
  Music,
  Play,
  Pause
} from 'lucide-react';
import { FontPicker } from '../common/FontPicker';
import { ColorPicker } from '../common/ColorPicker';

interface BrandingTabProps {
  branding: BrandingConfig;
  onBrandingChange: (branding: BrandingConfig) => void;
  clipTitle?: string;
}

const AVAILABLE_FONTS = [
  { id: 'Montserrat', name: 'Montserrat (Bold Viral)', font: '"Montserrat", sans-serif' },
  { id: 'Bebas Neue', name: 'Bebas Neue (Tall Punch)', font: '"Bebas Neue", sans-serif' },
  { id: 'Syne', name: 'Syne (Ultra Modern)', font: '"Syne", sans-serif' },
  { id: 'Righteous', name: 'Righteous (Retro Action)', font: '"Righteous", sans-serif' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono (Tech)', font: '"JetBrains Mono", monospace' }
];

const COLOR_PALETTE = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Lime', hex: '#bef264' },
  { name: 'Cyan', hex: '#38bdf8' },
  { name: 'Coral', hex: '#fb7185' },
  { name: 'Purple', hex: '#c084fc' }
];

const HOOK_SUGGESTIONS = [
  'WAIT TILL THE END 😱',
  'THIS CHANGED EVERYTHING 💡',
  'HOW TO WIN IN 2026 📈',
  'THE BRUTAL REALITY 🚨',
  'NOBODY TALKS ABOUT THIS 🤫'
];


const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const dbToGain = (db: number) => Math.pow(10, db / 20);

const MusicSection: React.FC<{ branding: BrandingConfig; onBrandingChange: (b: BrandingConfig) => void }> = ({ branding, onBrandingChange }) => {
  const m = branding.bgMusic;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = () => { audioRef.current?.pause(); setPlaying(false); };
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  useEffect(() => { if (audioRef.current && m) audioRef.current.volume = Math.min(1, dbToGain(m.volumeDb)); }, [m?.volumeDb]);

  const pick = async () => {
    stop();
    const f = await window.electronAPI?.pickAudio?.();
    if (!f) return;
    const a = new Audio(f.url);
    const set = (duration: number) => onBrandingChange({ ...branding, bgMusic: { ...f, duration, startSec: 0, volumeDb: m?.volumeDb ?? -18, fade: m?.fade ?? true } });
    a.onloadedmetadata = () => set(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => set(0);
    audioRef.current = a;
  };

  const toggle = () => {
    if (!m) return;
    if (!audioRef.current || audioRef.current.src !== m.url) audioRef.current = new Audio(m.url);
    const a = audioRef.current;
    if (playing) { stop(); return; }
    a.volume = Math.min(1, dbToGain(m.volumeDb));
    a.currentTime = m.startSec;
    a.onended = () => setPlaying(false);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const update = (patch: Partial<NonNullable<BrandingConfig['bgMusic']>>) => m && onBrandingChange({ ...branding, bgMusic: { ...m, ...patch } });

  return (
    <section className={`p-4 rounded-xl border transition-all ${m ? 'bg-[#0e1a15] border-[#3f9a5a] shadow-md shadow-[#3f9a5a]/10' : 'bg-[#0b1410] border-[#1a2c24]'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${m ? 'bg-[#3f9a5a]/20 text-[#8fd0a4]' : 'bg-neutral-800 text-neutral-400'}`}>
          <Music className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-wider text-white">Background Music</h3>
      </div>
      <p className="text-[11px] text-neutral-400 mt-1">Add your own song and choose which part plays under every clip.</p>

      {!m ? (
        <button type="button" onClick={pick}
          className="mt-3 w-full py-5 rounded-lg border border-dashed border-[#293f35] hover:border-[#3f9a5a] text-neutral-300 hover:text-[#8fd0a4] flex flex-col items-center gap-1 cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          <span className="text-[11px] font-bold">Add music</span>
          <span className="text-[10px] text-neutral-500">MP3, WAV, M4A, AAC, OGG, FLAC</span>
        </button>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-[#09100d] border border-[#1a2c24]">
            <button type="button" onClick={toggle} title={playing ? 'Pause preview' : 'Preview from the selected start'}
              className="w-9 h-9 rounded-full bg-[#bef264] text-black flex items-center justify-center cursor-pointer shrink-0">
              {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-white truncate">{m.name}</div>
              <div className="text-[10px] text-neutral-500">{m.duration ? `Length ${fmtTime(m.duration)}` : 'Length unknown'}</div>
              <div className="flex gap-3 mt-0.5">
                <button type="button" onClick={pick} className="text-[10px] text-[#8fd0a4] hover:underline cursor-pointer font-bold">Change</button>
                <button type="button" onClick={() => { stop(); onBrandingChange({ ...branding, bgMusic: undefined }); }}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer font-bold flex items-center gap-1"><Trash2 className="w-2.5 h-2.5" />Remove</button>
              </div>
            </div>
          </div>

          {/* Start point */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-300 font-semibold">Start the song at</span>
              <span className="font-mono text-[#8fd0a4] font-bold">{fmtTime(m.startSec)}{m.duration ? ` / ${fmtTime(m.duration)}` : ''}</span>
            </div>
            <input type="range" min={0} max={Math.max(1, Math.floor((m.duration || 600) - 1))} step={0.5} value={m.startSec}
              onChange={(e) => { const v = Number(e.target.value); update({ startSec: v }); if (playing && audioRef.current) audioRef.current.currentTime = v; }}
              className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]" />
            <p className="text-[10px] text-neutral-500">Every clip starts the music from this point. If the song ends before the clip does, it loops.</p>
          </div>

          {/* Volume in dB */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-300 font-semibold">Music volume</span>
              <span className="font-mono text-[#8fd0a4] font-bold">{m.volumeDb > 0 ? '+' : ''}{m.volumeDb} dB</span>
            </div>
            <input type="range" min={-60} max={12} step={1} value={m.volumeDb}
              onChange={(e) => update({ volumeDb: Number(e.target.value) })}
              className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]" />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>-60 dB (quiet)</span>
              <button type="button" onClick={() => update({ volumeDb: -18 })} className="hover:text-white cursor-pointer underline">Reset to -18 dB</button>
              <span>+12 dB (loud)</span>
            </div>
            <p className="text-[10px] text-neutral-500">The speaker's voice stays at its original level. Around -18 dB keeps the music under the voice.</p>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={m.fade !== false} onChange={(e) => update({ fade: e.target.checked })} className="accent-[#bef264]" />
            Fade the music in and out
          </label>
        </div>
      )}
    </section>
  );
};

export const BrandingTab: React.FC<BrandingTabProps> = ({
  branding,
  onBrandingChange,
  clipTitle = 'AI CODING REVOLUTION 2026'
}) => {
  const isAutoTitleOn = branding.autoTitle?.enabled ?? false;
  const [open, setOpen] = useState<Record<string, boolean>>({});          // every settings block starts collapsed
  const OpenBtn = ({ id }: { id: string }) => (
    <button type="button" onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))}
      className="mt-3 text-[11px] font-bold text-[#8fd0a4] hover:underline cursor-pointer flex items-center gap-1">
      {open[id] ? 'Hide settings ▴' : 'Show settings ▾'}
    </button>
  );

  const pickWatermarkImage = async () => {
    const img = await window.electronAPI?.pickImage?.();
    if (img) { onBrandingChange({ ...branding, watermarkType: 'image', watermarkImage: img }); return; }
    if (window.electronAPI?.pickImage) return;          // user cancelled
    // browser preview fallback
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.png,.jpg,.jpeg,.jfif,.webp,image/*';
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => onBrandingChange({ ...branding, watermarkType: 'image', watermarkImage: { path: '', name: f.name, dataUrl: String(r.result) } });
      r.readAsDataURL(f);
    };
    input.click();
  };

  const handleToggleAutoTitle = () => {
    if (!isAutoTitleOn && !LicenseService.guard()) return;
    onBrandingChange({
      ...branding,
      autoTitle: {
        ...branding.autoTitle,
        enabled: !isAutoTitleOn,
        title: branding.autoTitle?.title || clipTitle.toUpperCase()
      }
    });
  };

  const handleRegenerateTitle = () => {
    const viralTitles = [
      'THE UNTOLD TRUTH ABOUT CODING 🤯',
      'WHY 99% OF DEVS WILL FAIL 🚨',
      'THIS WILL REPLACE EVERYTHING ⚡',
      'STOP MAKING THIS MISTAKE NOW ❌',
      'THE 1% SECRET REVEALED 🤫'
    ];
    const randomTitle = viralTitles[Math.floor(Math.random() * viralTitles.length)];
    onBrandingChange({
      ...branding,
      autoTitle: {
        ...branding.autoTitle,
        title: randomTitle
      }
    });
  };

  return (
    <div className="space-y-6 text-neutral-200 text-xs">
      
      {/* ========================================================
          1. AI AUTO TITLE (AI DECIDES TITLE FOR EACH CLIP)
      ======================================================== */}
      <section className={`p-4 rounded-xl border transition-all ${
        isAutoTitleOn 
          ? 'bg-[#0e1a15] border-[#3f9a5a] shadow-md shadow-[#3f9a5a]/10' 
          : 'bg-[#0b1410] border-[#1a2c24]'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                isAutoTitleOn ? 'bg-[#3f9a5a]/20 text-[#8fd0a4]' : 'bg-neutral-800 text-neutral-400'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Auto Hook (AI text on the video)</span>
              </h3>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isAutoTitleOn
                  ? 'bg-[#3f9a5a]/20 text-[#8fd0a4] border-[#3f9a5a]/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {isAutoTitleOn ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed max-w-xl">
              AI writes a short two-line hook for each clip and sizes it to fit. Customize font, colour and position, or drag it directly in the phone preview.
            </p>
          </div>

          {/* Master ON / OFF Switch */}
          <button
            type="button"
            onClick={handleToggleAutoTitle}
            className={`w-13 h-7 rounded-full p-1 transition-all cursor-pointer relative shadow-inner shrink-0 ${
              isAutoTitleOn ? 'bg-[#bef264]' : 'bg-[#1d3228]'
            }`}
            title={isAutoTitleOn ? 'Disable Auto Hook' : 'Enable Auto Hook'}
          >
            <div className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform duration-200 flex items-center justify-center ${
              isAutoTitleOn ? 'translate-x-6' : 'translate-x-0'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isAutoTitleOn ? 'bg-[#bef264]' : 'bg-neutral-500'}`} />
            </div>
          </button>
        </div>

        {/* When Auto Hook is ON: Sub-settings expand */}
        {isAutoTitleOn  && <OpenBtn id="title" />}
        {isAutoTitleOn  && open.title && (
          <div className="mt-4 pt-4 border-t border-[#1a2b16] space-y-4">
            {/* Generated Title Preview / Manual Edit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Type className="w-3 h-3 text-[#8fd0a4]" />
                  <span>Sample hook (preview only — every clip gets its own AI hook):</span>
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateTitle}
                  className="text-[10px] text-[#8fd0a4] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>New sample</span>
                </button>
              </div>
              <input
                type="text"
                value={branding.autoTitle?.title || clipTitle.toUpperCase()}
                onChange={(e) => onBrandingChange({
                  ...branding,
                  autoTitle: {
                    ...branding.autoTitle,
                    title: e.target.value
                  }
                })}
                placeholder="AI CLIP TITLE"
                className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-xs text-white uppercase font-black tracking-wide placeholder-neutral-500 focus:outline-none"
              />
            </div>

            {/* Title font */}
            <FontPicker
              label="Hook Font"
              value={branding.autoTitle?.fontFamily || 'Montserrat Black'}
              onChange={(f) => onBrandingChange({ ...branding, autoTitle: { ...branding.autoTitle, fontFamily: f || 'Montserrat Black' } })}
            />

            {/* Title colour */}
            <ColorPicker
              label="Hook Color:"
              value={branding.autoTitle?.color || '#ffffff'}
              onChange={(hex) => onBrandingChange({ ...branding, autoTitle: { ...branding.autoTitle, color: hex } })}
            />

            {/* Title animation (off by default) */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-neutral-300">Hook animation <span className="text-neutral-500 font-normal">(off by default)</span></span>
              {([
                ['In animation', 'animIn', [['none', 'None'], ['fade', 'Fade in'], ['pop', 'Pop'], ['slide-up', 'Slide up']]],
                ['Out animation', 'animOut', [['none', 'None'], ['fade', 'Fade out'], ['shrink', 'Shrink']]],
                ['Show hook for', 'showSeconds', [['0', 'Whole clip'], ['3', '3 s'], ['5', '5 s'], ['8', '8 s']]],
              ] as Array<[string, 'animIn' | 'animOut' | 'showSeconds', Array<[string, string]>]>).map(([label, key, opts]) => {
                const cur = key === 'showSeconds' ? String(branding.autoTitle?.showSeconds || 0) : String((branding.autoTitle as any)?.[key] || 'none');
                return (
                  <div key={key} className="flex items-center gap-2 flex-wrap">
                    <span className="w-24 text-[11px] text-neutral-400">{label}</span>
                    {opts.map(([v, l]) => (
                      <button key={v} type="button"
                        onClick={() => onBrandingChange({ ...branding, autoTitle: { ...branding.autoTitle, [key]: key === 'showSeconds' ? Number(v) : v } })}
                        className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer transition-colors ${cur === v ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`}>{l}</button>
                    ))}
                  </div>
                );
              })}
              <p className="text-[10px] text-neutral-500">Out animation plays at the end of the time the hook is shown.</p>
            </div>

            {/* Font Size & Positions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="space-y-2 md:col-span-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-24 text-[11px] text-neutral-400">Lines</span>
                  {[1, 2, 3].map(n => (
                    <button key={n} type="button" onClick={() => onBrandingChange({ ...branding, autoTitle: { ...branding.autoTitle, lines: n as 1 | 2 | 3 } })}
                      className={`px-3 py-1 rounded-full text-[11px] cursor-pointer transition-colors ${(branding.autoTitle?.lines || 2) === n ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`}>{n} line{n > 1 ? 's' : ''}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-24 text-[11px] text-neutral-400">Size</span>
                  <button type="button" onClick={() => onBrandingChange({ ...branding, autoTitle: { ...branding.autoTitle, size: branding.autoTitle?.size ? undefined : 90 } })}
                    className={`px-3 py-1 rounded-full text-[11px] cursor-pointer transition-colors ${!branding.autoTitle?.size ? 'bg-[#12201a] border border-[#3f9a5a] text-[#8fd0a4] font-bold' : 'bg-[#0f1c16] border border-[#1d3228] text-neutral-400 hover:text-white'}`}>Auto</button>
                  {branding.autoTitle?.size ? (() => {
                    const ls = hookLines(branding.autoTitle?.title || clipTitle || 'THE VIRAL TRUTH', branding.autoTitle?.lines || 2);
                    const maxLen = Math.max(4, ...ls.map(l => l.length));
                    const fitMax = Math.max(40, Math.min(140, Math.floor((1080 * 0.92) / (maxLen * 0.64))));
                    const val = Math.min(branding.autoTitle.size as number, fitMax);
                    return (<>
                      <input type="range" min={30} max={fitMax} value={val} onChange={(e) => onBrandingChange({ ...branding, autoTitle: { ...branding.autoTitle, size: parseInt(e.target.value) } })} className="w-40 h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer" />
                      <span className="font-mono text-[11px] text-[#8fd0a4]">{val}</span>
                      <span className="text-[10px] text-neutral-500">max {fitMax} for this text · use more lines for a bigger size</span>
                    </>);
                  })() : null}
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed">The AI writes every hook for the number of lines you choose, in the size you choose. It only makes the text smaller when it would not fit on the screen at all.</p>
              </div>

              {/* Position X */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Position X (Horizontal):</span>
                  <span className="font-mono text-[#8fd0a4] font-bold">
                    {branding.autoTitle?.positionX ?? 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={branding.autoTitle?.positionX ?? 50}
                  onChange={(e) => onBrandingChange({
                    ...branding,
                    autoTitle: {
                      ...branding.autoTitle,
                      positionX: Number(e.target.value)
                    }
                  })}
                  className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
                />
              </div>

              {/* Position Y */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Position Y (Vertical):</span>
                  <span className="font-mono text-[#8fd0a4] font-bold">
                    {branding.autoTitle?.positionY ?? 10}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={branding.autoTitle?.positionY ?? 10}
                  onChange={(e) => onBrandingChange({
                    ...branding,
                    autoTitle: {
                      ...branding.autoTitle,
                      positionY: Number(e.target.value)
                    }
                  })}
                  className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
                />
              </div>
            </div>

            {/* Direct Manipulation Guide */}
            <div className="p-2 rounded-lg bg-[#09100d] border border-[#1a2c24] text-[10px] text-neutral-400 flex items-center gap-2">
              <Move className="w-3 h-3 text-[#8fd0a4] shrink-0" />
              <span>
                <strong>Drag & Drop:</strong> You can click and drag the Auto Hook directly on the mobile phone preview screen to position it anywhere!
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================
          2. TOP HOOK TITLE BANNER
      ======================================================== */}
      <section className={`p-4 rounded-xl border transition-all ${
        branding.showHookTitle 
          ? 'bg-[#0e1a15] border-[#3f9a5a]/70 shadow-sm' 
          : 'bg-[#0b1410] border-[#1a2c24]'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                branding.showHookTitle ? 'bg-amber-400/20 text-amber-400' : 'bg-neutral-800 text-neutral-400'
              }`}>
                <Flame className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Top Banner
              </h3>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                branding.showHookTitle
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {branding.showHookTitle ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Eye-catching top hook that drives curiosity in the first 3 seconds of the short.
            </p>
          </div>

          {/* Banner ON/OFF Toggle */}
          <button
            type="button"
            onClick={() => onBrandingChange({ ...branding, showHookTitle: !branding.showHookTitle })}
            className={`w-13 h-7 rounded-full p-1 transition-all cursor-pointer relative shadow-inner shrink-0 ${
              branding.showHookTitle ? 'bg-[#bef264]' : 'bg-[#1d3228]'
            }`}
            title={branding.showHookTitle ? 'Disable Top Banner' : 'Enable Top Banner'}
          >
            <div className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform duration-200 flex items-center justify-center ${
              branding.showHookTitle ? 'translate-x-6' : 'translate-x-0'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${branding.showHookTitle ? 'bg-[#bef264]' : 'bg-neutral-500'}`} />
            </div>
          </button>
        </div>

        {branding.showHookTitle  && <OpenBtn id="hook" />}
        {branding.showHookTitle  && open.hook && (
          <div className="mt-4 pt-4 border-t border-[#1a2b16] space-y-4">
            {/* Banner Text Input */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-neutral-300">Banner Text:</span>
              <input
                type="text"
                value={branding.hookTitle}
                onChange={(e) => onBrandingChange({ ...branding, hookTitle: e.target.value })}
                placeholder="e.g. WAIT TILL THE END 😱"
                className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-xs text-white uppercase font-black placeholder-neutral-500 focus:outline-none"
              />
            </div>

            <FontPicker
              label="Banner Font"
              value={branding.hookFontFamily || 'Montserrat Black'}
              onChange={(f) => onBrandingChange({ ...branding, hookFontFamily: f || 'Montserrat Black' })}
            />
            <ColorPicker
              label="Banner Text Color:"
              value={branding.hookTextColor || (branding.bannerShowBackground !== false ? '#000000' : '#ffffff')}
              onChange={(hex) => onBrandingChange({ ...branding, hookTextColor: hex })}
            />

            {/* Quick Viral Hook Templates */}
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400">Quick viral hook presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {HOOK_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => onBrandingChange({ ...branding, hookTitle: sug })}
                    className="text-[10px] bg-[#09100d] hover:bg-[#13221b] text-neutral-300 hover:text-white px-2 py-1 rounded border border-[#1a2c24] transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* BACKGROUND ON / OFF TOGGLE (Requested by user) */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#09100d] border border-[#1a2c24]">
              <div>
                <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  {branding.bannerShowBackground !== false ? (
                    <Eye className="w-3.5 h-3.5 text-[#8fd0a4]" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                  <span>Banner Background Fill</span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Turn ON for solid badge pill, or OFF for transparent floating punch text.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onBrandingChange({
                  ...branding,
                  bannerShowBackground: branding.bannerShowBackground === false ? true : false
                })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  branding.bannerShowBackground !== false
                    ? 'bg-[#bef264] text-black border-[#3f9a5a]'
                    : 'bg-[#111e18] text-neutral-400 border-[#1d3228]'
                }`}
              >
                {branding.bannerShowBackground !== false ? 'Background: ON' : 'Background: OFF'}
              </button>
            </div>

            {/* Badge background colour */}
            {branding.bannerShowBackground !== false && (
              <ColorPicker
                label="Banner Background Color:"
                value={branding.hookBgColor || '#bef264'}
                onChange={(hex) => onBrandingChange({ ...branding, hookBgColor: hex })}
              />
            )}

            {/* Position X and Y */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Position X:</span>
                  <span className="font-mono text-[#8fd0a4] font-bold">
                    {branding.bannerPositionX ?? 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={branding.bannerPositionX ?? 50}
                  onChange={(e) => onBrandingChange({
                    ...branding,
                    bannerPositionX: Number(e.target.value)
                  })}
                  className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Position Y:</span>
                  <span className="font-mono text-[#8fd0a4] font-bold">
                    {branding.bannerPositionY ?? 6}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={branding.bannerPositionY ?? 6}
                  onChange={(e) => onBrandingChange({
                    ...branding,
                    bannerPositionY: Number(e.target.value)
                  })}
                  className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
                />
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#09100d] border border-[#1a2c24] text-[10px] text-neutral-400 flex items-center gap-2">
              <Move className="w-3 h-3 text-[#8fd0a4] shrink-0" />
              <span>
                <strong>Direct Drag:</strong> You can click and drag the Banner directly on the mobile phone preview!
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================
          3. CREATOR WATERMARK / HANDLE
      ======================================================== */}
      <section className={`p-4 rounded-xl border transition-all ${
        branding.showWatermark 
          ? 'bg-[#0e1a15] border-[#3f9a5a]/70 shadow-sm' 
          : 'bg-[#0b1410] border-[#1a2c24]'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                branding.showWatermark ? 'bg-cyan-400/20 text-cyan-400' : 'bg-neutral-800 text-neutral-400'
              }`}>
                <AtSign className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Watermark / Channel Handle
              </h3>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                branding.showWatermark
                  ? 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {branding.showWatermark ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Protects your content and directs viewers to your social media or YouTube handle.
            </p>
          </div>

          {/* Watermark ON/OFF Toggle */}
          <button
            type="button"
            onClick={() => onBrandingChange({ ...branding, showWatermark: !branding.showWatermark })}
            className={`w-13 h-7 rounded-full p-1 transition-all cursor-pointer relative shadow-inner shrink-0 ${
              branding.showWatermark ? 'bg-[#bef264]' : 'bg-[#1d3228]'
            }`}
            title={branding.showWatermark ? 'Disable Watermark' : 'Enable Watermark'}
          >
            <div className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform duration-200 flex items-center justify-center ${
              branding.showWatermark ? 'translate-x-6' : 'translate-x-0'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${branding.showWatermark ? 'bg-[#bef264]' : 'bg-neutral-500'}`} />
            </div>
          </button>
        </div>

        {branding.showWatermark  && <OpenBtn id="mark" />}
        {branding.showWatermark  && open.mark && (
          <div className="mt-4 pt-4 border-t border-[#1a2b16] space-y-4">
            {/* Text or image */}
            <div className="grid grid-cols-2 gap-2">
              {(['text', 'image'] as const).map(t => (
                <button key={t} type="button" onClick={() => onBrandingChange({ ...branding, watermarkType: t })}
                  className={`py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                    (branding.watermarkType || 'text') === t ? 'bg-[#bef264] text-black border-[#3f9a5a]' : 'bg-[#0d1712] text-neutral-300 border-[#1b2f26] hover:border-[#2c4439]'}`}>
                  {t === 'text' ? 'Add text' : 'Add image'}
                </button>
              ))}
            </div>

            {(branding.watermarkType || 'text') === 'text' ? (
              <>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-300">Watermark Text:</span>
                  <input
                    type="text"
                    value={branding.creatorHandle}
                    onChange={(e) => onBrandingChange({ ...branding, creatorHandle: e.target.value })}
                    placeholder="@your_handle"
                    className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
                  />
                </div>
                <FontPicker
                  label="Watermark Font"
                  value={branding.watermarkFontFamily || 'Arial'}
                  onChange={(f) => onBrandingChange({ ...branding, watermarkFontFamily: f || 'Arial' })}
                />
                <ColorPicker
                  label="Watermark Color:"
                  value={branding.watermarkColor || '#ffffff'}
                  onChange={(hex) => onBrandingChange({ ...branding, watermarkColor: hex })}
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-400">Text Size:</span>
                    <span className="font-mono text-[#8fd0a4] font-bold">{branding.watermarkFontSize ?? 40}</span>
                  </div>
                  <input type="range" min={20} max={100} value={branding.watermarkFontSize ?? 40}
                    onChange={(e) => onBrandingChange({ ...branding, watermarkFontSize: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]" />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {branding.watermarkImage ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-[#09100d] border border-[#1a2c24]">
                    <div className="w-14 h-14 rounded-md bg-[repeating-conic-gradient(#222_0%_25%,#333_0%_50%)] bg-[length:10px_10px] flex items-center justify-center overflow-hidden shrink-0">
                      <img src={branding.watermarkImage.dataUrl} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-white truncate">{branding.watermarkImage.name}</div>
                      <div className="flex gap-3 mt-1">
                        <button type="button" onClick={pickWatermarkImage} className="text-[10px] text-[#8fd0a4] hover:underline cursor-pointer font-bold">Change</button>
                        <button type="button" onClick={() => onBrandingChange({ ...branding, watermarkImage: undefined })} className="text-[10px] text-rose-400 hover:underline cursor-pointer font-bold flex items-center gap-1"><Trash2 className="w-2.5 h-2.5" />Remove</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={pickWatermarkImage}
                    className="w-full py-5 rounded-lg border border-dashed border-[#293f35] hover:border-[#3f9a5a] text-neutral-300 hover:text-[#8fd0a4] flex flex-col items-center gap-1 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-[11px] font-bold">Upload image</span>
                    <span className="text-[10px] text-neutral-500">PNG, JPG, JPEG, JFIF or WEBP</span>
                  </button>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-400">Image Size:</span>
                    <span className="font-mono text-[#8fd0a4] font-bold">{branding.watermarkImageSize ?? 20}%</span>
                  </div>
                  <input type="range" min={5} max={80} value={branding.watermarkImageSize ?? 20}
                    onChange={(e) => onBrandingChange({ ...branding, watermarkImageSize: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-400">Opacity:</span>
                    <span className="font-mono text-[#8fd0a4] font-bold">{branding.watermarkOpacity ?? 100}%</span>
                  </div>
                  <input type="range" min={10} max={100} value={branding.watermarkOpacity ?? 100}
                    onChange={(e) => onBrandingChange({ ...branding, watermarkOpacity: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]" />
                </div>
              </div>
            )}

            {/* Position X and Y */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Position X:</span>
                  <span className="font-mono text-[#8fd0a4] font-bold">
                    {branding.watermarkPositionX ?? 20}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={branding.watermarkPositionX ?? 20}
                  onChange={(e) => onBrandingChange({
                    ...branding,
                    watermarkPositionX: Number(e.target.value)
                  })}
                  className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-400">Position Y:</span>
                  <span className="font-mono text-[#8fd0a4] font-bold">
                    {branding.watermarkPositionY ?? 92}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={branding.watermarkPositionY ?? 92}
                  onChange={(e) => onBrandingChange({
                    ...branding,
                    watermarkPositionY: Number(e.target.value)
                  })}
                  className="w-full h-1.5 bg-[#16271f] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
                />
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#09100d] border border-[#1a2c24] text-[10px] text-neutral-400 flex items-center gap-2">
              <Move className="w-3 h-3 text-[#8fd0a4] shrink-0" />
              <span>
                <strong>Direct Drag:</strong> You can click and drag the Watermark directly on the phone preview!
              </span>
            </div>
          </div>
        )}
      </section>

      <MusicSection branding={branding} onBrandingChange={onBrandingChange} />
    </div>
  );
};
