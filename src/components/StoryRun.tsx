// Project page of one "Script to Short" run: pipeline steps, the AI's questions, and the finished result.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, Circle, X, FolderOpen, Copy, MonitorPlay, MessageCircleQuestion, RotateCcw, Link2, Clock } from 'lucide-react';
import type { ProjectItem } from '../types/clipper';
import { StoryStore, STORY_STEPS, useStoryRun, StoryAnswer, StoryQ } from '../services/storyStore';
import { fileUrl } from '../utils/fileUrl';

const PLATFORMS: [string, string][] = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['x', 'X'], ['tiktok', 'TikTok']];
const card = 'rounded-2xl border border-[#1d3228] bg-[#0b1611] p-4';
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bef264]/70';
const btn = `px-3.5 min-h-[40px] rounded-xl bg-[#14231c] hover:bg-[#21332a] border border-[#263c32] text-neutral-100 font-bold text-xs cursor-pointer flex items-center gap-2 ${ring}`;
const field = `w-full min-h-[40px] rounded-lg bg-[#0f1c16] border border-[#1d3228] px-3 py-2 text-xs text-white outline-none focus:border-[#3f9a5a] ${ring}`;
const mmss = (t: number) => { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const base = (p: string) => p.split(/[\\/]/).pop() || p;

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return <button type="button" aria-label="Copy" className={`p-2 rounded-lg hover:bg-[#1d3228] text-neutral-400 hover:text-white cursor-pointer ${ring}`} onClick={() => { try { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* blocked */ } }}>{ok ? <Check className="w-4 h-4 text-[#bef264]" /> : <Copy className="w-4 h-4" />}</button>;
};

export const StoryResult: React.FC<{ result: any }> = ({ result }) => {
  const api = (window as any).electronAPI;
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      <div className={card}>
        <video src={fileUrl(result.video)} controls className="w-full rounded-xl bg-black aspect-[9/16]" />
        <button className={`${btn} mt-3`} onClick={() => api?.openFolder?.(result.outDir)}><FolderOpen className="w-4 h-4" />Open folder</button>
        <p className="text-[10px] text-neutral-500 mt-2 break-all">{result.outDir}</p>
      </div>
      <div className="space-y-4 min-w-0">
        {result.thumbs?.length > 0 && <div className={card}><h3 className="text-xs font-bold text-white mb-2">Thumbnails</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{result.thumbs.map((t: string) => <a key={t} href={fileUrl(t)} target="_blank" rel="noreferrer"><img alt="Thumbnail" src={fileUrl(t)} className="w-full rounded-lg border border-[#1d3228] aspect-[9/16] object-cover" /></a>)}</div></div>}
        {result.platforms && <div className={card}><h3 className="text-xs font-bold text-white mb-2">Titles, descriptions and hashtags</h3>
          <div className="space-y-3">{PLATFORMS.map(([k, n]) => { const v = result.platforms[k]; if (!v) return null; const full = [v.title, v.description, v.tags].filter(Boolean).join('\n\n'); return (
            <div key={k} className="rounded-xl bg-[#0f1c16] border border-[#1d3228] p-3"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold text-[#bef264]">{n}</span><CopyBtn text={full} /></div>
              {v.title && <p className="text-xs font-bold text-white mt-1">{v.title}</p>}<p className="text-[11px] text-neutral-300 whitespace-pre-wrap mt-1">{v.description}</p><p className="text-[11px] text-[#8fd0a4] mt-1 break-words">{v.tags}</p></div>); })}</div></div>}
      </div>
    </div>
  );
};

