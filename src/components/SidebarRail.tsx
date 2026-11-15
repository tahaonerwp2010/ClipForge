import React, { useEffect, useState } from 'react';
import { Crown, ArrowRight, Home, Folder, Settings, RotateCw, ArrowUpCircle, Gem, Database } from 'lucide-react';
import { UpdateChecker, APP_VERSION } from './UpdateChecker';

export type ActiveNavView = 'home' | 'my_projects' | 'settings' | 'studio' | 'progress' | 'clips' | 'story' | 'story_run';

interface SidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: 'home' | 'my_projects' | 'settings') => void;
  projectsCount?: number;
  busy?: boolean;
  pro?: boolean;
  proLabel?: string;
  showBuy?: boolean;
  owner?: boolean;
  onBuyPro?: () => void;
  onVersionTap?: () => void;
  onOpenCms?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelectView, projectsCount = 0, busy = false, pro = false, proLabel = 'Pro unlocked', showBuy = false, owner = false, onBuyPro, onVersionTap, onOpenCms }) => {
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => { setLogoOk(true); }, []);
  const items: { id: 'home' | 'my_projects' | 'settings'; label: string; Icon: React.ElementType; active: boolean; count?: number }[] = [
    { id: 'home', label: 'Home', Icon: Home, active: activeView === 'home' || activeView === 'story' || activeView === 'studio' },
    { id: 'my_projects', label: 'Projects', Icon: Folder, active: activeView === 'my_projects' || activeView === 'progress' || activeView === 'clips' || activeView === 'story_run', count: projectsCount },
    { id: 'settings', label: 'Settings', Icon: Settings, active: activeView === 'settings' },
  ];
  return (
    <><aside className="hidden md:flex w-[240px] min-[1500px]:w-[290px] shrink-0 h-full p-2.5 pr-0 bg-[#030806] select-none">
    <div className="relative flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl border border-[#1b3a28] bg-[#050d09]">
      <div className="absolute inset-0 bg-cover bg-bottom opacity-95 pointer-events-none" style={{ backgroundImage: 'url(./side-forest.jpg)' }} />
      <div className="relative flex items-center gap-3 px-4 min-[1500px]:px-5 pt-5 min-[1500px]:pt-7 pb-5 min-[1500px]:pb-8 [@media(max-height:760px)]:pt-4 [@media(max-height:760px)]:pb-3">
        {logoOk
          ? <img src="./logo.png" alt="ClipForge" className="w-[54px] h-[54px] min-[1500px]:w-[68px] min-[1500px]:h-[68px] rounded-2xl shrink-0 drop-shadow-[0_0_14px_rgba(111,212,74,0.7)]" onError={() => setLogoOk(false)} draggable={false} />
          : <div className="w-[68px] h-[68px] rounded-2xl bg-[#bef264] text-black font-black flex items-center justify-center text-xl shrink-0">C</div>}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 whitespace-nowrap leading-none">
            <span className="text-[23px] min-[1500px]:text-[29px] font-bold text-white tracking-tight">ClipForge</span>
            </div>
          <div className="text-[12.5px] min-[1500px]:text-[14px] text-neutral-200 mt-1 whitespace-nowrap">by taha.ai</div>
          <div className="text-[11px] min-[1500px]:text-[12px] text-neutral-400 mt-0.5 whitespace-nowrap">AI clips. Real impact.</div>
        </div>
      </div>

      <nav className="relative px-3 space-y-1.5 min-[1500px]:space-y-2.5">
        {items.map(({ id, label, Icon, active, count }) => (
          <button key={id} type="button" onClick={() => onSelectView(id)}
            className={`w-full flex items-center gap-3.5 px-3.5 h-[46px] min-[1500px]:gap-4 min-[1500px]:px-4 min-[1500px]:h-[58px] [@media(max-height:760px)]:h-[42px] rounded-xl text-[15px] min-[1500px]:text-[17px] font-medium transition-colors cursor-pointer border ${active ? 'bg-gradient-to-r from-[#245f31] to-[#143a22] border-[#6fd44a]/80 text-white shadow-[0_0_20px_-2px_rgba(111,212,74,0.55),inset_0_0_16px_-6px_rgba(111,212,74,0.5),inset_3px_0_0_#a3e635]' : 'border-transparent text-neutral-200 hover:text-white hover:bg-[#0c1a13]'}`}>
            <Icon className={`w-[22px] h-[22px] min-[1500px]:w-[26px] min-[1500px]:h-[26px] ${active ? 'text-[#b6f24a]' : 'text-neutral-300'}`} strokeWidth={1.7} />
            <span className="flex-1 text-left">{label}</span>
            {count ? <span className={`text-[14px] font-semibold min-w-[30px] text-center px-2 py-0.5 rounded-lg ${active ? 'bg-[#1f4a31] text-[#bef264]' : 'bg-[#14281d] text-neutral-100'}`}>{count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="relative px-3 min-[1500px]:px-4 pb-3 min-[1500px]:pb-4 space-y-2 min-[1500px]:space-y-2.5">
        {!showBuy ? null : pro ? (
          <div className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-[#bef264] bg-gradient-to-b from-[#143a22] to-[#0c2418] border border-[#2f6b45]"><Gem className="w-5 h-5" /><span>{proLabel}</span></div>
        ) : (
          <div className="relative w-full shadow-[0_0_18px_-4px_rgba(111,212,74,0.5)] rounded-[10px]">
            <img src="./gopro-card.png" alt="Go Pro: unlock the full potential with ClipForge Pro" className="block w-full h-auto" draggable={false} />
            <button type="button" onClick={onBuyPro} aria-label="Upgrade Now" className="absolute left-[5.5%] top-[68.4%] w-[47.6%] h-[17.9%] rounded-full cursor-pointer bg-transparent hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#bef264]" />
          </div>
        )}
        <UpdateChecker>
          {(open, checking) => (
            <button type="button" onClick={open} disabled={checking}
              className="w-full flex items-center gap-3 px-3.5 h-[44px] min-[1500px]:gap-3.5 min-[1500px]:px-4 min-[1500px]:h-[52px] rounded-xl text-[14px] min-[1500px]:text-[15px] font-medium text-neutral-100 hover:text-white bg-[#0a1610]/90 hover:bg-[#10201a] border border-[#1d3a29] transition-colors cursor-pointer disabled:opacity-60">
              {checking ? <RotateCw className="w-6 h-6 text-[#7ddc4a] animate-spin" /> : <ArrowUpCircle className="w-6 h-6 text-[#7ddc4a]" strokeWidth={1.7} />}
              <span>{checking ? 'Checking…' : 'Check for updates'}</span>
            </button>
          )}
        </UpdateChecker>
        <div className="flex items-center justify-between px-2 pt-1.5 text-[14px] text-neutral-300">
          <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${busy ? 'bg-amber-400 animate-pulse' : 'bg-[#bef264]'}`} />{busy ? 'Working' : 'Ready'}</span>
          {owner && <button type="button" onClick={onOpenCms} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#12201a] border border-[#2a4a35] text-[10px] font-bold text-[#bef264] cursor-pointer"><Database className="w-3 h-3" />CMS</button>}
          <span className="cursor-default" onClick={onVersionTap}>v{APP_VERSION}</span>
        </div>
      </div>
    </div></aside>
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-[60] flex bg-[#060d0a] border-t border-[#122219] pb-[env(safe-area-inset-bottom)]">
      {items.map(({ id, label, Icon, active, count }) => (
        <button key={id} type="button" onClick={() => onSelectView(id)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold relative ${active ? 'text-[#bef264]' : 'text-neutral-400'}`}>
          <Icon className="w-5 h-5" />{label}
          {count ? <span className="absolute top-1 right-[30%] text-[9px] min-w-[14px] text-center rounded-full bg-[#1f4a31] text-[#bef264] px-1">{count}</span> : null}
        </button>
      ))}
      <UpdateChecker>{(open, checking) => (
        <button type="button" onClick={open} disabled={checking} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-neutral-400">
          <ArrowUpCircle className="w-5 h-5" />{checking ? '…' : 'Update'}
        </button>)}
      </UpdateChecker>
    </nav></>
  );
};
