export interface GeminiSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
  status: 'idle' | 'connected' | 'quota_exceeded' | 'invalid_key' | 'disabled';
  lastTested?: string;
  lastErrorMessage?: string;
  autoFallbackToLocal: boolean;
}

const STORAGE_KEY = 'clipforge_gemini_config';

const DEFAULT_SETTINGS: GeminiSettings = {
  enabled: true,
  apiKey: '',
  model: 'gemini-3.8-flash',
  status: 'idle',
  autoFallbackToLocal: true
};

export class GeminiService {
  /**
   * Load stored Gemini settings from localStorage
   */
  public static getSettings(): GeminiSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (err) {
      console.warn('Failed to read Gemini settings:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save Gemini settings
   */
  public static saveSettings(settings: Partial<GeminiSettings>): GeminiSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save Gemini settings:', err);
    }
    return updated;
  }

  /**
   * Test API key connection and quota status
   */
  public static async testConnection(apiKeyToTest?: string, modelToTest?: string): Promise<{
    success: boolean;
    quotaExhausted?: boolean;
    message: string;
    model?: string;
  }> {
    const current = this.getSettings();
    const key = (apiKeyToTest !== undefined ? apiKeyToTest : current.apiKey).trim();
    const model = modelToTest || current.model || 'gemini-3.8-flash';
    if (!key) return { success: false, message: 'Enter your Gemini API key first.' };

    let r: { success: boolean; model?: string; message: string; kind?: string; quotaExhausted?: boolean; invalidKey?: boolean };
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (api?.testGemini) {
      r = await api.testGemini(key, model);
    } else {
      // Browser preview: call Google directly, trying the chosen model then newer fallbacks.
      r = { success: false, message: 'Could not connect to Gemini. Check your internet.' };
      for (const m of [model, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with: OK' }] }] })
          });
          if (res.ok) { r = { success: true, model: m, message: `Connected. Gemini answered using ${m}.` }; break; }
          const err = await res.json().catch(() => ({}));
          const msg = err.error?.message || `HTTP ${res.status}`;
          if (res.status === 429) { r = { success: false, quotaExhausted: true, message: 'Quota exhausted. Wait a while or use another key. Offline mode still works.' }; break; }
          if (res.status === 400 || res.status === 401 || res.status === 403) { r = { success: false, invalidKey: true, message: 'API key is invalid or not allowed.' }; break; }
          r = { success: false, message: msg };
        } catch (e: any) { r = { success: false, message: e?.message || 'Network error.' }; break; }
      }
    }

    this.saveSettings({
      status: r.success ? 'connected' : r.quotaExhausted ? 'quota_exceeded' : 'invalid_key',
      lastTested: new Date().toLocaleTimeString(),
      lastErrorMessage: r.success ? undefined : r.message
    });
    return { success: r.success, quotaExhausted: r.quotaExhausted, message: r.message, model: r.model };
  }

  /**
   * Transcribe REAL audio waveform using Gemini Multimodal Audio Model (gemini-2.5-flash)
   */
  public static async transcribeAudioWithGemini(
    audioBase64: string,
    duration: number,
    videoTitle: string
  ): Promise<{
    success: boolean;
    words?: any[];
    fullTranscript?: string;
    clips?: any[];
    errorMessage?: string;
  }> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return { success: false, errorMessage: 'Gemini disabled' };
    }

    // 1. Try server endpoint
    try {
      const res = await fetch('/api/ai/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'x-gemini-key': settings.apiKey } : {})
        },
        body: JSON.stringify({
          audioBase64,
          duration,
          videoTitle,
          apiKey: settings.apiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.words && Array.isArray(data.data.words) && data.data.words.length > 0) {
          return {
            success: true,
            words: data.data.words,
            fullTranscript: data.data.fullTranscript,
            clips: data.data.clips
          };
        }
      }
    } catch {
      // Server not reachable (standalone Electron)
    }

    // 2. Direct Gemini Multimodal API fallback (for Electron standalone)
    if (settings.apiKey && audioBase64) {
      try {
        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-3.8-flash'}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/wav',
                        data: audioBase64
                      }
                    },
                    {
                      text: `Transcribe this audio verbatim with exact start and end timestamps in seconds for each word, and detect 2-4 viral short clips. Return valid JSON: { "fullTranscript": "...", "words": [{ "word": "...", "start": 0.0, "end": 0.5 }], "clips": [{ "title": "...", "hookText": "...", "startTime": 0.0, "endTime": 25.0, "viralityScore": 95, "reason": "...", "category": "Deep Insight" }] }`
                    }
                  ]
                }
              ],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );

        if (directRes.ok) {
          const directData = await directRes.json();
          const rawText = directData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.words && parsed.words.length > 0) {
              return {
                success: true,
                words: parsed.words,
                fullTranscript: parsed.fullTranscript,
                clips: parsed.clips
              };
            }
          }
        }
      } catch (err: any) {
        console.warn('Direct multimodal audio transcribe failed:', err);
      }
    }

    return { success: false, errorMessage: 'Multimodal audio engine unavailable' };
  }

  /**
   * Attempt transcription with Gemini Cloud AI
   */
  public static async transcribeWithGemini(
    videoTitle: string,
    duration: number,
    hintText?: string
  ): Promise<{
    success: boolean;
    words?: any[];
    fullTranscript?: string;
    errorMessage?: string;
  }> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return { success: false, errorMessage: 'Gemini disabled' };
    }

    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'x-gemini-key': settings.apiKey } : {})
        },
        body: JSON.stringify({
          videoTitle,
          duration,
          hintText,
          apiKey: settings.apiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.words && Array.isArray(data.data.words) && data.data.words.length > 0) {
          return {
            success: true,
            words: data.data.words,
            fullTranscript: data.data.fullTranscript
          };
        }
      }
    } catch {
      // Backend not running (e.g. Electron standalone mode)
    }

    // Direct Google Gemini API fallback
    if (settings.apiKey) {
      try {
        const prompt = `You are a professional audio/video speech transcriber.
Transcribe and segment the spoken content of video: "${videoTitle}" (${duration}s duration).
${hintText ? `Context: ${hintText}` : ''}
Extract real sentences spoken in this video (approx 40-70 words) with realistic word timestamps between 0 and ${duration}s.
Respond ONLY with valid JSON:
{
  "fullTranscript": "Exact transcript text...",
  "words": [
    { "word": "Hello", "start": 0.5, "end": 0.9 }
  ]
}`;

        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-3.8-flash'}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );

        if (directRes.ok) {
          const directData = await directRes.json();
          const rawText = directData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.words && parsed.words.length > 0) {
              return {
                success: true,
                words: parsed.words,
                fullTranscript: parsed.fullTranscript
              };
            }
          }
        }
      } catch (err: any) {
        console.warn('Direct transcribe failed:', err);
      }
    }

    return { success: false, errorMessage: 'Could not reach transcription engine' };
  }

  /**
   * Attempt analysis with Gemini, falling back seamlessly if disabled, credits exhausted, or error
   */
  public static async analyzeWithFailover(
    videoTitle: string,
    targetClips: number,
    duration: number = 120,
    transcriptText?: string
  ): Promise<{
    usedCloud: boolean;
    usedFallback: boolean;
    clips?: any[];
    errorMessage?: string;
  }> {
    const settings = this.getSettings();

    // 1. If user has turned OFF the Gemini API toggle:
    if (!settings.enabled) {
      return {
        usedCloud: false,
        usedFallback: false,
        errorMessage: 'Gemini API is turned OFF by user. Using local offline model.'
      };
    }

    // 2. If ON, attempt Gemini Cloud inference via server proxy
    try {
      const res = await fetch('/api/ai/analyze-clips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'x-gemini-key': settings.apiKey } : {})
        },
        body: JSON.stringify({
          videoTitle,
          duration,
          targetClips,
          transcriptText,
          apiKey: settings.apiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.clips && Array.isArray(data.data.clips) && data.data.clips.length > 0) {
          return {
            usedCloud: true,
            usedFallback: false,
            clips: data.data.clips
          };
        }
      }
    } catch {
      // Backend not running (e.g. Electron standalone mode)
    }

    // 3. Direct Google Gemini API fallback
    if (settings.apiKey) {
      try {
        const prompt = `You are a viral short-form video clipping editor (MrBeast, Alex Hormozi style).
Analyze this video: "${videoTitle}" (${duration}s duration).
${transcriptText ? `Spoken Transcript:\n"""${transcriptText}"""` : ''}
Extract ${targetClips} viral short clips (each 20 to 45 seconds).
Respond ONLY with valid JSON:
{
  "clips": [
    {
      "title": "PUNCHY 3-5 WORD VIRAL TITLE WITH EMOJI",
      "hookText": "Exact hook sentence in first 3 seconds",
      "viralityScore": 96,
      "category": "High Energy",
      "reason": "Immediate retention grabber",
      "startSeconds": 5.0,
      "endSeconds": 35.0
    }
  ]
}`;

        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-3.8-flash'}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );

        if (directRes.ok) {
          const directData = await directRes.json();
          const rawText = directData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.clips && parsed.clips.length > 0) {
              return {
                usedCloud: true,
                usedFallback: false,
                clips: parsed.clips
              };
            }
          }
        }
      } catch (err: any) {
        console.warn('Direct analyze failed:', err);
      }
    }

    return {
      usedCloud: false,
      usedFallback: true,
      errorMessage: 'Gemini API unavailable, using on-device engine'
    };
  }
}
