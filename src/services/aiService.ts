import REG from '../../electron/engine/ai-providers.json';
import { GeminiService } from './geminiService';

export interface AiModel { id: string; label: string; vision?: boolean }
export interface AiProviderInfo { name: string; tagline: string; kind: string; keyUrl: string; free: boolean; models: AiModel[] }
export type KeyStatus = 'untested' | 'ok' | 'limit' | 'credits' | 'invalid' | 'network' | 'unknown';
export interface AiKey { id: string; key: string; status: KeyStatus; checked?: number; note?: string }
export interface AiProviderCfg { keys: AiKey[]; model: string; auto: boolean; extra?: AiModel[] }
export interface AiConfig { enabled: boolean; active: string; providers: Record<string, AiProviderCfg> }

export const PROVIDER_ORDER: string[] = REG.order;
export const PROVIDERS = REG.providers as unknown as Record<string, AiProviderInfo>;
const STORE = 'clipforge_ai_config';
const uid = () => Math.random().toString(36).slice(2, 9);

const blank = (): AiConfig => ({
  enabled: true, active: 'gemini',
  providers: Object.fromEntries(PROVIDER_ORDER.map(id => [id, { keys: [], model: PROVIDERS[id].models[0].id, auto: true } as AiProviderCfg])),
});

export class AiService {
  static getConfig(): AiConfig {
    const base = blank();
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const c = JSON.parse(raw);
        for (const id of PROVIDER_ORDER) if (c.providers?.[id]) base.providers[id] = { ...base.providers[id], ...c.providers[id] };
        return { ...base, enabled: c.enabled !== false, active: PROVIDERS[c.active] ? c.active : 'gemini' };
      }
      // one-time migration from the old single Gemini key
      const old = GeminiService.getSettings();
      if (old.apiKey) {
        base.providers.gemini.keys = [{ id: uid(), key: old.apiKey, status: old.status === 'connected' ? 'ok' : 'untested' }];
        if (PROVIDERS.gemini.models.some(m => m.id === old.model)) base.providers.gemini.model = old.model;
        base.enabled = old.enabled;
      }
    } catch { /* ignore */ }
    return base;
  }
  static saveConfig(cfg: AiConfig): AiConfig {
    try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch { /* ignore */ }
    // keep the older single-key settings in step (used by the browser preview paths)
    const g = cfg.providers.gemini;
    GeminiService.saveSettings({ enabled: cfg.enabled, apiKey: g.keys[0]?.key || '', model: g.model });
    return cfg;
  }
  static models(id: string, cfg?: AiConfig): AiModel[] {
    const extra = cfg?.providers[id]?.extra || [];
    const base = PROVIDERS[id].models;
    return [...base, ...extra.filter(e => !base.some(b => b.id === e.id))];
  }
  static hasKeys(cfg = this.getConfig()): boolean { return cfg.enabled && PROVIDER_ORDER.some(id => cfg.providers[id].keys.length > 0); }
  static keyCount(cfg = this.getConfig()): number { return PROVIDER_ORDER.reduce((n, id) => n + cfg.providers[id].keys.length, 0); }
  /** What the pipeline needs (plain keys only). */
  static forJob(cfg = this.getConfig()) {
    return {
      enabled: cfg.enabled, active: cfg.active,
      providers: Object.fromEntries(PROVIDER_ORDER.map(id => [id, { keys: cfg.providers[id].keys.filter(k => k.status !== 'invalid').map(k => k.key), model: cfg.providers[id].model, auto: cfg.providers[id].auto }])),
    };
  }
  static newKey(key: string): AiKey { return { id: uid(), key: key.trim(), status: 'untested' }; }

  /** Cheap check, no generation quota used. A network hiccup never flips a working key to "offline". */
  static async ping(provider: string, key: string): Promise<{ status: KeyStatus; message: string }> {
    const api = window.electronAPI;
    if (!api?.aiPing) return { status: 'unknown', message: 'Key checks run in the desktop app.' };
    const r = await api.aiPing({ provider, key });
    const map: Record<string, KeyStatus> = { ok: 'ok', invalid: 'invalid', credits: 'credits', limit: 'limit', network: 'network', unknown: 'unknown' };
    return { status: map[r.state] || 'unknown', message: r.message };
  }
  static async test(provider: string, key: string, model: string) {
    const api = window.electronAPI;
    if (!api?.aiTest) return { success: false, message: 'Testing runs in the desktop app.', kind: 'other' };
    return api.aiTest({ provider, key, model });
  }
  static async listModels(provider: string, key: string): Promise<AiModel[]> {
    const r = await window.electronAPI?.aiListModels?.({ provider, key });
    return r?.ok ? r.models : [];
  }
  /** Silent re-check of every saved key (keeps statuses fresh, so nothing "goes offline" by itself). */
  static async refreshAll(): Promise<AiConfig> {
    const cfg = this.getConfig();
    await Promise.all(PROVIDER_ORDER.flatMap(id => cfg.providers[id].keys.map(async k => {
      const r = await this.ping(id, k.key);
      if (r.status === 'network' || r.status === 'unknown') { k.note = r.message; return; }   // keep the previous status
      k.status = r.status; k.checked = Date.now(); k.note = r.message;
    })));
    const latest = this.getConfig();     // merge: do not overwrite edits made while checking
    for (const id of PROVIDER_ORDER) for (const k of latest.providers[id].keys) {
      const f = cfg.providers[id].keys.find(x => x.id === k.id); if (f) { k.status = f.status; k.checked = f.checked; k.note = f.note; }
    }
    return this.saveConfig(latest);
  }
}
