import { fileUrl } from '../utils/fileUrl';
import { 
  ProjectItem, 
  PipelineStep, 
  GeneratedClip, 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig,
  SplitConfig
} from '../types/clipper';
import { TranscriptionEngine } from './transcriptionEngine';
import { AutoReframeEngine, SpeakerKeyframe } from './autoReframeEngine';
import { ViralDetectorEngine } from './viralDetectorEngine';
import { SoftwareLogEvent, SoftwareManager } from './softwareManager';
import { GeminiService } from './geminiService';
import { AiService } from './aiService';
import { getHardware } from './hardwareMode';

export interface PipelineExecutionConfig {
  project: ProjectItem;
  framing: InnerFramingConfig;
  captions: CaptionConfig;
  grading: VideoGradingConfig;
  branding: BrandingConfig;
  targetClipsCount?: number;
  clipLength?: 'auto' | '15s' | '30s' | '45s' | '60s' | '90s';
  language?: string;
  aiPrompt?: string;
  canvasRatio?: string;
  quality?: number;
  split?: SplitConfig;
  resume?: boolean;
  initialSteps?: PipelineStep[];   // what the screen already shows (keeps finished steps / percentages when resuming)
}

export interface PipelineCallbacks {
  onStepChange?: (stepIndex: number, steps: PipelineStep[]) => void;
  onProgressChange?: (percent: number, etaSec?: number | null) => void;
  onLog?: (log: SoftwareLogEvent) => void;
  onComplete?: (updatedProject: ProjectItem, clips: GeneratedClip[]) => void;
  onError?: (message: string) => void;
}

/**
 * Master Pipeline Runner
 * Executes the 9-step processing pipeline connecting local binaries (FFmpeg, Whisper, AutoReframe)
 * with the AI clipping model.
 */
export class PipelineRunner {
  private static cancelRequested = false;
  // One live run per project: leaving the progress screen (Back) must NOT start a second run, and coming back attaches to the same one.
  private static runs = new Map<string, {
    steps: PipelineStep[]; percent: number; eta: number | null | undefined; logs: SoftwareLogEvent[];
    subs: Set<PipelineCallbacks>; off?: () => void; promise?: Promise<any>;
  }>();

  public static cancel() {
    this.cancelRequested = true;
    // stop listening to the run being paused right away, so a quick Resume can never mix the old and the new run
    for (const r of this.runs.values()) { try { r.off && r.off(); } catch { /* ignore */ } r.off = undefined; r.subs.clear(); }
    this.runs.clear();
    try { window.electronAPI?.cancelPipeline?.(); } catch { /* ignore */ }
  }
  /** true while this project's pipeline is running in the background */
  public static isRunning(projectId: string) { return this.runs.has(projectId); }
  /** stop sending updates to a screen that was closed (the run itself keeps going) */
  public static detach(cb: PipelineCallbacks) { for (const r of this.runs.values()) r.subs.delete(cb); }

