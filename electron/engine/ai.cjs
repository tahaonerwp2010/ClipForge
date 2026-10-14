// Multi-provider AI router. Chain: chosen model -> other models of the same provider (Auto) -> next key of the same provider
// -> next provider that has a key -> throws (callers then use the built-in local writer / offline finder).
const REG = require('./ai-providers.json');
const crypto = require('crypto');

class AiError extends Error { constructor(kind, message, status) { super(message); this.kind = kind; this.status = status; } }
let logger = () => {};
const setLogger = f => { logger = typeof f === 'function' ? f : () => {}; };
const say = (m, k = 'info') => { try { logger(m, k); } catch { /* ignore */ } };

// ---------- config ----------
const keyText = k => String(typeof k === 'string' ? k : (k && k.key) || '').trim();
function normalize(g) {
  g = g || {};
  const providers = {};
  for (const id of REG.order) {
    const p = (g.providers && g.providers[id]) || {};
    providers[id] = { keys: (p.keys || []).map(keyText).filter(Boolean), model: p.model || '', auto: p.auto !== false };
  }
  if (g.apiKey && !providers.gemini.keys.length) { providers.gemini.keys = [String(g.apiKey).trim()]; providers.gemini.model = providers.gemini.model || g.model || ''; }
  const active = REG.providers[g.active] ? g.active : 'gemini';
  const order = [active, ...REG.order.filter(x => x !== active)].filter(id => providers[id].keys.length);
  return { enabled: g.enabled !== false, providers, order };
}
const ready = g => { const c = normalize(g); return !!(g && g.enabled !== false && c.order.length); };

// ---------- health memory (per app session) ----------
const dead = new Map();   // keyHash -> { until, kind }
const kh = (prov, key) => prov + ':' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
const isDead = (prov, key) => { const d = dead.get(kh(prov, key)); if (!d) return false; if (Date.now() > d.until) { dead.delete(kh(prov, key)); return false; } return true; };
const mark = (prov, key, kind, ms) => dead.set(kh(prov, key), { until: Date.now() + ms, kind });
const forget = () => dead.clear();

// ---------- request builders ----------
const prep = (prompt, json) => (json ? `${prompt || ''}\n\nReturn ONLY valid JSON. No markdown, no extra text.` : prompt || '');
function imagesOf(parts) { return (parts || []).filter(p => p && p.inlineData); }
const hasImages = parts => imagesOf(parts).length > 0;

function classify(status, text, body) {
  const msg = String(body?.error?.message || body?.message || body?.error || text || `HTTP ${status}`).slice(0, 300);
  const all = msg + ' ' + (body?.error?.status || '') + ' ' + (body?.error?.type || '') + ' ' + (body?.error?.code || '');
  if (status === 402 || /insufficient[_ ]?(quota|credit|balance|funds)|billing|credit balance|out of credits|no credits|exceeded your current quota|arrearage/i.test(all)) return new AiError('credits', `No credits left: ${msg}`, status);
  if (status === 401 || /invalid[_ ]?api[_ ]?key|API key not valid|incorrect api key|authentication|unauthorized|API_KEY_INVALID/i.test(all)) return new AiError('invalid_key', `The key was rejected: ${msg}`, status);
  if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|too many requests|quota/i.test(all)) return new AiError('rate', `Rate or daily limit reached: ${msg}`, status);
  if (status === 403) return /model|not found|access|not available|not supported/i.test(msg) ? new AiError('model', msg, status) : new AiError('invalid_key', `The key was rejected: ${msg}`, status);
  if (status === 404 || /model.*(not found|does not exist|not supported|unavailable|deprecated)|no endpoints found/i.test(all)) return new AiError('model', msg, status);
  if (status >= 500 || status === 408 || status === 529) return new AiError('busy', `Service busy: ${msg}`, status);
  return new AiError('other', msg, status);
}

