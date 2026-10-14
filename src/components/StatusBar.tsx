import React, { useEffect, useState } from 'react';
import { SoftwareManager } from '../services/softwareManager';

const shortCpu = (n: string) => n.replace(/\((R|TM|tm)\)/g, '').replace(/\s+(CPU|Processor)\b/gi, '').replace(/@.*$/, '').replace(/\s+/g, ' ').trim();

export const StatusBar: React.FC = () => {
  const [hw, setHw] = useState('');
  const [model, setModel] = useState('');
  useEffect(() => {
    window.electronAPI?.getSystemSpecs?.().then(s => { if (s) setHw(`${shortCpu(s.cpuName)} · ${s.ramTotal}`); }).catch(() => {});
    const id = SoftwareManager.getActiveModelId?.();
    const m = SoftwareManager.getModels?.().find(x => x.id === id);
    setModel(m ? m.name.replace(/^Whisper\s*/i, '') : id || '');
  }, []);
  return (
    <footer className="h-7 bg-[#050b08] border-t border-[#122219] flex items-center px-4 gap-5 text-[11px] text-neutral-500 select-none font-mono shrink-0">
      {hw && <span className="text-neutral-400 truncate">{hw}</span>}
      {model && <span>Speech model <span className="text-neutral-300">{model}</span></span>}
      <span className="ml-auto hidden sm:block">Cloud Boost <span className="text-neutral-300">on by default</span></span>
    </footer>
  );
};
