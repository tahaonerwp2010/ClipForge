import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Youtube, 
  Sparkles, 
  FileVideo, 
  ArrowRight, 
  X,
  Play,
  Film
} from 'lucide-react';
import { VideoSource } from '../types/clipper';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';

interface SourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (source: VideoSource) => void;
}

export const SourcePickerModal: React.FC<SourcePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'youtube' | 'samples'>('samples');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isParsingYt, setIsParsingYt] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle local file selection
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Please upload a valid MP4, WebM, or MOV video file.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const newSource: VideoSource = {
      id: `local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      url: objectUrl,
      duration: 120, // will be auto-updated when metadata loads
      thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80',
      type: 'upload',
      author: 'Local File',
      originalAspect: '16:9',
      filePath: window.electronAPI?.getPathForFile?.(file) || undefined
    };

    onSelectVideo(newSource);
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Handle YouTube URL submit
  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsParsingYt(true);
    // Simulate YouTube video metadata resolution
    setTimeout(() => {
      // Pick a high quality talk video stream
      const matchedSample = SAMPLE_VIDEOS[0];
      const newSource: VideoSource = {
        id: `yt-${Date.now()}`,
        title: youtubeUrl.includes('podcast') ? 'YouTube Viral Tech Interview (Imported)' : 'Viral Masterclass & Keynote Talk',
        url: matchedSample.url,
        duration: 184,
        thumbnail: matchedSample.thumbnail,
        type: 'youtube',
        author: 'YouTube Import',
        originalAspect: '16:9 widescreen'
      };

      setIsParsingYt(false);
      onSelectVideo(newSource);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">What are you starting with?</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Everything else — aspect ratio, captions, dynamic framing & styling — comes next with live preview.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/40">
          <button
            onClick={() => setActiveTab('samples')}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'samples'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready Samples (Instant Test)</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Local Video</span>
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'youtube'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Youtube className="w-3.5 h-3.5" />
            <span>Paste YouTube URL</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'samples' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-400 font-medium">
                Choose a pre-loaded 16:9 widescreen video to immediately test vertical reframing, blurred backdrops, and animated captions:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SAMPLE_VIDEOS.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => {
                      onSelectVideo(sample);
                      onClose();
                    }}
                    className="group cursor-pointer rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/60 p-3 transition-all hover:shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-800 mb-2.5">
                        <img 
                          src={sample.thumbnail} 
                          alt={sample.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-9 h-9 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-neutral-300">
                          {Math.floor(sample.duration / 60)}:{(sample.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-neutral-200 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                        {sample.title}
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-1 truncate">
                        {sample.author}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                      <span>Click to Reframe</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input 
                ref={fileInputRef}
                type="file" 
                accept="video/mp4,video/webm,video/quicktime,video/mkv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-emerald-500 bg-emerald-950/20' 
                    : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">Choose a video file or drop it anywhere here</h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  Supports MP4, WebM, and MOV up to 4K resolution. Runs entirely locally on your processor and GPU.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition-all shadow-md">
                  <FileVideo className="w-4 h-4" />
                  <span>Browse Local Files</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'youtube' && (
            <form onSubmit={handleYoutubeSubmit} className="space-y-4">
              <p className="text-xs text-neutral-400">
                Paste any YouTube video link (podcasts, lectures, interviews, tutorials) to extract viral shorts:
              </p>

              <div className="space-y-2">
                <div className="relative">
                  <Youtube className="w-5 h-5 text-red-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1">
                  <span>Try examples:</span>
                  <button
                    type="button"
                    onClick={() => setYoutubeUrl('https://www.youtube.com/watch?v=lex-fridman-ai-podcast')}
                    className="text-neutral-400 hover:text-emerald-400 underline underline-offset-2"
                  >
                    Tech Podcast
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setYoutubeUrl('https://www.youtube.com/watch?v=hormozi-business-masterclass')}
                    className="text-neutral-400 hover:text-emerald-400 underline underline-offset-2"
                  >
                    Business Talk
                  </button>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!youtubeUrl.trim() || isParsingYt}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                >
                  {isParsingYt ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      <span>Resolving Stream...</span>
                    </>
                  ) : (
                    <>
                      <span>Import YouTube Video</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
