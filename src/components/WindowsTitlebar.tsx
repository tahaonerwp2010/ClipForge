import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, X, Download, CheckCircle2, AlertCircle, GitBranch, FolderOpen } from 'lucide-react';

type UpdateInfo = {
  ok: boolean; error?: string; message?: string; repo?: string; current?: string; latest?: string; available?: boolean;
  notes?: string; pageUrl?: string; asset?: { name: string; url: string; size: number } | null;
};
type Api = {
  isElectron?: boolean;
  updateCheck?: (repo?: string) => Promise<UpdateInfo>;
  updateDownload?: (url: string, name: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  openExternal?: (url: string) => Promise<boolean>;
  onUpdateProgress?: (cb: (d: { done: number; total: number; percent: number }) => void) => () => void;
};
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0';
const mb = (n: number) => `${(n / 1048576).toFixed(0)} MB`;

export const WindowsTitlebar: React.FC = () => {
  const api = (window as unknown as { electronAPI?: Api }).electronAPI;
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [repoInput, setRepoInput] = useState('');
  const [editRepo, setEditRepo] = useState(false);
  const [dl, setDl] = useState<{ percent: number; done: number; total: number } | null>(null);
  const [dlPath, setDlPath] = useState('');
  const [dlError, setDlError] = useState('');
  const autoDone = useRef(false);

  const runCheck = async (manual: boolean, repo?: string) => {
    if (!api?.updateCheck) { if (manual) { setInfo({ ok: false, error: 'web', message: 'Updates are available in the desktop app.' }); setOpen(true); } return; }
    setChecking(true);
    if (manual) { setOpen(true); setInfo(null); }
    try {
      const r = await api.updateCheck(repo);
      setInfo(r);
      if (!manual && r.ok && r.available) setOpen(true);        // silent start-up check: only speak up when there is something new
      if (manual) setOpen(true);
      if (r.error === 'no-repo' && manual) setEditRepo(true);
    } catch (e) { if (manual) setInfo({ ok: false, error: 'network', message: String((e as Error)?.message || e) }); }
    setChecking(false);
  };

  useEffect(() => {
    if (autoDone.current) return; autoDone.current = true;
    const t = setTimeout(() => runCheck(false), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => api?.onUpdateProgress?.(d => setDl(d)), [api]);

  const download = async () => {
    if (!info) return;
    setDlError('');
    if (info.asset && api?.updateDownload) {
      setDl({ percent: 0, done: 0, total: info.asset.size || 0 });
      const r = await api.updateDownload(info.asset.url, info.asset.name);
      setDl(null);
      if (r.ok && r.path) setDlPath(r.path); else setDlError(r.error || 'Download failed. Try again.');
    } else if (info.pageUrl) { api?.openExternal?.(info.pageUrl); }
  };
  const saveRepo = async (e: React.FormEvent) => { e.preventDefault(); setEditRepo(false); await runCheck(true, repoInput); };
  const close = () => { if (!dl) { setOpen(false); setDlPath(''); setDlError(''); setEditRepo(false); } };

  const upToDate = info?.ok && !info.available;
  const hasUpdate = info?.ok && info.available;

  return (
    <>
      <header className="h-9 bg-[#000000] border-b border-[#14181f] flex items-center justify-between px-4 select-none text-xs text-neutral-300 font-sans tracking-tight shrink-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">ClipForge</span>
          <span className="text-[10px] text-neutral-500 font-mono">v{VERSION}</span>
        </div>
        <button onClick={() => runCheck(true)} disabled={checking}
          className="px-3 py-1 rounded-full bg-[#161a20] hover:bg-[#202630] border border-[#2b3340] text-[11px] text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
          {checking && <RotateCw className="w-3 h-3 text-[#bef264] animate-spin" />}
          <span>{checking ? 'Checking…' : 'Check for updates'}</span>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="bg-[#0e1217] border border-[#232936] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {hasUpdate ? <Download className="w-5 h-5 text-[#bef264]" /> : upToDate ? <CheckCircle2 className="w-5 h-5 text-[#bef264]" /> : info ? <AlertCircle className="w-5 h-5 text-amber-400" /> : <RotateCw className="w-5 h-5 text-[#bef264] animate-spin" />}
                <h3 className="text-sm font-bold text-white">
                  {hasUpdate ? 'A new update is available' : upToDate ? 'You are up to date' : info ? 'Could not check for updates' : 'Checking for updates…'}
                </h3>
              </div>
              <button onClick={close} title="Close" disabled={!!dl} className="w-6 h-6 rounded-lg bg-[#161a22] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"><X className="w-3.5 h-3.5" /></button>
            </div>

            {hasUpdate && info && (
              <div className="space-y-3 text-xs text-neutral-300">
                <div className="p-3 bg-[#141820] rounded-xl border border-[#1f2633] space-y-1">
                  <div className="flex justify-between"><span className="text-neutral-400">Your version</span><span className="font-mono text-white">v{info.current}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-400">New version</span><span className="font-mono text-[#bef264] font-bold">v{info.latest}</span></div>
                </div>
                {info.notes && <p className="whitespace-pre-line text-neutral-400 max-h-32 overflow-y-auto leading-relaxed">{info.notes}</p>}
                {dl && (
                  <div>
                    <div className="h-1.5 rounded-full bg-[#0a0d11] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: `${dl.percent}%` }} /></div>
                    <p className="text-[11px] text-neutral-400 mt-1">Downloading… {dl.percent}%{dl.total ? ` (${mb(dl.done)} of ${mb(dl.total)})` : ''}</p>
                  </div>
                )}
                {dlPath && <p className="text-[11px] text-[#bef264]">Downloaded. The new version is in your Downloads folder. Close ClipForge and open the new file to finish updating.</p>}
                {dlError && <p className="text-[11px] text-red-300">{dlError}</p>}
              </div>
            )}
            {upToDate && info && <p className="text-xs text-neutral-300">ClipForge v{info.current} is the latest version.</p>}
            {info && !info.ok && <p className="text-xs text-amber-200/90 leading-relaxed">{info.error === 'no-repo' ? 'Enter the GitHub repository that hosts ClipForge so it can look for new versions.' : info.message}</p>}

            {info && (info.error === 'no-repo' || info.error === 'not-found' || editRepo || upToDate) && !hasUpdate && (
              editRepo || info.error === 'no-repo' || info.error === 'not-found' ? (
                <form onSubmit={saveRepo} className="flex gap-2">
                  <input value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder="username/ClipForge" autoFocus
                    className="flex-1 bg-[#090b0e] border border-[#2b3340] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-lime-400" />
                  <button type="submit" disabled={!repoInput.trim()} className="px-3 py-1.5 rounded-lg bg-[#bef264] text-black font-bold text-xs cursor-pointer disabled:opacity-40">Save</button>
                </form>
              ) : (
                <button onClick={() => { setRepoInput(info.repo || ''); setEditRepo(true); }} className="text-[11px] text-neutral-500 hover:text-lime-400 flex items-center gap-1.5 cursor-pointer"><GitBranch className="w-3 h-3" /> Source: {info.repo || 'not set'} · change</button>
              )
            )}

            <div className="flex justify-end gap-2 pt-1">
              {hasUpdate ? (
                <>
                  <button onClick={close} disabled={!!dl} className="px-4 py-2 rounded-xl bg-[#161b22] hover:bg-[#202732] text-neutral-200 text-xs font-semibold border border-[#2b3340] cursor-pointer disabled:opacity-40">Later</button>
                  {dlPath
                    ? <button onClick={() => (window as any).electronAPI?.showInFolder?.(dlPath)} className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs cursor-pointer flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Show file</button>
                    : <button onClick={download} disabled={!!dl} className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"><Download className="w-3.5 h-3.5" /> {dl ? 'Downloading…' : 'Download'}</button>}
                </>
              ) : (
                <button onClick={close} className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs cursor-pointer">OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
