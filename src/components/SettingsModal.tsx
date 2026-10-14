import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Mic, FolderOpen, Cpu, Eye, EyeOff, Download, ShieldCheck, Trash2, Check, Loader2, CheckCircle2, AlertTriangle, RotateCw, Plus, Lock } from 'lucide-react';
import { SpeechModelItem } from '../types/clipper';
import { SoftwareManager } from '../services/softwareManager';
import { AiService, AiConfig, AiProviderCfg, KeyStatus, PROVIDERS, PROVIDER_ORDER } from '../services/aiService';

type Tab = 'ai' | 'models' | 'folders' | 'system';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'AI Boost', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'models', label: 'Speech Models', icon: <Mic className="w-4 h-4" /> },
  { id: 'folders', label: 'Folders', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'system', label: 'System', icon: <Cpu className="w-4 h-4" /> },
];
const fmtMB = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="p-5 rounded-2xl bg-[#101d17] border border-[#20322a] space-y-3">
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
      : 'bg-[#172820] hover:bg-[#21332a] text-neutral-200 border border-[#263b31]'} ${className}`} />
);

// ---------------- AI Boost ----------------
const STATUS: Record<KeyStatus, { text: string; cls: string }> = {
  ok: { text: 'Working', cls: 'bg-[#3f9a5a]/15 text-[#8fd0a4] border-[#3f9a5a]/30' },
  limit: { text: 'Limit reached', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  credits: { text: 'No credits', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  invalid: { text: 'Invalid key', cls: 'bg-red-500/10 text-red-300 border-red-500/30' },
  untested: { text: 'Not tested', cls: 'bg-[#172820] text-neutral-400 border-[#263b31]' },
  network: { text: 'Not tested', cls: 'bg-[#172820] text-neutral-400 border-[#263b31]' },
  unknown: { text: 'Not tested', cls: 'bg-[#172820] text-neutral-400 border-[#263b31]' },
};
const mask = (k: string) => (k.length <= 10 ? '••••••' : `${k.slice(0, 4)}••••••••${k.slice(-4)}`);
const LIVE_LIST = ['openrouter', 'groq', 'gemini'];

const AiTab: React.FC = () => {
  const [cfg, setCfg] = useState<AiConfig>(AiService.getConfig());
  const [sel, setSel] = useState<string>(cfg.active);
  const [newKey, setNewKey] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [listBusy, setListBusy] = useState(false);
  const [addErr, setAddErr] = useState('');

  const commit = (next: AiConfig) => setCfg(AiService.saveConfig(next));
  const patchProv = (id: string, p: Partial<AiProviderCfg>) => commit({ ...cfg, providers: { ...cfg.providers, [id]: { ...cfg.providers[id], ...p } } });

  // Keys re-verify themselves (cheap check, no quota): when this page opens and every 2 minutes, so nothing silently "goes offline".
  useEffect(() => {
    let alive = true;
    const run = () => AiService.refreshAll().then(c => { if (alive) setCfg(c); }).catch(() => { /* ignore */ });
    run(); const t = setInterval(run, 120000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const P = PROVIDERS[sel]; const pc = cfg.providers[sel];
  const models = AiService.models(sel, cfg);
  const modelLabel = (id: string) => models.find(m => m.id === id)?.label || id;

  const addKey = async () => {
    const k = newKey.trim(); setAddErr('');
    if (!k) return;
    if (pc.keys.some(x => x.key === k)) { setAddErr('This key is already added.'); return; }
    const entry = AiService.newKey(k);
    commit({ ...cfg, providers: { ...cfg.providers, [sel]: { ...pc, keys: [...pc.keys, entry] } } });
    setNewKey('');
    const r = await AiService.ping(sel, k);
    const latest = AiService.getConfig();
    const t = latest.providers[sel].keys.find(x => x.id === entry.id);
    if (t && r.status !== 'network' && r.status !== 'unknown') { t.status = r.status; t.checked = Date.now(); }
    setCfg(AiService.saveConfig(latest));
    setNote(n => ({ ...n, [entry.id]: { ok: r.status === 'ok', text: r.status === 'ok' ? 'Key accepted.' : r.message } }));
  };
  const testKey = async (id: string, key: string) => {
    setBusyKey(id);
    const r = await AiService.test(sel, key, pc.model || P.models[0].id);
    const latest = AiService.getConfig();
    const t = latest.providers[sel].keys.find(x => x.id === id);
    if (t) { t.status = r.success ? 'ok' : r.kind === 'invalid_key' ? 'invalid' : r.kind === 'credits' ? 'credits' : r.kind === 'rate' ? 'limit' : t.status; t.checked = Date.now(); }
    setCfg(AiService.saveConfig(latest));
    setNote(n => ({ ...n, [id]: { ok: r.success, text: r.message } }));
    setBusyKey(null);
  };
  const removeKey = (id: string) => {
    patchProv(sel, { keys: pc.keys.filter(k => k.id !== id) });
    setConfirmDel(null); setNote(n => { const x = { ...n }; delete x[id]; return x; });
  };
  const refreshList = async () => {
    setListBusy(true);
    const list = await AiService.listModels(sel, pc.keys[0]?.key || '');
    if (list.length) patchProv(sel, { extra: list });
    setListBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="AI Boost" hint="Add API keys from any provider. ClipForge uses them to pick moments, write titles, hooks and descriptions, and translate captions. If nothing works, the built-in local writer takes over, so clips are always made.">
        <label className="flex items-center justify-between text-xs text-neutral-200 font-semibold">
          Use AI Boost
          <input type="checkbox" checked={cfg.enabled} onChange={e => commit({ ...cfg, enabled: e.target.checked })} className="w-4 h-4 accent-[#bef264]" />
        </label>
        <div className="rounded-xl bg-[#0b1611] border border-[#1b2d24] p-3">
          <p className="text-[11px] font-bold text-neutral-300 mb-2">How it chooses, step by step</p>
          <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal pl-4">
            <li>Starts with your <span className="text-[#8fd0a4] font-semibold">Primary</span> provider and its chosen model.</li>
            <li>If that model fails, it tries the next models of the same provider <span className="text-neutral-500">(when Auto fallback is on)</span>.</li>
            <li>If every model fails, it tries the <span className="text-[#8fd0a4] font-semibold">next API key</span> of the same provider.</li>
            <li>If all keys fail or the credits are finished, it moves to the <span className="text-[#8fd0a4] font-semibold">next provider</span> and repeats the same steps.</li>
            <li>If no provider works, or no key is added, the <span className="text-[#8fd0a4] font-semibold">built-in local AI</span> writes the title, hook, description and hashtags.</li>
          </ol>
          <p className="text-[10px] text-neutral-500 mt-2">Keys are re-checked automatically without using your quota, and every job tries all keys itself, so you never need to press Test again just to keep it online.</p>
        </div>
      </Card>

      <div className={cfg.enabled ? 'space-y-4' : 'space-y-4 opacity-40 pointer-events-none'}>
        <Card title="Provider" hint="Pick a provider to add its keys and choose its model. The dot shows how many keys are added.">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {PROVIDER_ORDER.map(id => {
              const pr = PROVIDERS[id]; const n = cfg.providers[id].keys.length; const on = sel === id;
              return (
                <button key={id} type="button" onClick={() => { setSel(id); setConfirmDel(null); setAddErr(''); }}
                  className={`text-left rounded-xl px-3 py-2.5 border transition-all cursor-pointer ${on ? 'bg-[#bef264]/10 border-[#bef264]/50' : 'bg-[#0b1611] border-[#1b2d24] hover:border-[#2c4a3a]'}`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    {pr.name}
                    {n > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#8fd0a4]" />}
                    {cfg.active === id && <span className="ml-auto text-[9px] font-extrabold text-[#bef264] uppercase tracking-wide">Primary</span>}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{n > 0 ? `${n} key${n > 1 ? 's' : ''} · ` : ''}{pr.tagline}</div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={`${P.name} · API keys`} hint={`Add as many keys as you like. If one key stops working, the next one is used. Get a key at ${P.keyUrl}.`}>
          <div className="space-y-2">
            {pc.keys.length === 0 && <p className="text-[11px] text-neutral-500">No key added for {P.name} yet.</p>}
            {pc.keys.map((k, i) => {
              const st = STATUS[k.status] || STATUS.untested; const nt = note[k.id];
              return (
                <div key={k.id} className="rounded-xl bg-[#0b1611] border border-[#1b2d24] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-neutral-500 w-10 shrink-0">Key {i + 1}</span>
                    <span className="flex-1 text-xs font-mono text-neutral-200 truncate">{mask(k.key)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.text}</span>
                    <Btn onClick={() => testKey(k.id, k.key)} disabled={busyKey === k.id} title="Send a real test request">
                      {busyKey === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />} Test
                    </Btn>
                    {confirmDel === k.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11px] text-red-300 font-semibold">Remove this key?</span>
                        <Btn tone="danger" onClick={() => removeKey(k.id)}>Yes, remove</Btn>
                        <Btn onClick={() => setConfirmDel(null)}>Cancel</Btn>
                      </span>
                    ) : (
                      <Btn tone="danger" onClick={() => setConfirmDel(k.id)} title="Remove key"><Trash2 className="w-3.5 h-3.5" /> Remove</Btn>
                    )}
                  </div>
                  {nt && <p className={`text-[11px] mt-1.5 flex items-start gap-1.5 ${nt.ok ? 'text-[#8fd0a4]' : 'text-red-300'}`}>{nt.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}<span>{nt.text}</span></p>}
                </div>
              );
            })}
            <div className="flex gap-2 pt-1">
              <input type={showNew ? 'text' : 'password'} value={newKey} onChange={e => { setNewKey(e.target.value); setAddErr(''); }}
                onKeyDown={e => { if (e.key === 'Enter') addKey(); }}
                placeholder={`Paste a ${P.name} API key`} spellCheck={false}
                className="flex-1 bg-[#09100d] border border-[#20322a] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#3f9a5a]/60" />
              <Btn onClick={() => setShowNew(s => !s)} title={showNew ? 'Hide' : 'Show'}>{showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Btn>
              <Btn tone="primary" onClick={addKey} disabled={!newKey.trim()}><Plus className="w-3.5 h-3.5" /> Add key</Btn>
            </div>
            {addErr && <p className="text-[11px] text-red-300">{addErr}</p>}
            <p className="text-[10px] text-neutral-500">Keys are stored only on this computer and are sent only to {P.name}.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {cfg.active === sel
              ? <span className="text-[11px] font-bold text-[#bef264] flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Primary provider (tried first)</span>
              : <Btn onClick={() => commit({ ...cfg, active: sel })}>Make {P.name} the primary provider</Btn>}
          </div>
        </Card>

        <Card title={`${P.name} · Models`} hint={P.free ? 'Models that work on the free plan of this provider.' : 'Low-cost models of this provider (these need a paid key).'}>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0b1611] border border-[#1b2d24] px-3 py-2.5">
            <div>
              <div className="text-xs font-bold text-white">Auto fallback</div>
              <div className="text-[11px] text-neutral-400">{pc.auto ? 'The app decides the model. If one model fails, it moves to the next one by itself.' : 'Off: only the model you choose below is used.'}</div>
            </div>
            <button type="button" onClick={() => patchProv(sel, { auto: !pc.auto })} role="switch" aria-checked={pc.auto}
              className={`w-10 h-6 rounded-full p-0.5 transition-all cursor-pointer shrink-0 ${pc.auto ? 'bg-[#bef264]' : 'bg-[#263b31]'}`}>
              <span className={`block w-5 h-5 rounded-full bg-[#07100c] transition-all ${pc.auto ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select value={pc.auto ? '' : pc.model} disabled={pc.auto} onChange={e => patchProv(sel, { model: e.target.value })}
                className="w-full bg-[#09100d] border border-[#20322a] rounded-lg px-3 py-2 text-xs text-white outline-none disabled:opacity-60 disabled:cursor-not-allowed">
                {pc.auto && <option value="">Auto · the app decides the model</option>}
                {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              {pc.auto && <Lock className="w-3.5 h-3.5 text-neutral-500 absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none" />}
            </div>
            {LIVE_LIST.includes(sel) && (
              <Btn onClick={refreshList} disabled={listBusy || (sel !== 'openrouter' && !pc.keys.length)} title="Get the latest model list">
                {listBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
              </Btn>
            )}
          </div>
          <div>
            <p className="text-[11px] text-neutral-500 mb-1.5">{pc.auto ? 'Tried in this order:' : 'Available models:'}</p>
            <div className="flex flex-wrap gap-1.5">
              {models.map((m, i) => (
                <span key={m.id} className={`text-[10px] px-2 py-1 rounded-lg border ${!pc.auto && pc.model === m.id ? 'border-[#bef264]/50 text-[#d9f99d] bg-[#bef264]/10' : 'border-[#1b2d24] text-neutral-400 bg-[#0b1611]'}`}>
                  {pc.auto ? `${i + 1}. ` : ''}{modelLabel(m.id)}{m.vision ? ' · vision' : ''}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
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
      <p className="text-xs text-neutral-400">Pick the speech model used to transcribe your videos. Small is the best balance for most computers. Stars show how well each model understands each language (approximate). For the most exact caption timing, also download Caption sync.</p>
      {error && <div className="text-xs rounded-lg px-3 py-2 border bg-red-500/10 border-red-500/30 text-red-200">{error}</div>}
      {[...models.filter(m => m.kind !== 'aligner'), ...models.filter(m => m.kind === 'aligner')].map(m => {
        const isAl = m.kind === 'aligner';
        const have = m.status === 'downloaded' || m.status === 'active';
        const downloading = m.status === 'downloading';
        return (
          <div key={m.id} className={`p-4 rounded-2xl border ${m.status === 'active' ? 'border-[#3f9a5a]/50 bg-[#3f9a5a]/5' : 'border-[#20322a] bg-[#101d17]'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{m.name}</h3>
                  <span className="text-[11px] font-mono text-neutral-400">{have && sizes[m.id] ? fmtMB(sizes[m.id]) : m.diskSize}</span>
                  {m.status === 'active' && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#bef264] text-black">In use</span>}
                  {m.recommended && !have && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#172820] text-[#8fd0a4] border border-[#263b31]">Recommended</span>}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5 max-w-xl">{m.werScore} · {m.ramRequirement}</p>
                {m.langs && (
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-1.5">
                    {m.langs.map(l => (
                      <div key={l.lang} className="text-[10px]">
                        <div className="flex justify-between text-neutral-400"><span>{isAl ? `${l.lang} timing` : l.lang}</span><span className="text-neutral-300">{l.label}</span></div>
                        <div className="flex gap-0.5 mt-0.5">{[1, 2, 3, 4, 5].map(n => <span key={n} className={`h-1 flex-1 rounded-full ${n <= l.stars ? 'bg-[#3f9a5a]' : 'bg-[#17291f]'}`} />)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {isAl && m.note && <p className="text-[10px] text-neutral-500 mt-2">{m.note}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {(!have || missing[m.id]) && !downloading && <Btn tone="primary" onClick={() => { setMissing(p => ({ ...p, [m.id]: false })); download(m.id); }}><Download className="w-3.5 h-3.5" /> Download</Btn>}
                {have && !isAl && m.status !== 'active' && <Btn onClick={() => activate(m.id)}><Check className="w-3.5 h-3.5" /> Use this</Btn>}
                {!downloading && <Btn onClick={() => verify(m.id)} disabled={working === m.id}>{working === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Verify</Btn>}
                {have && (confirmDel === m.id
                  ? <><Btn tone="danger" onClick={() => remove(m.id)}>Yes, delete</Btn><Btn onClick={() => setConfirmDel(null)}>Cancel</Btn></>
                  : <Btn tone="danger" onClick={() => setConfirmDel(m.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</Btn>)}
              </div>
            </div>
            {downloading && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-[#09100d] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: `${m.downloadProgress || 0}%` }} /></div>
                <p className="text-[11px] text-neutral-400 mt-1">Downloading… {m.downloadProgress || 0}%</p>
              </div>
            )}
            {msg[m.id] && <p className={`text-[11px] mt-2 ${msg[m.id].ok ? 'text-[#8fd0a4]' : 'text-red-300'}`}>{msg[m.id].text}</p>}
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
      <div className="bg-[#09100d] border border-[#20322a] rounded-lg px-3 py-2 text-xs font-mono text-neutral-200 break-all">{dir}</div>
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
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#182a22] last:border-0 text-xs">
      <div><span className="text-neutral-400">{k}</span>{sub && <p className="text-[10px] text-neutral-500 mt-0.5 max-w-[360px]">{sub}</p>}</div>
      <span className={`font-semibold text-right ${ok === undefined ? 'text-white' : ok ? 'text-[#8fd0a4]' : 'text-red-300'}`}>{v}</span>
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
          <div className={`text-xs rounded-lg px-3 py-2 border ${eng.allReady ? 'bg-[#3f9a5a]/10 border-[#3f9a5a]/30 text-[#8fd0a4]' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
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
    <div className="flex-1 flex flex-col h-full bg-[#0a130f] text-neutral-200 overflow-y-auto">
      <div className="px-8 pt-6 border-b border-[#182a22] bg-[#0c1611] shrink-0">
        <h1 className="text-xl font-display font-bold text-white tracking-tight">Settings</h1>
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${tab === t.id ? 'border-[#3f9a5a] text-[#8fd0a4]' : 'border-transparent text-neutral-400 hover:text-white'}`}>
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
