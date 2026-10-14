import { ProjectItem, SpeechModelItem, BundledBinary, MachineSpecs } from '../types/clipper';

export const INITIAL_PROJECTS: ProjectItem[] = [];

export const INITIAL_MODELS: SpeechModelItem[] = [
  { id: 'small', name: 'Small', kind: 'speech', diskSize: '488 MB', werScore: 'Fastest. Good for English, weaker for Urdu and Hindi', ramRequirement: '~2 GB RAM', status: 'not_downloaded', recommended: true,
    langs: [{ lang: 'English', stars: 4, label: 'Very good' }, { lang: 'Hinglish', stars: 3, label: 'Good' }, { lang: 'Hindi', stars: 2, label: 'Fair' }, { lang: 'Urdu', stars: 2, label: 'Fair' }] },
  { id: 'medium', name: 'Medium', kind: 'speech', diskSize: '1.5 GB', werScore: 'Better accuracy, about 3x slower than Small', ramRequirement: '~4 GB RAM', status: 'not_downloaded',
    langs: [{ lang: 'English', stars: 4, label: 'Very good' }, { lang: 'Hinglish', stars: 4, label: 'Very good' }, { lang: 'Hindi', stars: 3, label: 'Good' }, { lang: 'Urdu', stars: 3, label: 'Good' }] },
  { id: 'large-v3-turbo', name: 'Large', kind: 'speech', diskSize: '1.6 GB', werScore: 'Best accuracy, slowest', ramRequirement: '~5 GB RAM', status: 'not_downloaded',
    langs: [{ lang: 'English', stars: 5, label: 'Excellent' }, { lang: 'Hinglish', stars: 4, label: 'Very good' }, { lang: 'Hindi', stars: 4, label: 'Very good' }, { lang: 'Urdu', stars: 3, label: 'Good' }] },
  { id: 'aligner', name: 'Caption sync', kind: 'aligner', diskSize: '95 MB', werScore: 'Places every caption word exactly when it is spoken (like CapCut). Works together with the speech model.', ramRequirement: '~0.5 GB RAM', status: 'not_downloaded', recommended: true,
    note: 'Download once. Used automatically for every video.',
    langs: [{ lang: 'English', stars: 5, label: 'Excellent' }, { lang: 'Hinglish', stars: 5, label: 'Excellent' }, { lang: 'Hindi', stars: 4, label: 'Very good' }, { lang: 'Urdu', stars: 3, label: 'Good' }] },
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
