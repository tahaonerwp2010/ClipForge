import React, { useState, useEffect, useRef } from 'react';
import { 
  GeneratedClip, 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig, 
  OuterCanvasRatio,
  TranscriptWord 
} from '../types/clipper';
import { 
  Download, 
  Play, 
  Pause, 
  FileText, 
  Trash2, 
  Sliders, 
  Flame, 
  Sparkles,
  ArrowLeft,
  X,
  RotateCcw,
  Film
} from 'lucide-react';
import { exportVideoClip, triggerFileDownload, generateSrtContent } from '../utils/videoExporter';
import { getContextualEmoji } from '../utils/captionHelpers';
import { ViralDetectorEngine } from '../services/viralDetectorEngine';

interface ClipsLibraryProps {
  clips: GeneratedClip[];
  projectName?: string;
  sourceVideoUrl?: string;
  onBack?: () => void;
  onSelectClipToEdit: (clip: GeneratedClip) => void;
  onDeleteClip: (clipId: string) => void;
  sourceVideoElement?: HTMLVideoElement | null;
  canvasRatio: OuterCanvasRatio;
  framing: InnerFramingConfig;
  captions: CaptionConfig;
  grading: VideoGradingConfig;
  branding: BrandingConfig;
}

export const ClipsLibrary: React.FC<ClipsLibraryProps> = ({
  clips,
  projectName = 'Scaling AI Rocketships',
  sourceVideoUrl,
  onBack,
  onSelectClipToEdit,
  onDeleteClip,
  sourceVideoElement,
  canvasRatio,
  framing,
  captions,
  grading,
  branding
}) => {
  const fmtClock = (t: number) => { const s = Math.max(0, Math.round(t)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; };
  const clipsFolder = (() => { const f = clips.find(c => c.outputPath)?.outputPath; return f ? f.replace(/[\\/][^\\/]*$/, '') : ''; })();
  const [sheetMsg, setSheetMsg] = useState('');
  const saveSheet = async () => {
    if (!clipsFolder || !window.electronAPI?.saveClipSheet) return;
    const rows: string[][] = [['Name', 'Title', 'Description', 'Hook']];
    for (const c of clips) {
      const name = (c.outputPath || '').split(/[\\/]/).pop() || c.title;
      const tags = (c.hashtags || []).join(' ');
      rows.push([name, c.title, [c.description || c.reason || '', tags].filter(Boolean).join('\n\n'), String(c.hookText || c.title || '').replace(/\n/g, ' / ')]);
    }
    try { const f = await window.electronAPI.saveClipSheet(clipsFolder, rows); setSheetMsg(`Saved: ${f}`); window.electronAPI.showInFolder?.(f); }
    catch (e: any) { setSheetMsg(`Could not save: ${e?.message || e}`); }
  };
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [activePreviewClip, setActivePreviewClip] = useState<GeneratedClip | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(true);
  const [previewTime, setPreviewTime] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Rendered clips (outputPath) are standalone files starting at 0s; demo clips seek inside the source video.
  const clipBase = (c: GeneratedClip) => (c.outputPath ? 0 : c.startTime);
  const clipEndT = (c: GeneratedClip) => (c.outputPath ? c.duration : c.endTime);

  // Sync real video element with activePreviewClip playback
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!activePreviewClip || !video) return;

    video.currentTime = clipBase(activePreviewClip) + previewTime;
    if (isPlayingPreview) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [activePreviewClip]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !activePreviewClip) return;

    if (isPlayingPreview) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlayingPreview]);

  // Handle video timeupdate for loop and word synchronization
  const handleVideoTimeUpdate = () => {
    const video = previewVideoRef.current;
    if (!video || !activePreviewClip) return;

    const base = clipBase(activePreviewClip);
    const relTime = video.currentTime - base;
    if (video.currentTime >= clipEndT(activePreviewClip) || video.currentTime < base) {
      video.currentTime = base;
      setPreviewTime(0);
    } else {
      setPreviewTime(+relTime.toFixed(2));
    }
  };

  const handleOpenPreview = (clip: GeneratedClip) => {
    setActivePreviewClip(clip);
    setPreviewTime(0);
    setIsPlayingPreview(true);
  };

  const handleClosePreview = () => {
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
    }
    setActivePreviewClip(null);
    setIsPlayingPreview(false);
  };

  const handleExportClip = async (clip: GeneratedClip) => {
    // Real pipeline already produced the final MP4 on disk: just reveal it.
    if (clip.outputPath && window.electronAPI?.showInFolder) {
      await window.electronAPI.showInFolder(clip.outputPath);
      return;
    }
    setExportingId(clip.id);
    try {
      if (sourceVideoElement) {
        const blob = await exportVideoClip({
          clip,
          sourceVideoElement,
          canvasRatio,
          framing,
          captions,
          grading,
          branding,
          resolution: '1080p'
        });
        triggerFileDownload(blob, `${clip.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_9x16.webm`);
      } else {
        const srt = generateSrtContent(clip.words);
        const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
        triggerFileDownload(blob, `${clip.title.replace(/\s+/g, '_')}_subtitles.srt`);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setTimeout(() => setExportingId(null), 1000);
    }
  };


  // Find active word and surrounding beat for word-to-word sync preview
  const getActiveWordInfo = (clip: GeneratedClip, time: number) => {
    if (!clip.words || clip.words.length === 0) return { activeWord: null, beatWords: [] };

    const activeIdx = clip.words.findIndex(w => time >= w.start && time <= w.end);
    const targetIdx = activeIdx >= 0 ? activeIdx : clip.words.findIndex(w => w.start > time) - 1;
    const currentIdx = Math.max(0, targetIdx >= 0 ? targetIdx : 0);

    // Group 2-3 words around active word for clean beat display
    const startIdx = Math.max(0, currentIdx - 1);
    const endIdx = Math.min(clip.words.length - 1, currentIdx + 1);

    return {
      activeWord: clip.words[currentIdx],
      beatWords: clip.words.slice(startIdx, endIdx + 1),
      currentIdx
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050b08] text-neutral-100 overflow-y-auto font-sans select-none">
      
      {/* Top Header Bar */}
      <div className="h-14 border-b border-[#111e18] bg-[#050b08] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-[#0c1611] hover:bg-[#15241d] text-neutral-300 hover:text-white border border-[#192c23] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to My clips</span>
            </button>
          )}

          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Film className="w-4 h-4 text-[#8fd0a4]" />
              <span className="truncate max-w-md">{projectName}</span>
            </h1>
            <div className="text-[10px] text-neutral-400 font-mono-num">
              {clips.length} viral shorts extracted and formatted
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#3f9a5a]/15 text-[#8fd0a4] border border-[#3f9a5a]/30 font-bold">
            READY TO EXPORT
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {clips.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#0a130f] border border-[#16271f] space-y-3 max-w-md mx-auto mt-12">
              <div className="w-12 h-12 rounded-xl bg-[#13211a] text-[#8fd0a4] flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No clips in this project</h3>
              <p className="text-xs text-neutral-400">
                Go to Progress or Studio to generate clips from your video.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {clips.map((clip) => {
                const isExporting = exportingId === clip.id;
                const titleLines = ViralDetectorEngine.formatTitleLines(clip.title);

                return (
                  <div
                    key={clip.id}
                    className="bg-[#09110e] border border-[#15251e] hover:border-[#24382f] rounded-2xl overflow-hidden flex flex-col justify-between transition-all shadow-xl group"
                  >
                    {/* Top Preview Canvas Mockup */}
                    <div 
                      onClick={() => handleOpenPreview(clip)}
                      className="relative aspect-[9/16] max-h-[380px] bg-[#040806] flex items-center justify-center overflow-hidden border-b border-[#13211a] cursor-pointer"
                    >
                      {clip.thumbnailUrl ? (
                        <img 
                          src={clip.thumbnailUrl} 
                          alt={clip.title}
                          className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (clip.videoUrl || sourceVideoUrl) ? (
                        <video
                          src={clip.videoUrl || sourceVideoUrl}
                          className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            e.currentTarget.currentTime = clip.outputPath ? 1 : (clip.thumbnailTime || clip.startTime || 2);
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0e1914] text-neutral-500">
                          <Film className="w-8 h-8 mb-2 text-[#8fd0a4]" />
                          <span className="text-xs font-mono">Real Video Clip</span>
                        </div>
                      )}

                      {/* AI Generated Title Overlay */}
                      {!clip.outputPath && branding.autoTitle?.enabled && (
                        <div 
                          className="absolute z-20 pointer-events-none px-3 text-center"
                          style={{
                            top: `${branding.autoTitle.positionY ?? 10}%`,
                            left: `${branding.autoTitle.positionX ?? 50}%`,
                            transform: 'translate(-50%, -50%)',
                            color: branding.autoTitle.color || '#ffffff'
                          }}
                        >
                          <div 
                            style={{
                              fontSize: `${branding.autoTitle.fontSize || 16}px`,
                              textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)'
                            }}
                            className="font-black uppercase tracking-tight leading-snug line-clamp-2"
                          >
                            {titleLines.map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hook Banner */}
                      {branding.showHookTitle && (
                        <div 
                          className="absolute z-20 pointer-events-none"
                          style={{
                            top: `${branding.bannerPositionY ?? 6}%`,
                            left: `${branding.bannerPositionX ?? 50}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          {branding.bannerShowBackground !== false ? (
                            <div 
                              style={{ backgroundColor: branding.hookBgColor || '#bef264' }}
                              className="px-2 py-0.5 rounded text-black font-extrabold text-[9px] uppercase shadow-md"
                            >
                              {clip.hookText}
                            </div>
                          ) : (
                            <div 
                              style={{ 
                                color: branding.hookBgColor || '#bef264',
                                textShadow: '0 2px 6px rgba(0,0,0,0.95)'
                              }}
                              className="font-black text-[10px] uppercase tracking-wide drop-shadow"
                            >
                              {clip.hookText}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-[#bef264] text-black flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Virality Badge */}
                      {clip.viralityScore > 0 && <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-[#3f9a5a]/40 text-[#8fd0a4] text-[10px] font-black shadow-lg">
                        <Flame className="w-3 h-3 fill-current" />
                        <span>{clip.viralityScore}/100 Virality</span>
                      </div>}

                      {/* Duration */}
                      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">
                        {clip.duration}s
                      </div>
                    </div>

                    {/* Clip Metadata & Details */}
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono mb-1">
                          <span className="text-[#8fd0a4] font-bold">{clip.category}</span>
                          <span>{clip.duration}s length</span>
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight leading-snug line-clamp-2">
                          {clip.title}
                        </h3>
                      </div>

                      {/* Where it comes from + what it is about */}
                      <div className="p-2.5 rounded-xl bg-[#060b09] border border-[#13211a] space-y-1.5">
                        {clip.sourceName ? (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400"><span className="uppercase font-bold">Your clip</span><span className="text-[#8fd0a4] font-bold truncate">{clip.sourceName}</span></div>
                        ) : (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
                          <span className="uppercase font-bold">In the video</span>
                          <span className="text-[#8fd0a4] font-bold">{fmtClock(clip.startTime)} – {fmtClock(clip.endTime)}</span>
                        </div>
                        )}
                        <p className="text-[11px] text-neutral-300 leading-relaxed line-clamp-2">
                          {clip.reason && !/offline analysis/i.test(clip.reason) ? clip.reason : `“${clip.hookText}”`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#13211a] text-[11px] text-neutral-400">
                        <button onClick={() => onSelectClipToEdit(clip)} className="hover:text-[#bef264] flex items-center gap-1 cursor-pointer transition-colors" title="Edit captions and hook">
                          <span>✎ Edit</span>
                        </button>

                        <button
                          onClick={() => onDeleteClip(clip.id)}
                          className="hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Delete clip"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Bottom bar: open the folder with all clips of this project */}
      {clipsFolder && window.electronAPI?.openFolder && (
        <div className="shrink-0 h-12 px-6 border-t border-[#111e18] bg-[#09100d] flex items-center">
          <button type="button" onClick={() => window.electronAPI!.openFolder!(clipsFolder)}
            className="px-3 py-1.5 rounded-lg bg-[#111e18] hover:bg-[#192c23] text-neutral-200 text-xs font-bold flex items-center gap-2 border border-[#1d3228] cursor-pointer transition-colors">
            <Film className="w-3.5 h-3.5 text-[#8fd0a4]" /> Open clips folder
          </button>
          <button type="button" onClick={saveSheet}
            className="ml-2 px-3 py-1.5 rounded-lg bg-[#111e18] hover:bg-[#192c23] text-neutral-200 text-xs font-bold flex items-center gap-2 border border-[#1d3228] cursor-pointer transition-colors">
            <Download className="w-3.5 h-3.5 text-[#8fd0a4]" /> Download title &amp; description
          </button>
          {sheetMsg && <span className="ml-3 text-[11px] text-neutral-400 truncate">{sheetMsg}</span>}
        </div>
      )}

      {/* ========================================================
          FULL INTERACTIVE 9:16 VERTICAL PLAYER MODAL
          Plays clip with real word-by-word synced CapCut captions!
      ======================================================== */}
      {activePreviewClip && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative bg-[#09110e] border border-[#1b2f26] rounded-3xl p-6 shadow-2xl max-w-sm w-full flex flex-col items-center space-y-4">
            
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between border-b border-[#15241d] pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#8fd0a4]" />
                <span className="text-xs font-bold text-white truncate max-w-[220px]">
                  {activePreviewClip.title}
                </span>
              </div>
              <button
                onClick={handleClosePreview}
                className="w-7 h-7 rounded-lg bg-[#111e18] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 9:16 Vertical Screen Player */}
            <div className="relative aspect-[9/16] w-[260px] bg-black rounded-2xl overflow-hidden border border-[#20332a] shadow-2xl flex items-center justify-center select-none">
              {(activePreviewClip.videoUrl || sourceVideoUrl) ? (
                <video 
                  ref={previewVideoRef}
                  src={activePreviewClip.videoUrl || sourceVideoUrl} 
                  onTimeUpdate={handleVideoTimeUpdate}
                  className="w-full h-full object-cover"
                  playsInline
                />
              ) : activePreviewClip.thumbnailUrl ? (
                <img 
                  src={activePreviewClip.thumbnailUrl} 
                  alt="preview"
                  className="w-full h-full object-cover opacity-90"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#0e1914] text-neutral-400 font-mono text-xs">
                  <span>Playing Clip Video</span>
                </div>
              )}

              {/* AI Auto Title */}
              {!activePreviewClip.outputPath && branding.autoTitle?.enabled && (
                <div 
                  className="absolute z-20 pointer-events-none px-2 text-center"
                  style={{
                    top: `${branding.autoTitle.positionY ?? 10}%`,
                    left: `${branding.autoTitle.positionX ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    color: branding.autoTitle.color || '#ffffff'
                  }}
                >
                  <div 
                    style={{
                      fontSize: `${Math.round((branding.autoTitle.fontSize || 16) * 0.9)}px`,
                      textShadow: '0 2px 8px rgba(0,0,0,0.95)'
                    }}
                    className="font-black uppercase tracking-tight leading-snug line-clamp-2"
                  >
                    {ViralDetectorEngine.formatTitleLines(activePreviewClip.title).map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Watermark */}
              {!activePreviewClip.outputPath && branding.showWatermark && branding.creatorHandle && (
                <div 
                  className="absolute z-20 pointer-events-none font-bold text-[10px] text-white/80 font-mono"
                  style={{
                    top: `${branding.watermarkPositionY ?? 92}%`,
                    left: `${branding.watermarkPositionX ?? 22}%`,
                    transform: 'translate(-50%, -50%)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)'
                  }}
                >
                  {branding.creatorHandle}
                </div>
              )}

              {/* Real Word-by-Word Synced CapCut Subtitles */}
              {!activePreviewClip.outputPath && captions.enabled && (
                <div 
                  className="absolute z-20 pointer-events-none px-3 text-center w-full"
                  style={{
                    top: `${captions.positionY ?? 72}%`,
                    left: `${captions.positionX ?? 50}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {(() => {
                    const { activeWord, beatWords } = getActiveWordInfo(activePreviewClip, previewTime);
                    const contextualEmoji = activeWord ? getContextualEmoji(activeWord) : undefined;

                    return (
                      <div className="flex flex-col items-center">
                        {/* CapCut Contextual Animated Emoji Pop */}
                        {captions.showEmoji && contextualEmoji && (
                          <div className="text-3xl mb-1 animate-bounce drop-shadow-lg">
                            {contextualEmoji}
                          </div>
                        )}

                        {/* Words beat */}
                        <div className="flex items-center justify-center flex-wrap gap-1.5">
                          {beatWords.map((w, idx) => {
                            const isActive = previewTime >= w.start && previewTime <= w.end;
                            return (
                              <span
                                key={idx}
                                style={{
                                  fontSize: `${captions.fontSize || 22}px`,
                                  color: isActive ? (captions.highlightColor || '#bef264') : '#ffffff',
                                  textShadow: isActive 
                                    ? '0 0 16px rgba(190,242,100,0.6), 0 2px 4px rgba(0,0,0,0.9)' 
                                    : '0 2px 4px rgba(0,0,0,0.95)',
                                  transform: isActive ? 'scale(1.12)' : 'scale(1)'
                                }}
                                className={`font-black uppercase tracking-tight transition-all duration-100 ${
                                  isActive ? 'inline-block font-extrabold' : 'opacity-90'
                                }`}
                              >
                                {w.word}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Time display */}
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-neutral-300">
                {previewTime.toFixed(1)}s / {activePreviewClip.duration}s
              </div>
            </div>

            {/* Playback Controls */}
            <div className="w-full flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                className="px-4 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isPlayingPreview ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlayingPreview ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={() => setPreviewTime(0)}
                className="p-2 rounded-xl bg-[#111e18] hover:bg-[#1b2e25] text-neutral-300 hover:text-white border border-[#20322a] cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleExportClip(activePreviewClip)}
                className="px-4 py-2 rounded-xl bg-[#111e18] hover:bg-[#1b2e25] text-neutral-200 hover:text-white font-bold text-xs border border-[#20322a] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export MP4</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
