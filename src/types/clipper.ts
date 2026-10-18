export type OuterCanvasRatio = '9:16' | '4:5' | '1:1' | '4:3' | '16:9';

export type InnerFramingMode = 
  | 'fit-blur'     // Original 16:9 widescreen with dynamic blurred video backdrop
  | 'fill-crop'    // Fills entire 9:16 vertical canvas with pan/scan slider or face centering
  | 'split-screen' // 2 stacked videos (Top: Speaker, Bottom: Viral ASMR / gameplay)
  | 'letterbox'    // Clean matte letterbox with top hook title space and bottom subtitle zone
  | 'custom-scale';// Freeform scale, vertical position, corner radius, drop shadow

export type CaptionPresetStyle = 
  | 'capcut-pop'   // CapCut word-by-word: one white word at a time, thick black outline, pop-in
  | 'capcut-emoji' // CapCut style: dynamic active word pop with animated contextual emojis
  | 'hormozi'      // Alex Hormozi: High-impact vibrant yellow active word with dark contrast badge
  | 'mrbeast'      // MrBeast: Bold Impact uppercase with thick black outline & bouncy scaling pop
  | 'neon'         // Cyber Neon: Glowing neon bloom cyan/green typography
  | 'karaoke'      // Karaoke Pop: Progressive word-by-word colorful highlight
  | 'red-punch'    // Red Alert: High intensity red punch box for urgency & shock
  | 'cinematic'    // Cinematic: Minimalist clean typography for thought leadership
  | 'comic-pop'    // Comic Pop: Chunky retro bubble font with tilted action pop
  | 'glitch'       // Cyber Glitch: High energy digital glitch with split chromatics
  | `dyn-${string}`; // Dynamic captions (own locked fonts, metallic highlights) - see utils/dynCaptions.ts

export interface CaptionConfig {
  enabled: boolean;          // Master On / Off switch
  style: CaptionPresetStyle;
  fontSize: number;          // 14 - 38
  positionX: number;         // 10 to 90 (% from left, default 50)
  positionY: number;         // 10 to 90 (% from top, default 72)
  uppercase: boolean;
  maxWordsPerBeat: number;   // 1 to 4
  syncOffset?: number;       // seconds, -0.3..0.3 (+ = captions later)
  highlightColor: string;    // e.g. #FACC15, #BEF264, etc.
  showEmoji: boolean;
  outlineWidth: number;
  fontFamily?: string;       // overrides the style's default font
  translateTo?: string;      // '' = off; e.g. 'English'
  romanScript?: boolean;     // Urdu/Hindi -> Roman letters
}

export interface VideoGradingConfig {
  brightness: number; // 0 to 200 (%)
  contrast: number;   // 0 to 200 (%)
  saturation: number; // 0 to 200 (%)
  warmth: number;     // 0 to 200 (%), 100 is neutral
  grain: boolean;
  vignette: boolean;
  speedBoost: number; // 1.0 or 1.05
  fx?: AutoFxConfig;
}

export interface AutoFxConfig {
  enabled: boolean;
  intensity: 'subtle' | 'balanced' | 'wild';
  zoom: boolean;
  flash: boolean;
  shake?: boolean;
  glitch?: boolean;
  color?: boolean;
  sfx: boolean;
  sfxDb: number;
}

export interface InnerFramingConfig {
  mode: InnerFramingMode;
  panX: number;           // -50% to +50% for fill-crop
  customScale: number;    // 60% to 140%
  offsetY: number;        // -50% to +50%
  offsetX?: number;       // -50% to +50% (custom mode)
  fitBackground?: 'blur' | 'black';
  blurIntensity: number;  // 8 to 28px for fit-blur backdrop
  backdropDarken: number; // 0.1 to 0.7
  splitRatio: number;     // 50% / 50% split for split-screen
  secondaryVideoType: 'gameplay' | 'satisfying' | 'kinetic';
  innerBorderRadius: number; // 0 to 24px
  innerShadow: boolean;
  autoReframing?: boolean; // AI Active Speaker & Face Focus auto-tracking (Unlocked for fill-crop)
  trackingStyle?: 'smart-cut' | 'smooth-pan';
}

export interface AutoTitleConfig {
  enabled: boolean;
  title?: string;
  fontFamily: string;
  color: string;
  fontSize: number;
  positionX: number; // 0 to 100 (%)
  positionY: number; // 0 to 100 (%)
  animIn?: 'none' | 'fade' | 'pop' | 'slide-up';   // default none
  animOut?: 'none' | 'fade' | 'shrink';              // default none
  showSeconds?: number;                              // 0 / undefined = whole clip
  lines?: 1 | 2 | 3;                                 // how many lines the hook is written in (default 2)
  size?: number;                                     // user's hook size in px at 1080 wide; undefined = automatic
}

export interface BrandingConfig {
  // 1. AI Auto Title
  autoTitle: AutoTitleConfig;

  // 2. Hook Title Banner
  showHookTitle: boolean;
  hookTitle: string;
  bannerShowBackground: boolean; // Background ON / OFF
  hookBgColor: string;
  bannerPositionX?: number;      // 0 to 100 (%)
  bannerPositionY?: number;      // 0 to 100 (%)
  hookFontFamily?: string;
  hookTextColor?: string;

  // 3. Watermark
  showWatermark: boolean;
  creatorHandle: string;
  watermarkPositionX?: number;   // 0 to 100 (%)
  watermarkPositionY?: number;   // 0 to 100 (%)
  watermarkType?: 'text' | 'image';
  watermarkFontFamily?: string;
  watermarkColor?: string;
  watermarkFontSize?: number;    // 20 - 90
  watermarkImage?: { path: string; name: string; dataUrl: string };
  watermarkImageSize?: number;   // % of video width, 5 - 60
  watermarkOpacity?: number;     // 10 - 100

