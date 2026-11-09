// "Script to Short": voice-over (+ music, + screen recordings) in -> finished 9:16 short, 4 thumbnails and platform texts out.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mic, Music, MonitorPlay, Sparkles, Folder, Copy, Check, X, FolderOpen, Wand2 } from 'lucide-react';
import { fileUrl } from '../utils/fileUrl';
import { getHardware } from '../services/hardwareMode';
import { SoftwareManager } from '../services/softwareManager';
import { StockService } from '../services/stockService';
import { AiService } from '../services/aiService';

type Char = { id: string; name: string; builtin: boolean; count: number; preview: string | null; previewHead: string | null };
type Result = { outDir: string; video: string; duration: number; thumbs: string[]; platforms: any; plan: { beats: number; tool: string } };
const ACCENTS = ['#FFD400', '#22E3A1', '#FF3B5C', '#3BA7FF', '#FFFFFF'];
const PLATFORMS: [string, string][] = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['x', 'X'], ['tiktok', 'TikTok']];
const base = (p: string) => p.split(/[\\/]/).pop() || p;
const card = 'rounded-2xl border border-[#1d3228] bg-[#0b1611] p-4';
const btn = 'px-3 py-2 rounded-xl bg-[#14231c] hover:bg-[#21332a] border border-[#263c32] text-neutral-100 font-bold text-xs cursor-pointer flex items-center gap-2';
const lab = 'text-[11px] font-bold text-neutral-300 mb-1.5 block';