const QuestionCard: React.FC<{ q: StoryQ; n: number; ans: StoryAnswer; noRec: boolean; onChange: (a: StoryAnswer, noRec: boolean) => void }> = ({ q, n, ans, noRec, onChange }) => {
  const api = (window as any).electronAPI;
  const pick = async () => { const f = await api?.storyPickVideo?.(); if (f) onChange({ ...ans, rec: f.path }, false); };
  return (
    <div className="rounded-xl bg-[#0f1c16] border border-[#1d3228] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-[#13241b] border border-[#1d3228] text-[10px] font-extrabold text-[#bef264] flex items-center justify-center">{n}</span>
        {q.to > q.from ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#13241b] text-[#8fd0a4] flex items-center gap-1"><Clock className="w-3 h-3" />{mmss(q.from)} - {mmss(q.to)}</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#13241b] text-[#8fd0a4]">Whole video</span>}
        {q.kind === 'link' && <span className="text-[10px] font-bold text-sky-300 flex items-center gap-1"><Link2 className="w-3 h-3" />Link</span>}
        {q.kind === 'recording' && <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1"><MonitorPlay className="w-3 h-3" />Recording</span>}
      </div>
      <p id={`q-${q.id}`} className="text-[13px] text-white font-semibold leading-snug">{q.text}</p>
      <textarea id={`a-${q.id}`} aria-labelledby={`q-${q.id}`} rows={q.kind === 'link' ? 1 : 2} value={ans.text} onChange={e => onChange({ ...ans, text: e.target.value }, noRec)} placeholder={q.kind === 'link' ? 'Name and link, e.g. make.fun https://make.fun' : 'Type your answer (you can leave it empty)'} className={`${field} mt-2.5 resize-y`} />
      {q.kind === 'recording' && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={pick} className={`${btn} ${ans.rec ? 'border-[#bef264]' : ''}`}><MonitorPlay className="w-4 h-4" />{ans.rec ? 'Change video' : 'Import video'}</button>
          <button type="button" onClick={() => onChange({ ...ans, rec: null }, true)} className={`${btn} ${noRec ? 'border-[#bef264]' : ''}`}>No</button>
          {ans.rec && <span className="text-[11px] text-[#8fd0a4] truncate max-w-[260px]">{base(ans.rec)}</span>}
        </div>
      )}
    </div>
  );
};

export const StoryRun: React.FC<{ project: ProjectItem; onBack: () => void; onRestart: () => void }> = ({ project, onBack, onRestart }) => {
  const run = useStoryRun(project.id);
  const [answers, setAnswers] = useState<Record<string, StoryAnswer>>({});
  const [noRec, setNoRec] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e6 }); }, [run?.logs.length]);
  const story = project.story;
  const Head = (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={onBack} className={btn}><ArrowLeft className="w-4 h-4" />Back</button>
      <div className="min-w-0"><h1 className="text-lg font-extrabold text-white truncate">{project.name}</h1><p className="text-[11px] text-neutral-400">Script to Short</p></div>
    </div>
  );

  // finished (also after an app restart, from the saved project)
  const result = run?.phase === 'done' ? run.result : (!run && project.status === 'Finished' && story?.video ? { video: story.video, outDir: story.outDir, thumbs: story.thumbs || [], platforms: story.platforms } : null);
  if (result) return <main className="flex-1 overflow-y-auto"><div className="max-w-[1000px] mx-auto p-4 md:p-6">{Head}<StoryResult result={result} /></div></main>;

  if (!run || run.phase === 'error') return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[760px] mx-auto p-4 md:p-6">{Head}
      <div className={card}>
        <p className="text-sm font-bold text-white">{run?.error && run.error !== 'Cancelled.' ? 'This run stopped' : run ? 'Cancelled' : 'This run is not active'}</p>
        <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{run?.error && run.error !== 'Cancelled.' ? run.error : 'Nothing was lost: your files and settings are still here. You can start it again.'}</p>
        {run && run.logs.length > 0 && <div className="mt-3 max-h-40 overflow-y-auto text-[11px] font-mono text-neutral-500 space-y-0.5">{run.logs.slice(-8).map((l, i) => <div key={i}>{l.msg}</div>)}</div>}
        {story && <button onClick={onRestart} className={`${btn} mt-4`}><RotateCcw className="w-4 h-4" />Start again</button>}
      </div></div></main>
  );

  const asking = run.phase === 'questions';
  return (
    <main className="flex-1 overflow-y-auto"><div className="max-w-[860px] mx-auto p-4 md:p-6">{Head}
      <div className={card}>
        <div className="flex items-center justify-between text-xs mb-2"><span className="font-bold text-white">{asking ? 'The AI has some questions' : run.msg}</span><span className="text-neutral-400 tabular-nums">Step {Math.min(run.step + 1, STORY_STEPS.length)} of {STORY_STEPS.length} · {run.pct}%</span></div>
        <div className="h-2 rounded-full bg-[#14231c] overflow-hidden" role="progressbar" aria-valuenow={run.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[#bef264] transition-all" style={{ width: `${run.pct}%` }} /></div>
        <ol className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {STORY_STEPS.map((s, i) => { const done = i < run.step, active = i === run.step; return (
            <li key={s} className={`flex items-center gap-2.5 text-xs ${done ? 'text-[#8fd0a4]' : active ? 'text-white font-bold' : 'text-neutral-500'}`}>
              {done ? <Check className="w-4 h-4 shrink-0" /> : active ? (asking ? <MessageCircleQuestion className="w-4 h-4 shrink-0 text-[#bef264]" /> : <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[#bef264]" />) : <Circle className="w-4 h-4 shrink-0" />}{s}</li>); })}
        </ol>
      </div>

      {asking && (
        <div className={`${card} mt-4`}>
          <h2 className="text-sm font-extrabold text-white">Quick questions before the edit</h2>
          <p className="text-[11px] text-neutral-400 mt-1 mb-3 leading-snug">The AI listened to your voice-over. Answer what you can: the better the answers, the better the short. Links you write here are opened and read by the app.</p>
          <div className="space-y-3">{run.questions.map((q, i) => <QuestionCard key={q.id} q={q} n={i + 1} ans={answers[q.id] || { text: '' }} noRec={!!noRec[q.id]} onChange={(a, nr) => { setAnswers(x => ({ ...x, [q.id]: a })); setNoRec(x => ({ ...x, [q.id]: nr })); }} />)}</div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button disabled={sent} onClick={() => { setSent(true); StoryStore.build(project.id, answers); }} className={`disabled:opacity-60 px-5 min-h-[44px] rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-sm cursor-pointer ${ring}`}>Continue</button>
            <button disabled={sent} onClick={() => { setSent(true); StoryStore.build(project.id, {}); }} className={`${btn} disabled:opacity-60`}>Skip all questions</button>
            <button onClick={() => StoryStore.cancel(project.id)} className={btn}><X className="w-4 h-4" />Cancel</button>
          </div>
        </div>
      )}

      {!asking && (
        <div className={`${card} mt-4`}>
          <div ref={logRef} className="max-h-60 overflow-y-auto space-y-1 text-[11px] font-mono" aria-live="polite">
            {run.logs.map((l, i) => <div key={i} className={l.kind === 'warn' ? 'text-amber-300' : l.kind === 'success' ? 'text-[#8fd0a4]' : 'text-neutral-400'}>{l.msg}</div>)}
          </div>
          <button onClick={() => StoryStore.cancel(project.id)} className={`${btn} mt-3`}><X className="w-4 h-4" />Cancel</button>
        </div>
      )}
    </div></main>
  );
};