  // 4. Background music
  bgMusic?: {
    path: string; name: string; url: string;
    duration: number;            // seconds
    startSec: number;            // where in the song every clip starts
    volumeDb: number;            // -60 .. +12 dB
    fade?: boolean;              // fade in / out
  };

  // Legacy optional fields
  progressBar?: 'none' | 'rainbow' | 'accent' | 'minimal';
  audioBoost?: boolean;
}

export interface Rect01 { x: number; y: number; w: number; h: number }  // all 0..1 of the source frame
export interface SectionView { zoom: number; panX: number; panY: number }  // panX/panY -50..50
export interface SplitConfig {
  mode: 'single' | 'two' | 'bg';             // one video with a facecam inside / facecam file + game file / video + background footage
  facecam: Rect01 | null;                    // 'single' mode: where the facecam is inside the main video
  secondPath?: string; secondUrl?: string; secondName?: string; secondDuration?: number; secondDims?: [number, number];
  offset: number;                            // seconds: second video time = main time + offset
  audio: 'face' | 'game' | 'mix';
  splitPct: number;                          // height of the TOP section in % (25..75)
  swap: boolean;                             // false: facecam / main on top
  gap: number;                               // divider thickness (px at 1080 width)
  gapColor: string;
  radius: number;                            // facecam rounded corners (px at 1080 width)
  gameFit: 'fill' | 'fit';
  top: SectionView; bottom: SectionView;
  frame?: string;                            // preview frame (data URL) used by the facecam editor
  mainDims?: [number, number];
}

export interface VideoSource {
  id: string;
  title: string;
  url: string;
  duration: number; // in seconds
  thumbnail: string;
  type: 'upload' | 'youtube' | 'preset';
  author?: string;
  originalAspect?: string;
  filePath?: string; // real path on disk (Electron only)
  split?: SplitConfig;   // 'Split screen' mode
  shorts?: { path: string; name: string; duration: number }[]; // 'Upload short clips' mode: each file is one finished clip
}

export interface TranscriptWord {
  word: string;
  start: number; // in seconds
  end: number;
  emoji?: string; // CapCut smart contextual emoji
}

export interface GeneratedClip {
  id: string;
  sourceId: string;
  title: string;
  hookText: string;
  startTime: number;
  endTime: number;
  duration: number;
  viralityScore: number; // 80 - 99
  reason: string;
  category: 'High Energy' | 'Deep Insight' | 'Storytelling' | 'Shocking Truth';
  thumbnailTime: number;
  thumbnailUrl?: string; // Real video frame captured from source video
  videoUrl?: string;     // Source video stream URL (or rendered clip file URL)
  description?: string;  // upload description (1-2 lines)
  hashtags?: string[];   // up to 3 US-popular tags
  sourceName?: string;   // original file name (upload-short-clips mode)
  outputPath?: string;   // Rendered clip file on disk (real pipeline). When set, videoUrl plays from 0s.
  words: TranscriptWord[];
}

export type SafeZoneGuide = 'none' | 'yt-shorts' | 'tiktok' | 'ig-reels';

export type AppTheme = 
  | 'hicksville'  // True black and voltage lime (as seen in video 1)
  | 'emerald'     // Cool green, near-neutral surfaces
  | 'forest'      // Deeper and warmer with leaf accents
  | 'carbon'      // Neutral graphite, warm amber accent
  | 'midnight'    // Deep navy with crisp blue accent
  | 'paper';      // Warm off-white, soft headings

export interface PipelineStep {
  id: number;
  name: string;
  duration?: string;
  detail?: string;
  status: 'pending' | 'running' | 'completed' | 'skipped';
  percent?: number;
}

export interface ProjectItem {
  id: string;
  name: string;
  sourceVideoName: string;
  sourceVideoUrl: string;
  sourceFilePath?: string; // real path on disk (Electron only)
  shortsFiles?: { path: string; name: string; duration: number }[];
  outputDir?: string;
  thumbnail: string;
  diskSize: string;
  sourceDuration: number;
  clipCount: number;
  status: 'Finished' | 'Processing' | 'Paused' | 'Draft' | 'Queued' | 'Failed';
  currentStep?: number;
  stepsDone?: number;     // live counters shown in the Projects list while a project is running
  stepsTotal?: number;
  progressPercent?: number;
  steps?: PipelineStep[];
  createdAt: string;
  lastEdited: string;
  framingMode: InnerFramingMode;
  clips?: GeneratedClip[];
  elapsedSeconds?: number;
}

export interface SpeechModelItem {
  id: string;
  name: string;
  quantization?: string;
  diskSize: string;
  werScore: string;
  ramRequirement: string;
  status: 'active' | 'downloaded' | 'not_downloaded' | 'downloading';
  downloadProgress?: number;
  recommended?: boolean;
  kind?: 'speech' | 'aligner';
  note?: string;
  langs?: { lang: string; stars: number; label: string }[];   // accuracy per language (1-5)
}

export interface BundledBinary {
  id: string;
  name: string;
  resolvedPath: string;
  version: string;
  size: string;
  status: 'ok' | 'missing' | 'checking';
  role: string;
}

export interface MachineSpecs {
  machine: string;
  cpu: string;
  cores: string;
  architecture: string;
  ram: string;
  ramAvailable: string;
  gpu: string;
  acceleration: string;
  freeDisk: string;
  totalDisk: string;
  avx2: boolean;
}

export interface GeminiApiConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  status: 'idle' | 'connected' | 'quota_exceeded' | 'invalid_key' | 'disabled';
  lastTested?: string;
  lastErrorMessage?: string;
  autoFallbackToLocal: boolean;
}