  /**
   * REAL pipeline: runs in the Electron main process (ffprobe -> whisper.cpp -> analyzer -> ffmpeg render).
   * Used when the app runs as the desktop .exe and the source video has a real file path.
   */
  private static async executeReal(
    config: PipelineExecutionConfig,
    callbacks: PipelineCallbacks
  ): Promise<{ project: ProjectItem; clips: GeneratedClip[] }> {
    const api = window.electronAPI!;
    const { project, framing, captions, grading, branding, targetClipsCount = 4 } = config;

    // The same project is already running (the screen was closed and opened again): just show it again.
    const existing = this.runs.get(project.id);
    if (existing && existing.promise) {
      existing.subs.add(callbacks);
      callbacks.onStepChange?.(Math.max(0, existing.steps.findIndex(x => x.status === 'running')), existing.steps.map(x => ({ ...x })));
      callbacks.onProgressChange?.(existing.percent, existing.eta);
      existing.logs.forEach(l => callbacks.onLog?.(l));
      return existing.promise;
    }

    const steps: PipelineStep[] = [
      'Reading video metadata', 'Extracting audio', 'Transcribing speech', 'Translating captions',
      'Converting to Roman script', 'Finding moments & titles', 'Cutting clips', 'Reframing to vertical', 'Rendering clips'
    ].map((name, i) => {
      const prev = config.initialSteps && config.initialSteps.length === 9 ? config.initialSteps[i] : null;
      // a resumed run starts from what was already shown: finished steps stay finished, unfinished ones keep their percentage
      if (config.resume && prev) return { ...prev, status: prev.status === 'completed' ? 'completed' as const : 'pending' as const };
      return { id: i + 1, name, duration: '', status: 'pending' as const, detail: '' };
    });
    const run: { steps: PipelineStep[]; percent: number; eta: number | null | undefined; logs: SoftwareLogEvent[]; subs: Set<PipelineCallbacks>; off?: () => void; promise?: Promise<any> } =
      { steps, percent: project.progressPercent ?? 0, eta: null, logs: [], subs: new Set([callbacks]) };
    this.runs.set(project.id, run);
    const each = (f: (c: PipelineCallbacks) => void) => run.subs.forEach(c => { try { f(c); } catch { /* a closed screen must never stop the run */ } });
    // show what we already know straight away (no flash of 0%)
    if (config.resume) each(c => c.onStepChange?.(Math.max(0, steps.findIndex(x => x.status === 'running')), steps.map(x => ({ ...x }))));

    const off = api.onPipelineEvent?.((ev: any) => {
      if (this.runs.get(project.id) !== run) return;
      if (ev.type === 'step') {
        const s = steps[ev.index];
        s.status = ev.status;
        if (ev.name) s.name = ev.name;
        if (ev.status === 'completed') s.percent = 100;
        if (ev.duration) s.duration = ev.duration;
        if (ev.detail) s.detail = ev.detail;
        each(c => c.onStepChange?.(ev.index, steps.map(x => ({ ...x }))));
      } else if (ev.type === 'stepProgress') {
        steps[ev.index].percent = Math.max(steps[ev.index].percent || 0, ev.percent);      // a step never goes backwards
        each(c => c.onStepChange?.(ev.index, steps.map(x => ({ ...x }))));
      } else if (ev.type === 'progress') {
        run.percent = Math.max(run.percent, ev.percent); run.eta = ev.etaSec;
        each(c => c.onProgressChange?.(run.percent, ev.etaSec));
      } else if (ev.type === 'log') {
        const l: SoftwareLogEvent = {
          timestamp: new Date().toLocaleTimeString(),
          type: ev.kind === 'warn' ? 'warn' : ev.kind === 'success' ? 'success' : ev.kind === 'error' ? 'error' : 'info',
          source: ev.source,
          message: ev.message
        };
        run.logs = [...run.logs.slice(-120), l];
        each(c => c.onLog?.(l));
      }
    });
    run.off = off;

    run.promise = (async () => {
    try {
      const result = await api.startPipeline!({
        id: project.id,
        resume: !!config.resume || ((project.progressPercent ?? 0) > 0 && project.status !== 'Finished' && (project.status === 'Processing' || project.status === 'Paused')),
        filePath: project.sourceFilePath,
        shorts: !!project.shortsFiles?.length,
        files: project.shortsFiles?.map(f => ({ path: f.path, name: f.name })),
        name: project.name,
        outDir: project.outputDir,
        modelId: SoftwareManager.getActiveModelId(),
        language: config.language || 'auto',
        aiPrompt: config.aiPrompt || '',
        clipLength: config.clipLength || 'auto',
        targetClipsCount,
        ratio: config.split ? '9:16' : (config.canvasRatio || '9:16'),
        quality: config.quality || 1080,
        split: config.split ? { ...config.split, frame: undefined, secondUrl: undefined } : undefined,
        framing, captions, grading, branding,
        hardware: getHardware(),
        gemini: AiService.forJob()
      });

      const toUrl = (p: string) => fileUrl(p);
      const clips: GeneratedClip[] = result.clips.map((c: any, i: number) => ({
        id: `${project.id}-clip-${i + 1}`,
        sourceId: project.id,
        title: c.title,
        hookText: c.hookText || c.title,
        startTime: c.start,
        endTime: c.end,
        duration: +(c.end - c.start).toFixed(1),
        viralityScore: c.viralityScore,
        reason: c.reason,
        description: c.description,
        hashtags: c.hashtags,
        category: c.category,
        sourceName: c.sourceName,
        thumbnailTime: 0,
        thumbnailUrl: c.thumbnailUrl,
        videoUrl: toUrl(c.outputPath),
        outputPath: c.outputPath,
        words: (c.words || []).map((w: any) => ({ ...w, start: +(w.start - c.start).toFixed(2), end: +(w.end - c.start).toFixed(2) }))
      }));

      const updatedProject: ProjectItem = {
        ...project,
        status: 'Finished',
        currentStep: 9,
        progressPercent: 100,
        steps,
        clipCount: clips.length,
        clips,
        outputDir: result.outDir,
        lastEdited: 'Just now'
      };
      each(c => c.onProgressChange?.(100));
      each(c => c.onComplete?.(updatedProject, clips));
      return { project: updatedProject, clips };
    } catch (e: any) {
      const msg = String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      if (!/CANCELLED/.test(msg)) each(c => c.onError?.(msg));
      throw e;
    } finally {
      if (typeof off === 'function') off();
      if (this.runs.get(project.id) === run) this.runs.delete(project.id);
    }
    })();
    run.promise.catch(() => { /* reported through the callbacks */ });
    return run.promise;
  }

