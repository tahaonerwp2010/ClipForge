import React, { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
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
    <footer className="h-9 bg-[#030806] flex items-center px-6 gap-6 text-[14px] text-neutral-400 select-none shrink-0">
      {hw && <span className="text-neutral-200 truncate">{hw}</span>}
      {model && <span>Speech model: <span className="text-neutral-300">{model}</span></span>}
      <span className="ml-auto hidden sm:flex items-center gap-2 text-neutral-300"><Cloud className="w-[18px] h-[18px]" strokeWidth={1.6} />Cloud Boost: on by default</span>
    </footer>
  );
};
