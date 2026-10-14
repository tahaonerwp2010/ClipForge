import { cssFont, FontService } from '../services/fontService';
import React, { useRef, useEffect, useState } from 'react';
import { 
  MoveHorizontal, 
  Move
} from 'lucide-react';
import { 
  OuterCanvasRatio, 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig, 
  TranscriptWord, 
  SafeZoneGuide,
  SplitConfig
} from '../types/clipper';
import { SplitPreview } from './SplitPreview';
import { SECONDARY_FOOTAGE } from '../data/sampleVideos';
import { getContextualEmoji, CAPCUT_DYNAMIC_COLORS, hookTwoLines, hookFontPx } from '../utils/captionHelpers';

interface PhonePreviewProps {
  videoUrl: string;
  canvasRatio: OuterCanvasRatio;
  framing: InnerFramingConfig;
  captions: CaptionConfig;
  grading: VideoGradingConfig;
  branding: BrandingConfig;
  words: TranscriptWord[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onTogglePlay: () => void;
  safeZone: SafeZoneGuide;
  onSafeZoneChange: (zone: SafeZoneGuide) => void;
  onPanChange?: (newPan: number) => void;
  onFramingChange?: (framing: InnerFramingConfig) => void;
  onCaptionsChange?: (captions: CaptionConfig) => void;
  onBrandingChange?: (branding: BrandingConfig) => void;
  clipTitle?: string;
  split?: SplitConfig | null;
  onSplitChange?: (s: SplitConfig) => void;
}

export const PhonePreview: React.FC<PhonePreviewProps> = ({
  videoUrl,
  canvasRatio,
  framing,
  captions,
  grading,
  branding,
  words,
  currentTime,
  duration,
  isPlaying,
  onTimeUpdate,
  onDurationChange,
  onTogglePlay,
  safeZone,
  onSafeZoneChange,
  onPanChange,
  onFramingChange,
  onCaptionsChange,
  onBrandingChange,
  clipTitle = 'AI CODING REVOLUTION 2026',
  split,
  onSplitChange
}) => {
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const phoneScreenRef = useRef<HTMLDivElement>(null);

  // Pan dragging state for fill-crop
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const panStartXRef = useRef(0);
  const currentPanRef = useRef(framing.panX);

  // Caption drag & resize state on the phone screen
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const [isResizingCaption, setIsResizingCaption] = useState(false);
  const [isHoveringCaption, setIsHoveringCaption] = useState(false);
  
  const captionDragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 50,
    startY: 72
  });

  const captionResizeStartRef = useRef<{ mouseX: number; mouseY: number; startFontSize: number }>({
    mouseX: 0,
    mouseY: 0,
    startFontSize: 22
  });

  // Auto Title drag & resize state
  const [isDraggingAutoTitle, setIsDraggingAutoTitle] = useState(false);
  const [isResizingAutoTitle, setIsResizingAutoTitle] = useState(false);
  const [isHoveringAutoTitle, setIsHoveringAutoTitle] = useState(false);

  const autoTitleDragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 50,
    startY: 10
  });

  const autoTitleResizeStartRef = useRef<{ mouseX: number; mouseY: number; startFontSize: number }>({
    mouseX: 0,
    mouseY: 0,
    startFontSize: 16
  });

  // Banner drag state
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [isHoveringBanner, setIsHoveringBanner] = useState(false);

  const bannerDragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 50,
    startY: 6
  });

  // Watermark drag state
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);
  const [isHoveringWatermark, setIsHoveringWatermark] = useState(false);

  const watermarkDragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 20,
    startY: 92
  });

  useEffect(() => {
    if (primaryVideoRef.current) {
      if (isPlaying) {
        primaryVideoRef.current.play().catch(() => {});
        bgVideoRef.current?.play().catch(() => {});
        secondaryVideoRef.current?.play().catch(() => {});
      } else {
        primaryVideoRef.current.pause();
        bgVideoRef.current?.pause();
        secondaryVideoRef.current?.pause();
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (primaryVideoRef.current) {
      onTimeUpdate(primaryVideoRef.current.currentTime);
      if (bgVideoRef.current) {
        bgVideoRef.current.currentTime = primaryVideoRef.current.currentTime;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    onTimeUpdate(target);
    if (primaryVideoRef.current) primaryVideoRef.current.currentTime = target;
    if (bgVideoRef.current) bgVideoRef.current.currentTime = target;
  };

  const handleStop = () => {
    if (primaryVideoRef.current) {
      primaryVideoRef.current.pause();
      primaryVideoRef.current.currentTime = 0;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = 0;
      onTimeUpdate(0);
    }
  };

  // Resolve current active word chunk
  let activeWordIndex = words.findIndex(w => currentTime >= w.start && currentTime <= w.end);
  const chunkSize = captions.style === 'capcut-pop' ? 1 : (captions.maxWordsPerBeat || 3);

  // Fallback chunk if video is paused at 0 or between speech beats, so user can always see & adjust captions
  let currentChunk: TranscriptWord[] = [];
  if (activeWordIndex !== -1) {
    const chunkStart = Math.floor(activeWordIndex / chunkSize) * chunkSize;
    currentChunk = words.slice(chunkStart, chunkStart + chunkSize);
  } else if (words.length > 0) {
    let closestIdx = 0;
    let minDiff = Infinity;
    words.forEach((w, idx) => {
      const diff = Math.abs(w.start - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    const chunkStart = Math.floor(closestIdx / chunkSize) * chunkSize;
    currentChunk = words.slice(chunkStart, chunkStart + chunkSize);
    if (currentChunk.length === 0) {
      currentChunk = words.slice(0, chunkSize);
    }
    activeWordIndex = chunkStart;
  } else {
    currentChunk = [
      { word: 'BIGGEST', start: 0, end: 1 },
      { word: 'VIRAL', start: 1, end: 2, emoji: '🔥' },
      { word: 'MISTAKE', start: 2, end: 3, emoji: '🤯' }
    ];
    activeWordIndex = 1;
  }

  const warmthOffset = grading.warmth - 100;
  const filterStyle: React.CSSProperties = {
    filter: `brightness(${grading.brightness}%) contrast(${grading.contrast}%) saturate(${grading.saturation}%) ${
      warmthOffset > 0 ? `sepia(${warmthOffset * 0.4}%)` : `hue-rotate(${warmthOffset * 0.5}deg)`
    }`
  };

  // Video Pan Handlers for fill-crop
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (framing.mode === 'custom-scale') {
      setIsDraggingPan(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, ox: framing.offsetX ?? 0, oy: framing.offsetY };
      return;
    }
    if (framing.mode !== 'fill-crop') return;
    setIsDraggingPan(true);
    panStartXRef.current = e.clientX;
    currentPanRef.current = framing.panX;
  };

  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (isDraggingPan && framing.mode === 'custom-scale' && onFramingChange) {
      const r = phoneScreenRef.current?.getBoundingClientRect();
      if (!r) return;
      const d = dragStartRef.current;
      const clamp = (v: number) => Math.max(-50, Math.min(50, Math.round(v)));
      onFramingChange({
        ...framing,
        offsetX: framing.autoReframing ? (framing.offsetX ?? 0) : clamp(d.ox + ((e.clientX - d.x) / r.width) * 100),
        offsetY: clamp(d.oy + ((e.clientY - d.y) / r.height) * 100)
      });
      return;
    }
    if (!isDraggingPan || !onPanChange) return;
    const deltaX = e.clientX - panStartXRef.current;
    const deltaPercent = (deltaX / Math.max(100, scrW)) * 80;
    const nextPan = Math.max(-50, Math.min(50, currentPanRef.current + deltaPercent));
    onPanChange(Math.round(nextPan));
  };

  const handlePanMouseUp = () => setIsDraggingPan(false);

  // Dynamic aspect ratio geometry for device frame
  const getDeviceAspectClasses = () => {
    switch (canvasRatio) {
      case '9:16':
        return 'w-[212px] aspect-[9/16]';
      case '4:5':
        return 'w-[224px] aspect-[4/5]';
      case '1:1':
        return 'w-[224px] aspect-square';
      case '4:3':
        return 'w-[250px] aspect-[4/3]';
      case '16:9':
        return 'w-[270px] aspect-[16/9]';
      default:
        return 'w-[212px] aspect-[9/16]';
    }
  };

  // =========================================================================
  // CAPTION DRAG & RESIZE DIRECTLY ON THE MOBILE PHONE PREVIEW
  // =========================================================================
  const handleCaptionMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onCaptionsChange) return;

    setIsDraggingCaption(true);
    captionDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: captions.positionX,
      startY: captions.positionY
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onCaptionsChange) return;

    setIsResizingCaption(true);
    captionResizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startFontSize: captions.fontSize
    };
  };

  // =========================================================================
  // AUTO TITLE DRAG & RESIZE DIRECTLY ON THE MOBILE PHONE PREVIEW
  // =========================================================================
  const handleAutoTitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onBrandingChange) return;

    setIsDraggingAutoTitle(true);
    autoTitleDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: branding.autoTitle?.positionX ?? 50,
      startY: branding.autoTitle?.positionY ?? 10
    };
  };

  const handleAutoTitleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onBrandingChange) return;

    setIsResizingAutoTitle(true);
    autoTitleResizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startFontSize: branding.autoTitle?.fontSize || 16
    };
  };

  // =========================================================================
  // BANNER DRAG DIRECTLY ON THE MOBILE PHONE PREVIEW
  // =========================================================================
  const handleBannerMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onBrandingChange) return;

    setIsDraggingBanner(true);
    bannerDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: branding.bannerPositionX ?? 50,
      startY: branding.bannerPositionY ?? 6
    };
  };

  // =========================================================================
  // WATERMARK DRAG DIRECTLY ON THE MOBILE PHONE PREVIEW
  // =========================================================================
  const handleWatermarkMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onBrandingChange) return;

    setIsDraggingWatermark(true);
    watermarkDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: branding.watermarkPositionX ?? 20,
      startY: branding.watermarkPositionY ?? 92
    };
  };

  // CapCut-style guides: while an element is being dragged its centre / edges snap to the screen centre, the screen edges and the
  // centre lines of the other elements; the blue lines are drawn only during the drag.
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const snapPos = (id: 'caption' | 'title' | 'banner' | 'mark', x: number, y: number) => {
    const scr = phoneScreenRef.current;
    if (!scr) return { x, y };
    const sr = scr.getBoundingClientRect();
    const el = scr.querySelector(`[data-snap="${id}"]`) as HTMLElement | null;
    const er = el?.getBoundingClientRect();
    const w = er ? er.width / sr.width * 100 : 0, h = er ? er.height / sr.height * 100 : 0;
    const others: Array<[string, number, number]> = [];
    if (captions.enabled) others.push(['caption', captions.positionX, captions.positionY]);
    if (branding.autoTitle?.enabled) others.push(['title', branding.autoTitle.positionX ?? 50, branding.autoTitle.positionY ?? 10]);
    if (branding.showHookTitle) others.push(['banner', branding.bannerPositionX ?? 50, branding.bannerPositionY ?? 8]);
    if (branding.showWatermark) others.push(['mark', branding.watermarkPositionX ?? 20, branding.watermarkPositionY ?? 92]);
    const TH = 2;                                                       // % of the screen (about 5 px)
    const axis = (v: number, size: number, targets: number[]) => {
      let best: { d: number; val: number; line: number } | null = null;
      for (const off of [0, -size / 2, size / 2]) for (const t of targets) {
        const d = Math.abs(v + off - t);
        if (d < TH && (!best || d < best.d)) best = { d, val: t - off, line: t };
      }
      return best;
    };
    const bx = axis(x, w, [50, 0, 100, ...others.filter(o => o[0] !== id).map(o => o[1])]);
    const by = axis(y, h, [50, 0, 100, ...others.filter(o => o[0] !== id).map(o => o[2])]);
    setGuides({ x: bx ? bx.line : null, y: by ? by.line : null });
    return { x: bx ? Math.round(bx.val * 10) / 10 : x, y: by ? Math.round(by.val * 10) / 10 : y };
  };

  // GLOBAL MOUSE HANDLER FOR ALL DRAG INTERACTIONS
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!phoneScreenRef.current) return;
      const rect = phoneScreenRef.current.getBoundingClientRect();

      // 1. Caption drag
      if (isDraggingCaption && onCaptionsChange) {
        const deltaX = ((e.clientX - captionDragStartRef.current.mouseX) / rect.width) * 100;
        const deltaY = ((e.clientY - captionDragStartRef.current.mouseY) / rect.height) * 100;

        const rawX = Math.round(Math.max(0, Math.min(100, captionDragStartRef.current.startX + deltaX)));
        const rawY = Math.round(Math.max(0, Math.min(100, captionDragStartRef.current.startY + deltaY)));
        const { x: newX, y: newY } = snapPos('caption', rawX, rawY);

        onCaptionsChange({
          ...captions,
          positionX: newX,
          positionY: newY
        });
      }

      // Caption resize
      if (isResizingCaption && onCaptionsChange) {
        const deltaX = e.clientX - captionResizeStartRef.current.mouseX;
        const deltaY = e.clientY - captionResizeStartRef.current.mouseY;
        const newSize = Math.max(0, Math.round(captionResizeStartRef.current.startFontSize + (deltaX + deltaY) * 0.15));

        onCaptionsChange({
          ...captions,
          fontSize: newSize
        });
      }

      // 2. Auto Title drag
      if (isDraggingAutoTitle && onBrandingChange) {
        const deltaX = ((e.clientX - autoTitleDragStartRef.current.mouseX) / rect.width) * 100;
        const deltaY = ((e.clientY - autoTitleDragStartRef.current.mouseY) / rect.height) * 100;

        const rawX = Math.round(Math.max(0, Math.min(100, autoTitleDragStartRef.current.startX + deltaX)));
        const rawY = Math.round(Math.max(0, Math.min(100, autoTitleDragStartRef.current.startY + deltaY)));
        const { x: newX, y: newY } = snapPos('title', rawX, rawY);

        onBrandingChange({
          ...branding,
          autoTitle: {
            ...branding.autoTitle,
            positionX: newX,
            positionY: newY
          }
        });
      }

      // Auto Title resize
      if (isResizingAutoTitle && onBrandingChange) {
        const deltaX = e.clientX - autoTitleResizeStartRef.current.mouseX;
        const deltaY = e.clientY - autoTitleResizeStartRef.current.mouseY;
        const newSize = Math.max(8, Math.min(36, Math.round(autoTitleResizeStartRef.current.startFontSize + (deltaX + deltaY) * 0.12)));

        onBrandingChange({
          ...branding,
          autoTitle: {
            ...branding.autoTitle,
            fontSize: newSize
          }
        });
      }

      // 3. Banner drag
      if (isDraggingBanner && onBrandingChange) {
        const deltaX = ((e.clientX - bannerDragStartRef.current.mouseX) / rect.width) * 100;
        const deltaY = ((e.clientY - bannerDragStartRef.current.mouseY) / rect.height) * 100;

        const rawX = Math.round(Math.max(0, Math.min(100, bannerDragStartRef.current.startX + deltaX)));
        const rawY = Math.round(Math.max(0, Math.min(100, bannerDragStartRef.current.startY + deltaY)));
        const { x: newX, y: newY } = snapPos('banner', rawX, rawY);

        onBrandingChange({
          ...branding,
          bannerPositionX: newX,
          bannerPositionY: newY
        });
      }

      // 4. Watermark drag
      if (isDraggingWatermark && onBrandingChange) {
        const deltaX = ((e.clientX - watermarkDragStartRef.current.mouseX) / rect.width) * 100;
        const deltaY = ((e.clientY - watermarkDragStartRef.current.mouseY) / rect.height) * 100;

        const rawX = Math.round(Math.max(0, Math.min(100, watermarkDragStartRef.current.startX + deltaX)));
        const rawY = Math.round(Math.max(0, Math.min(100, watermarkDragStartRef.current.startY + deltaY)));
        const { x: newX, y: newY } = snapPos('mark', rawX, rawY);

        onBrandingChange({
          ...branding,
          watermarkPositionX: newX,
          watermarkPositionY: newY
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setGuides({ x: null, y: null });
      setIsDraggingCaption(false);
      setIsResizingCaption(false);
      setIsDraggingAutoTitle(false);
      setIsResizingAutoTitle(false);
      setIsDraggingBanner(false);
      setIsDraggingWatermark(false);
    };

    if (
      isDraggingCaption || isResizingCaption || 
      isDraggingAutoTitle || isResizingAutoTitle || 
      isDraggingBanner || isDraggingWatermark
    ) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [
    isDraggingCaption, isResizingCaption, captions, onCaptionsChange,
    isDraggingAutoTitle, isResizingAutoTitle, isDraggingBanner, isDraggingWatermark,
    branding, onBrandingChange
  ]);

  // Scale font size proportionally for the small phone mockup
  // Same proportions as the rendered clip: ASS font size = line height (~1.22 x the CSS em), 1080 px wide output.
  const [scrW, setScrW] = useState(160);
  useEffect(() => {
    const el = phoneScreenRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScrW(el.clientWidth || 160));
    ro.observe(el); setScrW(el.clientWidth || 160);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { const w = phoneScreenRef.current?.clientWidth; if (w && Math.abs(w - scrW) > 1) setScrW(w); });
  const previewScaleFactor = 3.4 * scrW / 1080 / 1.22;
  const titleScaleFactor = 4.5 * scrW / 1080 / 1.22;
  const scaledFontSize = Math.max(0, Math.round(captions.fontSize * previewScaleFactor * 10) / 10);

  // CapCut contextual emoji (ONLY for CapCut style)
  const activeWordObj = currentChunk.find(w => activeWordIndex >= 0 && words[activeWordIndex]?.word === w.word) || currentChunk[0];
  const capcutEmoji = getContextualEmoji(activeWordObj) || activeWordObj?.emoji || '🔥';

  // CapCut dynamic rotating color for the active word (CapCut style)
  const capcutActiveColor = CAPCUT_DYNAMIC_COLORS[Math.abs(activeWordIndex >= 0 ? activeWordIndex : 0) % CAPCUT_DYNAMIC_COLORS.length];

  const getFontFamily = (fontId?: string) => cssFont(fontId || 'Montserrat Black');
  const capFont = (def: string) => (captions.fontFamily ? cssFont(captions.fontFamily) : def);
  useEffect(() => { FontService.init(); }, []);

  return (
    <div className="flex flex-col items-center justify-center select-none shrink-0 py-2 px-2">
      
      {/* Device Frame */}
      <div 
        className={`relative ${getDeviceAspectClasses()} box-content rounded-[46px] p-[9px] bg-[#080f0c] border-[3px] border-[#22352c] shadow-[0_0_0_1px_#000,0_28px_60px_-12px_rgba(0,0,0,0.85),inset_0_0_0_1px_#13221b] flex flex-col transition-all duration-300`}
        onMouseMove={handlePanMouseMove}
        onMouseUp={handlePanMouseUp}
        onMouseLeave={handlePanMouseUp}
      >
        {/* Side buttons (volume / power) */}
        <div className="absolute -left-[5px] top-[88px] w-[3px] h-7 rounded-l bg-[#22352c] pointer-events-none" />
        <div className="absolute -left-[5px] top-[128px] w-[3px] h-12 rounded-l bg-[#22352c] pointer-events-none" />
        <div className="absolute -left-[5px] top-[186px] w-[3px] h-12 rounded-l bg-[#22352c] pointer-events-none" />
        <div className="absolute -right-[5px] top-[140px] w-[3px] h-16 rounded-r bg-[#22352c] pointer-events-none" />

        {/* Dynamic island + status bar */}
        {(canvasRatio === '9:16' || canvasRatio === '4:5') && (
          <>
            <div className="absolute top-[17px] left-1/2 -translate-x-1/2 w-[74px] h-[22px] bg-black rounded-full z-[60] pointer-events-none flex items-center justify-end px-2">
              <div className="w-2 h-2 rounded-full bg-[#0f1c16] ring-1 ring-[#1a2d24]" />
            </div>
            <div className="absolute top-[19px] left-[30px] right-[30px] z-[55] pointer-events-none flex items-center justify-between text-[9px] font-semibold text-white/80" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="flex items-end gap-[1.5px] h-2">{[3, 5, 7, 9].map(h => <i key={h} className="w-[2px] bg-white/85 rounded-sm" style={{ height: h }} />)}</span>
                <span className="inline-block w-[15px] h-[8px] rounded-[2px] border border-white/80 relative"><i className="absolute inset-[1px] right-[3px] bg-white/85 rounded-[1px]" /></span>
              </span>
            </div>
            <div className="absolute bottom-[14px] left-1/2 -translate-x-1/2 w-[84px] h-[3.5px] rounded-full bg-white/60 z-[55] pointer-events-none" />
          </>
        )}

        {/* Inner Screen */}
        <div 
          ref={phoneScreenRef}
          className="relative w-full h-full rounded-[36px] overflow-hidden bg-black flex items-center justify-center"
        >
          
          {/* Blue snap guides (only while dragging) */}
          {(isDraggingCaption || isDraggingAutoTitle || isDraggingBanner || isDraggingWatermark) && (
            <>
              {guides.x != null && <div className="absolute inset-y-0 z-[70] pointer-events-none bg-[#2f8cff]" style={{ left: `${guides.x}%`, width: 1, boxShadow: '0 0 4px #2f8cff' }} />}
              {guides.y != null && <div className="absolute inset-x-0 z-[70] pointer-events-none bg-[#2f8cff]" style={{ top: `${guides.y}%`, height: 1, boxShadow: '0 0 4px #2f8cff' }} />}
            </>
          )}

          {/* 1. FIT BLUR */}
          {!split && framing.mode === 'fit-blur' && (
            <>
              {framing.fitBackground !== 'black' && <video
                ref={bgVideoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover scale-125 pointer-events-none"
                style={{
                  filter: `blur(${framing.blurIntensity}px) brightness(${1 - framing.backdropDarken}) ${filterStyle.filter}`
                }}
              />}
              <div 
                className="relative z-10 w-full transition-all"
                style={{
                  transform: `translateY(${framing.offsetY}%)`,
                  boxShadow: framing.innerShadow ? '0 6px 18px rgba(0,0,0,0.85)' : 'none'
                }}
              >
                <video
                  ref={primaryVideoRef}
                  src={videoUrl}
                  loop
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
                  style={{
                    borderRadius: `${Math.round(framing.innerBorderRadius * 0.4)}px`,
                    ...filterStyle
                  }}
                  className="w-full object-contain cursor-pointer shadow-md"
                  onClick={onTogglePlay}
                />
              </div>
            </>
          )}

          {/* 2. FILL CROP (Full bleed vertical fill, NO BLACK SIDES, smooth pan & face tracking) */}
          {!split && framing.mode === 'fill-crop' && (() => {
            let panValue = framing.panX;
            if (framing.autoReframing) {
              panValue = framing.trackingStyle === 'smooth-pan'
                ? Math.sin(currentTime * 0.5) * 20
                : (Math.sin(currentTime * 0.35) > 0 ? -18 : 18);
            }

            // Map -50..+50 to objectPosition percentage (0% to 100%, 50% is center)
            const objectPosX = Math.max(0, Math.min(100, 50 + panValue));

            return (
              <div 
                className="relative w-full h-full overflow-hidden flex items-center justify-center cursor-ew-resize group"
                onMouseDown={handlePanMouseDown}
              >
                <video
                  ref={primaryVideoRef}
                  src={videoUrl}
                  loop
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
                  style={{
                    objectFit: 'cover',
                    objectPosition: `${objectPosX}% center`,
                    ...filterStyle
                  }}
                  className="absolute inset-0 w-full h-full transition-[object-position] duration-500 ease-out"
                  onClick={onTogglePlay}
                />
                {framing.autoReframing ? (
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-black/85 border border-[#3f9a5a]/60 px-1.5 py-0.5 rounded-full text-[7px] text-[#8fd0a4] font-mono flex items-center gap-1 shadow-lg z-30 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#bef264] animate-pulse" />
                    <span>AI Speaker Centered</span>
                  </div>
                ) : (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-white flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none">
                    <MoveHorizontal className="w-2 h-2 text-cyan-400" />
                    <span>Pan: {framing.panX}%</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3a. SPLIT SCREEN (real: facecam + game / second video) */}
          {split && onSplitChange && (
            <SplitPreview split={split} onChange={onSplitChange} videoUrl={videoUrl} primaryRef={primaryVideoRef} secondaryRef={secondaryVideoRef}
              onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange} onTogglePlay={onTogglePlay} filter={filterStyle} />
          )}

          {/* 3. SPLIT SCREEN (old demo) */}
          {!split && framing.mode === 'split-screen' && (
            <div className="relative w-full h-full flex flex-col overflow-hidden">
              <div 
                className="relative w-full overflow-hidden flex items-center justify-center bg-black"
                style={{ height: `${framing.splitRatio}%` }}
              >
                <video
                  ref={primaryVideoRef}
                  src={videoUrl}
                  loop
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
                  style={filterStyle}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={onTogglePlay}
                />
              </div>
              <div className="h-0.5 bg-[#bef264] z-20 shrink-0" />
              <div 
                className="relative w-full overflow-hidden flex items-center justify-center bg-[#111]"
                style={{ height: `${100 - framing.splitRatio}%` }}
              >
                <video
                  ref={secondaryVideoRef}
                  src={SECONDARY_FOOTAGE[framing.secondaryVideoType]}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* 4. LETTERBOX */}
          {!split && framing.mode === 'letterbox' && (
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              <div 
                className="w-full transition-all"
                style={{ transform: `translateY(${framing.offsetY}%)` }}
              >
                <video
                  ref={primaryVideoRef}
                  src={videoUrl}
                  loop
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
                  style={{
                    boxShadow: framing.innerShadow ? '0 6px 18px rgba(0,0,0,0.9)' : 'none',
                    ...filterStyle
                  }}
                  className="w-full object-contain cursor-pointer"
                  onClick={onTogglePlay}
                />
              </div>
            </div>
          )}

          {/* 5. CUSTOM: zoom + position + rounded corners (drag the video to move it) */}
          {!split && framing.mode === 'custom-scale' && (
            <div
              className="relative w-full h-full overflow-hidden cursor-move"
              onMouseDown={handlePanMouseDown}
            >
              {framing.fitBackground !== 'black' && (
                <video
                  src={videoUrl}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover scale-125 pointer-events-none"
                  style={{ filter: `blur(${framing.blurIntensity}px) brightness(${1 - framing.backdropDarken}) ${filterStyle.filter}` }}
                />
              )}
              <div
                className="absolute left-1/2 top-1/2 overflow-hidden"
                style={{
                  width: `${framing.customScale}%`,
                  transform: `translate(calc(-50% + ${framing.offsetX ?? 0}% * 100 / ${framing.customScale}), calc(-50% + ${framing.offsetY}% * 100 / ${framing.customScale}))`,
                  borderRadius: `${Math.round(framing.innerBorderRadius * 0.4)}px`,
                  boxShadow: framing.innerShadow ? '0 8px 20px rgba(0,0,0,0.95)' : 'none'
                }}
              >
                <video
                  ref={primaryVideoRef}
                  src={videoUrl}
                  loop
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
                  style={filterStyle}
                  className="w-full block"
                  onClick={onTogglePlay}
                  draggable={false}
                />
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-white z-30 pointer-events-none opacity-0 hover:opacity-100">
                Drag to move
              </div>
            </div>
          )}

          {/* Vignette */}
          {grading.vignette && (
            <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.65)_100%)]" />
          )}

          {/* =====================================================================
              1. AI AUTO TITLE (DRAGGABLE & RESIZABLE DIRECTLY ON SCREEN)
          ===================================================================== */}
          {branding.autoTitle?.enabled && (
            <div
              data-snap="title" className="absolute z-35 transition-transform select-none max-w-[92%] w-max"
              style={{
                left: `${branding.autoTitle.positionX ?? 50}%`,
                top: `${branding.autoTitle.positionY ?? 10}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseEnter={() => setIsHoveringAutoTitle(true)}
              onMouseLeave={() => {
                if (!isDraggingAutoTitle && !isResizingAutoTitle) setIsHoveringAutoTitle(false);
              }}
            >
              <div
                onMouseDown={handleAutoTitleMouseDown}
                className={`relative group/autotitle p-1 rounded cursor-move transition-all ${
                  isDraggingAutoTitle || isResizingAutoTitle || isHoveringAutoTitle
                    ? 'ring-1 ring-[#3f9a5a]'
                    : 'hover:ring-1 hover:ring-white/40'
                }`}
              >
                {/* Tooltip HUD */}
                {(isHoveringAutoTitle || isDraggingAutoTitle || isResizingAutoTitle) && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 px-1.5 py-0.2 rounded border border-[#3f9a5a]/40 text-[7px] text-[#8fd0a4] font-mono flex items-center gap-1 shadow-md whitespace-nowrap z-50 pointer-events-none">
                    <Move className="w-2 h-2" />
                    <span>Hook: X:{branding.autoTitle.positionX ?? 50}% Y:{branding.autoTitle.positionY ?? 10}%</span>
                  </div>
                )}

                {/* Corner Resize Handle */}
                {false && (isHoveringAutoTitle || isDraggingAutoTitle || isResizingAutoTitle) && (
                  <div
                    onMouseDown={handleAutoTitleResizeMouseDown}
                    className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#bef264] rounded-full border border-black shadow-md cursor-nwse-resize z-50 flex items-center justify-center hover:scale-125 transition-transform"
                    title=""
                  >
                    <div className="w-0.5 h-0.5 bg-black rounded-full" />
                  </div>
                )}

                <div
                  key={`at-${branding.autoTitle.animIn || 'none'}-${branding.autoTitle.animOut || 'none'}`}
                  style={{
                    animation: (() => { const i = branding.autoTitle.animIn || 'none', o = branding.autoTitle.animOut || 'none'; const parts = []; if (i !== 'none') parts.push(`cft-in-${i} 450ms ease-out both`); if (o !== 'none') parts.push(`cft-out-${o} 450ms ease-in 1.6s both`); return parts.join(', ') || undefined; })(),
                    color: branding.autoTitle.color || '#ffffff',
                    fontSize: `${Math.round(hookFontPx(hookTwoLines(branding.autoTitle.title || clipTitle || 'THE VIRAL TRUTH'), scrW))}px`,
                    fontFamily: getFontFamily(branding.autoTitle.fontFamily),
                    width: 'max-content', maxWidth: `${Math.round(scrW * 0.86)}px`, whiteSpace: 'normal', overflowWrap: 'break-word',
                    textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)'
                  }}
                  className="font-black uppercase tracking-tight text-center leading-tight"
                >
                  {hookTwoLines(branding.autoTitle.title || clipTitle || 'THE VIRAL TRUTH').map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              2. TOP HOOK BANNER (DRAGGABLE DIRECTLY ON SCREEN)
          ===================================================================== */}
          {branding.showHookTitle && branding.hookTitle.trim() && (
            <div
              data-snap="banner" className="absolute z-35 transition-transform select-none max-w-[92%] w-fit"
              style={{
                left: `${branding.bannerPositionX ?? 50}%`,
                top: `${branding.bannerPositionY ?? 6}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseEnter={() => setIsHoveringBanner(true)}
              onMouseLeave={() => {
                if (!isDraggingBanner) setIsHoveringBanner(false);
              }}
            >
              <div
                onMouseDown={handleBannerMouseDown}
                className={`relative group/banner p-0.5 rounded cursor-move transition-all ${
                  isDraggingBanner || isHoveringBanner
                    ? 'ring-1 ring-amber-400'
                    : 'hover:ring-1 hover:ring-white/40'
                }`}
              >
                {/* Tooltip HUD */}
                {(isHoveringBanner || isDraggingBanner) && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 px-1.5 py-0.2 rounded border border-amber-400/40 text-[7px] text-amber-300 font-mono flex items-center gap-1 shadow-md whitespace-nowrap z-50 pointer-events-none">
                    <Move className="w-2 h-2" />
                    <span>Banner: X:{branding.bannerPositionX ?? 50}% Y:{branding.bannerPositionY ?? 6}%</span>
                  </div>
                )}

                {branding.bannerShowBackground !== false ? (
                  <div
                    style={{ backgroundColor: branding.hookBgColor || '#bef264', color: branding.hookTextColor || '#000000', fontFamily: cssFont(branding.hookFontFamily || 'Montserrat Black') }}
                    className="px-2 py-0.5 rounded font-extrabold text-[8px] uppercase text-center shadow-md border border-black/20 whitespace-nowrap"
                  >
                    {branding.hookTitle}
                  </div>
                ) : (
                  <div
                    style={{
                      color: branding.hookTextColor || '#ffffff',
                      fontFamily: cssFont(branding.hookFontFamily || 'Montserrat Black'),
                      WebkitTextStroke: `1px ${branding.hookBgColor || '#bef264'}`,
                      textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)'
                    }}
                    className="px-1 font-black text-[9px] uppercase tracking-wide text-center whitespace-nowrap drop-shadow"
                  >
                    {branding.hookTitle}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              CAPTIONS OVERLAY:
              - ONLY rendered if captions.enabled is TRUE and fontSize > 0!
              - ZERO BACKGROUND BANNER ON ANY CAPTION (Clean floating text!)
              - MULTILINE AUTO-WRAP (Long lines cleanly wrap to the next line!)
              - ONLY 1 EMOJI TEMPLATE (CapCut Dynamic Emoji with rotating colors)
              - All other templates have NO emojis!
              - Scale can go all the way down to 0!
          ===================================================================== */}
          {captions.enabled && captions.fontSize > 0 && currentChunk.length > 0 && (
            <div 
              data-snap="caption" className="absolute z-30 transition-transform select-none max-w-[88%] w-fit"
              style={{ 
                left: `${captions.positionX}%`, 
                top: `${captions.positionY}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseEnter={() => setIsHoveringCaption(true)}
              onMouseLeave={() => {
                if (!isDraggingCaption && !isResizingCaption) {
                  setIsHoveringCaption(false);
                }
              }}
            >
              {/* Draggable Caption Wrapper Box (Clean with NO background fill!) */}
              <div 
                onMouseDown={handleCaptionMouseDown}
                className={`relative group/cap p-1 rounded cursor-move transition-all ${
                  isDraggingCaption || isResizingCaption || isHoveringCaption
                    ? 'ring-1 ring-[#3f9a5a]/70'
                    : 'hover:ring-1 hover:ring-white/30'
                }`}
              >
                {/* Floating position/size HUD tooltip during hover or drag */}
                {(isHoveringCaption || isDraggingCaption || isResizingCaption) && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 px-1.5 py-0.2 rounded border border-[#3f9a5a]/40 text-[7px] text-[#8fd0a4] font-mono flex items-center gap-1 shadow-md whitespace-nowrap z-40 pointer-events-none">
                    <Move className="w-2 h-2" />
                    <span>X:{captions.positionX}% Y:{captions.positionY}% ({captions.fontSize}px)</span>
                  </div>
                )}

                {/* Corner Resize Handle */}
                {(isHoveringCaption || isDraggingCaption || isResizingCaption) && (
                  <div
                    onMouseDown={handleResizeMouseDown}
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#bef264] rounded-full border border-black shadow-md cursor-nwse-resize z-40 flex items-center justify-center hover:scale-125 transition-transform"
                    title="Drag to resize captions font size (can reduce down to 0)"
                  >
                    <div className="w-1 h-1 bg-black rounded-full" />
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 1: CAPCUT DYNAMIC EMOJI POP
                    - ONLY TEMPLATE WITH EMOJIS!
                    - Dynamic rotating colors on spoken word!
                    - Multiline wrapping & NO BACKGROUND BANNER!
                    - Emoji scales proportionally down with font size!
                ============================================================= */}
                {captions.style === 'capcut-emoji' && (
                  <div className="flex flex-col items-center text-center">
                    {/* Bouncing Contextual Speech Emoji (Proportionally scaled with font size down to 0) */}
                    {capcutEmoji && scaledFontSize > 0 && (
                      <div 
                        style={{ 
                          fontSize: `${Math.max(0, Math.round(scaledFontSize * 1.15))}px`,
                          lineHeight: 1
                        }}
                        className="animate-bounce leading-none mb-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] select-none transition-all"
                      >
                        {capcutEmoji}
                      </div>
                    )}
                    {/* Multiline wrapping text without background box */}
                    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                      {currentChunk.map((w, idx) => {
                        const isActive = activeWordIndex >= 0 
                          ? words[activeWordIndex]?.word === w.word 
                          : idx === 0;

                        return (
                          <span
                            key={idx}
                            style={{
                              color: isActive ? capcutActiveColor : '#ffffff',
                              fontSize: `${scaledFontSize}px`,
                              fontFamily: capFont('"Montserrat", "Plus Jakarta Sans", sans-serif'),
                              textShadow: isActive 
                                ? `0 2px 6px rgba(0,0,0,0.9), 0 0 6px ${capcutActiveColor}, 0 0 14px ${capcutActiveColor}, 0 0 28px ${capcutActiveColor}99` 
                                : '0 2px 6px rgba(0,0,0,0.95)'
                            }}
                            className={`font-black tracking-tight uppercase leading-tight transition-transform ${
                              isActive ? 'scale-110 inline-block z-10' : 'opacity-95'
                            }`}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 2: ALEX HORMOZI (Vibrant Yellow Highlight, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'capcut-pop' && (
                  <div className="flex flex-col items-center text-center">
                    {false && capcutEmoji && scaledFontSize > 0 && (
                      <div key={`e${activeWordIndex}`} style={{ fontSize: `${Math.round(scaledFontSize * 1.15)}px`, lineHeight: 1, animation: 'cfpop 220ms ease-out' }} className="mb-0.5 select-none">{capcutEmoji}</div>
                    )}
                    <span
                      key={`w${activeWordIndex}`}
                      style={{
                        color: '#ffffff',
                        fontSize: `${scaledFontSize}px`,
                        fontFamily: capFont('"Montserrat", "Plus Jakarta Sans", sans-serif'),
                        WebkitTextStroke: `${Math.max(1, scaledFontSize * 0.16)}px #000000`,
                        paintOrder: 'stroke fill',
                        animation: 'cfpop 180ms ease-out',
                        display: 'inline-block'
                      }}
                      className="font-black tracking-tight uppercase leading-tight"
                    >
                      {captions.uppercase === false ? (currentChunk[0]?.word || '') : (currentChunk[0]?.word || '').toUpperCase()}
                    </span>
                  </div>
                )}

                {captions.style === 'hormozi' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                    {currentChunk.map((w, idx) => {
                      const isActive = activeWordIndex >= 0 ? words[activeWordIndex]?.word === w.word : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"Bebas Neue", "Plus Jakarta Sans", Impact, sans-serif'),
                            color: isActive ? '#facc15' : '#ffffff',
                            textShadow: isActive 
                              ? '0 2px 8px rgba(0,0,0,0.95), 0 0 14px rgba(250, 204, 21, 0.75)' 
                              : '0 2px 6px rgba(0,0,0,0.95)'
                          }}
                          className={`font-black tracking-wide uppercase leading-tight transition-all ${
                            isActive ? 'scale-110 inline-block' : 'opacity-90'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 3: MRBEAST (Chunky Impact Outline, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'mrbeast' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                    {currentChunk.map((w, idx) => {
                      const isActive = activeWordIndex >= 0 ? words[activeWordIndex]?.word === w.word : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"Montserrat", Impact, sans-serif'),
                            color: isActive ? '#bef264' : '#ffffff',
                            WebkitTextStroke: `${Math.max(0.5, Math.round(scaledFontSize * 0.08))}px #000000`,
                            textShadow: isActive ? '0 2px 10px rgba(0,0,0,0.95), 0 0 12px #bef264' : '0 2px 8px rgba(0,0,0,0.95)'
                          }}
                          className={`font-black uppercase tracking-tighter leading-tight transition-transform ${
                            isActive ? 'scale-115 inline-block z-10' : 'opacity-95'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 4: CYBER NEON (Glowing Bloom, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'neon' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                    {currentChunk.map((w, idx) => {
                      const isActive = activeWordIndex >= 0 ? words[activeWordIndex]?.word === w.word : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"Syne", "Plus Jakarta Sans", sans-serif'),
                            color: isActive ? '#38bdf8' : '#e2e8f0',
                            textShadow: isActive 
                              ? '0 0 10px #38bdf8, 0 0 20px #0284c7, 0 2px 8px rgba(0,0,0,0.95)' 
                              : '0 2px 6px rgba(0,0,0,0.9)'
                          }}
                          className={`font-black uppercase tracking-wider leading-tight transition-all ${
                            isActive ? 'scale-110 inline-block font-extrabold' : 'opacity-85'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 5: KARAOKE POP (Wave Fill, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'karaoke' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                    {currentChunk.map((w, idx) => {
                      const isPastOrCurrent = activeWordIndex >= 0 ? words.findIndex(x => x.word === w.word) <= activeWordIndex : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"Montserrat", sans-serif'),
                            color: isPastOrCurrent ? '#bef264' : '#64748b',
                            textShadow: isPastOrCurrent 
                              ? '0 2px 8px rgba(0,0,0,0.95), 0 0 10px #bef264' 
                              : '0 2px 4px rgba(0,0,0,0.8)'
                          }}
                          className={`font-black uppercase tracking-tight leading-tight transition-colors duration-150 ${
                            isPastOrCurrent ? 'scale-105 inline-block' : 'opacity-70'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 6: CINEMATIC MINIMALIST (Clean Thought Leadership, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'cinematic' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center leading-relaxed">
                    {currentChunk.map((w, idx) => {
                      const isActive = activeWordIndex >= 0 ? words[activeWordIndex]?.word === w.word : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"Plus Jakarta Sans", sans-serif'),
                            color: isActive ? '#ffffff' : '#94a3b8',
                            textShadow: '0 2px 8px rgba(0,0,0,0.95)'
                          }}
                          className={`font-bold tracking-widest uppercase transition-colors ${
                            isActive ? 'font-extrabold border-b-2 border-[#3f9a5a]' : 'opacity-80'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 7: COMIC ACTION BOLD (Retro Action Pop, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'comic-pop' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                    {currentChunk.map((w, idx) => {
                      const isActive = activeWordIndex >= 0 ? words[activeWordIndex]?.word === w.word : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"Righteous", cursive, sans-serif'),
                            color: isActive ? '#f43f5e' : '#fef08a',
                            WebkitTextStroke: `${Math.max(0.5, Math.round(scaledFontSize * 0.06))}px #000000`,
                            textShadow: '2px 2px 0 #000000, 0 3px 6px rgba(0,0,0,0.9)'
                          }}
                          className={`font-black uppercase tracking-normal leading-tight transition-transform ${
                            isActive ? 'scale-115 -rotate-2 inline-block z-10' : 'opacity-90'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* =============================================================
                    TEMPLATE 8: CYBER GLITCH (Split High Tech, No Box, No Emoji)
                ============================================================= */}
                {captions.style === 'glitch' && (
                  <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center leading-tight">
                    {currentChunk.map((w, idx) => {
                      const isActive = activeWordIndex >= 0 ? words[activeWordIndex]?.word === w.word : idx === 0;
                      return (
                        <span
                          key={idx}
                          style={{
                            fontSize: `${scaledFontSize}px`,
                            fontFamily: capFont('"JetBrains Mono", monospace'),
                            color: isActive ? '#38bdf8' : '#e2e8f0',
                            textShadow: isActive 
                              ? '-2px 0 #f43f5e, 2px 0 #22c55e, 0 2px 8px rgba(0,0,0,0.95)' 
                              : '0 2px 4px rgba(0,0,0,0.9)'
                          }}
                          className={`font-black uppercase tracking-wider leading-tight transition-transform ${
                            isActive ? 'scale-110 inline-block font-mono' : 'opacity-85'
                          }`}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* =====================================================================
              3. WATERMARK / CREATOR HANDLE (DRAGGABLE DIRECTLY ON SCREEN)
          ===================================================================== */}
          {branding.showWatermark && (branding.watermarkType === 'image' ? !!branding.watermarkImage : !!branding.creatorHandle.trim()) && (
            <div
              data-snap="mark" className="absolute z-35 transition-transform select-none max-w-[90%] w-fit"
              style={{
                left: `${branding.watermarkPositionX ?? 20}%`,
                top: `${branding.watermarkPositionY ?? 92}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseEnter={() => setIsHoveringWatermark(true)}
              onMouseLeave={() => {
                if (!isDraggingWatermark) setIsHoveringWatermark(false);
              }}
            >
              <div
                onMouseDown={handleWatermarkMouseDown}
                className={`relative group/watermark px-1 py-0.5 rounded cursor-move transition-all ${
                  isDraggingWatermark || isHoveringWatermark
                    ? 'ring-1 ring-cyan-400'
                    : 'hover:ring-1 hover:ring-white/40'
                }`}
              >
                {/* Tooltip HUD */}
                {(isHoveringWatermark || isDraggingWatermark) && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 px-1.5 py-0.2 rounded border border-cyan-400/40 text-[7px] text-cyan-300 font-mono flex items-center gap-1 shadow-md whitespace-nowrap z-50 pointer-events-none">
                    <Move className="w-2 h-2" />
                    <span>Handle: X:{branding.watermarkPositionX ?? 20}% Y:{branding.watermarkPositionY ?? 92}%</span>
                  </div>
                )}

                {branding.watermarkType === 'image' && branding.watermarkImage ? (
                  <img
                    src={branding.watermarkImage.dataUrl}
                    alt=""
                    draggable={false}
                    style={{ width: `${(branding.watermarkImageSize ?? 20) * 1.55}px`, opacity: (branding.watermarkOpacity ?? 100) / 100 }}
                    className="block select-none pointer-events-none"
                  />
                ) : (
                  <span
                    style={{
                      color: branding.watermarkColor || '#ffffff',
                      fontFamily: cssFont(branding.watermarkFontFamily || 'Arial'),
                      fontSize: `${(branding.watermarkFontSize ?? 40) * 0.2}px`,
                      textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)'
                    }}
                    className="font-bold tracking-wide select-none whitespace-nowrap"
                  >
                    {branding.creatorHandle}
                  </span>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Underneath Player Controls */}
      <div className="w-full mt-2 space-y-1.5">
        <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-neutral-300">
          <button 
            onClick={onTogglePlay} 
            className="hover:text-[#8fd0a4] transition-colors underline underline-offset-4 cursor-pointer"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button 
            onClick={handleStop} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            Stop
          </button>
        </div>

        <div className="px-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-[#1d3228] rounded-lg appearance-none cursor-pointer accent-[#bef264]"
          />
        </div>

        <div className="text-center font-mono text-[9px] text-neutral-400">
          {currentTime.toFixed(1)} / {(duration || 0).toFixed(1)}s
        </div>
      </div>
    </div>
  );
};
