// Android only: connects the screen to the Node.js engine (same engine as the desktop app) and to the phone's native features.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { NodeJS } from 'capacitor-nodejs';
import { Toast } from '@capacitor/toast';
import { bus } from './electron-shim';
import '../../electron/preload.cjs';

const ClipForge: any = registerPlugin('ClipForge');
const w = window as any;

(function boot() {
  if (!Capacitor.isNativePlatform()) return;
  let port = 0, seq = 0;
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  let ready: Promise<void>;
  let setReady: () => void;
  ready = new Promise<void>(r => { setReady = r; });
  w.__cfReady = ready;

  const sendNode = (eventName: string, ...args: any[]) => NodeJS.send({ eventName, args });
  bus.invokeImpl = async (ch, args) => {
    await ready;
    const id = ++seq;
    return new Promise((res, rej) => { pending.set(id, { res, rej }); sendNode('ipc', { id, ch, args }); });
  };
  bus.sendImpl = (ch, args) => { sendNode('ipc-send', { ch, args }); };

  NodeJS.addListener('ipc-result', (e: any) => {
    const m = e.args[0]; const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
    m.ok ? p.res(m.value) : p.rej(new Error(m.error || 'Failed'));
  });
  NodeJS.addListener('ev', (e: any) => bus.emit(e.args[0], e.args[1]));
  NodeJS.addListener('busy', (e: any) => { ClipForge.keepAlive({ on: !!e.args[0] }).catch(() => {}); });
  NodeJS.addListener('log', (e: any) => console.log('[node]', e.args[0]));

  // face detection runs in a hidden same-origin frame of this very WebView (face-api.js, no native code needed)
  let faceFrame: HTMLIFrameElement | null = null;
  const faceRun = async (code: string) => {
    if (!faceFrame) {
      faceFrame = document.createElement('iframe');
      faceFrame.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0;visibility:hidden';
      faceFrame.src = './facetrack/page.html';
      document.body.appendChild(faceFrame);
      await new Promise<void>((ok, bad) => { faceFrame!.onload = () => ok(); setTimeout(() => bad(new Error('Face detector did not load')), 20000); });
    }
    return await (faceFrame.contentWindow as any).eval(code);
  };

  NodeJS.addListener('req', async (e: any) => {
    const { id, method, args } = e.args[0];
    try {
      let value: any = null;
      if (method === 'faceRun') value = await faceRun(args.code);
      else if (method === 'toast') { await Toast.show({ text: String(args.text || ''), duration: 'long' }); }
      else if (typeof ClipForge[method] === 'function') value = await ClipForge[method](args);
      else throw new Error('Unknown request ' + method);
      sendNode('req-result', { id, ok: true, value });
    } catch (err: any) { sendNode('req-result', { id, ok: false, error: String(err?.message || err) }); }
  });
  ['ytLine', 'ytErr'].forEach(n => ClipForge.addListener(n, (d: any) => sendNode('native-event', n, d)));

  w.electronAPI = {
    ...w.electronAPI,
    isMobile: true,
    fileUrl: (p: string) => `http://127.0.0.1:${port}/f?p=${encodeURIComponent(p)}`,
  };

  (async () => {
    try {
      const info = await ClipForge.info();
      await NodeJS.whenReady();
      NodeJS.addListener('ready', (e: any) => { port = e.args[0].port; setReady!(); });
      sendNode('init', info);
    } catch (err) { console.error('ClipForge boot failed', err); }
  })();
})();
