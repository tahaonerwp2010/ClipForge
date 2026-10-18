import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, X, Download, CheckCircle2, AlertCircle, FolderOpen } from 'lucide-react';

type UpdateInfo = {
  ok: boolean; error?: string; message?: string; repo?: string; current?: string; latest?: string; available?: boolean;
  notes?: string; pageUrl?: string; asset?: { name: string; url: string; size: number } | null;
};
type Api = {
  isElectron?: boolean;
  updateCheck?: (repo?: string) => Promise<UpdateInfo>;
  updateDownload?: (url: string, name: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  updateInstall?: (filePath: string) => Promise<{ ok: boolean; mode?: string; error?: string }>;
  openExternal?: (url: string) => Promise<boolean>;
  onUpdateProgress?: (cb: (d: { done: number; total: number; percent: number }) => void) => () => void;
};
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0';
const mb = (n: number) => `${(n / 1048576).toFixed(0)} MB`;

export const UpdateChecker: React.FC<{ children: (open: () => void, checking: boolean) => React.ReactNode }> = ({ children }) => {
  const api = (window as unknown as { electronAPI?: Api }).electronAPI;
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [repoInput, setRepoInput] = useState('');
  const [dl, setDl] = useState<{ percent: number; done: number; total: number } | null>(null);
  const [dlPath, setDlPath] = useState('');
  const [dlError, setDlError] = useState('');
  const [installing, setInstalling] = useState(false);
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
      if (r.ok && r.path) {
        setDlPath(r.path);
        if (api.updateInstall) {                                   // install by itself, ClipForge closes and reopens
          setInstalling(true);
          const i = await api.updateInstall(r.path);
          if (!i.ok) { setInstalling(false); setDlError(i.error || 'Could not start the update.'); }
          else if (i.mode === 'manual') setInstalling(false);
        }
      } else setDlError(r.error || 'Download failed. Try again.');
    } else if (info.pageUrl) { api?.openExternal?.(info.pageUrl); }
  };
  const saveRepo = async (e: React.FormEvent) => { e.preventDefault(); await runCheck(true, repoInput); };
  const close = () => { if (!dl && !installing) { setOpen(false); setDlPath(''); setDlError(''); } };

  const upToDate = info?.ok && !info.available;
  const hasUpdate = info?.ok && info.available;

  return (
    <>
      {children(() => runCheck(true), checking)}

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="bg-[#0c1611] border border-[#20322a] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {hasUpdate ? <Download className="w-5 h-5 text-[#8fd0a4]" /> : upToDate ? <CheckCircle2 className="w-5 h-5 text-[#8fd0a4]" /> : info ? <AlertCircle className="w-5 h-5 text-amber-400" /> : <RotateCw className="w-5 h-5 text-[#8fd0a4] animate-spin" />}
                <h3 className="text-sm font-bold text-white">
                  {hasUpdate ? 'A new update is available' : upToDate ? 'You are up to date' : info ? 'Could not check for updates' : 'Checking for updates…'}
                </h3>
              </div>
              <button onClick={close} title="Close" disabled={!!dl} className="w-6 h-6 rounded-lg bg-[#13211a] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"><X className="w-3.5 h-3.5" /></button>
            </div>

            {hasUpdate && info && (
              <div className="space-y-3 text-xs text-neutral-300">
                <div className="p-3 bg-[#111e18] rounded-xl border border-[#1c3026] space-y-1">
                  <div className="flex justify-between"><span className="text-neutral-400">Your version</span><span className="font-mono text-white">v{info.current}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-400">New version</span><span className="font-mono text-[#8fd0a4] font-bold">v{info.latest}</span></div>
                </div>
                {dl && (
                  <div>
                    <div className="h-1.5 rounded-full bg-[#09100d] overflow-hidden"><div className="h-full bg-[#bef264] transition-all" style={{ width: `${dl.percent}%` }} /></div>
                    <p className="text-[11px] text-neutral-400 mt-1">Downloading… {dl.percent}%{dl.total ? ` (${mb(dl.done)} of ${mb(dl.total)})` : ''}</p>
                  </div>
                )}
                {installing && <p className="text-[11px] text-[#8fd0a4] flex items-center gap-1.5"><RotateCw className="w-3 h-3 animate-spin" /> Installing the update. ClipForge will close and open again by itself…</p>}
                {dlPath && !installing && !dlError && <p className="text-[11px] text-[#8fd0a4]">{(window as any).electronAPI?.isMobile ? 'Update downloaded. The installer opened: tap Install to finish. (If nothing opened, allow ClipForge to install apps and tap Update again.)' : 'Update downloaded. Open the file to finish updating.'}</p>}
                {dlError && <p className="text-[11px] text-red-300">{dlError}</p>}
              </div>
            )}
            {upToDate && info && <p className="text-xs text-neutral-300">ClipForge v{info.current} is the latest version.</p>}
            {info && !info.ok && <p className="text-xs text-amber-200/90 leading-relaxed">{info.error === 'no-repo' ? 'Enter the GitHub repository that hosts ClipForge so it can look for new versions.' : info.message}</p>}

            {info && (info.error === 'no-repo' || info.error === 'not-found') && (
              <form onSubmit={saveRepo} className="flex gap-2">
                <input value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder="username/ClipForge" autoFocus
                  className="flex-1 bg-[#070e0b] border border-[#263c32] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-[#3f9a5a]" />
                <button type="submit" disabled={!repoInput.trim()} className="px-3 py-1.5 rounded-lg bg-[#bef264] text-black font-bold text-xs cursor-pointer disabled:opacity-40">Save</button>
              </form>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {hasUpdate ? (
                <>
                  <button onClick={close} disabled={!!dl || installing} className="px-4 py-2 rounded-xl bg-[#13211a] hover:bg-[#1c3026] text-neutral-200 text-xs font-semibold border border-[#263c32] cursor-pointer disabled:opacity-40">Later</button>
                  {installing
                    ? <button disabled className="px-5 py-2 rounded-xl bg-[#bef264] text-black font-extrabold text-xs flex items-center gap-1.5 opacity-60"><RotateCw className="w-3.5 h-3.5 animate-spin" /> Installing…</button>
                    : dlPath
                    ? <button onClick={() => (window as any).electronAPI?.showInFolder?.(dlPath)} className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs cursor-pointer flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Show file</button>
                    : <button onClick={download} disabled={!!dl} className="px-5 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"><Download className="w-3.5 h-3.5" /> {dl ? 'Downloading…' : 'Update now'}</button>}
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
