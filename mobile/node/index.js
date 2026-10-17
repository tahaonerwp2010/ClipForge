// ClipForge for Android – Node side. Runs the SAME engine and the SAME main.cjs as the desktop app;
// only the 'electron' module is replaced by a small shim that talks to the phone through the Capacitor bridge.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { channel, getDataPath } = require('bridge');

global.__cfMobile = true;
const PROJECT = __dirname;
const handlers = new Map(), onHandlers = new Map();
const pending = new Map();
let rid = 0, PORT = 0, CTX = null;
const logf = (...a) => { try { channel.send('log', a.map(String).join(' ')); } catch {} };
process.on('uncaughtException', e => logf('uncaught', e && e.stack || e));
process.on('unhandledRejection', e => logf('unhandled', e && e.stack || e));

// ---------- files -> http (the WebView cannot open file:// from its own origin) ----------
const MIME = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json', html: 'text/html', js: 'text/javascript' };
const roots = () => [CTX.filesDir, CTX.extDir, CTX.cacheDir, os.tmpdir(), PROJECT].filter(Boolean).map(r => path.resolve(r) + path.sep);
function startServer() {
  const srv = http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length' };
    try {
      const u = new URL(req.url, 'http://x'); const p = path.resolve(u.searchParams.get('p') || '');
      if (!roots().some(r => (p + path.sep).startsWith(r)) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404, cors); return res.end(); }
      const size = fs.statSync(p).size, type = MIME[path.extname(p).slice(1).toLowerCase()] || 'application/octet-stream';
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        let a = m[1] === '' ? Math.max(0, size - +m[2]) : +m[1], b = m[1] !== '' && m[2] !== '' ? Math.min(+m[2], size - 1) : size - 1;
        if (a > b || a >= size) { res.writeHead(416, { ...cors, 'Content-Range': `bytes */${size}` }); return res.end(); }
        res.writeHead(206, { ...cors, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Cache-Control': 'no-cache' });
        fs.createReadStream(p, { start: a, end: b }).on('error', () => res.destroy()).pipe(res);
      } else {
        res.writeHead(200, { ...cors, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size, 'Cache-Control': 'no-cache' });
        fs.createReadStream(p).on('error', () => res.destroy()).pipe(res);
      }
    } catch { res.writeHead(500, cors); res.end(); }
  });
  return new Promise((ok) => {
    const tryPort = (port) => { srv.once('error', () => { if (port) tryPort(0); }); srv.listen(port, '127.0.0.1', () => { PORT = srv.address().port; ok(); }); };
    tryPort(47821);                                           // fixed on purpose: saved projects keep their video links across restarts
  });
}
const urlFor = (p) => `http://127.0.0.1:${PORT}/f?p=${encodeURIComponent(p)}`;
const fromFileUrl = (u) => { try { return decodeURIComponent(new URL(u).pathname); } catch { return u.replace(/^file:\/\//, ''); } };
// every file:// link going to the screen becomes an http link
function deep(v) {
  if (typeof v === 'string') return v.startsWith('file://') ? urlFor(fromFileUrl(v)) : v;
  if (Array.isArray(v)) return v.map(deep);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) { const o = {}; for (const k in v) o[k] = deep(v[k]); return o; }
  return v;
}

// ---------- ask the phone (WebView / Java) for something ----------
function ask(method, args) {
  return new Promise((resolve, reject) => { const id = ++rid; pending.set(id, { resolve, reject }); channel.send('req', { id, method, args: args || {} }); });
}
channel.addListener('req-result', (m) => { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.ok ? p.resolve(m.value) : p.reject(new Error(m.error || 'failed')); });
const nativeEvents = new EventEmitter();
channel.addListener('native-event', (name, data) => nativeEvents.emit(name, data));

// ---------- the electron look-alike ----------
const LONG = new Set(['start-pipeline', 'yt-download', 'download-model', 'edit-render', 'update-download', 'sync-videos']);
let busy = 0;
const setBusy = (d) => { const was = busy > 0; busy = Math.max(0, busy + d); if ((busy > 0) !== was) channel.send('busy', busy > 0); };
const ipcMain = {
  handle: (ch, fn) => handlers.set(ch, fn),
  on: (ch, fn) => onHandlers.set(ch, fn),
  removeHandler: (ch) => handlers.delete(ch),
};
let mainWin = null;
class WebContents extends EventEmitter {
  constructor(hidden) { super(); this.hidden = hidden; }
  send(ch, data) { if (!this.hidden) channel.send('ev', ch, deep(data)); }
  setWindowOpenHandler() {} toggleDevTools() {} reload() {} isDestroyed() { return false; }
  async executeJavaScript(code) {
    code = String(code).replace(/"(file:\/\/\/[^"]+)"/g, (m, u) => JSON.stringify(urlFor(fromFileUrl(u))));
    return ask('faceRun', { code });
  }
}
class BrowserWindow extends EventEmitter {
  constructor(o = {}) { super(); this.webContents = new WebContents(o.show === false); if (o.show !== false) mainWin = this; }
  loadFile() { return Promise.resolve(); } loadURL() { return Promise.resolve(); }
  isDestroyed() { return false; } destroy() {} close() {} minimize() {} maximize() {} unmaximize() {} isMaximized() { return false; }
  static getAllWindows() { return mainWin ? [mainWin] : []; }
}
const appEv = new EventEmitter();
const app = Object.assign(appEv, {
  isPackaged: true,
  getPath: (n) => ({ userData: CTX.userData, downloads: path.join(CTX.extDir, 'Download'), videos: path.join(CTX.extDir, 'Videos'), documents: path.join(CTX.extDir, 'Documents'), temp: os.tmpdir(), home: CTX.extDir })[n] || CTX.userData,
  getAppPath: () => PROJECT, getVersion: () => CTX.version, getName: () => 'ClipForge',
  whenReady: () => Promise.resolve(), quit() {}, exit() {}, setAppUserModelId() {}, commandLine: { appendSwitch() {} },
  getGPUInfo: () => Promise.reject(new Error('n/a')),
});
const shell = {
  openExternal: (u) => ask('openExternal', { url: u }),
  async openPath(p) {
    try {
      if (/\.apk$/i.test(p)) { await ask('installApk', { path: p }); return ''; }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) { await exportDir(p); return ''; }
      await ask('exportFile', { path: p }); return '';
    } catch (e) { return String(e.message || e); }
  },
  async showItemInFolder(p) { try { await ask('exportFile', { path: p }); } catch (e) { logf('export', e.message); } },
};
// "Open folder" / "Show in folder" on a phone = save the clips to the gallery (Movies/ClipForge)
const expFile = () => path.join(CTX.userData, 'exported.json');
async function exportDir(dir) {
  let done = {}; try { done = JSON.parse(fs.readFileSync(expFile(), 'utf8')); } catch {}
  const files = fs.readdirSync(dir).filter(f => /\.(mp4|mov|mkv)$/i.test(f) && !f.startsWith('.'));
  let n = 0;
  for (const f of files) {
    const full = path.join(dir, f), key = full + '|' + fs.statSync(full).mtimeMs;
    if (done[full] === key) continue;
    await ask('exportFile', { path: full, quiet: true }); done[full] = key; n++;
  }
  try { fs.writeFileSync(expFile(), JSON.stringify(done)); } catch {}
  await ask('toast', { text: n ? `${n} clip${n > 1 ? 's' : ''} saved to Movies/ClipForge` : 'All clips are already in your gallery (Movies/ClipForge)' });
}
const dialog = {
  async showOpenDialog(win, o) {
    if (!o) { o = win; }
    const props = (o && o.properties) || [], f = ((o && o.filters) || [])[0];
    if (props.includes('openDirectory')) { await ask('toast', { text: 'Choosing folders is not available on Android. The default folder is used.' }); return { canceled: true, filePaths: [] }; }
    const kind = f ? (/font/i.test(f.name) ? 'font' : /audio/i.test(f.name) ? 'audio' : /image/i.test(f.name) ? 'image' : 'video') : 'video';
    const r = await ask('pick', { kind, multiple: props.includes('multiSelections') });
    const files = (r && r.files || []).map(x => x.path);
    return files.length ? { canceled: false, filePaths: files } : { canceled: true, filePaths: [] };
  },
};
const electron = { app, BrowserWindow, ipcMain, shell, dialog, ipcRenderer: undefined };
const origLoad = Module._load;
Module._load = function (request, ...rest) { return request === 'electron' ? electron : origLoad.call(this, request, ...rest); };

