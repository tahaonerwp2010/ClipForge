// A tiny stand-in for the 'electron' module that electron/preload.cjs expects. It is only bundled into the Android build.
type Fn = (e: any, d: any) => void;
const listeners = new Map<string, Set<Fn>>();
export const bus = {
  invokeImpl: (_ch: string, _args: any[]): Promise<any> => Promise.reject(new Error('Not ready')),
  sendImpl: (_ch: string, _args: any[]) => {},
  emit(ch: string, data: any) { listeners.get(ch)?.forEach(f => { try { f({}, data); } catch {} }); },
};
export const ipcRenderer = {
  invoke: (ch: string, ...args: any[]) => bus.invokeImpl(ch, args),
  send: (ch: string, ...args: any[]) => bus.sendImpl(ch, args),
  on: (ch: string, f: Fn) => { if (!listeners.has(ch)) listeners.set(ch, new Set()); listeners.get(ch)!.add(f); },
  removeListener: (ch: string, f: Fn) => { listeners.get(ch)?.delete(f); },
};
export const contextBridge = { exposeInMainWorld: (name: string, api: any) => { (window as any)[name] = api; } };
export const webUtils = { getPathForFile: () => '' };
