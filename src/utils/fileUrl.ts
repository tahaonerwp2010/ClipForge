// Link the screen can use to play a file on disk. Desktop: file:///…  Android: a small local web address served by the engine.
export const fileUrl = (p: string): string => {
  const f = (window as any).electronAPI?.fileUrl;
  if (typeof f === 'function') return f(p);
  return 'file:///' + p.replace(/\\/g, '/').split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
};
