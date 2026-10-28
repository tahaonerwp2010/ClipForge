/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AiService } from './services/aiService';
import { 
  OuterCanvasRatio, 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig, 
  VideoSource, 
  GeneratedClip, 
  SafeZoneGuide, 
  ProjectItem,
  SplitConfig
} from './types/clipper';
import { SAMPLE_VIDEOS, DEFAULT_TRANSCRIPT_SEGMENTS, INITIAL_PRESET_CLIPS } from './data/sampleVideos';
import { INITIAL_PROJECTS } from './data/projectsData';
import { Sidebar, ActiveNavView } from './components/SidebarRail';
import { RecentProjects, TipCard, HomeAside } from './components/HomeExtras';
import { StatusBar } from './components/StatusBar';
import { LandingStartPage } from './components/LandingStartPage';
import { StudioHeader } from './components/StudioHeader';
import { PhonePreview } from './components/PhonePreview';
import { FormatTab } from './components/tabs/FormatTab';
import { CaptionsTab } from './components/tabs/CaptionsTab';
import { VideoGradeTab } from './components/tabs/VideoGradeTab';
import { BrandingTab } from './components/tabs/BrandingTab';
import { GenerateModal } from './components/GenerateModal';
import { MyProjectsView } from './components/MyProjectsView';
import { GenerationProgressView } from './components/GenerationProgressView';
import { ClipsLibrary } from './components/ClipsLibrary';
import { ClipEditor } from './components/ClipEditor';
import { SettingsView } from './components/SettingsModal';
import { Check } from 'lucide-react';
import { ConfirmDialog, ModelRequiredDialog } from './components/Dialogs';
import { BuyProModal, OwnerLogin, OwnerPanel, ProBlockedModal } from './components/ProOwner';
import { LicenseService, useLicense } from './services/licenseService';
import { X, Crown } from 'lucide-react';
import { PRO_ENFORCED, TRIAL_ENABLED } from './config/proConfig';
import { isDynStyle } from './utils/dynCaptions';
import { SoftwareManager } from './services/softwareManager';
import { PipelineRunner } from './services/pipelineRunner';

