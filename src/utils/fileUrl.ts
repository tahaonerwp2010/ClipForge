// Link the screen can use to play a file on disk. Desktop: file:///…  Android: a small local web address served by the engine.
export const fileUrl = (p: string): string => {
  const f = (window as any).electronAPI?.fileUrl;
  if (typeof f === 'function') return f(p);
  return 'file:///' + p.replace(/\\/g, '/').split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
};

/** Link the screen should use to PLAY a video: the original when the window can play it, otherwise a small H.264 copy made by the engine (only for preview). */
export async function playableUrl(path: string | undefined, url: string, force = false): Promise<string> {
  const api = (window as any).electronAPI;
  if (!path || typeof api?.makePreview !== 'function') return url;
  (window as any).__previewErr = '';
  try { const r = await api.makePreview(path, force); if (r && r.ok && r.path) return fileUrl(r.path); if (r && !r.ok) (window as any).__previewErr = r.error || 'unknown error'; } catch { /* keep the original */ }
  return url;
}
