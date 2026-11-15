import React, { useState } from 'react';
import { Crown, TrendingUp, Plus, FolderOpen, Settings, ArrowUpCircle, ChevronRight, Lightbulb, Clock, BarChart3, RotateCw, Zap, Play, CheckCircle2, CircleDot, AlertCircle, Gem, ArrowRight, MoreVertical } from 'lucide-react';
import { ProjectItem } from '../types/clipper';
import { UpdateChecker } from './UpdateChecker';

const ago = (p: ProjectItem) => (p.lastEdited || p.createdAt || '').toString();

export const RecentProjects: React.FC<{ projects: ProjectItem[]; onOpen: (p: ProjectItem) => void; onViewAll: () => void }> = ({ projects, onOpen, onViewAll }) => {
  if (!projects.length) return null;
  const tone = (p: ProjectItem): [React.ElementType, string, string] => p.status === 'Finished' ? [CheckCircle2, 'text-[#7ddc5a]', 'Completed'] : p.status === 'Failed' ? [AlertCircle, 'text-rose-400', 'Failed'] : p.status === 'Queued' ? [CircleDot, 'text-sky-400', 'Queued'] : [CircleDot, 'text-amber-400', 'Processing'];
  return (
    <section className="w-full mt-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5"><Clock className="w-[22px] h-[22px] text-[#8fd13a]" strokeWidth={1.8} /><h2 className="text-[19px] font-semibold text-white tracking-tight">Recent Projects</h2></div>
        <button type="button" onClick={onViewAll} className="text-[13px] font-medium text-neutral-200 hover:text-white flex items-center gap-2 cursor-pointer">View all <ArrowRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
        {projects.slice(0, 3).map(p => {
          const [Ic, col, label] = tone(p);
          return (
            <button key={p.id} type="button" onClick={() => onOpen(p)} className="text-left flex items-center gap-3.5 p-2.5 rounded-xl bg-[#0a1510]/90 border border-[#1c3326] hover:border-[#3f7a4a] transition-colors cursor-pointer">
              <div className="w-[100px] h-[90px] rounded-lg overflow-hidden shrink-0 bg-[#10201a] relative">
                {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <Play className="w-5 h-5 text-[#3f9a5a] absolute inset-0 m-auto" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-white truncate">{p.name.replace(/\.[a-z0-9]{2,4}$/i, '')}</div>
                <div className="text-[13px] text-neutral-400 mt-1.5 truncate">{ago(p)}</div>
                <div className={`flex items-center gap-1.5 mt-2 text-[13px] font-medium ${col}`}><Ic className="w-4 h-4" />{label}</div>
              </div>
              <MoreVertical className="w-[18px] h-[18px] text-neutral-400 shrink-0 mr-1" />
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

export const HomeAside: React.FC<{ projects: ProjectItem[]; onNew: () => void; onSettings: () => void; showPro?: boolean; onBuyPro?: () => void; aiBoostKeys?: number }> = ({ projects, onNew, onSettings, showPro = false, onBuyPro, aiBoostKeys = 0 }) => {
  const [msg, setMsg] = useState('');
  const openClips = async () => {
    try { const f = await window.electronAPI?.getFolders?.(); if (f) { await window.electronAPI?.openFolder?.(f.clipsDir); return; } } catch { /* ignore */ }
    setMsg('The clips folder can be opened in the desktop app.'); setTimeout(() => setMsg(''), 2500);
  };
  const done = projects.filter(p => p.status === 'Finished').length;
  const working = projects.filter(p => p.status === 'Processing' || p.status === 'Queued').length;
  const failed = projects.filter(p => p.status === 'Failed').length;
  const Row = ({ Icon, title, sub, onClick, busy }: { Icon: React.ElementType; title: string; sub: string; onClick: () => void; busy?: boolean }) => (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-2 py-[7px] rounded-xl hover:bg-[#10231a] transition-colors text-left cursor-pointer group">
      <span className="w-[42px] h-[42px] rounded-[10px] bg-gradient-to-b from-[#1f5a35] to-[#12361f] border border-[#2c6b40] flex items-center justify-center shrink-0">{busy ? <RotateCw className="w-5 h-5 text-[#b6f24a] animate-spin" /> : <Icon className="w-5 h-5 text-[#b6f24a]" strokeWidth={2} />}</span>
      <span className="flex-1 min-w-0"><span className="block text-[14px] font-medium text-white leading-tight">{title}</span><span className="block text-[11px] text-neutral-400 truncate mt-0.5">{sub}</span></span>
      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-[#a3e635]" />
    </button>
  );
  const Stat = ({ Ic, n, label, col }: { Ic: React.ElementType; n: number; label: string; col: string }) => (
    <div className="flex items-center gap-3.5 py-[9px] border-t border-[#14281c] first:border-t-0"><Ic className={`w-[22px] h-[22px] ${col}`} strokeWidth={2.2} /><span className="text-[21px] font-medium text-white w-7 leading-none">{n}</span><span className="text-[14px] text-neutral-300 ml-3">{label}</span></div>
  );
  const card = 'rounded-2xl bg-gradient-to-b from-[#0b1a11] to-[#07110b] border border-[#2a5a3a]/80 shadow-[0_0_16px_-6px_rgba(111,212,74,0.4)]';
  return (
    <aside className="w-full xl:w-[282px] shrink-0 space-y-3.5">
      <div className="flex items-center h-[34px] mb-1">
        <button type="button" onClick={onSettings} title="AI Boost settings"
          className={`h-[34px] flex items-center gap-2 px-3.5 rounded-full border text-[12px] font-medium cursor-pointer transition-colors ${aiBoostKeys ? 'border-[#2f7a45] bg-[#0b1d13] text-white hover:bg-[#10281a]' : 'border-[#22382b] bg-[#0a140f] text-neutral-400 hover:text-white'}`}>
          <Zap className={`w-4 h-4 ${aiBoostKeys ? 'text-[#b6f24a] fill-[#b6f24a]' : ''}`} /> AI Boost {aiBoostKeys ? `\u2022 ${aiBoostKeys} key${aiBoostKeys === 1 ? '' : 's'}` : '\u2022 off'}
        </button>
      </div>
      <section className={`${card} p-3.5 pb-2.5`}>
        <h3 className="px-1.5 pb-2 text-[18px] font-medium text-white flex items-center gap-3"><Zap className="w-6 h-6 text-[#b6f24a] fill-[#b6f24a]" strokeWidth={1.5} />Quick Actions</h3>
        <Row Icon={Plus} title="New Project" sub="Start with a video or link" onClick={onNew} />
        <Row Icon={FolderOpen} title={(window as any).electronAPI?.isMobile ? 'Save clips to gallery' : 'Open Clips Folder'} sub={(window as any).electronAPI?.isMobile ? 'Copy finished clips to your phone gallery' : 'See your finished clips'} onClick={openClips} />
        <Row Icon={Settings} title="Settings" sub="Models, folders, AI Boost" onClick={onSettings} />
        <UpdateChecker>{(open, checking) => <Row Icon={ArrowUpCircle} title="Check for Updates" sub="Look for a newer version" onClick={open} busy={checking} />}</UpdateChecker>
        {msg && <p className="px-3 pb-2 text-[11px] text-amber-300">{msg}</p>}
      </section>
      <section className={`${card} p-4 pt-3.5`}>
        <h3 className="pb-2 text-[18px] font-medium text-white flex items-center gap-3"><BarChart3 className="w-6 h-6 text-[#b6f24a]" strokeWidth={2.2} />Project Stats<TrendingUp className="w-12 h-6 ml-auto text-[#8fd13a]" strokeWidth={1.8} /></h3>
        <Stat Ic={Play} n={projects.length} label="Total Projects" col="text-[#5fd13a] fill-[#5fd13a]" />
        <Stat Ic={CheckCircle2} n={done} label="Completed" col="text-[#5fd13a]" />
        <Stat Ic={CircleDot} n={working} label="Processing" col="text-amber-400" />
        <Stat Ic={AlertCircle} n={failed} label="Failed" col="text-rose-500" />
      </section>
    </aside>
  );
};
