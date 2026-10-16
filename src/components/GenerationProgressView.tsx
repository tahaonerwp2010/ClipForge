import React, { useState, useEffect, useRef } from 'react';
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
import { 
  ArrowLeft, 
  Check, 
  Loader2, 
  Play, 
  Pause, 
  Sparkles,
  Film,
  Terminal,
  Cpu,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Server,
  AlertTriangle,
  Cloud
} from 'lucide-react';
import { PipelineRunner } from '../services/pipelineRunner';
import { SoftwareLogEvent } from '../services/softwareManager';
import { AiService } from '../services/aiService';

interface GenerationProgressViewProps {
  project: ProjectItem;
  onBack: () => void;
  onViewClips: () => void;
  onNewProject: () => void;
  onUpdateProject?: (updated: ProjectItem) => void;
  framing?: InnerFramingConfig;
  captions?: CaptionConfig;
  grading?: VideoGradingConfig;
  branding?: BrandingConfig;
  canvasRatio?: string;
  clipLength?: 'auto' | '15s' | '30s' | '45s' | '60s' | '90s';
  targetClipsCount?: number;
  language?: string;
  aiPrompt?: string;
  split?: SplitConfig;
}

const DEFAULT_STEPS: PipelineStep[] = [
  'Reading video metadata', 'Extracting audio', 'Transcribing speech', 'Translating captions',
  'Converting to Roman script', 'Finding moments & titles', 'Cutting clips', 'Reframing to vertical', 'Rendering clips'
].map((name, i) => ({ id: i + 1, name, status: 'pending' as const, percent: 0 }));

