import React, { useState, useRef, useEffect } from 'react';
import { VideoSource, SplitConfig, Rect01 } from '../types/clipper';
import { FacecamEditor } from './FacecamEditor';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';
import { 
  Clapperboard, 
  Scissors, 
  Link as LinkIcon, 
  Upload, 
  Check, 
  Youtube,
  Play,
  Sparkles,
  X,
  Download,
  AlertCircle,
  Rows2,
  Crop
} from 'lucide-react';

const MAX_SHORTS = 30;
const MAX_SHORT_SEC = 60;
interface ShortItem { id: string; name: string; path: string; url: string; duration: number; thumbnail: string }
const FALLBACK_THUMB = 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80';
const fmtBytes = (b = 0) => b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1e3))} KB`;
const fmtEta = (s?: number | null) => s == null ? '' : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Reads duration + a thumbnail frame from a video URL (blob: or file:). Never rejects. */
function readVideoMeta(url: string, thumbW = 480): Promise<{ duration: number; thumb: string; vertical: boolean; w: number; h: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.src = url;
    let done = false;
    const finish = (thumb: string) => { if (done) return; done = true; resolve({ duration: v.duration && isFinite(v.duration) ? v.duration : 0, thumb, vertical: v.videoWidth < v.videoHeight, w: v.videoWidth || 0, h: v.videoHeight || 0 }); };
    const timer = setTimeout(() => finish(FALLBACK_THUMB), 8000);
    v.onloadedmetadata = () => { v.currentTime = Math.min(1.0, (v.duration || 2) * 0.2); };
    v.onseeked = () => {
      let thumb = FALLBACK_THUMB;
      try {
        const c = document.createElement('canvas');
        c.width = thumbW; c.height = Math.round(thumbW * (v.videoHeight || 9) / (v.videoWidth || 16));
        const ctx = c.getContext('2d');
        if (ctx && v.videoWidth > 0) { ctx.drawImage(v, 0, 0, c.width, c.height); thumb = c.toDataURL('image/jpeg', 0.8); }
      } catch { /* fallback */ }
      clearTimeout(timer); finish(thumb);
    };
    v.onerror = () => { clearTimeout(timer); finish(FALLBACK_THUMB); };
  });
}

interface LandingStartPageProps {
  onVideoSelectedAndContinue: (source: VideoSource) => void;
  selectedVideo: VideoSource | null;
  onSelectVideo: (source: VideoSource) => void;
}

export const LandingStartPage: React.FC<LandingStartPageProps> = ({
  onVideoSelectedAndContinue,
  selectedVideo,
  onSelectVideo
}) => {
  const [activeCard, setActiveCard] = useState<'long' | 'short' | 'split' | 'youtube'>('long');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortsInputRef = useRef<HTMLInputElement>(null);

  // ---- Upload short clips (multi-select) ----
  const [shortFiles, setShortFiles] = useState<ShortItem[]>([]);
  const [shortWarn, setShortWarn] = useState<string[]>([]);
  const [shortBusy, setShortBusy] = useState(false);

  // ---- YouTube ----
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [ytProg, setYtProg] = useState<{ phase: string; percent: number; done?: number; total?: number; speed?: number; eta?: number | null; text?: string } | null>(null);
  const [ytError, setYtError] = useState('');
  const [ytVideo, setYtVideo] = useState<VideoSource | null>(null);
  const [ytFolder, setYtFolder] = useState('');
  const inDesktop = !!window.electronAPI?.ytDownload;
  const validUrl = /^https?:\/\/[^\s]+\.[^\s]+$/i.test(ytUrl.trim());

  useEffect(() => {
    const off = window.electronAPI?.onYtProgress?.((d) => setYtProg(d));
    window.electronAPI?.getFolders?.().then(f => setYtFolder(f.ytDir || '')).catch(() => {});
    return () => { if (typeof off === 'function') off(); };
  }, []);

  const handleShortFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setShortBusy(true);
    const warns: string[] = [];
    const room = MAX_SHORTS - shortFiles.length;
    const files = Array.from(list).filter(f => f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name));
    if (files.length < list.length) warns.push(`${list.length - files.length} file(s) were skipped because they are not videos.`);
    const added: ShortItem[] = [];
    let tooLong = 0, dup = 0, over = 0;
    for (const file of files) {
      const realPath = window.electronAPI?.getPathForFile?.(file) || '';
      if (realPath && (shortFiles.some(x => x.path === realPath) || added.some(x => x.path === realPath))) { dup++; continue; }
      if (added.length >= room) { over++; continue; }
      const url = URL.createObjectURL(file);
      const meta = await readVideoMeta(url);
      if (meta.duration > MAX_SHORT_SEC + 0.5) {
        tooLong++; warns.push(`“${file.name}” is ${fmtClock(meta.duration)} long. Only clips of 60 seconds or less are allowed.`);
        URL.revokeObjectURL(url); continue;
      }
      added.push({ id: `${Date.now()}-${added.length}-${Math.random().toString(36).slice(2, 6)}`, name: file.name.replace(/\.[^/.]+$/, ''), path: realPath, url, duration: Math.max(1, Math.round(meta.duration)), thumbnail: meta.thumb });
    }
    if (over > 0) warns.unshift(`Limit reached: you can add at most ${MAX_SHORTS} clips at once. ${over} clip(s) were not added.`);
    if (dup > 0) warns.push(`${dup} clip(s) were already in the list.`);
    if (!window.electronAPI && added.length) warns.push('Real processing needs the desktop app.');
    setShortFiles(prev => [...prev, ...added]);
    setShortWarn(warns);
    setShortBusy(false);
    if (shortsInputRef.current) shortsInputRef.current.value = '';
  };
  const removeShort = (id: string) => { setShortFiles(prev => prev.filter(x => x.id !== id)); setShortWarn([]); };

  const shortsSource = (): VideoSource | null => {
    if (!shortFiles.length) return null;
    const first = shortFiles[0];
    return {
      id: `shorts-${Date.now()}`,
      title: shortFiles.length === 1 ? first.name : `${shortFiles.length} short clips`,
      url: first.url, duration: first.duration, thumbnail: first.thumbnail,
      type: 'upload', author: 'Local clips', originalAspect: 'short clips', filePath: first.path || undefined,
      shorts: shortFiles.map(x => ({ path: x.path, name: x.name, duration: x.duration }))
    };
  };

  const startYtDownload = async () => {
    if (!validUrl || ytState === 'downloading' || !window.electronAPI?.ytDownload) return;
    setYtState('downloading'); setYtError(''); setYtVideo(null); setYtProg({ phase: 'prepare', percent: 0, text: 'Starting…' });
    const r = await window.electronAPI.ytDownload(ytUrl.trim());
    if (!r.ok || !r.path) {
      if (r.error === 'Cancelled') { setYtState('idle'); setYtProg(null); return; }
      setYtState('error'); setYtError(r.error || 'Download failed.'); return;
    }
    const fileUrl = 'file:///' + r.path.replace(/\\/g, '/').split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
    let duration = 0, w = 0, h = 0;
    try { const pr = await window.electronAPI.probeVideo?.(r.path); if (pr) { duration = pr.duration; w = pr.width; h = pr.height; } } catch { /* ignore */ }
    const meta = await readVideoMeta(fileUrl);
    setYtVideo({
      id: `yt-${Date.now()}`, title: r.title || r.path.split(/[\\/]/).pop() || 'YouTube video', url: fileUrl,
      duration: Math.round(duration || meta.duration || 0), thumbnail: meta.thumb, type: 'youtube', author: 'YouTube',
      originalAspect: w && h && w < h ? '9:16 vertical' : '16:9 widescreen', filePath: r.path
    });
    setYtState('done');
  };
  const cancelYt = () => { window.electronAPI?.ytCancel?.(); setYtState('idle'); setYtProg(null); };


  // ---- Split screen ----
  type SplitFile = { name: string; path: string; url: string; duration: number; thumb: string; w: number; h: number };
  const splitMainRef = useRef<HTMLInputElement>(null);
  const splitSecondRef = useRef<HTMLInputElement>(null);
  const [spMode, setSpMode] = useState<'single' | 'two' | 'bg'>('single');
  const [spMain, setSpMain] = useState<SplitFile | null>(null);
  const [spSecond, setSpSecond] = useState<SplitFile | null>(null);
  const [spFrame, setSpFrame] = useState('');
  const [spRect, setSpRect] = useState<Rect01 | null>(null);
  const [spDetect, setSpDetect] = useState<'idle' | 'detecting' | 'found' | 'notfound' | 'error'>('idle');
  const [spMsg, setSpMsg] = useState('');
  const [spEditor, setSpEditor] = useState(false);
  const [spOffset, setSpOffset] = useState(0);
  const [spSync, setSpSync] = useState<{ state: 'idle' | 'working' | 'done' | 'error'; text: string }>({ state: 'idle', text: '' });

  const readSplitFile = async (file: File): Promise<SplitFile> => {
    const url = URL.createObjectURL(file);
    const m = await readVideoMeta(url, 960);
    return { name: file.name.replace(/\.[^/.]+$/, ''), path: window.electronAPI?.getPathForFile?.(file) || '', url, duration: m.duration, thumb: m.thumb, w: m.w, h: m.h };
  };
  const runDetect = async (f: SplitFile) => {
    setSpRect(null); setSpFrame(f.thumb); setSpMsg('');
    if (!window.electronAPI?.detectFacecam || !f.path) { setSpDetect('notfound'); setSpMsg('Automatic detection works in the desktop app.'); return; }
    setSpDetect('detecting');
    const r = await window.electronAPI.detectFacecam(f.path);
    if (r.frame) setSpFrame(r.frame);
    if (!r.ok) { setSpDetect('error'); setSpMsg(r.error || 'Could not analyse the video.'); return; }
    if (r.found && r.rect) { setSpRect(r.rect); setSpDetect('found'); }
    else { setSpDetect('notfound'); setSpMsg(r.error || ''); }
  };
  const pickSplitMain = async (list: FileList | null) => {
    const file = list && list[0]; if (!file) return;
    const f = await readSplitFile(file);
    setSpMain(f); setSpSync({ state: 'idle', text: '' });
    if (spMode === 'single') await runDetect(f);
    if (splitMainRef.current) splitMainRef.current.value = '';
  };
  const pickSplitSecond = async (list: FileList | null) => {
    const file = list && list[0]; if (!file) return;
    setSpSecond(await readSplitFile(file)); setSpSync({ state: 'idle', text: '' }); setSpOffset(0);
    if (splitSecondRef.current) splitSecondRef.current.value = '';
  };
  const switchSpMode = (m: 'single' | 'two' | 'bg') => {
    setSpMode(m);
    if (m === 'single' && spMain && spDetect === 'idle') runDetect(spMain);
  };
  const autoSync = async () => {
    if (!spMain?.path || !spSecond?.path || !window.electronAPI?.syncVideos) { setSpSync({ state: 'error', text: 'Auto sync works in the desktop app with both videos selected.' }); return; }
    setSpSync({ state: 'working', text: 'Matching the two recordings…' });
    const r = await window.electronAPI.syncVideos(spMain.path, spSecond.path);
    if (!r.ok || r.offset == null) { setSpSync({ state: 'error', text: r.error || 'Could not match the recordings.' }); return; }
    const good = (r.confidence || 0) >= 6;
    setSpOffset(+r.offset.toFixed(2));
    setSpSync({ state: good ? 'done' : 'error', text: good ? `Synced: offset ${r.offset >= 0 ? '+' : ''}${r.offset.toFixed(2)} s.` : `Low match (${r.confidence}). The recordings may not share the same sound — check the offset by hand.` });
  };
  const splitSource = (): VideoSource | null => {
    if (!spMain) return null;
    if (spMode === 'single' && !spRect) return null;
    if (spMode !== 'single' && !spSecond) return null;
    const cfg: SplitConfig = {
      mode: spMode, facecam: spMode === 'single' ? spRect : null,
      secondPath: spSecond?.path, secondUrl: spSecond?.url, secondName: spSecond?.name, secondDuration: spSecond?.duration,
      secondDims: spSecond ? [spSecond.w, spSecond.h] : undefined,
      offset: spMode === 'two' ? spOffset : 0, audio: 'face',
      splitPct: 40, swap: false, gap: 4, gapColor: '#000000', radius: 0, gameFit: 'fill',
      top: { zoom: 1, panX: 0, panY: 0 }, bottom: { zoom: 1, panX: 0, panY: 0 },
      frame: spFrame || spMain.thumb, mainDims: [spMain.w || 1920, spMain.h || 1080]
    };
    return {
      id: `split-${Date.now()}`, title: spMain.name, url: spMain.url, duration: Math.round(spMain.duration) || 120, thumbnail: spMain.thumb,
      type: 'upload', author: 'Split screen', originalAspect: 'split screen', filePath: spMain.path || undefined, split: cfg
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const meta = await readVideoMeta(objectUrl);
    onSelectVideo({
      id: `local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      url: objectUrl,
      duration: Math.round(meta.duration) || 120,
      thumbnail: meta.thumb,
      type: 'upload',
      author: 'Local File',
      originalAspect: meta.vertical ? '9:16 vertical' : '16:9 widescreen',
      filePath: window.electronAPI?.getPathForFile?.(file) || undefined
    });
  };

  const longSelected = selectedVideo && !selectedVideo.shorts && selectedVideo.type !== 'youtube' ? selectedVideo : null;
  const nextVideo: VideoSource | null = activeCard === 'long' ? longSelected : activeCard === 'short' ? shortsSource() : activeCard === 'split' ? splitSource() : (ytState === 'done' ? ytVideo : null);
  const nextHint = activeCard === 'long' ? 'Choose a video to continue.' : activeCard === 'short' ? 'Add at least one short clip to continue.' : activeCard === 'split' ? (spMode === 'single' ? 'Choose a video and select the facecam area to continue.' : 'Choose both videos to continue.') : (ytState === 'downloading' ? 'Downloading… Next unlocks when it finishes.' : 'Paste a link and download the video to continue.');

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-8 py-6 max-w-5xl mx-auto w-full select-none text-neutral-200">
      <input 
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mkv"
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={shortsInputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mkv,.mov,.m4v"
        className="hidden"
        onChange={(e) => handleShortFiles(e.target.files)}
      />

      {/* 1. HERO TITLE & PITCH */}
      <div className="flex flex-col items-center text-center mt-2 max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white font-sans">
          ClipForge
        </h1>
        
        {/* Creator tag */}
        <div className="mt-2.5 px-3 py-0.5 rounded-full bg-[#161a20] border border-[#232832] text-xs font-mono text-neutral-400">
          @creator.ai
        </div>

        <p className="mt-4 text-xs md:text-sm text-neutral-300 leading-relaxed max-w-xl">
          Long videos into short clips — transcribed, cut, reframed and captioned on this computer. Free, and nothing is uploaded unless you turn Cloud Boost on.
        </p>

        {/* 2. SLICK TIMELINE GRAPHIC (Exact match to screenshot illustration!) */}
        <div className="mt-6 w-full max-w-md p-4 rounded-2xl bg-[#0a0d11] border border-[#1a1e24] shadow-2xl relative overflow-hidden">
          {/* Timeline horizontal track */}
          <div className="h-6 w-full rounded-md bg-[#161a22] relative flex items-center justify-around px-2">
            {/* 3 Green clip segments */}
            <div className="h-3.5 w-14 rounded-md bg-[#bef264] shadow-sm shadow-[#bef264]/30" />
            <div className="h-3.5 w-14 rounded-md bg-[#bef264] shadow-sm shadow-[#bef264]/30" />
            <div className="h-3.5 w-14 rounded-md bg-[#bef264] shadow-sm shadow-[#bef264]/30" />

            {/* Playhead line */}
            <div className="absolute right-14 top-0 bottom-0 w-0.5 bg-white shadow-md" />
          </div>

          {/* 3 Vertical Phone Mockup Cards dropping down from timeline */}
          <div className="flex items-center justify-around mt-3 px-2">
            {[0, 1, 2].map((idx) => (
              <div 
                key={idx}
                className="w-11 h-16 rounded-lg bg-[#11141a] border border-[#232832] p-1 flex flex-col justify-end items-center shadow-inner"
              >
                <div className="w-6 h-1 rounded-full bg-[#bef264]/90 mb-1" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. SECTION HEADING */}
      <div className="text-center mt-5">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          What are you starting with?
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Everything else — captions, styling, aspect ratio — comes next, with a preview.
        </p>
      </div>

      {/* 4. THREE MAIN STARTING CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full mt-4">
        {/* Card 1: Upload a long video */}
        <div
          onClick={() => setActiveCard('long')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
            activeCard === 'long'
              ? 'bg-[#101419] border-[#bef264] ring-1 ring-[#bef264]/40 shadow-lg shadow-[#bef264]/5'
              : 'bg-[#0f1217] border-[#1d222b] hover:border-[#2e3644]'
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#bef264] text-black flex items-center justify-center mb-4 shadow-md shadow-[#bef264]/20">
              <Clapperboard className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white">
              Upload a long video
            </h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              A podcast, lecture, interview or livestream. ClipForge finds the moments worth posting.
            </p>
          </div>
        </div>

        {/* Card 2: Upload short clips */}
        <div
          onClick={() => setActiveCard('short')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
            activeCard === 'short'
              ? 'bg-[#101419] border-[#bef264] ring-1 ring-[#bef264]/40 shadow-lg shadow-[#bef264]/5'
              : 'bg-[#0f1217] border-[#1d222b] hover:border-[#2e3644]'
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#181d24] text-neutral-400 flex items-center justify-center mb-4 border border-[#2b3340]">
              <Scissors className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white">
              Upload short clips
            </h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Already cut it yourself? Captions and styling only — your edit is left alone.
            </p>
          </div>
        </div>

        {/* Card 3: Split screen */}
        <div
          onClick={() => setActiveCard('split')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
            activeCard === 'split'
              ? 'bg-[#101419] border-[#bef264] ring-1 ring-[#bef264]/40 shadow-lg shadow-[#bef264]/5'
              : 'bg-[#0f1217] border-[#1d222b] hover:border-[#2e3644]'
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#181d24] text-neutral-400 flex items-center justify-center mb-4 border border-[#2b3340]">
              <Rows2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Split screen</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              Facecam on top, game or footage below. Finds the facecam for you.
            </p>
          </div>
        </div>

        {/* Card 4: Paste a YouTube URL */}
        <div
          onClick={() => setActiveCard('youtube')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
            activeCard === 'youtube'
              ? 'bg-[#101419] border-[#bef264] ring-1 ring-[#bef264]/40 shadow-lg shadow-[#bef264]/5'
              : 'bg-[#0f1217] border-[#1d222b] hover:border-[#2e3644]'
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#181d24] text-neutral-400 flex items-center justify-center mb-4 border border-[#2b3340]">
              <LinkIcon className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white">
              Paste a YouTube URL
            </h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              For videos you own or have permission to use. Imported at up to 1080p.
            </p>
          </div>
        </div>
      </div>

      {/* 5. DYNAMIC INPUT AREA BELOW CARDS */}
      <div className="w-full mt-4">
        {activeCard === 'long' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-[#0f1216] border border-[#1e232a]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs shadow-md shadow-[#bef264]/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <Upload className="w-4 h-4 stroke-[2.5]" />
                <span>Choose a video...</span>
              </button>
              <span className="text-xs text-neutral-400">or drop one anywhere on this window</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-500">Instant test:</span>
              <button
                onClick={() => onSelectVideo(SAMPLE_VIDEOS[0])}
                className="px-2.5 py-1 rounded bg-[#181d24] hover:bg-[#252b36] text-[11px] text-[#bef264] font-medium border border-[#2b3340] transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Podcast Sample</span>
              </button>
            </div>
          </div>
        )}

        {activeCard === 'short' && (
          <div className="rounded-xl bg-[#0f1216] border border-[#1e232a] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => shortsInputRef.current?.click()}
                  disabled={shortBusy || shortFiles.length >= MAX_SHORTS}
                  className="px-5 py-2.5 rounded-xl bg-[#bef264] hover:bg-[#a3e635] disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold text-xs shadow-md shadow-[#bef264]/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>{shortBusy ? 'Reading clips...' : shortFiles.length ? 'Add more clips...' : 'Choose clips...'}</span>
                </button>
                <span className="text-xs text-neutral-400">Select several at once · up to {MAX_SHORT_SEC}s each · max {MAX_SHORTS} clips</span>
              </div>
              <span className={`font-mono text-[11px] ${shortFiles.length >= MAX_SHORTS ? 'text-amber-300' : 'text-neutral-400'}`}>{shortFiles.length} / {MAX_SHORTS}</span>
            </div>

            {shortWarn.length > 0 && (
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 space-y-0.5">
                {shortWarn.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" /><span>{w}</span></div>
                ))}
              </div>
            )}

            {shortFiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {shortFiles.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-[#12161c] border border-[#1d222b]">
                    <img src={f.thumbnail} alt="" className="w-7 h-10 rounded object-cover bg-black shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-white truncate">{i + 1}. {f.name}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{fmtClock(f.duration)}</div>
                    </div>
                    <button onClick={() => removeShort(f.id)} title="Remove" className="p-1 rounded hover:bg-[#232832] text-neutral-500 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCard === 'split' && (
          <div className="rounded-xl bg-[#0f1216] border border-[#1e232a] p-3 space-y-3">
            <input ref={splitMainRef} type="file" accept="video/*,.mkv,.mov,.m4v" className="hidden" onChange={(e) => pickSplitMain(e.target.files)} />
            <input ref={splitSecondRef} type="file" accept="video/*,.mkv,.mov,.m4v" className="hidden" onChange={(e) => pickSplitSecond(e.target.files)} />
            <div className="flex flex-wrap gap-1.5">
              {([['single', 'One video (facecam inside)'], ['two', 'Two videos (facecam + game)'], ['bg', 'Video + background footage']] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => switchSpMode(m)}
                  className={`px-3 py-1.5 rounded-full text-xs cursor-pointer transition-colors ${spMode === m ? 'bg-[#182116] border border-[#bef264] text-[#bef264] font-bold' : 'bg-[#12151c] border border-[#232832] text-neutral-400 hover:text-white'}`}>{label}</button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => splitMainRef.current?.click()} className="px-4 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs flex items-center gap-2 cursor-pointer active:scale-95">
                <Upload className="w-4 h-4 stroke-[2.5]" />
                <span>{spMain ? 'Change' : 'Choose'} {spMode === 'single' ? 'video' : spMode === 'two' ? 'facecam video' : 'main video'}...</span>
              </button>
              {spMain && <span className="text-xs text-white truncate max-w-[16rem]">{spMain.name} <span className="text-neutral-500 font-mono">{fmtClock(spMain.duration)}</span></span>}
              {spMode !== 'single' && (
                <>
                  <button onClick={() => splitSecondRef.current?.click()} className="px-4 py-2 rounded-xl bg-[#181d24] hover:bg-[#252b36] border border-[#2b3340] text-neutral-100 font-bold text-xs flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>{spSecond ? 'Change' : 'Choose'} {spMode === 'two' ? 'game video' : 'background footage'}...</span>
                  </button>
                  {spSecond && <span className="text-xs text-white truncate max-w-[16rem]">{spSecond.name} <span className="text-neutral-500 font-mono">{fmtClock(spSecond.duration)}</span></span>}
                </>
              )}
            </div>

            {spMode === 'single' && spMain && (
              <div className="flex flex-wrap items-start gap-3">
                <div className="relative w-56 shrink-0 rounded-lg overflow-hidden bg-black border border-[#1d222b]" style={{ aspectRatio: String((spMain.w || 16) / (spMain.h || 9)) }}>
                  <img src={spFrame || spMain.thumb} alt="" className="absolute inset-0 w-full h-full object-fill" />
                  {spRect && <div className="absolute border-2 border-[#bef264]" style={{ left: `${spRect.x * 100}%`, top: `${spRect.y * 100}%`, width: `${spRect.w * 100}%`, height: `${spRect.h * 100}%` }} />}
                </div>
                <div className="space-y-2 text-xs min-w-[14rem] flex-1">
                  {spDetect === 'detecting' && <div className="text-neutral-300">Looking for a facecam…</div>}
                  {spDetect === 'found' && <div className="flex items-center gap-1.5 text-[#bef264] font-semibold"><Check className="w-4 h-4" /> Facecam detected</div>}
                  {(spDetect === 'notfound' || spDetect === 'error') && (
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                      <span>{spDetect === 'error' ? 'Could not analyse the video.' : 'Face cam not detected.'} {spMsg}</span>
                    </div>
                  )}
                  {spDetect !== 'detecting' && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSpEditor(true)} className="px-3 py-1.5 rounded-lg bg-[#181d24] hover:bg-[#252b36] border border-[#2b3340] text-neutral-100 font-bold flex items-center gap-1.5 cursor-pointer">
                        <Crop className="w-3.5 h-3.5 text-[#bef264]" /> {spRect ? 'Adjust facecam area' : 'Select the facecam area manually'}
                      </button>
                      {spDetect !== 'found' && (
                        <button onClick={() => setSpMode('two')} className="px-3 py-1.5 rounded-lg bg-[#181d24] hover:bg-[#252b36] border border-[#2b3340] text-neutral-100 font-bold cursor-pointer">Use two separate videos instead</button>
                      )}
                      <button onClick={() => runDetect(spMain)} className="px-3 py-1.5 rounded-lg bg-[#12151c] border border-[#232832] text-neutral-400 hover:text-white cursor-pointer">Detect again</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {spMode === 'two' && spMain && spSecond && (
              <div className="space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={autoSync} disabled={spSync.state === 'working'} className="px-3 py-1.5 rounded-lg bg-[#181d24] hover:bg-[#252b36] border border-[#2b3340] text-neutral-100 font-bold cursor-pointer disabled:opacity-50">Auto sync</button>
                  <span className="text-neutral-400">Game video offset</span>
                  <input type="number" step={0.1} value={spOffset} onChange={(e) => setSpOffset(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-[#12151c] border border-[#232832] focus:border-[#bef264] rounded-lg px-2 py-1 font-mono text-white text-center focus:outline-none" />
                  <span className="text-neutral-400">seconds</span>
                </div>
                {spSync.text && <div className={spSync.state === 'error' ? 'text-amber-300' : 'text-[#bef264]'}>{spSync.text}</div>}
                <div className="text-[11px] text-neutral-500">Auto sync needs both recordings to share the same sound. Otherwise set it by hand: + skips ahead in the game video, − delays it.</div>
              </div>
            )}
            {spMode === 'bg' && <div className="text-[11px] text-neutral-500">The background footage loops under your video and is not synced. Its sound is muted.</div>}
          </div>
        )}

        {activeCard === 'youtube' && (
          <div className="rounded-xl bg-[#0f1216] border border-[#1e232a] p-3 space-y-2.5">
            <input
              type="text"
              value={ytUrl}
              disabled={ytState === 'downloading'}
              onChange={(e) => { setYtUrl(e.target.value); if (ytState !== 'idle') { setYtState('idle'); setYtVideo(null); setYtError(''); setYtProg(null); } }}
              placeholder="Paste the long video link: https://www.youtube.com/watch?v=..."
              className="w-full bg-[#12151c] border border-[#232832] focus:border-[#bef264] rounded-lg px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none disabled:opacity-60"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!validUrl || ytState === 'downloading' || !inDesktop}
                onClick={startYtDownload}
                className={`px-5 py-2 rounded-lg font-extrabold text-xs flex items-center gap-2 transition-all ${
                  validUrl && ytState !== 'downloading' && inDesktop ? 'bg-[#bef264] hover:bg-[#a3e635] text-black cursor-pointer active:scale-95' : 'bg-[#364323] text-neutral-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{ytState === 'downloading' ? 'Downloading...' : ytState === 'done' ? 'Download again' : 'Download'}</span>
              </button>
              {ytState === 'downloading' && (
                <button type="button" onClick={cancelYt} className="px-3 py-2 rounded-lg bg-[#181d24] hover:bg-[#252b36] border border-[#2b3340] text-xs text-neutral-300 cursor-pointer">Cancel</button>
              )}
              {!inDesktop && <span className="text-[11px] text-neutral-500">Downloading works in the desktop app.</span>}
              {inDesktop && ytFolder && ytState !== 'downloading' && <span className="text-[11px] text-neutral-500 truncate">Saves to: <span className="text-neutral-400">{ytFolder}</span> (change in Settings → Folders)</span>}
            </div>

            {ytState === 'downloading' && ytProg && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-[#1a1f27] overflow-hidden">
                  <div className="h-full bg-[#bef264] transition-all" style={{ width: `${Math.max(2, Math.min(100, ytProg.percent || 0))}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 text-[11px] text-neutral-400 font-mono">
                  <span>{ytProg.phase === 'download' ? `${(ytProg.percent || 0).toFixed(1)}%` : (ytProg.text || 'Working…')}{ytProg.phase === 'prepare' && ytProg.percent > 0 ? ` ${Math.round(ytProg.percent)}%` : ''}</span>
                  {ytProg.phase === 'download' && (
                    <span>
                      {fmtBytes(ytProg.done)}{ytProg.total ? ` / ${fmtBytes(ytProg.total)}` : ''}
                      {ytProg.speed ? ` · ${fmtBytes(ytProg.speed)}/s` : ''}
                      {ytProg.eta != null ? ` · ${fmtEta(ytProg.eta)} left` : ''}
                    </span>
                  )}
                </div>
              </div>
            )}
            {ytState === 'error' && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-[11px] text-rose-300 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-px" /><span>{ytError}</span></div>
            )}
            {ytState === 'done' && ytVideo && (
              <div className="p-2 rounded-lg bg-[#141812] border border-[#bef264]/40 flex items-center gap-2 text-xs">
                <Check className="w-4 h-4 text-[#bef264] shrink-0" />
                <span className="text-white truncate">{ytVideo.title}</span>
                <span className="ml-auto font-mono text-[11px] text-neutral-400 shrink-0">{fmtClock(ytVideo.duration)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected video indicator (long video) */}
      {activeCard === 'long' && longSelected && (
        <div className="w-full mt-2 p-2 px-4 rounded-xl bg-[#141812] border border-[#bef264]/40 flex items-center justify-between text-xs text-neutral-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#bef264]" />
            <span className="font-semibold text-white">Selected:</span>
            <span className="text-[#bef264] truncate max-w-md">{longSelected.title}</span>
          </div>
          <span className="font-mono text-[11px] text-neutral-400">{fmtClock(longSelected.duration)}</span>
        </div>
      )}

      {spEditor && spMain && (
        <FacecamEditor frame={spFrame || spMain.thumb} dims={[spMain.w || 16, spMain.h || 9]} rect={spRect}
          onApply={(r) => { setSpRect(r); if (spDetect !== 'found') setSpDetect('found'); setSpEditor(false); }} onClose={() => setSpEditor(false)} />
      )}

      {/* 6. NEXT BUTTON ROW */}
      <div className="w-full mt-5 flex items-center gap-3">
        <button
          disabled={!nextVideo}
          onClick={() => nextVideo && onVideoSelectedAndContinue(nextVideo)}
          className={`px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-md flex items-center gap-2 ${
            nextVideo
              ? 'bg-[#bef264] hover:bg-[#a3e635] text-black shadow-[#bef264]/20 cursor-pointer active:scale-95'
              : 'bg-[#364323] text-neutral-400 opacity-60 cursor-not-allowed'
          }`}
        >
          <span>Next</span>
        </button>
        <span className="text-xs text-neutral-500">
          {nextVideo ? (activeCard === 'split' ? 'Ready! Click Next to set the layout, captions & style.' : activeCard === 'short' ? `Ready! ${shortFiles.length} clip${shortFiles.length > 1 ? 's' : ''} selected. Click Next to set captions & style.` : 'Ready! Click Next to configure aspect ratio, captions & grading.') : nextHint}
        </span>
      </div>
    </div>
  );
};
