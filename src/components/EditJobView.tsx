import React from 'react';
import { Check, Film, Pause, Play, X } from 'lucide-react';

/** One "edit clips" job (hook / captions / banner / watermark / music changes applied to finished clips). Shown like the normal pipeline page, but only with the steps that matter. */
export interface EditJob {
  projectId: string; outDir: string;
  labels: string[];                    // what the user changed (Captions, Hook, ...)
  total: number; done: number;
  inflight: Record<number, number>;    // 0..1 per clip that is rendering right now
  paused: boolean; status: 'running' | 'done' | 'error' | 'cancelled'; error?: string; startedAt: number;
}
export const editJobPct = (j: EditJob) => j.status === 'done' ? 100 : Math.min(99, Math.round((j.done + Object.values(j.inflight).reduce((a, b) => a + b, 0)) / Math.max(1, j.total) * 100));

const fmt = (s: number) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };

export const EditJobView: React.FC<{ job: EditJob; name: string; onPause: () => void; onResume: () => void; onCancel: () => void; onViewClips: () => void; onBack: () => void }> = ({ job, name, onPause, onResume, onCancel, onViewClips, onBack }) => {
  const pct = editJobPct(job), finished = job.status === 'done', failed = job.status === 'error';
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const elapsed = (now - job.startedAt) / 1000, eta = pct > 2 && !job.paused ? elapsed * (100 - pct) / pct : null;
  const steps = [
    { name: 'Preparing the clips', p: 100, done: true },
    ...job.labels.map(l => ({ name: `Applying ${l.toLowerCase()}`, p: 100, done: true })),
    { name: `Rendering clips (${Math.min(job.done, job.total)} of ${job.total})`, p: finished ? 100 : pct, done: finished },
    { name: 'Saving', p: finished ? 100 : 0, done: finished },
  ];
  const runningIdx = finished ? -1 : steps.length - 2;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#13211a] flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-xs text-neutral-400 hover:text-white cursor-pointer">← Back</button>
        <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-500">Edit pipeline</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-[#09110e] border border-[#15251e] rounded-2xl p-7 space-y-4 shadow-xl">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight break-all leading-snug">{name}</h1>
            <div className="text-xs text-neutral-400 font-medium">{finished ? 'Your changes are applied · Ready to view' : failed ? (job.error || 'Something went wrong') : job.paused ? 'Processing paused' : `Applying: ${job.labels.join(', ') || 'changes'}`}</div>
            <div className="w-full h-1.5 bg-[#13211a] rounded-full overflow-hidden"><div className="h-full bg-[#bef264] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} /></div>
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-4xl md:text-5xl font-black text-white tracking-tight">{pct}%</span>
              <span className="text-sm text-neutral-400 font-medium">{finished ? 'Finished' : job.paused ? 'Paused' : `${job.done} of ${job.total} clips done`}</span>
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">{finished ? 'Done' : job.paused ? 'Paused. Resume continues from where it stopped.' : eta === null ? 'Estimating remaining time…' : `Estimated time left: ${fmt(eta)}`}</div>
          </div>
          <div className="bg-[#09110e] border border-[#15251e] rounded-2xl overflow-hidden shadow-xl divide-y divide-[#13211a]">
            {steps.map((s, i) => {
              const run = i === runningIdx && !job.paused, pp = i === runningIdx && job.paused;
              return (
                <div key={i} className="p-4 px-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {s.done ? <Check className="w-4 h-4 text-[#8fd0a4] stroke-[3]" /> : run ? <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] animate-ping" /> : pp ? <div className="w-2 h-2 rounded-full bg-amber-400" /> : <div className="w-2 h-2 rounded-full bg-neutral-600" />}
                    </div>
                    <span className={`text-xs font-semibold ${s.done ? 'text-white' : run ? 'text-[#8fd0a4]' : 'text-neutral-400'}`}>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
                    <div className="w-24 h-1 bg-[#13211a] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-300 ${s.done ? 'bg-[#bef264]' : pp ? 'bg-amber-400' : 'bg-[#3f9a5a]/80'}`} style={{ width: `${s.done ? 100 : s.p}%` }} /></div>
                    <span className="w-9 text-right">{s.done ? 100 : s.p}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            {finished || failed ? (
              <button type="button" onClick={onViewClips} className="px-6 py-2.5 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs flex items-center gap-2 cursor-pointer"><Film className="w-4 h-4" /><span>View Clips</span></button>
            ) : (
              <>
                <button type="button" onClick={job.paused ? onResume : onPause} className={`px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 cursor-pointer ${job.paused ? 'bg-[#bef264] hover:bg-[#a3e635] text-black' : 'bg-[#12201a] hover:bg-[#1a2e25] text-white border border-[#273d33]'}`}>
                  {job.paused ? <><Play className="w-3.5 h-3.5 fill-current" /><span>Resume Pipeline</span></> : <><Pause className="w-3.5 h-3.5 fill-current" /><span>Pause Pipeline</span></>}
                </button>
                <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-[#1a0f0f] hover:bg-[#2a1414] text-rose-300 text-xs font-bold border border-[#3a1c1c] flex items-center gap-2 cursor-pointer"><X className="w-3.5 h-3.5" /><span>Cancel Pipeline</span></button>
                <button type="button" onClick={onViewClips} className="px-5 py-2.5 rounded-xl bg-[#0f1c16] hover:bg-[#172820] text-neutral-200 text-xs font-bold border border-[#1d3228] cursor-pointer">View clips meanwhile</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
