import React from 'react';
import { 
  FilePlus2, 
  Film, 
  Settings2
} from 'lucide-react';

export type ActiveNavView = 'home' | 'my_projects' | 'settings' | 'studio' | 'progress' | 'clips';

interface FloatingSidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: 'home' | 'my_projects' | 'settings') => void;
  projectsCount?: number;
}

export const FloatingSidebar: React.FC<FloatingSidebarProps> = ({
  activeView,
  onSelectView,
  projectsCount = 0
}) => {
  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-40 select-none">
      {/* Floating Pill Dock (Exact match to screenshot!) */}
      <div className="bg-[#0b0e12]/95 backdrop-blur-md border border-[#1e242d] rounded-2xl p-1.5 flex flex-col items-center gap-2 shadow-2xl shadow-black/80">
        {/* 1. PLUS / NEW VIDEO (Active on home) */}
        <button
          onClick={() => onSelectView('home')}
          title="New Project / Start (Home)"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
            activeView === 'home'
              ? 'bg-[#182116] text-[#bef264] border border-[#bef264]/60 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#151920]'
          }`}
        >
          <FilePlus2 className={`w-5 h-5 ${activeView === 'home' ? 'text-[#bef264] stroke-[2.4]' : 'stroke-[1.8]'}`} />
          
          <span className="absolute left-14 px-2 py-1 rounded bg-[#161a22] border border-[#2b3340] text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
            Start / New Video
          </span>
        </button>

        {/* 2. MY PROJECTS */}
        <button
          onClick={() => onSelectView('my_projects')}
          title="My Projects"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
            activeView === 'my_projects' || activeView === 'progress' || activeView === 'clips'
              ? 'bg-[#182116] text-[#bef264] border border-[#bef264]/60 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#151920]'
          }`}
        >
          <Film className={`w-5 h-5 ${activeView === 'my_projects' || activeView === 'progress' || activeView === 'clips' ? 'text-[#bef264] stroke-[2.4]' : 'stroke-[1.8]'}`} />

          {projectsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#bef264]" />
          )}

          <span className="absolute left-14 px-2 py-1 rounded bg-[#161a22] border border-[#2b3340] text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
            My Projects
          </span>
        </button>

        {/* 3. SETTINGS */}
        <button
          onClick={() => onSelectView('settings')}
          title="Settings (Models, Hardware, Libraries)"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
            activeView === 'settings'
              ? 'bg-[#182116] text-[#bef264] border border-[#bef264]/60 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#151920]'
          }`}
        >
          <Settings2 className={`w-5 h-5 ${activeView === 'settings' ? 'text-[#bef264] stroke-[2.4]' : 'stroke-[1.8]'}`} />

          <span className="absolute left-14 px-2 py-1 rounded bg-[#161a22] border border-[#2b3340] text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
};
