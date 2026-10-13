// Gemini REST helper: model fallback + clear error classes. Used by the pipeline and the Settings "Test" button.
const BASE = () => process.env.CF_GEMINI_BASE || 'https://generativelanguage.googleapis.com';
const FALLBACKS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

class GeminiError extends Error { constructor(kind, message, status) { super(message); this.kind = kind; this.status = status; } }

function classify(status, body) {
  const msg = body?.error?.message || `HTTP ${status}`;
  const st = body?.error?.status || '';
  if (status === 429 || st === 'RESOURCE_EXHAUSTED') return new GeminiError('quota', `Quota or rate limit reached: ${msg}`, status);
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg + st)) {
    if (/not found|not supported|no longer available|has not been used/i.test(msg) && status !== 401) return new GeminiError('model', msg, status);
    return new GeminiError('invalid_key', `The API key was rejected: ${msg}`, status);
  }
  if (status === 400 && /API key/i.test(msg)) return new GeminiError('invalid_key', `The API key was rejected: ${msg}`, status);
  if (status === 404 || /not found|not supported/i.test(msg)) return new GeminiError('model', msg, status);
  return new GeminiError('other', msg, status);
}

async function generate({ apiKey, model, prompt, parts, system, json = false, timeoutMs = 60000 }) {
  if (!apiKey) throw new GeminiError('invalid_key', 'No API key entered.');
  const models = [...new Set([model, ...FALLBACKS].filter(Boolean))];
  let last;
  for (const m of models) {
    let res;
    try {
      res = await fetch(`${BASE()}/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ parts: parts || [{ text: prompt }] }], ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) { throw new GeminiError('network', `Could not reach Gemini: ${e.message}`); }
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = body?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (!text) { last = new GeminiError('other', 'Gemini returned an empty answer.'); continue; }
      return { text, model: m };
    }
    last = classify(res.status, body);
    if (last.kind === 'quota' || last.kind === 'invalid_key') throw last;   // another model will not fix these
  }
  throw last || new GeminiError('other', 'Gemini request failed.');
}

async function test({ apiKey, model }) {
  try {
    const r = await generate({ apiKey, model, prompt: 'Reply with exactly: OK', timeoutMs: 20000 });
    return { success: true, model: r.model, message: `Connected. Using ${r.model}.` };
  } catch (e) {
    return { success: false, kind: e.kind || 'other', quotaExhausted: e.kind === 'quota', invalidKey: e.kind === 'invalid_key', message: e.message };
  }
}
const parseJson = t => JSON.parse(String(t).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
module.exports = { generate, test, parseJson, GeminiError, FALLBACKS };