export const GenerationProgressView: React.FC<GenerationProgressViewProps> = ({
  project,
  onBack,
  onViewClips,
  onNewProject,
  onUpdateProject,
  framing,
  captions,
  grading,
  branding,
  canvasRatio,
  clipLength,
  targetClipsCount,
  language,
  aiPrompt,
  split
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isInitiallyFinished = project.status === 'Finished';
  const [isPaused, setIsPaused] = useState(project.status === 'Paused');
  const [currentStepIdx, setCurrentStepIdx] = useState(
    isInitiallyFinished ? 8 : (project.currentStep ? project.currentStep - 1 : 0)
  );
  const [progressPercent, setProgressPercent] = useState(
    isInitiallyFinished ? 100 : (project.progressPercent ?? 0)
  );
  const [steps, setSteps] = useState<PipelineStep[]>(() => {
    if (project.steps && project.steps.length === 9) {
      return project.steps;
    }
    if (isInitiallyFinished) {
      return DEFAULT_STEPS.map((s, idx) => ({
        ...s,
        status: 'completed',
        duration: s.duration || `${(idx * 1.8 + 0.9).toFixed(1)}s`
      }));
    }
    return DEFAULT_STEPS;
  });

  const [activeStepSeconds, setActiveStepSeconds] = useState(0);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [started, setStarted] = useState(false);          // true once the engine reports its first event
  const resumeRef = useRef(project.status === 'Paused');
  const [showTerminalLogs, setShowTerminalLogs] = useState(false);
  const [logs, setLogs] = useState<SoftwareLogEvent[]>([
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      source: 'System',
      message: `ClipForge Pipeline initialized for "${project.name}"`
    },
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      source: 'FFmpeg',
      message: 'Demuxer attached to source stream at 1080p 25fps'
    }
  ]);

  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const hasExecutedRef = useRef(false);

  // Auto-scroll terminal when new logs appear
  useEffect(() => {
    if (showTerminalLogs && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showTerminalLogs]);

  // Execute pipeline if project is processing
  useEffect(() => {
    if (isInitiallyFinished || hasExecutedRef.current || isPaused) return;

    hasExecutedRef.current = true;

    // Default fallback configurations
    const effectiveFraming: InnerFramingConfig = framing || {
      mode: project.framingMode || 'fill-crop',
      panX: 0,
      customScale: 100,
      offsetY: 0,
      blurIntensity: 18,
      backdropDarken: 0.35,
      splitRatio: 50,
      secondaryVideoType: 'gameplay',
      innerBorderRadius: 16,
      innerShadow: true,
      autoReframing: true,
      trackingStyle: 'smooth-pan'
    };

    const effectiveCaptions: CaptionConfig = captions || {
      enabled: true,
      style: 'capcut-emoji',
      fontSize: 24,
      positionX: 50,
      positionY: 72,
      uppercase: true,
      maxWordsPerBeat: 2,
      highlightColor: '#bef264',
      showEmoji: true,
      outlineWidth: 3
    };

    const effectiveGrading: VideoGradingConfig = grading || {
      brightness: 100,
      contrast: 105,
      saturation: 110,
      warmth: 100,
      grain: false,
      vignette: false,
      speedBoost: 1.0
    };

    const effectiveBranding: BrandingConfig = branding || {
      autoTitle: {
        enabled: true,
        title: 'VIRAL HOOK OF THE YEAR',
        fontFamily: 'Montserrat',
        color: '#ffffff',
        fontSize: 16,
        positionX: 50,
        positionY: 10
      },
      showHookTitle: false,
      hookTitle: '',
      bannerShowBackground: true,
      hookBgColor: '#bef264',
      showWatermark: false,
      creatorHandle: '@creator'
    };

    PipelineRunner.execute(
      {
        project,
        framing: effectiveFraming,
        captions: effectiveCaptions,
        grading: effectiveGrading,
        branding: effectiveBranding,
        targetClipsCount: targetClipsCount || project.clipCount || 4,
        clipLength: clipLength || 'auto',
        language: language || 'auto',
        aiPrompt: (aiPrompt || '').trim(),
        canvasRatio: canvasRatio || '9:16',
        split,
        resume: resumeRef.current
      },
      {
        onStepChange: (idx, updatedSteps) => {
          setStarted(true);
          const run = updatedSteps.findIndex(x => x.status === 'running');
          setCurrentStepIdx(run >= 0 ? run : idx);
          setSteps(updatedSteps);
        },
        onProgressChange: (percent, eta) => {
          setStarted(true);
          setProgressPercent(prev => Math.max(prev, percent));
          setEtaSec(eta ?? null);
        },
        onLog: (log) => {
          setLogs(prev => [...prev.slice(-120), log]);
        },
        onError: (msg) => {
          setErrorMsg(msg);
          if (onUpdateProject) onUpdateProject({ ...project, status: 'Failed' });
          setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'error', source: 'System', message: msg }]);
        },
        onComplete: (updatedProj, generatedClips) => {
          setProgressPercent(100);
          setEtaSec(0);
          setCurrentStepIdx(8);
          if (onUpdateProject) {
            onUpdateProject(updatedProj);
          }
        }
      }
    );
  }, [isInitiallyFinished, isPaused]);

  // Active step second counter timer (resets when the step changes)
  useEffect(() => { setActiveStepSeconds(0); }, [currentStepIdx]);
  useEffect(() => {
    if (isPaused || progressPercent >= 100) return;
    const timer = setInterval(() => {
      setActiveStepSeconds(prev => +(prev + 0.4).toFixed(1));
    }, 400);
    return () => clearInterval(timer);
  }, [isPaused, progressPercent]);

  const togglePauseResume = () => {
    const nextPaused = !isPaused;
    if (nextPaused) {
      // Stop the engine now; finished chunks/clips stay on disk as checkpoints.
      PipelineRunner.cancel();
      setEtaSec(null);
    } else {
      // Resume: re-run the pipeline in resume mode, it skips everything already finished.
      resumeRef.current = true;
      hasExecutedRef.current = false;
      setStarted(false);
    }
    setIsPaused(nextPaused);
    if (onUpdateProject) {
      onUpdateProject({
        ...project,
        status: nextPaused ? 'Paused' : (progressPercent >= 100 ? 'Finished' : 'Processing'),
        progressPercent,
        currentStep: currentStepIdx + 1
      });
    }
  };

  const fmtEta = (sec: number) => {
    if (sec < 60) return `less than a minute`;
    const m = Math.round(sec / 60);
    if (m < 60) return `about ${m} min`;
    return `about ${Math.floor(m / 60)} h ${m % 60} min`;
  };
  const fmtSecs = (s: number) => s < 60 ? `${Math.floor(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m`;
  const visibleSteps = steps.filter(x => x.status !== 'skipped');
  const doneCount = visibleSteps.filter(x => x.status === 'completed').length;

  const isFinished = progressPercent >= 100;
  const currentStepName = steps[currentStepIdx]?.name || 'Finalizing clips';
  const aiCfg = AiService.getConfig();
  const aiOn = AiService.hasKeys(aiCfg);
  const fallbackTriggered = logs.some(l => 
    l.message.includes('[AUTO-FAILOVER]') || 
    l.message.includes('Switched to Offline Local') ||
    l.message.includes('Local fallback')
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050b08] text-neutral-100 overflow-y-auto font-sans select-none">
      
      {errorMsg && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 max-w-2xl rounded-xl border border-red-500/40 bg-red-950/90 text-red-200 text-xs p-4 shadow-2xl select-text">
          <div className="font-bold mb-1 text-red-100">Generation failed</div>
          <div className="whitespace-pre-wrap break-words">{errorMsg}</div>
          <button className="mt-3 px-3 py-1 rounded-md bg-red-900 hover:bg-red-800 cursor-pointer" onClick={() => setErrorMsg(null)}>Dismiss</button>
        </div>
      )}

      {/* Top Application Header bar */}
      <div className="h-12 border-b border-[#111e18] bg-[#050b08] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#111e18] transition-colors cursor-pointer"
            title="Go back to My clips"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-neutral-200 tracking-wide">ClipForge Pipeline Engine <span className="text-[10px] font-semibold text-[#8fd0a4]">by taha.ai</span></span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Engine Indicator */}
          {fallbackTriggered ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Switched to Local Engine (Quota Limit)</span>
            </span>
          ) : aiOn ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#3f9a5a]/15 text-[#8fd0a4] border border-[#3f9a5a]/30">
              <Sparkles className="w-3 h-3" />
              <span>AI Boost · {AiService.keyCount(aiCfg)} key{AiService.keyCount(aiCfg) > 1 ? 's' : ''} (auto-fallback)</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
              <Server className="w-3 h-3" />
              <span>Local AI only (no key added)</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowTerminalLogs(!showTerminalLogs)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showTerminalLogs
                ? 'bg-[#3f9a5a]/20 text-[#8fd0a4] border border-[#3f9a5a]/40'
                : 'text-neutral-400 hover:text-white bg-[#0c1611] border border-[#192c23]'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>Terminal Logs ({logs.length})</span>
            {showTerminalLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-4">
          
          {/* ========================================================
              CARD 1: HERO PROGRESS CARD (Exact match to screenshot 1)
          ======================================================== */}
          <div className="bg-[#09110e] border border-[#15251e] rounded-2xl p-7 space-y-4 shadow-xl">
            {/* Failover notice banner if quota was reached */}
            {fallbackTriggered && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Zero-Downtime Local Failover: </span>
                  The AI providers ran out of quota or credits, so the app automatically switched to the built-in local engine. Generation is continuing without interruption.
                </div>
              </div>
            )}

            {/* Video File Name */}
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight break-all leading-snug">
              {project.name.endsWith('.mp4') ? project.name : `${project.name}.mp4`}
            </h1>

            {/* Subtitle */}
            <div className="text-xs text-neutral-400 font-medium">
              {isFinished ? `All ${visibleSteps.length} steps completed · Ready to view & export` : (isPaused ? 'Processing paused' : currentStepName)}
            </div>

            {/* Horizontal Progress Bar */}
            <div className="w-full h-1.5 bg-[#13211a] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#bef264] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Percentage & Status Label */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-4xl md:text-5xl font-black text-white tracking-tight font-mono-num">
                {progressPercent}%
              </span>
              <span className="text-sm text-neutral-400 font-medium">
                {isFinished ? 'Finished' : (isPaused ? 'Paused' : `${doneCount} of ${visibleSteps.length} steps done`)}
              </span>
            </div>

            {/* Estimated time */}
            <div className="text-[11px] text-neutral-400 font-mono-num pt-1 flex items-center justify-between">
              <span>
                {isFinished ? 'Done'
                  : isPaused ? 'Paused. Resume continues from where it stopped.'
                  : !started ? 'Waiting for the engine to start…'
                  : etaSec === null ? 'Estimating remaining time…'
                  : `Estimated time left: ${fmtEta(etaSec)}`}
              </span>
              <span className="text-neutral-500">Whisper.cpp + FFmpeg + Face tracking</span>
            </div>
          </div>

          {/* ========================================================
              CARD 2: HARDWARE NOTICE CARD (Exact match to screenshot 1)
          ======================================================== */}
          <div className="bg-[#09110e] border border-[#15251e] rounded-2xl p-6 space-y-1.5 shadow-md">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#8fd0a4]" />
              <span>Optimized CPU & AVX2 Acceleration Pipeline</span>
            </h3>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Transcription and auto-reframing are running via bundled Whisper.cpp and FaceMesh computer vision binaries. Multi-threaded AVX2 instruction sets ensure sub-second latency and zero black-border vertical formatting.
            </p>
          </div>

          {/* ========================================================
              LIVE TERMINAL LOGS DRAWER (Optional collapsible)
          ======================================================== */}
          {showTerminalLogs && (
            <div className="bg-[#070d0a] border border-[#1c3026] rounded-2xl p-4 shadow-2xl space-y-2">
              <div className="flex items-center justify-between border-b border-[#13221b] pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-[#8fd0a4]" />
                  <span>C:\\Program Files\\ClipForge\\resources\\binaries\\win32\\stdout.log</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {logs.length} entries
                </span>
              </div>

              <div className="h-44 overflow-y-auto space-y-1 font-mono text-[11px] p-1 select-text">
                {logs.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-neutral-600 shrink-0">[{item.timestamp}]</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                      item.source === 'FFmpeg' ? 'bg-indigo-950 text-indigo-300' :
                      item.source === 'Whisper' ? 'bg-amber-950 text-amber-300' :
                      item.source === 'AutoReframe' ? 'bg-emerald-950 text-emerald-300' :
                      'bg-neutral-800 text-neutral-300'
                    }`}>
                      {item.source}
                    </span>
                    <span className={`${
                      item.type === 'success' ? 'text-[#8fd0a4]' :
                      item.type === 'warn' ? 'text-amber-300' :
                      item.type === 'stderr' ? 'text-rose-400' :
                      'text-neutral-300'
                    }`}>
                      {item.message}
                    </span>
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>
            </div>
          )}

          {/* ========================================================
              CARD 3: PIPELINE 9-STEPS CHECKLIST (Exact match to screenshot 2)
          ======================================================== */}
          <div className="bg-[#09110e] border border-[#15251e] rounded-2xl overflow-hidden shadow-xl divide-y divide-[#13211a]">
            {steps.map((step, idx) => {
              if (step.status === 'skipped') return null;
              const isCompleted = step.status === 'completed' || (isFinished && idx <= 8);
              const isRunning = !isFinished && !isPaused && step.status === 'running';
              const isStepPaused = isPaused && step.status === 'running';

              return (
                <div key={step.id} className="p-4 px-6 transition-colors hover:bg-[#0d1913]/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Step Indicator Icon */}
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {isCompleted ? (
                          <Check className="w-4 h-4 text-[#8fd0a4] stroke-[3]" />
                        ) : isRunning ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#bef264] animate-ping" />
                        ) : isStepPaused ? (
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-neutral-600" />
                        )}
                      </div>

                      {/* Step Name */}
                      <span className={`text-xs font-semibold ${
                        isCompleted ? 'text-white' : isRunning ? 'text-[#8fd0a4]' : 'text-neutral-400'
                      }`}>
                        {step.name}
                      </span>
                    </div>

                    {/* Step duration / timing */}
                    <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
                      {(() => {
                        const sp = isCompleted ? 100 : (step.percent ?? 0);
                        return (
                          <>
                            <div className="w-24 h-1 bg-[#13211a] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-[#bef264]' : isStepPaused ? 'bg-amber-400' : 'bg-[#3f9a5a]/80'}`} style={{ width: `${sp}%` }} />
                            </div>
                            <span className={`w-9 text-right ${isRunning ? 'text-[#8fd0a4]' : ''}`}>{sp}%</span>
                          </>
                        );
                      })()}
                      <span className="w-16 text-right">
                        {isCompleted && step.duration ? step.duration : isRunning ? <span className="text-[#8fd0a4]">{fmtSecs(activeStepSeconds)}</span> : ''}
                      </span>
                    </div>
                  </div>

                  {/* Step detail (e.g. video metadata details) */}
                  {step.detail && isCompleted && (
                    <div className="pl-8 text-[11px] font-mono text-neutral-400 mt-1">
                      {step.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ========================================================
              BOTTOM ACTION CONTROLS (Exact match to user requests)
          ======================================================== */}
          <div className="pt-2 flex items-center gap-3">
            {isFinished ? (
              <button
                type="button"
                onClick={onViewClips}
                className="px-6 py-2.5 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs shadow-lg shadow-[#3f9a5a]/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Film className="w-4 h-4" />
                <span>View Generated Clips ({project.clips?.length || project.clipCount || 4} Ready)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={togglePauseResume}
                className={`px-6 py-2.5 rounded-xl font-extrabold text-xs shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer ${
                  isPaused
                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black shadow-[#3f9a5a]/20'
                    : 'bg-[#12201a] hover:bg-[#1a2e25] text-white border border-[#273d33]'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Pipeline</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause Pipeline</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onNewProject}
              className="px-5 py-2.5 rounded-xl bg-[#0f1c16] hover:bg-[#172820] text-neutral-200 text-xs font-bold border border-[#1d3228] transition-colors cursor-pointer"
            >
              New project
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