// ---------- yt-dlp lives in the native side: look like a child process ----------
let ytSeq = 0;
global.__cfMobileInitYt = () => ask('ytInit');
global.__cfMobileSpawn = (cmd, args) => {
  const id = 'yt' + (++ytSeq) + '_' + Date.now();
  const p = new EventEmitter(); p.stdout = new PassThrough(); p.stderr = new PassThrough(); p.pid = 0; let ended = false;
  const lineH = (d) => { if (d.id === id) p.stdout.write(d.line + '\n'); };
  const errH = (d) => { if (d.id === id) p.stderr.write(d.line + '\n'); };
  nativeEvents.on('ytLine', lineH); nativeEvents.on('ytErr', errH);
  const fin = (code) => { if (ended) return; ended = true; nativeEvents.off('ytLine', lineH); nativeEvents.off('ytErr', errH); p.stdout.end(); p.stderr.end(); setImmediate(() => p.emit('close', code)); };
  p.kill = () => { ask('ytKill', { id }).catch(() => {}); fin(null); };
  ask('ytRun', { id, args: args.slice() }).then((r) => { if (r && r.err) p.stderr.write(String(r.err) + '\n'); fin(r && r.code != null ? r.code : 0); }, (e) => { p.stderr.write(String(e.message || e) + '\n'); fin(1); });
  return p;
};