const Seg: React.FC<{ value: string; onChange: (v: string) => void; items: [string, string][] }> = ({ value, onChange, items }) => (
  <div className="flex gap-1.5 flex-wrap">{items.map(([v, t]) => (
    <button key={v} type="button" onClick={() => onChange(v)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${value === v ? 'bg-[#bef264] text-black border-transparent' : 'bg-[#0f1c16] text-neutral-300 border-[#1d3228] hover:text-white'}`}>{t}</button>
  ))}</div>
);
const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; text: string; hint?: string; disabled?: boolean }> = ({ on, onChange, text, hint, disabled }) => (
  <button type="button" disabled={disabled} onClick={() => onChange(!on)} className={`flex items-start gap-2 text-left w-full ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
    <span className={`mt-0.5 w-8 h-[18px] rounded-full shrink-0 relative transition-colors ${on && !disabled ? 'bg-[#3f9a5a]' : 'bg-[#263c32]'}`}><span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${on && !disabled ? 'left-[16px]' : 'left-[2px]'}`} /></span>
    <span><span className="text-xs font-bold text-neutral-100 block">{text}</span>{hint && <span className="text-[10px] text-neutral-400 block leading-snug">{hint}</span>}</span>
  </button>
);
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return <button type="button" className="p-1.5 rounded-lg hover:bg-[#1d3228] text-neutral-400 hover:text-white cursor-pointer" title="Copy" onClick={() => { try { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* clipboard blocked */ } }}>{ok ? <Check className="w-3.5 h-3.5 text-[#bef264]" /> : <Copy className="w-3.5 h-3.5" />}</button>;
};

export const StoryStudio: React.FC<{ onBack: () => void; onSettings: () => void }> = ({ onBack, onSettings }) => {
  const api = (window as any).electronAPI;
  const [voice, setVoice] = useState<{ path: string; name: string } | null>(null);
  const [music, setMusic] = useState<{ path: string; name: string } | null>(null);
  const [recs, setRecs] = useState<string[]>([]);
  const [chars, setChars] = useState<Char[]>([]);
  const [charId, setCharId] = useState('suit');
  const [motion, setMotion] = useState('bold');
  const [charLevel, setCharLevel] = useState('normal');
  const [captions, setCaptions] = useState(true);
  const [sfx, setSfx] = useState(true);
  const [broll, setBroll] = useState(true);
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [musicVol, setMusicVol] = useState(16);
  const [cta, setCta] = useState('COMMENT "LINK"');
  const [textLang, setTextLang] = useState('');
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [prog, setProg] = useState({ pct: 0, msg: '' });
  const [logs, setLogs] = useState<{ msg: string; kind: string }[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const hasStock = StockService.hasAny();
  const hasAi = (() => { try { return !!AiService.forJob(); } catch { return false; } })();

  useEffect(() => { api?.storyCharacters?.().then((c: Char[]) => { setChars(c || []); if (c?.length && !c.find(x => x.id === 'suit')) setCharId(c[0].id); }).catch(() => {}); }, []);
  useEffect(() => {
    const off = api?.onStoryEvent?.((ev: any) => {
      if (ev.type === 'progress') setProg({ pct: ev.pct, msg: ev.msg });
      else if (ev.type === 'log') setLogs(l => [...l.slice(-60), { msg: `${ev.src}: ${ev.msg}`, kind: ev.kind }]);
    });
    return () => { off && off(); };
  }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e6 }); }, [logs]);

  const pickVoice = async () => { const f = await api?.storyPickVoice?.(); if (f) setVoice(f); };
  const pickMusic = async () => { const f = await api?.pickAudio?.(); if (f) setMusic({ path: f.path, name: f.name }); };
  const pickRecs = async () => { const f: string[] = (await api?.pickVideos?.()) || []; if (f.length) setRecs(r => [...new Set([...r, ...f])].slice(0, 8)); };

  const start = async () => {
    if (!voice) return;
    setState('running'); setErr(''); setLogs([]); setProg({ pct: 1, msg: 'Starting' }); setResult(null);
    const r = await api.storyStart({
      voicePath: voice.path, musicPath: music?.path || null, recordings: recs, name: base(voice.path).replace(/\.[^.]+$/, ''),
      modelId: SoftwareManager.getActiveModelId(), language: 'auto', hardware: getHardware(), gemini: AiService.forJob(), stockKeys: StockService.keys(),
      options: { motion, captions, sfx, broll, accent, musicVol, cta: cta.trim(), thumbCta: cta.trim() || 'LINK IN COMMENTS', character: charId !== 'none', characterStyle: charId, charLevel, textLang: textLang.trim() }
    });
    if (r.ok) { setResult(r.result); setState('done'); } else if (r.cancelled) { setState('idle'); } else { setErr(r.error || 'Something went wrong.'); setState('error'); }
  };
  const cancel = async () => { await api?.storyCancel?.(); setState('idle'); };

  if (!api?.storyStart) return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[760px] mx-auto p-6"><button onClick={onBack} className={btn}><ArrowLeft className="w-4 h-4" />Back</button>
      <div className={`${card} mt-4 text-sm text-neutral-300`}>Script to Short is available in the desktop app.</div></div></main>
  );

  const Header = (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={onBack} disabled={state === 'running'} className={`${btn} disabled:opacity-40`}><ArrowLeft className="w-4 h-4" />Back</button>
      <div><h1 className="text-lg font-extrabold text-white flex items-center gap-2"><Wand2 className="w-5 h-5 text-[#bef264]" />Script to Short</h1>
        <p className="text-[11px] text-neutral-400">Add your voice-over. The app builds the video, thumbnails and post texts.</p></div>
    </div>
  );

  if (state === 'running') return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[760px] mx-auto p-4 md:p-6">{Header}
      <div className={card}>
        <div className="flex items-center justify-between text-xs mb-2"><span className="font-bold text-white">{prog.msg}</span><span className="text-neutral-400 tabular-nums">{prog.pct}%</span></div>
        <div className="h-2 rounded-full bg-[#14231c] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: `${prog.pct}%` }} /></div>
        <div ref={logRef} className="mt-4 max-h-56 overflow-y-auto space-y-1 text-[11px] font-mono">
          {logs.map((l, i) => <div key={i} className={l.kind === 'warn' ? 'text-amber-300' : l.kind === 'success' ? 'text-[#8fd0a4]' : 'text-neutral-400'}>{l.msg}</div>)}
        </div>
        <button onClick={cancel} className={`${btn} mt-4`}><X className="w-4 h-4" />Cancel</button>
      </div></div></main>
  );

  if (state === 'done' && result) return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[1000px] mx-auto p-4 md:p-6">{Header}
      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        <div className={card}>
          <video src={fileUrl(result.video)} controls className="w-full rounded-xl bg-black aspect-[9/16]" />
          <div className="flex gap-2 mt-3 flex-wrap"><button className={btn} onClick={() => api.openFolder(result.outDir)}><FolderOpen className="w-4 h-4" />Open folder</button><button className={btn} onClick={() => { setState('idle'); }}><Sparkles className="w-4 h-4" />Make another</button></div>
          <p className="text-[10px] text-neutral-500 mt-2 break-all">{result.outDir}</p>
        </div>
        <div className="space-y-4 min-w-0">
          {result.thumbs.length > 0 && <div className={card}><h3 className="text-xs font-bold text-white mb-2">Thumbnails</h3>
            <div className="grid grid-cols-4 gap-2">{result.thumbs.map(t => <a key={t} href={fileUrl(t)} target="_blank" rel="noreferrer"><img src={fileUrl(t)} className="w-full rounded-lg border border-[#1d3228] aspect-[9/16] object-cover" /></a>)}</div></div>}
          {result.platforms && <div className={card}><h3 className="text-xs font-bold text-white mb-2">Titles, descriptions and hashtags</h3>
            <div className="space-y-3">{PLATFORMS.map(([k, n]) => { const v = result.platforms[k]; if (!v) return null; const full = [v.title, v.description, v.tags].filter(Boolean).join('\n\n'); return (
              <div key={k} className="rounded-xl bg-[#0f1c16] border border-[#1d3228] p-3"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold text-[#bef264]">{n}</span><CopyBtn text={full} /></div>
                {v.title && <p className="text-xs font-bold text-white mt-1">{v.title}</p>}<p className="text-[11px] text-neutral-300 whitespace-pre-wrap mt-1">{v.description}</p><p className="text-[11px] text-[#8fd0a4] mt-1 break-words">{v.tags}</p></div>); })}</div></div>}
        </div>
      </div></div></main>
  );

  return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[860px] mx-auto p-4 md:p-6">{Header}
      {state === 'error' && <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-xs p-3">{err}</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className={card}><span className={lab}>1. Voice-over (any language) <span className="text-[#bef264]">required</span></span>
          <button onClick={pickVoice} className={btn}><Mic className="w-4 h-4" />{voice ? 'Change' : 'Choose file'}</button>
          {voice && <p className="text-[11px] text-[#8fd0a4] mt-2 truncate">{voice.name}</p>}</div>
        <div className={card}><span className={lab}>2. Background music (optional)</span>
          <div className="flex gap-2"><button onClick={pickMusic} className={btn}><Music className="w-4 h-4" />{music ? 'Change' : 'Choose file'}</button>{music && <button className={btn} onClick={() => setMusic(null)}><X className="w-4 h-4" /></button>}</div>
          {music && <p className="text-[11px] text-[#8fd0a4] mt-2 truncate">{music.name}</p>}</div>
        <div className={`${card} sm:col-span-2`}><span className={lab}>3. Screen recordings (optional): shown in order while you talk</span>
          <button onClick={pickRecs} className={btn}><MonitorPlay className="w-4 h-4" />Add recordings</button>
          {recs.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{recs.map(r => <span key={r} className="text-[11px] px-2 py-1 rounded-lg bg-[#14231c] border border-[#1d3228] text-neutral-200 flex items-center gap-1.5 max-w-[240px]"><span className="truncate">{base(r)}</span><button onClick={() => setRecs(x => x.filter(y => y !== r))} className="cursor-pointer text-neutral-500 hover:text-white"><X className="w-3 h-3" /></button></span>)}</div>}
        </div>
        <div className={`${card} sm:col-span-2`}><div className="flex items-center justify-between"><span className={lab}>Character</span>
          <button onClick={() => api.storyOpenCharacters?.()} className="text-[10px] font-bold text-[#8fd0a4] hover:text-white flex items-center gap-1 cursor-pointer -mt-1"><Folder className="w-3 h-3" />Add your own character pictures</button></div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setCharId('none')} className={`shrink-0 w-24 rounded-xl border p-2 text-center cursor-pointer ${charId === 'none' ? 'border-[#bef264] bg-[#0f1f17]' : 'border-[#1d3228] bg-[#0f1c16]'}`}><div className="h-20 flex items-center justify-center text-neutral-500 text-xs">No character</div><span className="text-[10px] font-bold text-neutral-200">None</span></button>
            {chars.map(c => <button key={c.id} type="button" onClick={() => setCharId(c.id)} className={`shrink-0 w-24 rounded-xl border p-2 text-center cursor-pointer ${charId === c.id ? 'border-[#bef264] bg-[#0f1f17]' : 'border-[#1d3228] bg-[#0f1c16]'}`}>
              <div className="h-20 flex items-end justify-center overflow-hidden">{c.preview && <img src={c.preview} className="h-[130px] object-cover object-top" />}</div>
              <span className="text-[10px] font-bold text-neutral-200 block truncate">{c.name}</span><span className="text-[9px] text-neutral-500">{c.count} looks</span></button>)}
          </div></div>
        <div className={card}><span className={lab}>Motion graphics</span><Seg value={motion} onChange={setMotion} items={[['clean', 'Clean'], ['bold', 'Bold'], ['wild', 'Wild']]} />
          <span className={`${lab} mt-3`}>Character pop-ups</span><Seg value={charLevel} onChange={setCharLevel} items={[['few', 'Few'], ['normal', 'Normal'], ['many', 'Many']]} />
          <span className={`${lab} mt-3`}>Accent colour</span><div className="flex gap-2">{ACCENTS.map(c => <button key={c} type="button" onClick={() => setAccent(c)} className={`w-7 h-7 rounded-full cursor-pointer border-2 ${accent === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />)}</div></div>
        <div className={`${card} space-y-3`}>
          <Toggle on={captions} onChange={setCaptions} text="Word-by-word captions" />
          <Toggle on={sfx} onChange={setSfx} text="Sound effects" hint="Whoosh on cuts, pops on big words" />
          <Toggle on={broll && hasStock} onChange={setBroll} disabled={!hasStock} text="Stock footage (b-roll)" hint={hasStock ? 'Free Pexels / Pixabay clips that match what you say' : 'Add a free Pexels or Pixabay key in Settings to turn this on'} />
          {music && <div><span className={lab}>Music volume under the voice: {musicVol}%</span><input type="range" min={5} max={40} value={musicVol} onChange={e => setMusicVol(+e.target.value)} className="w-full accent-[#bef264]" /></div>}
          <div><span className={lab}>Button text at the end</span><input value={cta} onChange={e => setCta(e.target.value)} maxLength={28} className="w-full rounded-lg bg-[#0f1c16] border border-[#1d3228] px-3 py-1.5 text-xs text-white outline-none focus:border-[#3f9a5a]" /></div>
          <div><span className={lab}>Language for post texts (empty = same as the voice)</span><input value={textLang} onChange={e => setTextLang(e.target.value)} placeholder="e.g. English" maxLength={24} className="w-full rounded-lg bg-[#0f1c16] border border-[#1d3228] px-3 py-1.5 text-xs text-white outline-none focus:border-[#3f9a5a]" /></div>
        </div>
      </div>
      {!hasAi && <p className="mt-3 text-[11px] text-amber-300/90">No AI key yet: the app will use simple built-in editing rules and plain post texts. <button onClick={onSettings} className="underline cursor-pointer">Add a key in Settings</button> for smarter cuts, hooks and headlines.</p>}
      <button onClick={start} disabled={!voice} className="mt-4 w-full py-3 rounded-xl bg-[#bef264] hover:bg-[#a3e635] disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"><Sparkles className="w-4 h-4" />{voice ? 'Make my short' : 'Choose a voice-over to continue'}</button>
    </div></main>
  );
};
