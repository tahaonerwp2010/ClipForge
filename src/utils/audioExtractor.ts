/**
 * Audio Extractor Utility
 * Extracts real audio tracks from video files/URLs using the browser Web Audio API
 * and converts them to 16kHz mono 16-bit PCM WAV (the gold standard for AI speech models like Whisper and Gemini).
 */

export interface ExtractedAudioResult {
  base64Wav: string;
  duration: number;
  sampleRate: number;
  hasAudio: boolean;
  peaks: Array<{ start: number; end: number; energy: number }>;
}

/**
 * Convert AudioBuffer to a 16kHz Mono 16-bit PCM WAV file encoded as Base64
 */
export function audioBufferToWavBase64(
  audioBuffer: AudioBuffer,
  maxDurationSeconds: number = 180
): { base64Wav: string; duration: number; peaks: Array<{ start: number; end: number; energy: number }> } {
  const targetSampleRate = 16000;
  const numChannels = 1;
  const originalDuration = audioBuffer.duration;
  const durationToProcess = Math.min(originalDuration, maxDurationSeconds);
  const targetLength = Math.floor(durationToProcess * targetSampleRate);

  // Downsample & mix channels to 16kHz mono
  const monoSamples = new Float32Array(targetLength);
  const srcSampleRate = audioBuffer.sampleRate;
  const channelCount = audioBuffer.numberOfChannels;
  const channelData: Float32Array[] = [];

  for (let c = 0; c < channelCount; c++) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  // Linear interpolation resampling
  const ratio = srcSampleRate / targetSampleRate;
  const peaks: Array<{ start: number; end: number; energy: number }> = [];
  const windowSize = targetSampleRate; // 1-second energy windows
  let currentWindowEnergy = 0;
  let windowSampleCount = 0;
  let windowIndex = 0;

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcFraction = srcIndex - srcIndexFloor;

    let sample = 0;
    for (let c = 0; c < channelCount; c++) {
      const data = channelData[c];
      const s0 = data[srcIndexFloor] || 0;
      const s1 = data[srcIndexFloor + 1] || s0;
      sample += s0 + srcFraction * (s1 - s0);
    }
    sample = sample / channelCount; // Average across channels
    monoSamples[i] = sample;

    // Track energy for voice activity
    currentWindowEnergy += sample * sample;
    windowSampleCount++;

    if (windowSampleCount >= windowSize || i === targetLength - 1) {
      const rms = Math.sqrt(currentWindowEnergy / Math.max(1, windowSampleCount));
      peaks.push({
        start: +(windowIndex).toFixed(1),
        end: +(windowIndex + 1).toFixed(1),
        energy: +rms.toFixed(4)
      });
      windowIndex++;
      currentWindowEnergy = 0;
      windowSampleCount = 0;
    }
  }

  // Create 16-bit PCM WAV array buffer
  const wavBytes = targetLength * 2;
  const wavBuffer = new ArrayBuffer(44 + wavBytes);
  const view = new DataView(wavBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + wavBytes, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels (1 = Mono)
  view.setUint32(24, targetSampleRate, true); // SampleRate
  view.setUint32(28, targetSampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, wavBytes, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < targetLength; i++) {
    // Clamp to [-1, 1] and scale to 16-bit signed integer
    const s = Math.max(-1, Math.min(1, monoSamples[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  // Convert ArrayBuffer to base64
  let binary = '';
  const bytes = new Uint8Array(wavBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
  }
  const base64Wav = btoa(binary);

  return {
    base64Wav,
    duration: durationToProcess,
    peaks
  };
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Extract audio track from a video URL or File object into a 16kHz Base64 WAV
 */
export async function extractAudioFromVideo(
  videoSource: string | File,
  maxDurationSeconds: number = 180
): Promise<ExtractedAudioResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser environment');
  }

  const audioCtx = new AudioContextClass();

  try {
    let arrayBuffer: ArrayBuffer;
    if (typeof videoSource === 'string') {
      const resp = await fetch(videoSource);
      if (!resp.ok) {
        throw new Error(`Failed to fetch video stream: HTTP ${resp.status}`);
      }
      arrayBuffer = await resp.arrayBuffer();
    } else {
      arrayBuffer = await videoSource.arrayBuffer();
    }

    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const { base64Wav, duration, peaks } = audioBufferToWavBase64(decodedBuffer, maxDurationSeconds);

    return {
      base64Wav,
      duration,
      sampleRate: 16000,
      hasAudio: true,
      peaks
    };
  } catch (err: any) {
    console.warn('Audio decoding warning:', err);
    return {
      base64Wav: '',
      duration: 0,
      sampleRate: 16000,
      hasAudio: false,
      peaks: []
    };
  } finally {
    audioCtx.close().catch(() => {});
  }
}
