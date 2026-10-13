import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface StudioHeaderProps {
  videoTitle: string;
  onBack: () => void;
  activeTab: 'format' | 'captions' | 'grade' | 'branding';
  onSelectTab: (tab: 'format' | 'captions' | 'grade' | 'branding') => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  videoTitle,
  onBack,
  activeTab,
  onSelectTab
}) => {
  const tabs = [
    {
      id: 'format' as const,
      num: '1',
      title: 'Preview & setup',
      sub: 'format, clips, language'
    },
    {
      id: 'captions' as const,
      num: '2',
      title: 'Captions',
      sub: 'style, colour, text'
    },
    {
      id: 'grade' as const,
      num: '3',
      title: 'Video',
      sub: 'grade the footage'
    },
    {
      id: 'branding' as const,
      num: '4',
      title: 'Branding',
      sub: 'mark, end card, music'
    }
  ];

  return (
    <div className="w-full bg-transparent px-8 pt-4 pb-2 select-none shrink-0 space-y-3">
      {/* 1. FLOATING HEADER ROW: [Back] button + video title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#14171d] hover:bg-[#1f242d] border border-[#232932] text-xs font-semibold text-neutral-300 hover:text-white transition-all shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#bef264]" />
          <span>Back</span>
        </button>

        <span className="text-xs text-neutral-500 font-mono truncate max-w-xl">
          {videoTitle}
        </span>
      </div>

      {/* 2. THE 4 STEP TABS (Preview & setup, Captions, Video, Branding) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-[#151c13] border-[#bef264] ring-1 ring-[#bef264]/40 shadow-sm'
                  : 'bg-[#0f1217] border-[#1d222b] hover:border-[#2b3340]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-[#bef264] text-black' : 'bg-[#1e242d] text-neutral-400'
                }`}>
                  {tab.num}
                </span>
                <span className={`font-bold text-xs truncate ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                  {tab.title}
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 pl-7 truncate">
                {tab.sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