// ---------- messages from the screen ----------
channel.addListener('ipc', async (m) => {
  const { id, ch, args = [] } = m;
  const h = handlers.get(ch);
  if (!h) return channel.send('ipc-result', { id, ok: false, error: 'No handler for ' + ch });
  const long = LONG.has(ch); if (long) setBusy(1);
  try { const v = await h({ sender: mainWin && mainWin.webContents }, ...args); channel.send('ipc-result', { id, ok: true, value: deep(v === undefined ? null : v) }); }
  catch (e) { channel.send('ipc-result', { id, ok: false, error: String(e && e.message || e) }); }
  finally { if (long) setBusy(-1); }
});
channel.addListener('ipc-send', (m) => { const h = onHandlers.get(m.ch); if (h) try { h({}, ...(m.args || [])); } catch {} });

// ---------- start ----------
channel.addListener('init', async (c) => {
  if (CTX) return;
  CTX = c; CTX.version = c.version || '0.0.0';
  CTX.userData = path.join(c.filesDir, 'ClipForge'); fs.mkdirSync(CTX.userData, { recursive: true });
  if (c.androidId && c.androidId !== 'null') process.env.CF_MACHINE_ID = 'android:' + c.androidId;
  process.env.HOME = c.extDir; process.env.TMPDIR = c.cacheDir;
  const Paths = require(path.join(PROJECT, 'electron', 'engine', 'paths.cjs'));
  Paths.configure({ userData: CTX.userData, appPath: PROJECT, resourcesPath: '', nativeLibDir: c.nativeLibDir });
  // clips go to the app's public folder (visible in the file manager); the gallery copy is made with "Open folder"
  try { fs.mkdirSync(path.join(c.extDir, 'ClipForge'), { recursive: true }); } catch {}
  await startServer();
  try { require(path.join(PROJECT, 'electron', 'main.cjs')); } catch (e) { logf('main failed', e && e.stack || e); }
  channel.send('ready', { port: PORT, handlers: [...handlers.keys()].length });
});
channel.send('boot');