  public static async execute(
    config: PipelineExecutionConfig,
    callbacks: PipelineCallbacks
  ): Promise<{ project: ProjectItem; clips: GeneratedClip[] }> {
    this.cancelRequested = false;

    if (typeof window !== 'undefined' && window.electronAPI?.startPipeline && config.project.sourceFilePath) {
      return this.executeReal(config, callbacks).catch((e) => {
        // error already reported through onError; keep UI alive
        return { project: config.project, clips: [] as GeneratedClip[] };
      });
    }

    // --- Browser preview / no real file path: simulated pipeline (demo only) ---
    const { project, framing, captions, branding, targetClipsCount = 4 } = config;
    const emitLog = (source: SoftwareLogEvent['source'], message: string, type: SoftwareLogEvent['type'] = 'info') => {
      callbacks.onLog?.({
        timestamp: new Date().toLocaleTimeString(),
        type,
        source,
        message
      });
    };

    const steps: PipelineStep[] = [
      { id: 1, name: 'Reading video metadata', duration: '', status: 'pending', detail: 'ffprobe format analyzer' },
      { id: 2, name: 'Extracting audio', duration: '', status: 'pending', detail: 'ffmpeg audio demuxer' },
      { id: 3, name: 'Transcribing speech', duration: '', status: 'pending', detail: 'whisper.cpp word-by-word' },
      { id: 4, name: 'Translating captions', duration: '', status: 'pending', detail: 'multilingual transformer' },
      { id: 5, name: 'Converting to Roman script', duration: '', status: 'pending', detail: 'phonetic transliteration' },
      { id: 6, name: 'Finding moments & titles', duration: '', status: 'pending', detail: 'ai hook & retention detector' },
      { id: 7, name: 'Cutting clips', duration: '', status: 'pending', detail: 'lossless stream segmenter' },
      { id: 8, name: 'Reframing to vertical', duration: '', status: 'pending', detail: 'facemesh 9:16 auto-tracking' },
      { id: 9, name: 'Rendering clips', duration: '', status: 'pending', detail: 'capcut word sync & export' }
    ];

    const updateStep = (index: number, status: PipelineStep['status'], duration?: string, detail?: string) => {
      steps[index].status = status;
      if (duration) steps[index].duration = duration;
      if (detail) steps[index].detail = detail;
      callbacks.onStepChange?.(index, [...steps]);
    };

    emitLog('System', `Starting generation pipeline for "${project.name}" (ID: ${project.id})`);
    callbacks.onProgressChange?.(5);

    // STEP 1: Video Metadata
    updateStep(0, 'running');
    emitLog('FFmpeg', `Probing input stream: ffprobe -v quiet -print_format json -show_format -show_streams "${project.name}"`);
    await new Promise(r => setTimeout(r, 450));
    updateStep(0, 'completed', '0.2s', '1920×1080 @ 25fps, 3430.1s, h264/aac');
    emitLog('FFmpeg', 'Detected 1080p stream at 25fps. Audio track AAC 48kHz stereo found.', 'success');
    callbacks.onProgressChange?.(12);

    // STEP 2: Audio Extraction
    updateStep(1, 'running');
    emitLog('FFmpeg', `Demuxing PCM audio: ffmpeg -i "${project.name}" -vn -acodec pcm_s16le -ar 16000 -ac 1 audio.wav`);
    await new Promise(r => setTimeout(r, 600));
    updateStep(1, 'completed', '3.8s', '16kHz mono 16-bit PCM extracted');
    emitLog('FFmpeg', 'Audio extraction complete (38.4 MB temporary PCM buffer ready).', 'success');
    callbacks.onProgressChange?.(24);

    // STEP 3: Transcribing Speech (Word-by-word sync with timestamps!)
    updateStep(2, 'running');
    emitLog('Whisper', `Running whisper-cli --model small.bin --output-txt --output-vtt --word-timestamps`);
    const words = await TranscriptionEngine.transcribe(
      project.sourceDuration || 120,
      project.name,
      { includeEmojis: captions.showEmoji },
      project.sourceVideoUrl
    );
    updateStep(2, 'completed', '12.4s', `${words.length} words transcribed with millisecond timestamps`);
    emitLog('Whisper', `Transcription finished: ${words.length} words aligned with millisecond precision & contextual emojis.`, 'success');
    callbacks.onProgressChange?.(42);

    // STEP 4: Translating Captions
    updateStep(3, 'running');
    emitLog('System', 'Checking caption translation model...');
    await new Promise(r => setTimeout(r, 400));
    updateStep(3, 'completed', '2.1s', 'English / Urdu bilingual sync enabled');
    callbacks.onProgressChange?.(52);

    // STEP 5: Converting to Roman Script
    updateStep(4, 'running');
    emitLog('System', 'Transliterating phonetic terms into clean Roman script...');
    await new Promise(r => setTimeout(r, 350));
    updateStep(4, 'completed', '1.6s', 'Roman script normalization passed');
    callbacks.onProgressChange?.(61);

    // STEP 6: Finding Viral Moments & Scoring
    updateStep(5, 'running');
    emitLog('System', `AI Hook Engine analyzing curiosity gaps and emotional peaks across ${words.length} words...`);
    const viralResult = await ViralDetectorEngine.detectViralMoments(
      words,
      project.id,
      targetClipsCount,
      30,
      (source, msg, type) => emitLog(source, msg, type)
    );
    const generatedClips = viralResult.clips;

    // Attach real video source & capture real frame thumbnails from the actual video file
    if (project.sourceVideoUrl) {
      try {
        const { captureMultipleFrames } = await import('../utils/videoFrameExtractor');
        const timestamps = generatedClips.map(c => +(c.startTime + 1.5).toFixed(1));
        const frames = await captureMultipleFrames(project.sourceVideoUrl, timestamps);
        generatedClips.forEach((c, idx) => {
          c.videoUrl = project.sourceVideoUrl;
          if (frames[idx]) {
            c.thumbnailUrl = frames[idx];
          }
        });
      } catch (fErr) {
        console.warn('Frame capture notice:', fErr);
      }
    }

    const stepDetail = viralResult.failoverOccurred
      ? `${generatedClips.length} clips (Local fallback: API quota reached)`
      : viralResult.engineUsed === 'gemini-cloud'
      ? `${generatedClips.length} clips (Gemini 3.8 Flash Cloud AI)`
      : `${generatedClips.length} clips (Offline Local Engine)`;

    updateStep(5, 'completed', '6.8s', stepDetail);
    emitLog('System', `Discovered ${generatedClips.length} viral clips (scores: ${generatedClips.map(c => c.viralityScore + '%').join(', ')})`, 'success');
    callbacks.onProgressChange?.(75);

    // STEP 7: Cutting Clips
    updateStep(6, 'running');
    emitLog('FFmpeg', `Cutting lossless segments: ffmpeg -ss [start] -to [end] -c copy clip_chunks...`);
    await new Promise(r => setTimeout(r, 500));
    updateStep(6, 'completed', '4.2s', `${generatedClips.length} video streams segmented`);
    callbacks.onProgressChange?.(84);

    // STEP 8: Auto-Reframing to Vertical
    updateStep(7, 'running');
    emitLog('AutoReframe', `Running FaceMesh active speaker detection & 9:16 vertical crop generator...`);
    const trackResult = await AutoReframeEngine.analyzeSpeakerTracking(30, framing.trackingStyle || 'smooth-pan');
    updateStep(7, 'completed', '8.9s', `${trackResult.keyframes.length} tracking keyframes generated (0 black bars)`);
    emitLog('AutoReframe', `Speaker centered with 96% confidence. Smooth bezier pan curves rendered.`, 'success');
    callbacks.onProgressChange?.(94);

    // STEP 9: Rendering Final Clips with CapCut Word-Sync Captions
    updateStep(8, 'running');
    emitLog('FFmpeg', `Compositing ${captions.style} subtitles, dynamic auto titles, and color grading filters...`);
    await new Promise(r => setTimeout(r, 700));
    updateStep(8, 'completed', '14.5s', `${generatedClips.length} 9:16 MP4 clips ready to export`);
    emitLog('FFmpeg', `All clips rendered successfully in 1080x1920 60fps.`, 'success');
    callbacks.onProgressChange?.(100);

    const updatedProject: ProjectItem = {
      ...project,
      status: 'Finished',
      currentStep: 9,
      progressPercent: 100,
      steps,
      clipCount: generatedClips.length,
      clips: generatedClips,
      lastEdited: 'Just now'
    };

    callbacks.onComplete?.(updatedProject, generatedClips);
    return { project: updatedProject, clips: generatedClips };
  }
}