async function http(url, opt, timeoutMs) {
  let res;
  try { res = await fetch(url, { ...opt, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (e) { throw new AiError(/timeout|abort/i.test(String(e.name + e.message)) ? 'busy' : 'network', `Could not reach the service: ${e.message}`); }
  const text = await res.text().catch(() => '');
  let body = {}; try { body = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw classify(res.status, text, body);
  return body;
}

async function callOne(provId, key, model, { prompt, parts, system, json, timeoutMs }) {
  const P = REG.providers[provId];
  if (P.kind === 'gemini') {
    const body = await http(`${P.base}/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ parts: parts || [{ text: prompt }] }], ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) }),
    }, timeoutMs);
    const text = body?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!text) throw new AiError('other', 'Empty answer.');
    return text;
  }
  const textPrompt = prep(prompt || (parts || []).filter(p => p.text).map(p => p.text).join('\n'), json);
  const imgs = imagesOf(parts);
  if (P.kind === 'anthropic') {
    const content = [...imgs.map(p => ({ type: 'image', source: { type: 'base64', media_type: p.inlineData.mimeType, data: p.inlineData.data } })), { type: 'text', text: textPrompt }];
    const body = await http(`${P.base}/v1/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8000, ...(system ? { system } : {}), messages: [{ role: 'user', content }] }),
    }, timeoutMs);
    const text = (body.content || []).map(c => c.text || '').join('');
    if (!text) throw new AiError('other', 'Empty answer.');
    return text;
  }
  // OpenAI-compatible (OpenRouter, Groq, OpenAI, DeepSeek, Qwen)
  const content = imgs.length ? [{ type: 'text', text: textPrompt }, ...imgs.map(p => ({ type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } }))] : textPrompt;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(provId === 'openrouter' ? { 'HTTP-Referer': 'https://github.com/ClipForge', 'X-Title': 'ClipForge' } : {}) };
  const body = await http(`${P.base}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content }] }),
  }, timeoutMs);
  const text = String(body?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) throw new AiError('other', 'Empty answer.');
  return text;
}

// ---------- main entry ----------
async function generate(g, { prompt, parts, system, json = false, timeoutMs = 60000 } = {}) {
  const cfg = normalize(g);
  if (!cfg.enabled || !cfg.order.length) throw new AiError('invalid_key', 'No AI key added.');
  const needVision = hasImages(parts);
  const started = Date.now(); let attempts = 0, last = null;
  for (const pid of cfg.order) {
    const P = REG.providers[pid], pc = cfg.providers[pid];
    let models = (pc.auto ? [pc.model, ...(pc.extra || []), ...P.models.map(m => m.id)] : [pc.model || P.models[0].id]).filter(Boolean);
    models = [...new Set(models)];
    if (needVision) { const ok = new Set(P.models.filter(m => m.vision).map(m => m.id)); models = models.filter(m => ok.has(m)); }
    if (!models.length) { say(`${P.name}: no image-capable model, skipping`, 'info'); continue; }
    let providerDown = false;
    for (let ki = 0; ki < pc.keys.length && !providerDown; ki++) {
      const key = pc.keys[ki];
      if (isDead(pid, key)) continue;
      let rateHits = 0, tried = 0;
      for (const m of models) {
        if (attempts >= 14 || Date.now() - started > 170000) throw last || new AiError('busy', 'AI took too long.');
        attempts++; tried++;
        try {
          const text = await callOne(pid, key, m, { prompt, parts, system, json, timeoutMs: Math.min(timeoutMs, 60000) });
          if (ki > 0 || pid !== cfg.order[0]) say(`Answered by ${P.name} · key ${ki + 1} · ${m}`, 'success');
          return { text, model: m, provider: pid, providerName: P.name, keyIndex: ki };
        } catch (e) {
          last = e;
          const k = e.kind || 'other';
          if (k === 'invalid_key') { mark(pid, key, k, 1e12); say(`${P.name} key ${ki + 1} was rejected → ${ki + 1 < pc.keys.length ? 'next key' : 'next provider'}`, 'warn'); break; }
          if (k === 'credits') { mark(pid, key, k, 30 * 60000); say(`${P.name} key ${ki + 1} has no credits → ${ki + 1 < pc.keys.length ? 'next key' : 'next provider'}`, 'warn'); break; }
          if (k === 'network') { providerDown = true; say(`${P.name} could not be reached → next provider`, 'warn'); break; }
          if (k === 'rate') { rateHits++; say(`${P.name} · ${m} is at its limit${pc.auto ? ' → next model' : ''}`, 'warn'); continue; }
          say(`${P.name} · ${m} failed (${String(e.message).slice(0, 70)})${pc.auto ? ' → next model' : ''}`, 'warn');
        }
      }
      if (tried && rateHits === tried) { mark(pid, key, 'rate', 2 * 60000); say(`${P.name} key ${ki + 1}: every model is at its limit → ${ki + 1 < pc.keys.length ? 'next key' : 'next provider'}`, 'warn'); }
    }
  }
  throw last || new AiError('other', 'No AI provider answered.');
}

// ---------- Settings helpers ----------
async function test({ provider, key, model }) {
  const P = REG.providers[provider];
  if (!P) return { success: false, kind: 'other', message: 'Unknown provider.' };
  key = keyText(key);
  if (!key) return { success: false, kind: 'invalid_key', message: 'Enter an API key first.' };
  const m = model || P.models[0].id;
  try {
    await callOne(provider, key, m, { prompt: 'Reply with exactly: OK', timeoutMs: 25000 });
    return { success: true, model: m, message: `Working. ${P.name} answered using ${m}.` };
  } catch (e) {
    return { success: false, kind: e.kind || 'other', quotaExhausted: e.kind === 'rate' || e.kind === 'credits', message: e.message };
  }
}

// Cheap key check (lists models / key info). Uses no generation quota, so it can run often.
async function ping({ provider, key }) {
  const P = REG.providers[provider]; key = keyText(key);
  if (!P || !key) return { state: 'invalid', message: 'No key.' };
  const url = P.kind === 'gemini' ? `${P.base}/v1beta/models?pageSize=1` : P.kind === 'anthropic' ? `${P.base}/v1/models?limit=1` : provider === 'openrouter' ? `${P.base}/auth/key` : `${P.base}/models`;
  const headers = P.kind === 'gemini' ? { 'x-goog-api-key': key } : P.kind === 'anthropic' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${key}` };
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (res.ok) return { state: 'ok', message: 'Key accepted.' };
    if (res.status === 401 || res.status === 403) return { state: 'invalid', message: 'The key was rejected.' };
    if (res.status === 402) return { state: 'credits', message: 'No credits left.' };
    if (res.status === 429) return { state: 'limit', message: 'Limit reached for now.' };
    return { state: 'unknown', message: `Service answered ${res.status}.` };
  } catch (e) { return { state: 'network', message: 'Could not reach the service (check internet).' }; }
}

