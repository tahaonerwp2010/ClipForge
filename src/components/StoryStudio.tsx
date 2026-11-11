// "Script to Short" setup: three sections (Setup, Video, Captions and language). Pressing "Make my short" opens the project page.
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Mic, Music, MonitorPlay, Sparkles, Folder, X, Wand2, Settings2, Film, Captions, Info } from 'lucide-react';
import { StockService } from '../services/stockService';
import { AiService } from '../services/aiService';

type Char = { id: string; name: string; builtin: boolean; count: number; preview: string | null };
export const LANGS = ['English', 'Urdu', 'Hindi', 'Arabic', 'Spanish', 'French', 'German', 'Portuguese', 'Turkish', 'Indonesian', 'Bengali', 'Russian', 'Italian', 'Persian', 'Japanese', 'Korean'];
const ACCENTS = ['#FFD400', '#22E3A1', '#FF3B5C', '#3BA7FF', '#FFFFFF'];
const base = (p: string) => p.split(/[\\/]/).pop() || p;
const card = 'rounded-2xl border border-[#1d3228] bg-[#0b1611] p-4';
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bef264]/70';
const btn = `px-3.5 min-h-[40px] rounded-xl bg-[#14231c] hover:bg-[#21332a] border border-[#263c32] text-neutral-100 font-bold text-xs cursor-pointer flex items-center gap-2 ${ring}`;
const lab = 'text-[11px] font-bold text-neutral-300 mb-2 block';
const field = `w-full min-h-[40px] rounded-lg bg-[#0f1c16] border border-[#1d3228] px-3 text-xs text-white outline-none focus:border-[#3f9a5a] ${ring}`;

const Seg: React.FC<{ value: string; onChange: (v: string) => void; items: [string, string][] }> = ({ value, onChange, items }) => (
  <div className="flex gap-1.5 flex-wrap" role="radiogroup">{items.map(([v, t]) => (
    <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`px-3.5 min-h-[36px] rounded-lg text-[11px] font-bold border cursor-pointer ${ring} ${value === v ? 'bg-[#bef264] text-black border-transparent' : 'bg-[#0f1c16] text-neutral-300 border-[#1d3228] hover:text-white'}`}>{t}</button>
  ))}</div>
);
const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; text: string; hint?: string; disabled?: boolean }> = ({ on, onChange, text, hint, disabled }) => (
  <button type="button" role="switch" aria-checked={on && !disabled} disabled={disabled} onClick={() => onChange(!on)} className={`flex items-start gap-3 text-left w-full rounded-lg ${ring} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
    <span className={`mt-0.5 w-9 h-5 rounded-full shrink-0 relative transition-colors ${on && !disabled ? 'bg-[#3f9a5a]' : 'bg-[#263c32]'}`}><span className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-all ${on && !disabled ? 'left-[19px]' : 'left-[3px]'}`} /></span>
    <span><span className="text-xs font-bold text-neutral-100 block">{text}</span>{hint && <span className="text-[10px] text-neutral-400 block leading-snug">{hint}</span>}</span>
  </button>
);
const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className={card}><h3 className="text-[13px] font-extrabold text-white">{title}</h3>{hint && <p className="text-[11px] text-neutral-400 mt-0.5 mb-3 leading-snug">{hint}</p>}{!hint && <div className="mb-3" />}{children}</section>
);

export interface StoryStart { name: string; voicePath: string; musicPath: string | null; recordings: string[]; options: Record<string, any> }

