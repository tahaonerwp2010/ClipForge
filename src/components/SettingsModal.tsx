import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Mic, FolderOpen, Cpu, Eye, EyeOff, Download, ShieldCheck, Trash2, Check, Loader2, CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { SpeechModelItem } from '../types/clipper';
import { SoftwareManager } from '../services/softwareManager';
import { GeminiService, GeminiSettings } from '../services/geminiService';

type Tab = 'ai' | 'models' | 'folders' | 'system';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'AI Boost', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'models', label: 'Speech Models', icon: <Mic className="w-4 h-4" /> },
  { id: 'folders', label: 'Folders', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'system', label: 'System', icon: <Cpu className="w-4 h-4" /> },
];
const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (recommended)' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (lightest)' },
];
const fmtMB = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="p-5 rounded-2xl bg-[#12161f] border border-[#232936] space-y-3">
    <div>
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
    {children}
  </div>
);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }> = ({ tone = 'ghost', className = '', ...p }) => (
  <button type="button" {...p}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
      tone === 'primary' ? 'bg-[#bef264] hover:bg-[#a3e635] text-black'
      : tone === 'danger' ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30'
      : 'bg-[#1a202a] hover:bg-[#232b38] text-neutral-200 border border-[#2a3240]'} ${className}`} />
);

// ---------------- AI Boost ----------------
const AiTab: React.FC = () => {
  const [cfg, setCfg] = useState<GeminiSettings>(GeminiService.getSettings());
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const update = (p: Partial<GeminiSettings>) => setCfg(GeminiService.saveSettings(p));
  const test = async () => {
    setBusy(true); setResult(null);
    const r = await GeminiService.testConnection(cfg.apiKey, cfg.model);
    setResult({ ok: r.success, text: r.message });
    setCfg(GeminiService.getSettings());
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <Card title="AI Boost (Gemini)" hint="Uses Google Gemini to pick the best moments. If it is off, unavailable or out of quota, ClipForge automatically uses the offline finder, so clips are always made.">
        <label className="flex items-center justify-between text-xs text-neutral-200 font-semibold">
          Use AI Boost
          <input type="checkbox" checked={cfg.enabled} onChange={e => update({ enabled: e.target.checked })} className="w-4 h-4 accent-[#bef264]" />
        </label>
        <div className={cfg.enabled ? 'space-y-3' : 'space-y-3 opacity-40 pointer-events-none'}>
          <div>
            <label className="text-xs font-semibold text-neutral-300">API key</label>
            <div className="flex gap-2 mt-1">
              <input type={show ? 'text' : 'password'} value={cfg.apiKey} onChange={e => update({ apiKey: e.target.value.trim(), status: 'idle' })}
                placeholder="Paste your Gemini API key" spellCheck={false}
                className="flex-1 bg-[#0a0d11] border border-[#232936] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#bef264]/60" />
              <Btn onClick={() => setShow(s => !s)} title={show ? 'Hide' : 'Show'}>{show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Btn>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Free key: aistudio.google.com/apikey. It is stored only on this computer.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-300">Model</label>
            <select value={cfg.model} onChange={e => update({ model: e.target.value, status: 'idle' })}
              className="mt-1 w-full bg-[#0a0d11] border border-[#232936] rounded-lg px-3 py-2 text-xs text-white outline-none">
              {GEMINI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="text-[11px] text-neutral-500 mt-1">If the chosen model is not available for your key, ClipForge tries the next one automatically.</p>
          </div>
          <div className="flex items-center gap-3">
            <Btn tone="primary" onClick={test} disabled={busy || !cfg.apiKey}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />} Test connection
            </Btn>
            {cfg.status === 'connected' && !result && <span className="text-xs text-[#bef264] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Connected {cfg.lastTested && `(${cfg.lastTested})`}</span>}
          </div>
          {result && (
            <div className={`text-xs rounded-lg px-3 py-2 border flex items-start gap-2 ${result.ok ? 'bg-[#bef264]/10 border-[#bef264]/30 text-[#d9f99d]' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{result.text}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// ---------------- Speech models ----------------
const ModelsTab: React.FC = () => {
  const [models, setModels] = useState<SpeechModelItem[]>(SoftwareManager.getModels());
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const m = await SoftwareManager.syncModelStatus();
    setModels([...m]);
    try { const s = await window.electronAPI?.modelStatus?.(); if (s) setSizes(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.size]))); } catch { /* ignore */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const download = async (id: string) => {
    setError('');
    try {
      await SoftwareManager.downloadModel(id, () => setModels([...SoftwareManager.getModels()]));
    } catch (e: any) { setError(`Download failed: ${e?.message || e}`); }
    refresh();
  };
  const verify = async (id: string) => {
    setWorking(id);
    const r = await window.electronAPI?.verifyModel?.(id);
    setMsg(p => ({ ...p, [id]: { ok: !!r?.ok, text: r?.message || 'Verification is only available in the desktop app.' } }));
    setMissing(p => ({ ...p, [id]: !!r?.missing }));
    setWorking(null);
    refresh();
  };
  const remove = async (id: string) => {
    await window.electronAPI?.deleteModel?.(id);
    setConfirmDel(null); setMsg(p => { const n = { ...p }; delete n[id]; return n; });
    refresh();
  };
  const activate = (id: string) => { SoftwareManager.setActiveModelId(id); refresh(); };

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">Pick the speech model used to transcribe your videos. Small is the best balance for most computers.</p>
      {error && <div className="text-xs rounded-lg px-3 py-2 border bg-red-500/10 border-red-500/30 text-red-200">{error}</div>}
      {models.map(m => {
        const have = m.status === 'downloaded' || m.status === 'active';
        const downloading = m.status === 'downloading';
        return (
          <div key={m.id} className={`p-4 rounded-2xl border ${m.status === 'active' ? 'border-[#bef264]/50 bg-[#bef264]/5' : 'border-[#232936] bg-[#12161f]'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{m.name}</h3>
                  <span className="text-[11px] font-mono text-neutral-400">{have && sizes[m.id] ? fmtMB(sizes[m.id]) : m.diskSize}</span>
                  {m.status === 'active' && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#bef264] text-black">In use</span>}
                  {m.recommended && !have && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#1a202a] text-[#bef264] border border-[#2a3240]">Recommended</span>}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">{m.werScore} · {m.ramRequirement}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(!have || missing[m.id]) && !downloading && <Btn tone="primary" onClick={() => { setMissing(p => ({ ...p, [m.id]: false })); download(m.id); }}><Download className="w-3.5 h-3.5" /> Download</Btn>}
                {have && m.status !== 'active' && <Btn onClick={() => activate(m.id)}><Check className="w-3.5 h-3.5" /> Use this</Btn>}
                {!downloading && <Btn onClick={() => verify(m.id)} disabled={working === m.id}>{working === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Verify</Btn>}
                {have && (confirmDel === m.id
                  ? <><Btn tone="danger" onClick={() => remove(m.id)}>Yes, delete</Btn><Btn onClick={() => setConfirmDel(null)}>Cancel</Btn></>
                  : <Btn tone="danger" onClick={() => setConfirmDel(m.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</Btn>)}
              </div>
            </div>
            {downloading && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-[#0a0d11] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: `${m.downloadProgress || 0}%` }} /></div>
                <p className="text-[11px] text-neutral-400 mt-1">Downloading… {m.downloadProgress || 0}%</p>
              </div>
            )}
            {msg[m.id] && <p className={`text-[11px] mt-2 ${msg[m.id].ok ? 'text-[#bef264]' : 'text-red-300'}`}>{msg[m.id].text}</p>}
          </div>
        );
      })}
    </div>
  );
};

// ---------------- Folders ----------------
type Folders = { modelsDir: string; clipsDir: string; defaultModelsDir: string; defaultClipsDir: string; ytDir: string; defaultYtDir: string };
const FoldersTab: React.FC = () => {
  const [f, setF] = useState<Folders | null>(null);
  useEffect(() => { window.electronAPI?.getFolders?.().then(setF).catch(() => {}); }, []);
  if (!window.electronAPI?.getFolders) return <p className="text-xs text-neutral-400">Folder settings are available in the desktop app.</p>;
  if (!f) return null;
  const row = (kind: 'models' | 'clips' | 'youtube', title: string, hint: string, dir: string, def: string) => (
    <Card title={title} hint={hint}>
      <div className="bg-[#0a0d11] border border-[#232936] rounded-lg px-3 py-2 text-xs font-mono text-neutral-200 break-all">{dir}</div>
      <div className="flex gap-2">
        <Btn tone="primary" onClick={async () => setF(await window.electronAPI!.chooseFolder!(kind))}><FolderOpen className="w-3.5 h-3.5" /> Change</Btn>
        <Btn onClick={() => window.electronAPI!.openFolder!(dir)}>Open</Btn>
        {dir !== def && <Btn onClick={async () => setF(await window.electronAPI!.chooseFolder!(kind, true))}>Reset to default</Btn>}
      </div>
    </Card>
  );
  return (
    <div className="space-y-4">
      {row('models', '1. Models folder', 'Where speech models are downloaded. If you change it, download the models again or move the files there.', f.modelsDir, f.defaultModelsDir)}
      {row('clips', '2. Clips folder', 'Where finished clips are saved. Every project gets its own folder inside it.', f.clipsDir, f.defaultClipsDir)}
      {row('youtube', '3. YouTube downloads folder', 'Where videos downloaded from a YouTube link are saved.', f.ytDir || f.defaultYtDir, f.defaultYtDir)}
    </div>
  );
};

// ---------------- System ----------------
type EngineItem = { id: string; name: string; ok: boolean; required: boolean; detail: string };
type EngineReport = { items: EngineItem[]; allReady: boolean; missing: string[]; optionalMissing: string[] };
const SystemTab: React.FC = () => {
  const [specs, setSpecs] = useState<any>(null);
  const [eng, setEng] = useState<EngineReport | null>(null);
  const [busyHw, setBusyHw] = useState(false);
  const [busyEng, setBusyEng] = useState(false);
  const loadHw = async () => { setBusyHw(true); try { setSpecs(await window.electronAPI?.getSystemSpecs?.()); } catch { /* ignore */ } setBusyHw(false); };
  const loadEng = async () => { setBusyEng(true); try { setEng((await window.electronAPI?.engineCheck?.()) || null); } catch { /* ignore */ } setBusyEng(false); };
  useEffect(() => { loadHw(); loadEng(); }, []);
  if (!window.electronAPI) return <p className="text-xs text-neutral-400">System details are available in the desktop app.</p>;
  const Row = ({ k, v, ok, sub }: { k: string; v: string; ok?: boolean; sub?: string }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#1c222c] last:border-0 text-xs">
      <div><span className="text-neutral-400">{k}</span>{sub && <p className="text-[10px] text-neutral-500 mt-0.5 max-w-[360px]">{sub}</p>}</div>
      <span className={`font-semibold text-right ${ok === undefined ? 'text-white' : ok ? 'text-[#bef264]' : 'text-red-300'}`}>{v}</span>
    </div>
  );
  const Re = ({ onClick, busy }: { onClick: () => void; busy: boolean }) => (
    <Btn onClick={onClick} disabled={busy}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />} Recheck</Btn>
  );
  return (
    <div className="space-y-4">
      <Card title="Computer">
        <Row k="Processor (CPU)" v={specs?.cpuName || '…'} />
        <Row k="Memory (RAM)" v={specs ? `${specs.ramTotal} total · ${specs.ramAvailable} free` : '…'} />
        <Row k="Graphics card (GPU)" v={specs?.gpu || '…'} />
        <div><Re onClick={loadHw} busy={busyHw} /></div>
      </Card>
      <Card title="Software check" hint="Everything ClipForge needs to make clips. Press Recheck to scan again.">
        {eng && (
          <div className={`text-xs rounded-lg px-3 py-2 border ${eng.allReady ? 'bg-[#bef264]/10 border-[#bef264]/30 text-[#bef264]' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
            {eng.allReady ? 'All required software is installed and working.' : `Missing: ${eng.missing.join(', ')}. Reinstall ClipForge or put the files in the binaries folder.`}
            {eng.allReady && eng.optionalMissing.length > 0 && <span className="text-neutral-300"> Optional: {eng.optionalMissing.join(', ')}.</span>}
          </div>
        )}
        {eng?.items.map(i => <Row key={i.id} k={i.name} v={i.ok ? 'Ready' : i.required ? 'Missing' : 'Not yet'} ok={i.ok ? true : i.required ? false : undefined} sub={i.ok ? i.detail : i.detail} />)}
        {!eng && <p className="text-xs text-neutral-400">Checking…</p>}
        <div><Re onClick={loadEng} busy={busyEng} /></div>
      </Card>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ai');
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f12] text-neutral-200 overflow-y-auto">
      <div className="px-8 pt-6 border-b border-[#1e232a] bg-[#0f1216] shrink-0">
        <h1 className="text-xl font-display font-bold text-white tracking-tight">Settings</h1>
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${tab === t.id ? 'border-[#bef264] text-[#bef264]' : 'border-transparent text-neutral-400 hover:text-white'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-8 max-w-3xl">
        {tab === 'ai' && <AiTab />}
        {tab === 'models' && <ModelsTab />}
        {tab === 'folders' && <FoldersTab />}
        {tab === 'system' && <SystemTab />}
      </div>
    </div>
  );
};
