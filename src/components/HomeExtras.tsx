import React, { useState } from 'react';
import { Plus, FolderOpen, Settings, ArrowUpCircle, ChevronRight, Lightbulb, Clock, BarChart3, RotateCw } from 'lucide-react';
import { ProjectItem } from '../types/clipper';
import { UpdateChecker } from './UpdateChecker';

const ago = (p: ProjectItem) => (p.lastEdited || p.createdAt || '').toString();

export const RecentProjects: React.FC<{ projects: ProjectItem[]; onOpen: (p: ProjectItem) => void; onViewAll: () => void }> = ({ projects, onOpen, onViewAll }) => {
  if (!projects.length) return null;
  const tone = (p: ProjectItem) => p.status === 'Finished' ? ['bg-[#3f9a5a]', 'Completed'] : p.status === 'Failed' ? ['bg-rose-500', 'Failed'] : p.status === 'Queued' ? ['bg-sky-400', 'Queued'] : ['bg-amber-400', 'Processing'];
  return (
    <section className="w-full mt-6">
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#8fd0a4]" /><h2 className="text-base font-bold text-white tracking-tight">Recent projects</h2></div>
        <button type="button" onClick={onViewAll} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer">View all <ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {projects.slice(0, 4).map(p => {
          const [dot, label] = tone(p);
          return (
            <button key={p.id} type="button" onClick={() => onOpen(p)} className="text-left flex items-center gap-3 p-2.5 rounded-xl bg-[#0b1611] border border-[#17291f] hover:border-[#2a4a38] transition-colors cursor-pointer">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#10201a]">
                {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{p.name.replace(/\.[a-z0-9]{2,4}$/i, '')}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5 truncate">{ago(p)}</div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-neutral-300"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export const TipCard: React.FC = () => (
  <div className="w-full mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0b1611] border border-[#17291f]">
    <Lightbulb className="w-4 h-4 text-[#bef264] shrink-0" />
    <p className="text-xs text-neutral-400"><span className="font-semibold text-neutral-200">Tip </span>Shorter clips (15–60 seconds) usually get better engagement on Shorts, Reels and TikTok.</p>
  </div>
);

export const HomeAside: React.FC<{ projects: ProjectItem[]; onNew: () => void; onSettings: () => void }> = ({ projects, onNew, onSettings }) => {
  const [msg, setMsg] = useState('');
  const openClips = async () => {
    try { const f = await window.electronAPI?.getFolders?.(); if (f) { await window.electronAPI?.openFolder?.(f.clipsDir); return; } } catch { /* ignore */ }
    setMsg('The clips folder can be opened in the desktop app.'); setTimeout(() => setMsg(''), 2500);
  };
  const done = projects.filter(p => p.status === 'Finished').length;
  const working = projects.filter(p => p.status === 'Processing' || p.status === 'Queued').length;
  const failed = projects.filter(p => p.status === 'Failed').length;
  const Row = ({ Icon, title, sub, onClick, busy }: { Icon: React.ElementType; title: string; sub: string; onClick: () => void; busy?: boolean }) => (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#10201a] transition-colors text-left cursor-pointer group">
      <span className="w-9 h-9 rounded-lg bg-[#13241b] border border-[#1d3228] flex items-center justify-center shrink-0">{busy ? <RotateCw className="w-4 h-4 text-[#8fd0a4] animate-spin" /> : <Icon className="w-4 h-4 text-[#8fd0a4]" />}</span>
      <span className="flex-1 min-w-0"><span className="block text-xs font-semibold text-white">{title}</span><span className="block text-[10px] text-neutral-500 truncate">{sub}</span></span>
      <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-300" />
    </button>
  );
  const Stat = ({ n, label, dot }: { n: number; label: string; dot: string }) => (
    <div className="flex items-center gap-3 py-2"><span className={`w-2 h-2 rounded-full ${dot}`} /><span className="text-lg font-bold text-white w-7 leading-none">{n}</span><span className="text-xs text-neutral-400">{label}</span></div>
  );
  return (
    <aside className="w-full xl:w-[290px] shrink-0 space-y-4">
      <section className="rounded-2xl bg-[#0b1611] border border-[#17291f] p-3">
        <h3 className="px-2 pt-1 pb-2 text-sm font-bold text-white">Quick actions</h3>
        <Row Icon={Plus} title="New project" sub="Start with a video or link" onClick={onNew} />
        <Row Icon={FolderOpen} title="Open clips folder" sub="See your finished clips" onClick={openClips} />
        <Row Icon={Settings} title="Settings" sub="Models, folders, AI Boost" onClick={onSettings} />
        <UpdateChecker>{(open, checking) => <Row Icon={ArrowUpCircle} title="Check for updates" sub="Look for a newer version" onClick={open} busy={checking} />}</UpdateChecker>
        {msg && <p className="px-3 pb-2 text-[11px] text-amber-300">{msg}</p>}
      </section>
      <section className="rounded-2xl bg-[#0b1611] border border-[#17291f] p-4">
        <h3 className="pb-1 text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#8fd0a4]" />Project stats</h3>
        <Stat n={projects.length} label="Total projects" dot="bg-neutral-500" />
        <Stat n={done} label="Completed" dot="bg-[#3f9a5a]" />
        <Stat n={working} label="Processing" dot="bg-amber-400" />
        <Stat n={failed} label="Failed" dot="bg-rose-500" />
      </section>
    </aside>
  );
};