// Live model list for providers whose free list changes often.
async function listModels({ provider, key }) {
  const P = REG.providers[provider]; key = keyText(key);
  if (!P) return { ok: false, models: [] };
  try {
    if (provider === 'openrouter') {
      const r = await (await fetch(`${P.base}/models`, { signal: AbortSignal.timeout(20000) })).json();
      const list = (r.data || []).filter(x => /:free$/.test(x.id) && Number(x.pricing?.prompt) === 0 && /text/.test((x.architecture?.modality || 'text'))).sort((a, b) => (b.context_length || 0) - (a.context_length || 0)).slice(0, 14)
        .map(x => ({ id: x.id, label: String(x.name || x.id).replace(/\s*\(free\)/i, ''), vision: /image/.test(x.architecture?.modality || '') }));
      return { ok: true, models: list };
    }
    if (provider === 'groq' && key) {
      const r = await (await fetch(`${P.base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) })).json();
      const list = (r.data || []).filter(x => x.active !== false && !/whisper|guard|tts|playai|prompt-guard|distil/i.test(x.id)).map(x => ({ id: x.id, label: x.id, vision: /scout|maverick|vision/.test(x.id) }));
      return { ok: true, models: list.slice(0, 14) };
    }
    if (provider === 'gemini' && key) {
      const r = await (await fetch(`${P.base}/v1beta/models?pageSize=100`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000) })).json();
      const list = (r.models || []).filter(x => (x.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(x.name) && !/image|tts|live|audio|thinking-exp|preview-0/.test(x.name))
        .map(x => ({ id: x.name.replace(/^models\//, ''), label: x.displayName || x.name, vision: true })).slice(0, 12);
      return { ok: true, models: list };
    }
  } catch (e) { return { ok: false, models: [], message: e.message }; }
  return { ok: false, models: [] };
}

const parseJson = t => {
  let s = String(t).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch { /* find the json inside text */ }
  const a = s.search(/[\[{]/); const open = s[a], close = open === '[' ? ']' : '}'; const b = s.lastIndexOf(close);
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error('AI did not return JSON');
};
module.exports = { generate, ready, normalize, test, ping, listModels, parseJson, setLogger, forget, AiError, REG };
