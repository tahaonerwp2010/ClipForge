// Keys of the stock-footage websites (auto b-roll). Stored only on this computer.
export interface StockProvider { id: string; name: string; paid: boolean; url: string; hint: string; placeholder: string }
export const STOCK_PROVIDERS: StockProvider[] = [
  { id: 'pexels', name: 'Pexels', paid: false, url: 'https://www.pexels.com/api/', hint: 'Free. Create a free account and request an API key.', placeholder: 'Pexels API key' },
  { id: 'pixabay', name: 'Pixabay', paid: false, url: 'https://pixabay.com/api/docs/', hint: 'Free. Sign up and the key is shown on the API page.', placeholder: 'Pixabay API key' },
  { id: 'shutterstock', name: 'Shutterstock', paid: true, url: 'https://www.shutterstock.com/developers', hint: 'Paid. Paste "API token|subscription id" (the subscription id is needed to download without a watermark).', placeholder: 'token|subscriptionId' },
  { id: 'storyblocks', name: 'Storyblocks', paid: true, url: 'https://www.storyblocks.com/api', hint: 'Paid. Paste "public key:private key" of your Storyblocks API plan.', placeholder: 'publicKey:privateKey' },
];
const STORE = 'clipforge_stock_keys';
export const StockService = {
  keys(): Record<string, string> {
    let k: Record<string, string> = {}; try { k = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { /* ignore */ }
    if (!Object.keys(k).length) { try { const d = (window as any).electronAPI?.kvLoadSync?.('stock_keys'); if (d && Object.keys(d).length) { k = d; try { localStorage.setItem(STORE, JSON.stringify(k)); } catch { /* ignore */ } } } catch { /* ignore */ } }
    return k;
  },
  setKey(id: string, key: string) { const k = this.keys(); if (key.trim()) k[id] = key.trim(); else delete k[id]; try { localStorage.setItem(STORE, JSON.stringify(k)); } catch {} try { (window as any).electronAPI?.kvSaveSync?.('stock_keys', k); } catch {} return k; },
  hasAny() { return Object.values(this.keys()).some(v => v && v.trim()); },
  async test(id: string, key: string): Promise<{ ok: boolean; message: string }> {
    const api: any = (window as any).electronAPI;
    if (!api?.stockTest) return { ok: false, message: 'Testing works in the desktop app.' };
    try { return await api.stockTest(id, key); } catch (e: any) { return { ok: false, message: String(e?.message || e) }; }
  },
};
