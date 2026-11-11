// Runs of "Script to Short" live here (not in a component), so they keep going while you look at other screens.
import { useSyncExternalStore } from 'react';
import { getHardware } from './hardwareMode';
import { SoftwareManager } from './softwareManager';
import { StockService } from './stockService';
import { AiService } from './aiService';

export type StoryQ = { id: string; from: number; to: number; kind: 'link' | 'recording' | 'detail'; text: string };
export type StoryAnswer = { text: string; rec?: string | null };
export type StoryPhase = 'analyzing' | 'questions' | 'building' | 'done' | 'error';
export interface StoryRunState {
  projectId: string; phase: StoryPhase; stage: string; pct: number; msg: string; step: number;
  logs: { msg: string; kind: string }[]; questions: StoryQ[]; analysis: any | null; job: any; result: any | null; error: string; startedAt: number;
}
export const STORY_STEPS = ['Listening to the voice-over', 'Understanding the script', 'Your answers', 'Reading links and translating', 'Planning the edit', 'Finding footage', 'Editing scenes', 'Motion graphics and captions', 'Mixing sound', 'Rendering the video', 'Thumbnails and post texts'];
const STAGE_STEP: Record<string, number> = { Preparing: 0, Listening: 0, Understanding: 1, Researching: 3, Translating: 3, Planning: 4, Footage: 5, Editing: 6, Graphics: 7, Mixing: 8, Rendering: 9, Packaging: 10, Done: 11 };

const runs = new Map<string, StoryRunState>();
const subs = new Set<() => void>();
type ProjectHook = (projectId: string, patch: any) => void;
let projectHook: ProjectHook = () => {};
let activeId = '';
let listening = false;
let version = 0;
const api = () => (window as any).electronAPI;
const emit = () => { version++; subs.forEach(f => f()); };
const upd = (id: string, patch: Partial<StoryRunState>) => { const r = runs.get(id); if (!r) return; runs.set(id, { ...r, ...patch }); emit(); };

export const StoryStore = {
  setProjectHook(f: ProjectHook) { projectHook = f; },
  get: (id: string) => runs.get(id),
  isRunning: (id: string) => { const r = runs.get(id); return !!r && (r.phase === 'analyzing' || r.phase === 'building'); },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },

  listen() {
    if (listening || !api()?.onStoryEvent) return; listening = true;
    api().onStoryEvent((ev: any) => {
      const r = runs.get(activeId); if (!r) return;
      if (ev.type === 'log') { upd(activeId, { logs: [...r.logs.slice(-120), { msg: `${ev.src}: ${ev.msg}`, kind: ev.kind || 'info' }] }); return; }
      if (ev.type !== 'progress') return;
      const overall = r.phase === 'analyzing' ? ev.pct * 0.3 : 30 + ev.pct * 0.7;
      const step = STAGE_STEP[ev.stage] ?? r.step;
      upd(activeId, { stage: ev.stage, msg: ev.msg, pct: Math.max(r.pct, Math.round(overall)), step: Math.max(r.step, step) });
      projectHook(activeId, { status: 'Processing', progressPercent: Math.round(Math.max(r.pct, overall)), stepsDone: Math.max(r.step, step), stepsTotal: STORY_STEPS.length });
    });
  },

  async start(projectId: string, job: any) {
    this.listen();
    activeId = projectId;
    runs.set(projectId, { projectId, phase: 'analyzing', stage: 'Listening', pct: 1, msg: 'Starting', step: 0, logs: [], questions: [], analysis: null, job, result: null, error: '', startedAt: Date.now() });
    emit();
    projectHook(projectId, { status: 'Processing', progressPercent: 1, stepsDone: 0, stepsTotal: STORY_STEPS.length });
    const full = { ...job, modelId: SoftwareManager.getActiveModelId(), language: job.options?.voiceLang && job.options.voiceLang !== 'auto' ? job.options.voiceLang : 'auto', hardware: getHardware(), gemini: AiService.forJob(), stockKeys: StockService.keys() };
    runs.set(projectId, { ...runs.get(projectId)!, job: full });
    const r = await api().storyAnalyze(full);
    if (!r.ok) { if (r.cancelled) { upd(projectId, { phase: 'error', error: 'Cancelled.' }); projectHook(projectId, { status: 'Paused' }); } else { upd(projectId, { phase: 'error', error: r.error || 'Something went wrong.' }); projectHook(projectId, { status: 'Failed' }); } return; }
    const qs: StoryQ[] = r.analysis.questions || [];
    upd(projectId, { analysis: r.analysis, questions: qs, pct: 30, step: 2 });
    if (!qs.length) { await this.build(projectId, {}); return; }
    upd(projectId, { phase: 'questions', msg: 'Waiting for your answers' });
    projectHook(projectId, { status: 'Processing', progressPercent: 30, stepsDone: 2, stepsTotal: STORY_STEPS.length });
  },

  async build(projectId: string, answers: Record<string, StoryAnswer>) {
    const r0 = runs.get(projectId); if (!r0 || !r0.analysis) return;
    activeId = projectId;
    const list = r0.questions.map(q => { const a = answers[q.id]; return a && (a.text?.trim() || a.rec) ? { q: q.text, from: q.from, to: q.to, kind: q.kind, text: (a.text || '').trim(), rec: a.rec || null } : null; }).filter(Boolean);
    upd(projectId, { phase: 'building', stage: 'Planning', msg: 'Starting the edit', pct: 30, step: 3 });
    const job = { ...r0.job, words: r0.analysis.words, answers: list };
    const r = await api().storyStart(job);
    if (r.ok) {
      upd(projectId, { phase: 'done', pct: 100, step: STORY_STEPS.length, result: r.result, msg: 'Finished' });
      projectHook(projectId, { status: 'Finished', progressPercent: 100, stepsDone: STORY_STEPS.length, stepsTotal: STORY_STEPS.length, result: r.result });
    } else if (r.cancelled) { upd(projectId, { phase: 'error', error: 'Cancelled.' }); projectHook(projectId, { status: 'Paused' }); }
    else { upd(projectId, { phase: 'error', error: r.error || 'Something went wrong.' }); projectHook(projectId, { status: 'Failed' }); }
  },

  async cancel(projectId: string) { await api()?.storyCancel?.(); const r = runs.get(projectId); if (r && (r.phase === 'questions')) { upd(projectId, { phase: 'error', error: 'Cancelled.' }); projectHook(projectId, { status: 'Paused' }); } },
  forget(projectId: string) { runs.delete(projectId); emit(); }
};

export function useStoryRun(id: string): StoryRunState | undefined {
  return useSyncExternalStore(StoryStore.subscribe, () => { void version; return runs.get(id); });
}
