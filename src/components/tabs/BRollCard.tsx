import React from 'react';
import { Film, X, Plus } from 'lucide-react';

export interface BRollState { enabled: boolean; files: Array<{ path: string; name: string }>; pct?: number }
const DEFAULT: BRollState = { enabled: false, files: [], pct: 20 };

export const BRollCard: React.FC<{ broll?: BRollState; setBroll: (b: BRollState) => void }> = ({ broll, setBroll }) => {
  const b: BRollState = { ...DEFAULT, ...(broll || {}) };
  const set = (patch: Partial<BRollState>) => setBroll({ ...b, ...patch });
  const add = async () => {
    const api: any = (window as any).electronAPI;
    if (!api?.pickVideos) return;
    const picked: string[] = await api.pickVideos();
    if (!picked || !picked.length) return;
    const have = new Set(b.files.map(f => f.path));
    const more = picked.filter(p => !have.has(p)).map(p => ({ path: p, name: p.split(/[\\/]/).pop() || p }));
    set({ files: [...b.files, ...more].slice(0, 24) });
  };
  return (
    <section className="space-y-3 p-4 rounded-xl bg-[#0b1410] border border-[#172820]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2"><Film className="w-3.5 h-3.5" />B-Roll (your own videos)</h3>
          <p className="text-[11px] text-neutral-400 mt-0.5 max-w-md">Add your own stock videos. The AI reads what is being said and, at the right moments, briefly cuts away to the matching video of yours (2-3 seconds, muted) while the main audio keeps playing.</p>
        </div>
        <button type="button" onClick={() => set({ enabled: !b.enabled })}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${b.enabled ? 'bg-[#3f9a5a] border-[#3f9a5a] text-black' : 'bg-[#111e18] border-[#20322a] text-neutral-300'}`}>{b.enabled ? 'ON' : 'OFF'}</button>
      </div>
      {b.enabled && (<>
        <button type="button" onClick={add} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#111e18] border border-[#20322a] text-[#8fd0a4] hover:border-[#3f9a5a] cursor-pointer"><Plus className="w-3.5 h-3.5" />Add videos</button>
        {b.files.length > 0 ? (
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {b.files.map(f => (
              <li key={f.path} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[#0f1c16] border border-[#1d3228] text-[11px] text-neutral-300">
                <span className="truncate">{f.name}</span>
                <button type="button" title="Remove" onClick={() => set({ files: b.files.filter(x => x.path !== f.path) })} className="text-neutral-500 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-[11px] text-amber-300/90">No videos added yet. B-roll stays off until you add at least one.</p>}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-neutral-300"><span>Most of each clip that may be b-roll</span><span className="font-mono text-[#8fd0a4]">{b.pct ?? 20}%</span></div>
          <input type="range" min={10} max={25} step={1} value={b.pct ?? 20} onChange={e => set({ pct: parseInt(e.target.value) })} className="w-full h-1.5 bg-[#1d3228] rounded-lg appearance-none accent-[#bef264] cursor-pointer" />
        </div>
        <p className="text-[10px] text-neutral-500">The b-roll never covers more than about a fifth of a clip (25% at most), never in the first seconds, and the captions and hook stay on top. For the best matches add an AI key in Settings: the AI looks at your videos and describes them. Without a key, matching uses the words in the file names. Not used together with split screen. It is applied while rendering and shows in the finished clip, not in the preview.</p>
      </>)}
    </section>
  );
};
