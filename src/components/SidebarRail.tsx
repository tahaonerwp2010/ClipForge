import React, { useEffect, useState } from 'react';
import { Home, Folder, Settings, RotateCw, ArrowUpCircle, Crown, Database } from 'lucide-react';
import { UpdateChecker, APP_VERSION } from './UpdateChecker';

export type ActiveNavView = 'home' | 'my_projects' | 'settings' | 'studio' | 'progress' | 'clips';

interface SidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: 'home' | 'my_projects' | 'settings') => void;
  projectsCount?: number;
  busy?: boolean;
  pro?: boolean;
  showBuy?: boolean;
  owner?: boolean;
  onBuyPro?: () => void;
  onVersionTap?: () => void;
  onOpenCms?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelectView, projectsCount = 0, busy = false, pro = false, showBuy = false, owner = false, onBuyPro, onVersionTap, onOpenCms }) => {
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => { setLogoOk(true); }, []);
  const items: { id: 'home' | 'my_projects' | 'settings'; label: string; Icon: React.ElementType; active: boolean; count?: number }[] = [
    { id: 'home', label: 'Home', Icon: Home, active: activeView === 'home' || activeView === 'studio' },
    { id: 'my_projects', label: 'Projects', Icon: Folder, active: activeView === 'my_projects' || activeView === 'progress' || activeView === 'clips', count: projectsCount },
    { id: 'settings', label: 'Settings', Icon: Settings, active: activeView === 'settings' },
  ];
  return (
    <><aside className="hidden md:flex w-[220px] shrink-0 h-full flex-col bg-[#060d0a] border-r border-[#122219] select-none">
      <div className="flex items-center gap-2.5 px-4 pt-6 pb-7">
        {logoOk
          ? <img src="./logo.png" alt="ClipForge" className="w-12 h-12 rounded-xl shrink-0" onError={() => setLogoOk(false)} draggable={false} />
          : <div className="w-12 h-12 rounded-xl bg-[#bef264] text-black font-black flex items-center justify-center text-xl shrink-0">C</div>}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 whitespace-nowrap leading-none">
            <span className="text-[21px] font-extrabold text-white tracking-tight">ClipForge</span>
            <span className="text-[9px] font-semibold text-[#8fd0a4] tracking-normal">by taha.ai</span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1.5 whitespace-nowrap">AI clips. Real impact.</div>
        </div>
      </div>

      <nav className="px-3 space-y-1">
        {items.map(({ id, label, Icon, active, count }) => (
          <button key={id} type="button" onClick={() => onSelectView(id)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer border ${active ? 'bg-[#112a1d] border-[#1f4a31] text-white' : 'border-transparent text-neutral-400 hover:text-white hover:bg-[#0c1a13]'}`}>
            <Icon className={`w-[18px] h-[18px] ${active ? 'text-[#bef264]' : ''}`} />
            <span className="flex-1 text-left">{label}</span>
            {count ? <span className={`text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 rounded-md ${active ? 'bg-[#1f4a31] text-[#bef264]' : 'bg-[#10201a] text-neutral-400'}`}>{count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="px-3 pb-4 space-y-2">
        {!showBuy ? null : pro ? (
          <div className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#bef264] bg-[#12201a] border border-[#2a4a35]"><Crown className="w-4 h-4" /><span>Pro unlocked</span></div>
        ) : (
          <button type="button" onClick={onBuyPro}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-black bg-[#bef264] hover:bg-[#a3e635] transition-colors cursor-pointer">
            <Crown className="w-4 h-4" /><span>Buy Pro</span>
          </button>
        )}
        <UpdateChecker>
          {(open, checking) => (
            <button type="button" onClick={open} disabled={checking}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-[#0b1611] hover:bg-[#10201a] border border-[#17291f] transition-colors cursor-pointer disabled:opacity-60">
              {checking ? <RotateCw className="w-4 h-4 text-[#8fd0a4] animate-spin" /> : <ArrowUpCircle className="w-4 h-4 text-[#8fd0a4]" />}
              <span>{checking ? 'Checking…' : 'Check for updates'}</span>
            </button>
          )}
        </UpdateChecker>
        <div className="flex items-center justify-between px-1.5 pt-1 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${busy ? 'bg-amber-400 animate-pulse' : 'bg-[#bef264]'}`} />{busy ? 'Working' : 'Ready'}</span>
          {owner && <button type="button" onClick={onOpenCms} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#12201a] border border-[#2a4a35] text-[10px] font-bold text-[#bef264] cursor-pointer"><Database className="w-3 h-3" />CMS</button>}
          <span className="font-mono cursor-default" onClick={onVersionTap}>v{APP_VERSION}</span>
        </div>
      </div>
    </aside>
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
