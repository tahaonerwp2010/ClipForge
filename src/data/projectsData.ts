import { ProjectItem, SpeechModelItem, BundledBinary, MachineSpecs } from '../types/clipper';

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-1',
    name: "Scaling AI Rocketships_ ElevenLabs' Mati Staniszewski _ Lovable's Anton Osika.mp4",
    sourceVideoName: "Scaling AI Rocketships_ ElevenLabs' Mati Staniszewski _ Lovable's Anton Osika.mp4",
    sourceVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80',
    diskSize: '35 MB',
    sourceDuration: 3430,
    clipCount: 4,
    status: 'Processing',
    currentStep: 1,
    progressPercent: 12,
    createdAt: 'today',
    lastEdited: 'Just now',
    framingMode: 'fill-crop',
    steps: [
      { id: 1, name: 'Reading video metadata', duration: '0.2s', detail: '1920×1080 @ 25fps, 3430.1s, h264/aac', status: 'completed' },
      { id: 2, name: 'Extracting audio', duration: '4.0s', status: 'completed' },
      { id: 3, name: 'Transcribing speech', status: 'running' },
      { id: 4, name: 'Translating captions', status: 'pending' },
      { id: 5, name: 'Converting to Roman script', status: 'pending' },
      { id: 6, name: 'Finding moments & titles', status: 'pending' },
      { id: 7, name: 'Cutting clips', status: 'pending' },
      { id: 8, name: 'Reframing to vertical', status: 'pending' },
      { id: 9, name: 'Rendering clips', status: 'pending' }
    ]
  },
  {
    id: 'proj-2',
    name: '-T53flsWrrs.mp4',
    sourceVideoName: '-T53flsWrrs.mp4',
    sourceVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=80',
    diskSize: '2.0 GB',
    sourceDuration: 1920,
    clipCount: 3,
    status: 'Finished',
    currentStep: 9,
    progressPercent: 100,
    createdAt: 'yesterday',
    lastEdited: 'yesterday',
    framingMode: 'fit-blur',
    steps: [
      { id: 1, name: 'Reading video metadata', duration: '0.2s', detail: '1920×1080 @ 25fps, 1920.0s, h264/aac', status: 'completed' },
      { id: 2, name: 'Extracting audio', duration: '3.8s', status: 'completed' },
      { id: 3, name: 'Transcribing speech', duration: '14.2s', status: 'completed' },
      { id: 4, name: 'Translating captions', duration: '4.1s', status: 'completed' },
      { id: 5, name: 'Converting to Roman script', duration: '1.9s', status: 'completed' },
      { id: 6, name: 'Finding moments & titles', duration: '8.4s', status: 'completed' },
      { id: 7, name: 'Cutting clips', duration: '5.1s', status: 'completed' },
      { id: 8, name: 'Reframing to vertical', duration: '12.0s', status: 'completed' },
      { id: 9, name: 'Rendering clips', duration: '18.5s', status: 'completed' }
    ]
  }
];

export const INITIAL_MODELS: SpeechModelItem[] = [
  { id: 'small', name: 'Small', diskSize: '488 MB', werScore: 'Good accuracy, fastest', ramRequirement: '~2 GB RAM', status: 'not_downloaded', recommended: true },
  { id: 'medium', name: 'Medium', diskSize: '1.5 GB', werScore: 'Better accuracy, slower', ramRequirement: '~4 GB RAM', status: 'not_downloaded' },
  { id: 'large-v3-turbo', name: 'Large', diskSize: '1.6 GB', werScore: 'Best accuracy, slowest', ramRequirement: '~5 GB RAM', status: 'not_downloaded' }
];

export const INITIAL_BUNDLED_BINARIES: BundledBinary[] = [
  {
    id: 'ffmpeg',
    name: 'FFmpeg',
    role: 'Video decoding, scaling & re-encoding pipeline',
    resolvedPath: 'C:\\Program Files\\ClipForge\\resources\\binaries\\win32\\ffmpeg.exe',
    version: 'ffmpeg version N-125858-g2ae2413488-20260730 Copyright (c) 2000-2026 the FFmpeg developers',
    size: '114.9 MB',
    status: 'ok'
  },
  {
    id: 'ffprobe',
    name: 'FFprobe',
    role: 'Audio stream metadata analyzer & format detection',
    resolvedPath: 'C:\\Program Files\\ClipForge\\resources\\binaries\\win32\\ffprobe.exe',
    version: 'ffprobe version N-125858-g2ae2413488-20260730 Copyright (c) 2000-2026 the FFmpeg developers',
    size: '114.8 MB',
    status: 'ok'
  },
  {
    id: 'whisper',
    name: 'Whisper.cpp (CLI)',
    role: 'Fast on-device speech-to-text transcription engine',
    resolvedPath: 'C:\\Program Files\\ClipForge\\resources\\binaries\\win32\\whisper-cli.exe',
    version: 'build: cpu-only · optimized with AVX2 instruction sets',
    size: '18.4 MB',
    status: 'ok'
  },
  {
    id: 'ytdlp',
    name: 'yt-dlp',
    role: 'YouTube stream importer & metadata extractor',
    resolvedPath: 'C:\\Program Files\\ClipForge\\resources\\binaries\\win32\\yt-dlp.exe',
    version: 'version stable@2026.08.30',
    size: '38.2 MB',
    status: 'ok'
  },
  {
    id: 'openh264',
    name: 'OpenH264 / libopenh264',
    role: 'Hardware/Software H.264 video encoder',
    resolvedPath: 'C:\\Program Files\\ClipForge\\resources\\binaries\\win32\\openh264-2.4.0-win64.dll',
    version: 'libopenh264 version 2.4.0 (Cisco BSD Licensed)',
    size: '2.8 MB',
    status: 'ok'
  }
];

export const INITIAL_MACHINE_SPECS: MachineSpecs = {
  machine: 'Core i7-8800U · 16GB',
  cpu: 'Intel(R) Core(TM) i7-8800U CPU @ 2.60GHz',
  cores: '4 physical / 8 logical',
  architecture: 'x64',
  ram: '16 GB total · 9.4 GB available',
  ramAvailable: '9.4 GB',
  gpu: 'Intel(R) Iris(R) Xe Graphics (DirectML + WebGL ready)',
  acceleration: 'None - CPU / DirectML only',
  freeDisk: '142.0 GB of 512 GB SSD',
  totalDisk: '512 GB',
  avx2: true
};
