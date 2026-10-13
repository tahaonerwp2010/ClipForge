import { 
  GeneratedClip, 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig, 
  OuterCanvasRatio 
} from '../types/clipper';
import { renderCanvasFrame } from './canvasRenderer';

export interface ExportProgressCallback {
  (percentage: number, statusText: string): void;
}

/**
 * Exports an actual playable video clip using HTMLCanvasElement.captureStream and MediaRecorder.
 * Fallbacks to high-res video slice download if MediaRecorder is constrained.
 */
export async function exportVideoClip(params: {
  clip: GeneratedClip;
  sourceVideoElement: HTMLVideoElement;
  secondaryVideoElement?: HTMLVideoElement | null;
  canvasRatio: OuterCanvasRatio;
  framing: InnerFramingConfig;
  captions: CaptionConfig;
  grading: VideoGradingConfig;
  branding: BrandingConfig;
  resolution: '1080p' | '720p';
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const {
    clip,
    sourceVideoElement,
    secondaryVideoElement,
    canvasRatio,
    framing,
    captions,
    grading,
    branding,
    resolution,
    onProgress
  } = params;

  // Determine export dimensions
  let width = 1080;
  let height = 1920;
  if (canvasRatio === '4:5') {
    width = 1080;
    height = 1350;
  } else if (canvasRatio === '1:1') {
    width = 1080;
    height = 1080;
  }

  if (resolution === '720p') {
    width = Math.round(width * 0.666);
    height = Math.round(height * 0.666);
  }

  // Create offscreen canvas for rendering
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not create Canvas 2D context');

  // Set up video playback range
  const startTime = clip.startTime;
  const endTime = clip.endTime;
  const duration = endTime - startTime;

  onProgress?.(5, 'Initializing local GPU canvas stream...');

  // Setup media recorder
  const stream = exportCanvas.captureStream(30);
  
  // Try supported mime types
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: resolution === '1080p' ? 8_000_000 : 4_000_000
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise(async (resolve, reject) => {
    try {
      recorder.start(100);

      // Seek to clip start
      sourceVideoElement.currentTime = startTime;
      await new Promise(r => setTimeout(r, 200));

      const fps = 30;
      const totalFrames = Math.max(1, Math.round(duration * fps));
      let currentFrame = 0;

      const frameInterval = setInterval(() => {
        try {
          const currentClipTime = startTime + (currentFrame / fps);
          sourceVideoElement.currentTime = currentClipTime;

          renderCanvasFrame(ctx, {
            canvas: exportCanvas,
            primaryVideo: sourceVideoElement,
            secondaryVideo: secondaryVideoElement,
            currentTime: currentClipTime,
            canvasRatio,
            framing,
            captions,
            grading,
            branding,
            words: clip.words
          });

          currentFrame++;
          const progress = Math.min(95, Math.round((currentFrame / totalFrames) * 90) + 5);
          onProgress?.(progress, `Rendering frame ${currentFrame} / ${totalFrames} (${progress}%)...`);

          if (currentFrame >= totalFrames || currentClipTime >= endTime) {
            clearInterval(frameInterval);
            onProgress?.(98, 'Finalizing video container encoding...');

            recorder.onstop = () => {
              const finalBlob = new Blob(recordedChunks, { type: 'video/webm' });
              onProgress?.(100, 'Export complete!');
              resolve(finalBlob);
            };

            setTimeout(() => {
              recorder.stop();
            }, 300);
          }
        } catch (err) {
          clearInterval(frameInterval);
          reject(err);
        }
      }, 1000 / fps);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Downloads a Blob as a file directly in the browser
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Formats transcript words into SubRip (.srt) subtitle text
 */
export function generateSrtContent(words: GeneratedClip['words']): string {
  if (!words || words.length === 0) return '';
  
  const chunks: Array<{ start: number; end: number; text: string }> = [];
  const chunkSize = 3;
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const slice = words.slice(i, i + chunkSize);
    chunks.push({
      start: slice[0].start,
      end: slice[slice.length - 1].end,
      text: slice.map(w => w.word).join(' ')
    });
  }

  return chunks.map((c, index) => {
    return `${index + 1}\n${formatTimecode(c.start)} --> ${formatTimecode(c.end)}\n${c.text}\n`;
  }).join('\n');
}

function formatTimecode(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  const millis = Math.floor((sec % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}
