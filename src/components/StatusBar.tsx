import React from 'react';

interface StatusBarProps {
  statusText?: string;
  hardwareText?: string;
  modelText?: string;
  encoderText?: string;
  cloudBoostText?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  statusText = 'Ready',
  hardwareText = 'Core i7-6600U · 7GB',
  modelText = 'Small',
  encoderText = 'libopenh264 (software)',
  cloudBoostText = 'On by default'
}) => {
  return (
    <footer className="h-7 bg-[#050608] border-t border-[#14181f] flex items-center justify-between px-4 text-[11px] text-neutral-400 select-none font-mono shrink-0">
      <div className="flex items-center gap-5">
        {/* Ready with green dot */}
        <div className="flex items-center gap-1.5 text-neutral-300">
          <span className="w-2 h-2 rounded-full bg-[#bef264]" />
          <span className="font-medium text-neutral-200">{statusText}</span>
        </div>

        {/* Hardware in amber */}
        <div className="text-[#f59e0b] font-medium">
          {hardwareText}
        </div>

        {/* Model */}
        <div className="text-neutral-400">
          <span>Model — </span>
          <span className="text-neutral-200">{modelText}</span>
        </div>

        {/* Encoder in amber */}
        <div>
          <span className="text-neutral-500">Encoder — </span>
          <span className="text-[#f59e0b] font-medium">{encoderText}</span>
        </div>

        {/* Cloud Boost */}
        <div className="hidden sm:block text-neutral-400">
          <span>Cloud Boost — </span>
          <span className="text-neutral-300">{cloudBoostText}</span>
        </div>
      </div>
    </footer>
  );
};