export const StoryStudio: React.FC<{ onBack: () => void; onSettings: () => void; onStart: (s: StoryStart) => void }> = ({ onBack, onSettings, onStart }) => {
  const api = (window as any).electronAPI;
  const [tab, setTab] = useState<'setup' | 'video' | 'captions'>('setup');
  const [voice, setVoice] = useState<{ path: string; name: string } | null>(null);
  const [music, setMusic] = useState<{ path: string; name: string } | null>(null);
  const [recs, setRecs] = useState<string[]>([]);
  const [chars, setChars] = useState<Char[]>([]);
  const [charId, setCharId] = useState('suit');
  const [motion, setMotion] = useState('bold');
  const [charLevel, setCharLevel] = useState('normal');
  const [sceneMode, setSceneMode] = useState('auto');
  const [captions, setCaptions] = useState(true);
  const [sfx, setSfx] = useState(true);
  const [broll, setBroll] = useState(true);
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [musicVol, setMusicVol] = useState(16);
  const [cta, setCta] = useState('COMMENT "LINK"');
  const [lang, setLang] = useState('');
  const hasStock = StockService.hasAny();
  const hasAi = (() => { try { return !!AiService.forJob(); } catch { return false; } })();

  useEffect(() => { api?.storyCharacters?.().then((c: Char[]) => { setChars(c || []); if (c?.length && !c.find(x => x.id === 'suit')) setCharId(c[0].id); }).catch(() => {}); }, []);
  const pickVoice = async () => { const f = await api?.storyPickVoice?.(); if (f) setVoice(f); };
  const pickMusic = async () => { const f = await api?.pickAudio?.(); if (f) setMusic({ path: f.path, name: f.name || base(f.path) }); };
  const pickRecs = async () => { const f: string[] = (await api?.pickVideos?.()) || []; if (f.length) setRecs(r => [...new Set([...r, ...f])].slice(0, 8)); };

  const start = () => {
    if (!voice) return;
    onStart({
      name: base(voice.path).replace(/\.[^.]+$/, ''), voicePath: voice.path, musicPath: music?.path || null, recordings: recs,
      options: { motion, captions, sfx, broll: broll && hasStock, accent, musicVol, cta: cta.trim(), thumbCta: cta.trim() || 'LINK IN COMMENTS', character: charId !== 'none', characterStyle: charId, charLevel, sceneMode, textLang: lang }
    });
  };

  if (!api?.storyStart) return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[760px] mx-auto p-6"><button onClick={onBack} className={btn}><ArrowLeft className="w-4 h-4" />Back</button>
      <div className={`${card} mt-4 text-sm text-neutral-300`}>Script to Short is available in the desktop app.</div></div></main>
  );

  const TABS: [typeof tab, string, React.ReactNode][] = [['setup', 'Setup', <Settings2 className="w-4 h-4" />], ['video', 'Video', <Film className="w-4 h-4" />], ['captions', 'Captions and language', <Captions className="w-4 h-4" />]];

  return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[1040px] mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className={btn}><ArrowLeft className="w-4 h-4" />Back</button>
        <div><h1 className="text-lg font-extrabold text-white flex items-center gap-2"><Wand2 className="w-5 h-5 text-[#bef264]" />Script to Short</h1>
          <p className="text-[11px] text-neutral-400">Voice-over in, finished short, thumbnails and post texts out.</p></div>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible" role="tablist" aria-label="Sections" onKeyDown={e => { const ids = TABS.map(t => t[0]); const i = ids.indexOf(tab); if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setTab(ids[(i + 1) % ids.length]); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setTab(ids[(i + ids.length - 1) % ids.length]); } }}>
          {TABS.map(([id, t, ic]) => (
            <button key={id} role="tab" id={`tab-${id}`} aria-controls="story-panel" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 flex items-center gap-2.5 px-3.5 min-h-[44px] rounded-xl text-xs font-bold text-left cursor-pointer border ${ring} ${tab === id ? 'bg-[#13241b] border-[#3f9a5a]/60 text-white' : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-[#0f1c16]'}`}>
              <span className={tab === id ? 'text-[#bef264]' : ''}>{ic}</span>{t}</button>
          ))}
          <div className="hidden md:block mt-3 rounded-xl border border-[#1d3228] bg-[#0b1611] p-3 text-[11px] text-neutral-400 leading-relaxed">
            <p className="font-bold text-neutral-200 mb-1">How it works</p>
            1. The AI listens and asks you a few questions.<br />2. You answer (or skip).<br />3. It builds the video, thumbnails and post texts.
          </div>
        </nav>

        <div className="space-y-3 min-w-0" role="tabpanel" id="story-panel" aria-labelledby={`tab-${tab}`}>
          {tab === 'setup' && <>
            <Section title="Voice-over" hint="Any language. This is the only thing you must add.">
              <div className="flex items-center gap-3 flex-wrap"><button onClick={pickVoice} className={btn}><Mic className="w-4 h-4" />{voice ? 'Change file' : 'Choose file'}</button>{voice && <span className="text-[11px] text-[#8fd0a4] truncate max-w-[320px]">{voice.name}</span>}</div>
            </Section>
            <Section title="Background music" hint="Optional. It gets quieter whenever you speak.">
              <div className="flex items-center gap-2 flex-wrap"><button onClick={pickMusic} className={btn}><Music className="w-4 h-4" />{music ? 'Change file' : 'Choose file'}</button>{music && <><span className="text-[11px] text-[#8fd0a4] truncate max-w-[260px]">{music.name}</span><button aria-label="Remove music" className={btn} onClick={() => setMusic(null)}><X className="w-4 h-4" /></button></>}</div>
            </Section>
            <Section title="Screen recordings" hint="Optional. Add them now, or later when the AI asks which part needs a recording.">
              <button onClick={pickRecs} className={btn}><MonitorPlay className="w-4 h-4" />Add recordings</button>
              {recs.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{recs.map(r => <span key={r} className="text-[11px] px-2.5 min-h-[32px] rounded-lg bg-[#14231c] border border-[#1d3228] text-neutral-200 flex items-center gap-1.5 max-w-[260px]"><span className="truncate">{base(r)}</span><button aria-label={`Remove ${base(r)}`} onClick={() => setRecs(x => x.filter(y => y !== r))} className={`cursor-pointer text-neutral-500 hover:text-white rounded ${ring}`}><X className="w-3.5 h-3.5" /></button></span>)}</div>}
            </Section>
          </>}

          {tab === 'video' && <>
            <Section title="Character" hint="Pops in on trigger words like hello, stop, link, free or dollar.">
              <div className="flex justify-end -mt-9 mb-2"><button onClick={() => api.storyOpenCharacters?.()} className={`text-[10px] font-bold text-[#8fd0a4] hover:text-white flex items-center gap-1 cursor-pointer rounded ${ring}`}><Folder className="w-3 h-3" />Add your own character pictures</button></div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => setCharId('none')} className={`shrink-0 w-24 rounded-xl border p-2 text-center cursor-pointer ${ring} ${charId === 'none' ? 'border-[#bef264] bg-[#0f1f17]' : 'border-[#1d3228] bg-[#0f1c16]'}`}><div className="h-20 flex items-center justify-center text-neutral-500 text-[11px]">No character</div><span className="text-[10px] font-bold text-neutral-200">None</span></button>
                {chars.map(c => <button key={c.id} type="button" onClick={() => setCharId(c.id)} className={`shrink-0 w-24 rounded-xl border p-2 text-center cursor-pointer ${ring} ${charId === c.id ? 'border-[#bef264] bg-[#0f1f17]' : 'border-[#1d3228] bg-[#0f1c16]'}`}>
                  <div className="h-20 flex items-end justify-center overflow-hidden">{c.preview && <img alt="" src={c.preview} className="h-[130px] object-cover object-top" />}</div>
                  <span className="text-[10px] font-bold text-neutral-200 block truncate">{c.name}</span><span className="text-[9px] text-neutral-500">{c.count} looks</span></button>)}
              </div>
              <span className={`${lab} mt-3`}>How often</span><Seg value={charLevel} onChange={setCharLevel} items={[['few', 'Few'], ['normal', 'Normal'], ['many', 'Many']]} />
            </Section>
            <Section title="Motion graphics" hint="The AI designs animated scenes from your script and links: titles, steps, flows, checklists, call-outs on your recordings and a button at the end.">
              <Seg value={motion} onChange={setMotion} items={[['clean', 'Clean'], ['bold', 'Bold'], ['wild', 'Wild']]} />
              <span className={`${lab} mt-4`}>Scene look</span><Seg value={sceneMode} onChange={setSceneMode} items={[['auto', 'Auto (AI picks)'], ['light', 'Light'], ['dark', 'Dark']]} />
              <span className={`${lab} mt-4`}>Accent colour</span>
              <div className="flex gap-2">{ACCENTS.map(c => <button key={c} type="button" aria-label={`Accent ${c}`} onClick={() => setAccent(c)} className={`w-9 h-9 rounded-full cursor-pointer border-2 ${ring} ${accent === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />)}</div>
            </Section>
            <Section title="Footage and sound">
              <div className="space-y-3.5">
                <Toggle on={broll && hasStock} onChange={setBroll} disabled={!hasStock} text="Stock footage (b-roll)" hint={hasStock ? 'Free Pexels / Pixabay clips that match what you say' : 'Add a free Pexels or Pixabay key in Settings to turn this on'} />
                <Toggle on={sfx} onChange={setSfx} text="Sound effects" hint="Whoosh on cuts, pops on big words" />
                {music && <div><span className={lab}>Music volume under the voice: {musicVol}%</span><input aria-label="Music volume" type="range" min={5} max={40} value={musicVol} onChange={e => setMusicVol(+e.target.value)} className="w-full accent-[#bef264]" /></div>}
              </div>
            </Section>
          </>}

          {tab === 'captions' && <>
            <Section title="Captions"><Toggle on={captions} onChange={setCaptions} text="Word-by-word captions" hint="The spoken word lights up as it is said" /></Section>
            <Section title="Language for captions, texts and posts" hint="Everything written in the video and in the post texts uses this language. Pick another one and the app translates it.">
              <label className="sr-only" htmlFor="story-lang">Language</label>
              <select id="story-lang" value={lang} onChange={e => setLang(e.target.value)} className={`${field} cursor-pointer`}>
                <option value="">Same as the voice-over</option>
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {lang && !hasAi && <p className="mt-2 text-[11px] text-amber-300/90 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />Translating needs an AI key. <button onClick={onSettings} className={`underline cursor-pointer rounded ${ring}`}>Add one in Settings</button></p>}
            </Section>
            <Section title="Button text at the end" hint="Shown as a button in the last seconds and on the thumbnails.">
              <input aria-label="Button text" value={cta} onChange={e => setCta(e.target.value)} maxLength={28} className={field} />
            </Section>
          </>}

          {!hasAi && <p className="text-[11px] text-amber-300/90 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" /><span>No AI key yet: the app uses simple rules and asks only basic questions. <button onClick={onSettings} className={`underline cursor-pointer rounded ${ring}`}>Add a key in Settings</button> for smart questions, cuts and headlines.</span></p>}
          <button onClick={start} disabled={!voice} className={`w-full min-h-[48px] rounded-xl bg-[#bef264] hover:bg-[#a3e635] disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer ${ring}`}><Sparkles className="w-4 h-4" />{voice ? 'Make my short' : 'Add a voice-over in Setup to continue'}</button>
        </div>
      </div>
    </div></main>
  );
};