export default function App() {
  // Navigation & View: 'home' | 'my_projects' | 'settings' | 'studio'
  const [activeView, setActiveView] = useState<ActiveNavView>('home');
  const [activeStudioTab, setActiveStudioTab] = useState<'format' | 'captions' | 'grade' | 'branding'>('format');

  // Video Selection
  const [selectedVideo, setSelectedVideo] = useState<VideoSource | null>(null);

  // Projects State
  const [projects, setProjects] = useState<ProjectItem[]>(INITIAL_PROJECTS);
  const projectsLoaded = useRef(false);
  // Pro licence + owner access
  const lic = useLicense();
  const [ownerLoginOpen, setOwnerLoginOpen] = useState(false);
  const [cmsOpen, setCmsOpen] = useState(false);
  const versionTaps = useRef<number[]>([]);
  const onVersionTap = () => {
    if (lic.ownerPw) return;
    const now = Date.now();
    versionTaps.current = [...versionTaps.current.filter(t => now - t < 2500), now];
    if (versionTaps.current.length >= 5) { versionTaps.current = []; setOwnerLoginOpen(true); }
  };
  useEffect(() => { LicenseService.refresh(); const t = setInterval(() => LicenseService.refresh(), 600000); return () => clearInterval(t); }, []);
  // Projects are saved to disk and restored on the next start
  useEffect(() => {
    (async () => {
      try {
        const list = window.electronAPI?.projectsLoad ? await window.electronAPI.projectsLoad() : JSON.parse(localStorage.getItem('clipforge_projects') || '[]');
        if (Array.isArray(list) && list.length) setProjects(prev => {
          const ids = new Set(prev.map(p => p.id));
          const old = list.filter((p: ProjectItem) => !ids.has(p.id)).map((p: ProjectItem) => (p.status === 'Processing' || p.status === 'Queued') ? { ...p, status: 'Paused' as const } : p);
          return [...prev, ...old];
        });
      } catch { /* ignore */ }
      projectsLoaded.current = true;
    })();
  }, []);
  useEffect(() => {
    if (!projectsLoaded.current) return;
    const t = setTimeout(() => {
      try { if (window.electronAPI?.projectsSave) window.electronAPI.projectsSave(projects); else localStorage.setItem('clipforge_projects', JSON.stringify(projects)); } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [projects]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // Theme

  // Modals & Generation
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectItem | null>(null);
  // Job queue: only ONE project processes at a time; the rest wait as 'Queued'.
  const [queue, setQueue] = useState<string[]>([]);
  const [runKeys, setRunKeys] = useState<Record<string, number>>({});   // projectId -> run counter (mounted runners)
  const settingsRef = useRef<Record<string, any>>({});                  // settings snapshot taken when Generate was pressed
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Playback State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(184);
  const [isPlaying, setIsPlaying] = useState(false);

  // Canvas & Framing Configurations (9:16 default for Reels/Shorts)
  const [canvasRatio, setCanvasRatio] = useState<OuterCanvasRatio>('9:16');
  const [framing, setFraming] = useState<InnerFramingConfig>({
    mode: 'fit-blur',
    panX: 0,
    customScale: 100,
    offsetY: 0,
    blurIntensity: 18,
    backdropDarken: 0.35,
    splitRatio: 50,
    secondaryVideoType: 'gameplay',
    innerBorderRadius: 12,
    innerShadow: true,
    autoReframing: false,
    trackingStyle: 'smart-cut'
  });

  const [captions, setCaptions] = useState<CaptionConfig>({
    enabled: true,
    style: 'capcut-emoji',
    fontSize: 22,
    positionX: 50,
    positionY: 72,
    uppercase: true,
    maxWordsPerBeat: 3,
    highlightColor: '#bef264',
    showEmoji: true,
    outlineWidth: 3
  });

  const [grading, setGrading] = useState<VideoGradingConfig>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    warmth: 100,
    grain: false,
    vignette: false,
    speedBoost: 1.0
  });

  const [branding, setBranding] = useState<BrandingConfig>({
    autoTitle: {
      enabled: false,
      title: 'THE VIRAL TRUTH ABOUT CODING IN 2026',
      fontFamily: 'Montserrat',
      color: '#ffffff',
      fontSize: 16,
      positionX: 50,
      positionY: 10
    },
    showHookTitle: true,
    hookTitle: 'WAIT TILL THE END 😱',
    bannerShowBackground: true,
    hookBgColor: '#bef264',
    bannerPositionX: 50,
    bannerPositionY: 6,
    showWatermark: true,
    creatorHandle: '@viralclips',
    watermarkPositionX: 22,
    watermarkPositionY: 92
  });

  const [clipLength, setClipLength] = useState<'auto' | '15s' | '30s' | '45s' | '60s' | '90s'>('auto');
  const [targetClipsCount, setTargetClipsCount] = useState(3);
  const [language, setLanguage] = useState('auto');
  const [aiPrompt, setAiPrompt] = useState('');
  const [split, setSplit] = useState<SplitConfig | null>(null);
  const [safeZone, setSafeZone] = useState<SafeZoneGuide>('none');

  const [editClipId, setEditClipId] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Window drag and drop
  useEffect(() => {
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
          const newSource: VideoSource = {
            id: `drop-${Date.now()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            url: URL.createObjectURL(file),
            duration: 120,
            thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80',
            type: 'upload',
            author: 'Local File',
            originalAspect: '16:9',
            filePath: window.electronAPI?.getPathForFile?.(file) || undefined
          };
          setSelectedVideo(newSource);
          showToast(`File loaded: ${file.name}`);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  const handleProceedToStudio = async (video: VideoSource) => {
    if (!(await hasModel())) { setModelDialogOpen(true); return; }   // no speech model yet: stay here until it is downloaded
    setSelectedVideo(video);
    if (video.shorts || video.split) setCanvasRatio('9:16');
    setSplit(video.split || null);
    if (video.split) setCaptions(c => ({ ...c, positionY: video.split!.splitPct }));   // captions sit on the divider by default
    setFraming(prev => video.split ? { ...prev, mode: 'split-screen' } : (prev.mode === 'split-screen' ? { ...prev, mode: 'fit-blur' } : prev));
    setCurrentTime(0);
    setIsPlaying(false);

    // The project is only created when "Generate clips" is pressed (handleStartGeneration).
    setActiveProjectId(`draft-${Date.now()}`);

    setActiveView('studio');
    showToast(`Entering Clip settings: ${video.title}`);
  };

  const getProjectClips = (proj: ProjectItem): GeneratedClip[] => {
    if (proj.clips && proj.clips.length > 0) {
      return proj.clips.map(c => ({
        ...c,
        videoUrl: c.videoUrl || proj.sourceVideoUrl
      }));
    }
    const cleanName = proj.name || 'Video Highlights';
    const totalDur = proj.sourceDuration || 120;
    const seg1End = Math.min(25, totalDur * 0.35);
    const seg2Start = +(totalDur * 0.4).toFixed(1);
    const seg2End = Math.min(totalDur - 5, +(seg2Start + 22).toFixed(1));

    return [
      {
        id: `${proj.id}-clip-1`,
        sourceId: proj.id,
        title: `${cleanName.slice(0, 24).toUpperCase()} HIGHLIGHT 🔥`,
        hookText: `Watch what happened during ${cleanName}...`,
        startTime: 0,
        endTime: seg1End,
        duration: +(seg1End).toFixed(1),
        viralityScore: 97,
        reason: 'Instant opening hook captures immediate viewer attention within the first 3 seconds.',
        category: 'High Energy',
        thumbnailTime: 3,
        words: [
          { word: 'Watch', start: 0.2, end: 0.6, emoji: '👀' },
          { word: 'closely', start: 0.65, end: 1.1, emoji: '⚡' },
          { word: 'what', start: 1.15, end: 1.4 },
          { word: 'happened', start: 1.45, end: 1.9, emoji: '🤯' },
          { word: 'right', start: 2.0, end: 2.3 },
          { word: 'here', start: 2.35, end: 2.7, emoji: '🎯' }
        ]
      },
      {
        id: `${proj.id}-clip-2`,
        sourceId: proj.id,
        title: `KEY MOMENT IN ${cleanName.slice(0, 20).toUpperCase()} 💡`,
        hookText: `The turning point of ${cleanName}!`,
        startTime: seg2Start,
        endTime: seg2End,
        duration: +(seg2End - seg2Start).toFixed(1),
        viralityScore: 94,
        reason: 'Strong narrative contrast that creates anticipation and high watch-time completion.',
        category: 'Deep Insight',
        thumbnailTime: +(seg2Start + 2).toFixed(1),
        words: [
          { word: 'This', start: 0.2, end: 0.5 },
          { word: 'was', start: 0.55, end: 0.8 },
          { word: 'the', start: 0.85, end: 1.0 },
          { word: 'biggest', start: 1.05, end: 1.5, emoji: '🚀' },
          { word: 'breakthrough', start: 1.55, end: 2.2, emoji: '🔥' },
          { word: 'yet', start: 2.25, end: 2.7 }
        ]
      }
    ];
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const handleOpenProject = (project: ProjectItem) => {
    const matched = SAMPLE_VIDEOS.find(s => s.url === project.sourceVideoUrl) || {
      id: project.id,
      title: project.name,
      url: project.sourceVideoUrl,
      duration: project.sourceDuration,
      thumbnail: project.thumbnail,
      type: 'preset' as const
    };
    setSelectedVideo(matched);
    setActiveProjectId(project.id);
    setActiveView('studio');
    showToast(`Opened project: ${project.name}`);
  };

  const requestDelete = (projectId: string) => {
    const p = projects.find(x => x.id === projectId);
    if (p) setPendingDelete(p);
  };

  const confirmDelete = async () => {
    const p = pendingDelete;
    setPendingDelete(null);
    if (!p) return;
    const wasRunning = p.status === 'Processing' && runKeys[p.id] !== undefined;
    if (wasRunning) {
      PipelineRunner.cancel();
      await new Promise(r => setTimeout(r, 800));   // let ffmpeg release its files
    }
    try { await window.electronAPI?.discardCheckpoint?.({ id: p.id, name: p.name }); } catch { /* ignore */ }
    try {
      await window.electronAPI?.deleteProjectFiles?.({
        id: p.id,
        name: p.name,
        outputDir: p.outputDir,
        files: (p.clips || []).map(c => c.outputPath).filter(Boolean) as string[]
      });
    } catch { /* files may already be gone */ }
    setProjects(prev => prev.filter(x => x.id !== p.id));
    setQueue(q => q.filter(id => id !== p.id));
    setRunKeys(prev => { const n = { ...prev }; delete n[p.id]; return n; });
    delete settingsRef.current[p.id];
    showToast('Project deleted');
  };

  // Check that a speech model is installed before allowing generation
  const hasModel = async (): Promise<boolean> => {
    if (!window.electronAPI?.modelStatus) return true;   // browser preview: nothing to check
    const models = await SoftwareManager.syncModelStatus();
    return models.some(m => (m as any).kind !== 'aligner' && (m.status === 'downloaded' || m.status === 'active'));
  };
  // Pro features this project uses right now (used to stop a render when the trial is over and there is no Pro)
  const proUsage = (q: number = 0) => ({ autoReframe: !!framing.autoReframing, ai: (() => { try { const c = AiService.getConfig(); return !!c.enabled && Object.values(c.providers).some((p: any) => (p.keys || []).some((k: any) => k.status !== 'invalid')); } catch { return false; } })(), highRes: q > 1080, dynamicCaptions: isDynStyle(captions.style), split: !!selectedVideo?.split, customFormat: framing.mode === 'custom-scale', autoHook: !!branding.autoTitle?.enabled, fx: !!(grading as any).fx?.enabled });
  const requestGenerate = async () => {
    if (!(await hasModel())) { setModelDialogOpen(true); return; }
    if (LicenseService.blockIfLocked(proUsage())) return;
    setIsGenerateModalOpen(true);
  };
  useEffect(() => { AiService.refreshAll().catch(() => {}); const t = setInterval(() => AiService.refreshAll().catch(() => {}), 180000); return () => clearInterval(t); }, []);
  useEffect(() => { hasModel().then(ok => { if (!ok) setModelDialogOpen(true); }); }, []);

  const startRun = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'Processing', currentStep: 1, progressPercent: 0 } : p));
    setRunKeys(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };
  const isBusy = (exceptId?: string) => projects.some(p => p.id !== exceptId && p.status === 'Processing' && runKeys[p.id] !== undefined);

  // When the running project ends (finished / failed / paused), start the next queued one automatically
  useEffect(() => {
    if (isBusy()) return;
    const nextId = queue.find(id => projects.some(p => p.id === id && p.status === 'Queued'));
    if (!nextId) return;
    setQueue(q => q.filter(id => id !== nextId));
    startRun(nextId);
    showToast('Next queued project started');
  }, [projects, queue, runKeys]);

  const handleStartGeneration = (quality: number = 1080) => {
    setIsGenerateModalOpen(false);
    if (LicenseService.blockIfLocked(proUsage(quality))) return;

    const projTitle = selectedVideo ? selectedVideo.title : 'Untitled project';
    const existing = projects.find(p => p.id === activeProjectId);
    const id = existing ? existing.id : `proj-${Date.now()}`;

    settingsRef.current[id] = { framing, captions, grading, branding, canvasRatio: (selectedVideo?.shorts || selectedVideo?.split) ? '9:16' : canvasRatio, quality, clipLength, targetClipsCount, language, aiPrompt, split: selectedVideo?.split ? split : undefined };
    const busy = isBusy(id);

    if (!existing) {
      const newProj: ProjectItem = {
        id,
        name: projTitle,
        sourceVideoName: projTitle,
        sourceVideoUrl: selectedVideo?.url || '',
        sourceFilePath: selectedVideo?.filePath,
        shortsFiles: selectedVideo?.shorts,
        thumbnail: selectedVideo?.thumbnail || '',
        diskSize: '',
        sourceDuration: selectedVideo?.duration || 0,
        clipCount: 0,
        status: busy ? 'Queued' : 'Processing',
        currentStep: 1,
        progressPercent: 0,
        createdAt: 'today',
        lastEdited: 'Just now',
        framingMode: framing.mode
      };
      setProjects(prev => [newProj, ...prev]);
      setActiveProjectId(id);
    } else {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status: busy ? 'Queued' : 'Processing', currentStep: 1, progressPercent: 0 } : p));
    }

    if (busy) {
      setQueue(q => [...q.filter(x => x !== id), id]);
      showToast('Another project is processing. This one was added to the queue and will start automatically.');
      setActiveView('my_projects');
    } else {
      setRunKeys(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      setActiveView('progress');
      showToast('Processing started...');
    }
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(52px+env(safe-area-inset-bottom))] md:pb-0 md:pt-0 bg-[#07100c] text-neutral-100 font-sans overflow-hidden select-none">
      {/* Main body: sidebar + content */}
      <div className="flex-1 relative flex overflow-hidden">
        <Sidebar
          activeView={activeView}
          onSelectView={(view) => setActiveView(view)}
          projectsCount={projects.length}
          busy={queue.length > 0 || projects.some(p => p.status === 'Processing')}
          pro={lic.pro}
          proLabel={lic.forever ? 'Pro · forever' : lic.proDaysLeft != null ? `Pro · ${lic.proDaysLeft} day${lic.proDaysLeft === 1 ? '' : 's'} left` : 'Pro unlocked'}
          showBuy={PRO_ENFORCED}
          owner={!!lic.ownerPw}
          onBuyPro={() => LicenseService.openBuy()}
          onVersionTap={onVersionTap}
          onOpenCms={() => setCmsOpen(true)}
        />
        {PRO_ENFORCED && TRIAL_ENABLED && lic.loaded && !lic.pro && !lic.ownerPw && (
          <button type="button" onClick={() => LicenseService.openBuy()} title="Get Pro"
            className={`fixed top-1.5 right-5 z-[70] flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[10px] font-bold cursor-pointer ${lic.trial ? 'bg-[#bef264]/15 hover:bg-[#bef264]/25 border-[#bef264]/50 text-[#bef264]' : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200'}`}>
            <Crown className="w-3 h-3" />{lic.trial ? `${lic.trialDaysLeft} day${lic.trialDaysLeft === 1 ? '' : 's'} left` : 'Trial ended · Get Pro'}
          </button>
        )}
        {lic.ownerPw && (
          <button type="button" onClick={() => { LicenseService.setOwner(null); setCmsOpen(false); }} title="Leave owner access"
            className="fixed top-1.5 right-5 z-[70] flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-[10px] font-bold text-red-300 cursor-pointer">
            <X className="w-3 h-3" />Exit owner
          </button>
        )}

        {/* VIEW 1: HOME LANDING PAGE */}
        {activeView === 'home' && (
          <main className="flex-1 overflow-y-auto">
            <div className="flex flex-col xl:flex-row gap-5 px-3 md:px-6 py-4 md:py-6 max-w-[1280px] mx-auto">
              <div className="flex-1 min-w-0">
                <LandingStartPage
                  selectedVideo={selectedVideo}
                  onSelectVideo={(video) => setSelectedVideo(video)}
                  onVideoSelectedAndContinue={handleProceedToStudio}
                />
                <RecentProjects
                  projects={projects}
                  onOpen={(p) => { setActiveProjectId(p.id); setActiveView(p.status === 'Finished' ? 'clips' : 'progress'); }}
                  onViewAll={() => setActiveView('my_projects')}
                />
                <TipCard />
              </div>
              <HomeAside projects={projects} onNew={() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })} onSettings={() => setActiveView('settings')} />
            </div>
          </main>
        )}

        {/* VIEW 2: MY PROJECTS */}
        {activeView === 'my_projects' && (
          <main className="flex-1 flex flex-col overflow-y-auto">
            <MyProjectsView
              projects={projects}
              onOpenClips={(proj) => {
                setActiveProjectId(proj.id);
                setActiveView('clips');
              }}
              onOpenProgress={(proj) => {
                setActiveProjectId(proj.id);
                setActiveView('progress');
              }}
              onDeleteProject={requestDelete}
              onNewProject={() => setActiveView('home')}
            />
          </main>
        )}

        {/* VIEW 5: GENERATION PROGRESS (Matching screenshots 1 & 2) */}
        {/* Background runners: stay mounted (hidden) so processing continues while you browse other screens */}
        {Object.keys(runKeys).map(id => {
          const p = projects.find(x => x.id === id);
          if (!p) return null;
          const visible = activeView === 'progress' && activeProjectId === id;
          return (
            <main key={`${id}:${runKeys[id]}`} className={`${visible ? 'flex' : 'hidden'} flex-1 flex-col overflow-hidden`}>
              <GenerationProgressView
                project={p}
                onBack={() => setActiveView('my_projects')}
                onViewClips={() => { setActiveProjectId(id); setActiveView('clips'); }}
                onNewProject={() => setActiveView('home')}
                onUpdateProject={(updated) => setProjects(prev => prev.map(x => x.id === updated.id ? updated : x))}
                {...(settingsRef.current[id] || {})}
              />
            </main>
          );
        })}

        {/* Queued project: waiting screen */}
        {activeView === 'progress' && activeProject && activeProject.status === 'Queued' && (
          <main className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <div className="text-lg font-bold text-white">Waiting in queue</div>
            <p className="text-xs text-neutral-400 max-w-sm">
              ClipForge processes one project at a time to keep your computer responsive. This project will start automatically when the current one finishes.
            </p>
            <button type="button" onClick={() => setActiveView('my_projects')} className="px-4 py-2 rounded-xl bg-[#111e18] hover:bg-[#192c23] text-neutral-200 font-bold text-xs border border-[#1d3228] cursor-pointer">
              Back to Projects
            </button>
          </main>
        )}

        {activeView === 'progress' && activeProject && runKeys[activeProject.id] === undefined && activeProject.status !== 'Queued' && (
          <main className="flex-1 flex flex-col overflow-hidden">
            <GenerationProgressView
              project={activeProject}
              onBack={() => setActiveView('my_projects')}
              onViewClips={() => setActiveView('clips')}
              onNewProject={() => setActiveView('home')}
              onUpdateProject={(updated) => {
                setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
              }}
              framing={framing}
              captions={captions}
              grading={grading}
              branding={branding}
              canvasRatio={canvasRatio}
              clipLength={clipLength}
              targetClipsCount={targetClipsCount}
              language={language}
              aiPrompt={aiPrompt}
            />
          </main>
        )}

        {/* VIEW 6: DEDICATED CLIPS LIBRARY */}
        {activeView === 'clips' && activeProject && (
          <main className="flex-1 flex flex-col overflow-hidden">
            <ClipsLibrary
              clips={getProjectClips(activeProject)}
              projectName={activeProject.name}
              projectId={activeProject.id}
              sourceVideoUrl={activeProject.sourceVideoUrl || selectedVideo?.url}
              onBack={() => setActiveView('my_projects')}
              onSelectClipToEdit={(clip) => {
                if (!activeProject.outputDir || !clip.outputPath) { showToast('This clip cannot be edited (no rendered file).'); return; }
                setEditClipId(clip.id);
              }}
              onDeleteClip={(clipId) => {
                const gone = getProjectClips(activeProject).find(c => c.id === clipId);
                if (gone?.outputPath) window.electronAPI?.deleteClipFile?.({ outputPath: gone.outputPath, outputDir: activeProject.outputDir });   // also remove the file from the clips folder
                setProjects(prev => prev.map(p => {
                  if (p.id === activeProject.id) {
                    const currentClips = getProjectClips(p);
                    const filtered = currentClips.filter(c => c.id !== clipId);
                    return { ...p, clips: filtered, clipCount: filtered.length };
                  }
                  return p;
                }));
                showToast('Clip deleted');
              }}
              canvasRatio={canvasRatio}
              framing={framing}
              captions={captions}
              grading={grading}
              branding={branding}
            />
          
            {editClipId && activeProject && (() => {
              // a clip keeps its engine number (clip_NN.mp4) even after other clips were deleted, so never use the position in the list
              const engIdx = (c: any) => { const m = /-clip-(\d+)$/.exec(String(c.id)); return m ? parseInt(m[1], 10) - 1 : -1; };
              const cl = getProjectClips(activeProject); const k = cl.findIndex(c => c.id === editClipId); if (k < 0) return null;
              return <ClipEditor key={editClipId} clip={cl[k]} index={engIdx(cl[k])} outDir={activeProject.outputDir || ''} total={cl.length} allIdx={cl.map(engIdx).filter(n => n >= 0)} fallback={{ captions, branding, grading, framing }}
                onClose={() => setEditClipId(null)}
                onSaved={(i, r) => { const v = '?v=' + Date.now(); setProjects(prev => prev.map(p => p.id !== activeProject.id ? p : { ...p, clips: getProjectClips(p).map(c => engIdx(c) !== i ? c : { ...c, outputPath: r.outputPath, thumbnailUrl: r.thumbnailUrl || c.thumbnailUrl, videoUrl: (c.videoUrl || '').split('?')[0] + v }) })); }} />;
            })()}
          </main>
        )}

        {/* VIEW 3: SETTINGS */}
        {activeView === 'settings' && (
          <main className="flex-1 flex flex-col overflow-y-auto">
            <SettingsView />
          </main>
        )}

        {/* VIEW 4: STUDIO WORKSTATION (SINGLE UNIFIED SCROLL CONTAINER AS REQUESTED!) */}
        {activeView === 'studio' && selectedVideo && (
          <main className="flex-1 flex flex-col overflow-hidden">
            
            {/* Studio Header (floating) */}
            <StudioHeader
              videoTitle={selectedVideo.title}
              onBack={() => setActiveView('home')}
              activeTab={activeStudioTab}
              onSelectTab={setActiveStudioTab}
            />

            {/* SINGLE UNIFIED SCROLL CONTAINER (Both settings & mobile preview scroll together!) */}
            <div className="flex-1 overflow-y-auto px-3 md:px-8 py-4">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-8 max-w-6xl mx-auto pb-16">
                
                {/* Left Column: Tab Settings */}
                <div className="flex-1 min-w-0 w-full">
                  {activeStudioTab === 'format' && (
                    <FormatTab
                      shortsMode={!!selectedVideo.shorts}
                      split={split}
                      onSplitChange={setSplit}
                      canvasRatio={canvasRatio}
                      onCanvasRatioChange={setCanvasRatio}
                      framing={framing}
                      onFramingChange={setFraming}
                      clipLength={clipLength}
                      onClipLengthChange={setClipLength}
                      clipsCount={targetClipsCount}
                      onClipsCountChange={setTargetClipsCount}
                      language={language}
                      onLanguageChange={setLanguage}
                      aiPrompt={aiPrompt}
                      onAiPromptChange={setAiPrompt}
                    />
                  )}

                  {activeStudioTab === 'captions' && (
                    <CaptionsTab
                      captions={captions}
                      onCaptionsChange={setCaptions}
                    />
                  )}

                  {activeStudioTab === 'grade' && (
                    <VideoGradeTab
                      grading={grading}
                      onGradingChange={setGrading}
                      framing={framing}
                      onFramingChange={setFraming}
                    />
                  )}

                  {activeStudioTab === 'branding' && (
                    <BrandingTab
                      branding={branding}
                      onBrandingChange={setBranding}
                      clipTitle={selectedVideo.title}
                    />
                  )}
                </div>

                {/* Right Column: Phone Mockup (Merged into the same scroll flow!) */}
                <div className="shrink-0 w-full lg:w-[300px] flex flex-col items-center sticky top-2">
                  <PhonePreview
                    videoUrl={selectedVideo.url}
                    canvasRatio={canvasRatio}
                    framing={framing}
                    captions={captions}
                    grading={grading}
                    branding={branding}
                    words={DEFAULT_TRANSCRIPT_SEGMENTS}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onTimeUpdate={setCurrentTime}
                    onDurationChange={setDuration}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    safeZone={safeZone}
                    onSafeZoneChange={setSafeZone}
                    onPanChange={(newPan) => setFraming(prev => ({ ...prev, panX: newPan }))}
                    onFramingChange={setFraming}
                    onCaptionsChange={setCaptions}
                    onBrandingChange={setBranding}
                    clipTitle={selectedVideo.title}
                    split={split}
                    onSplitChange={setSplit}
                  />
                </div>
              </div>
            </div>

            {/* Pinned Bottom Bar: Generate clips */}
            <div className="h-14 bg-[#09100d] border-t border-[#111e18] px-8 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => requestGenerate()}
                  className="px-6 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs shadow-md shadow-[#3f9a5a]/20 transition-all active:scale-95 cursor-pointer"
                >
                  Generate clips
                </button>

                <div className="text-xs text-neutral-400 font-mono">
                  <span>on this computer, about </span>
                  <span className="text-white font-bold">82–188 min </span>
                  <span>estimate</span>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar />

      {/* Generate Resolution Modal */}
      <GenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onStartGeneration={handleStartGeneration}
        canvasRatio={canvasRatio}
        filePath={selectedVideo?.filePath}
        shortsPath={selectedVideo?.shorts?.[0]?.path}
        shortsPaths={selectedVideo?.shorts?.map(x => x.path).filter(Boolean) as string[] | undefined}
        extraPaths={selectedVideo?.split?.secondPath ? [selectedVideo.split.secondPath] : undefined}
        mainDims={selectedVideo?.split?.mainDims}
      />

      {lic.buyOpen && !lic.pro && <BuyProModal onClose={() => LicenseService.closeBuy()} />}
      {lic.blocked && <ProBlockedModal features={lic.blocked} onClose={() => LicenseService.closeBlocked()} />}
      {ownerLoginOpen && <OwnerLogin onClose={() => setOwnerLoginOpen(false)} onOk={() => { setOwnerLoginOpen(false); showToast('Owner access on'); }} />}
      {cmsOpen && lic.ownerPw && <OwnerPanel onClose={() => setCmsOpen(false)} />}
      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title="Delete this project?"
        message={<>
          <p><span className="text-neutral-200 font-semibold break-all">{pendingDelete?.name}</span> will be permanently deleted, together with all of its generated clips and their files on disk.</p>
          <p className="mt-1.5">Your original video file will not be touched. This cannot be undone.</p>
        </>}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ModelRequiredDialog
        open={modelDialogOpen}
        onClose={() => setModelDialogOpen(false)}
        onOpenSettings={() => { setModelDialogOpen(false); setActiveView('settings'); }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-10 right-6 z-50 bg-[#111e18] border border-[#3f9a5a]/60 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#8fd0a4]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
