/**
 * ClipForge Desktop - Electron Main Process
 * This file turns the React web app into a standalone Windows .exe application.
 * It manages downloading Whisper AI models (Hugging Face) and running local FFmpeg binaries.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');

const Paths = require('./engine/paths.cjs');
const { killAll, resetCancel } = require('./engine/proc.cjs');
const { runPipeline, workDirFor } = require('./engine/pipeline.cjs');
const R = require('./engine/render.cjs');
const Settings = require('./engine/settings.cjs');
const AI = require('./engine/ai.cjs');

let mainWindow;
let askedClose = false;
const send = (ch, data) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(ch, data); };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#07100c',
    icon: appIcon(),
    title: 'ClipForge by taha.ai',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  // The inspector (F12 / Ctrl+Shift+I) is for development only. In the installed app it stays closed, unless it is started with --devtools.
  const allowDev = !app.isPackaged || process.argv.includes('--devtools');
  if (!allowDev) { try { require('electron').Menu.setApplicationMenu(null); } catch {} }   // the default menu would also open it
  // Closing the window while a project is being made would stop it: ask first (the progress is kept either way and can be resumed)
  mainWindow.on('close', (e) => {
    if (forceQuit || !(currentRun || editJob)) return;
    e.preventDefault();
    if (askedClose) return; askedClose = true;
    dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Keep working', 'Close and stop'], defaultId: 0, cancelId: 0, noLink: true, title: 'ClipForge is still working',
      message: 'A project is still being processed.', detail: 'If you close ClipForge now the work stops. Everything finished so far is kept, and you can resume the project later from where it stopped.' })
      .then(r => { askedClose = false; if (r.response === 1) { forceQuit = true; try { mainWindow.close(); } catch {} } })
      .catch(() => { askedClose = false; });
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDev = input.key === 'F12' || (input.control && input.shift && String(input.key).toLowerCase() === 'i');
    if (!isDev) return;
    if (allowDev) mainWindow.webContents.toggleDevTools(); else event.preventDefault();
  });

  // If the window freezes or its process dies, offer a reload instead of leaving the app stuck (progress is kept in the project files)
  let askedFreeze = false;
  mainWindow.webContents.on('unresponsive', () => {
    if (askedFreeze) return; askedFreeze = true;
    setTimeout(async () => {
      try {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const r = await dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Reload ClipForge', 'Keep waiting'], defaultId: 0, cancelId: 1, title: 'ClipForge is not responding', message: 'ClipForge stopped responding.', detail: 'Reloading usually fixes it. Your finished clips and projects are not affected.' });
        if (r.response === 0 && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
      } catch {}
      askedFreeze = false;
    }, 6000);
  });
  mainWindow.webContents.on('responsive', () => { askedFreeze = false; });
  mainWindow.webContents.on('render-process-gone', (e, d) => {
    console.error('ClipForge window process ended:', d && d.reason);
    if (d && d.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) setTimeout(() => { try { mainWindow.webContents.reload(); } catch {} }, 500);
  });
  // Log render crashes or loading failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`ClipForge window failed to load [${errorCode}]: ${errorDescription} at ${validatedURL}`);
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      loadProductionBuild();
    });
  } else {
    loadProductionBuild();
  }

  function loadProductionBuild() {
    const candidates = [
      path.join(__dirname, '../dist/index.html'),
      path.join(__dirname, 'dist/index.html'),
      path.join(app.getAppPath(), 'dist/index.html'),
      path.join(process.resourcesPath || '', 'app.asar/dist/index.html')
    ];

    let foundTarget = null;
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        foundTarget = cand;
        break;
      }
    }

    if (foundTarget) {
      mainWindow.loadFile(foundTarget).catch((err) => {
        console.error('loadFile error, attempting file url:', err);
        mainWindow.loadURL(`file://${foundTarget}`);
      });
    } else {
      // Graceful error UI if build files are missing instead of black blank screen
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ClipForge Desktop - Build Required</title>
            <style>
              body {
                background: #0d0f12;
                color: #f3f4f6;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                padding: 24px;
                box-sizing: border-box;
              }
              .box {
                background: #161b22;
                border: 1px solid #30363d;
                border-radius: 12px;
                padding: 36px;
                max-width: 580px;
                box-shadow: 0 12px 36px rgba(0,0,0,0.6);
              }
              h2 { color: #a3e635; margin-top: 0; font-size: 22px; }
              code { background: #000; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; }
              p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>⚡ ClipForge Desktop Initializer</h2>
              <p>Frontend production bundle (<code>dist/index.html</code>) was not detected yet.</p>
              <p>Please run the build command in your terminal before launching:</p>
              <p><code>npm run build</code></p>
              <p style="margin-top: 18px; color: #64748b; font-size: 12px;">Then run <code>npm run electron:dev</code> or <code>npm run build:exe</code>.</p>
            </div>
          </body>
        </html>
      `));
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// window / taskbar icon: loaded from the real resources folder (native code cannot read files inside app.asar)
function appIcon() {
  const c = [path.join(process.resourcesPath || '', 'icon.png'), path.join(__dirname, '..', 'assets', 'icons', 'icon.png')];
  return c.find(f => { try { return fs.existsSync(f) && !/app\.asar/.test(f); } catch { return false; } }) || c[1];
}
if (process.platform === 'win32') app.setAppUserModelId('com.clipforge.desktop');
app.commandLine.appendSwitch('disable-accelerated-video-decode');   // some graphics drivers (older Intel) show black or colour-garbled frames in <video>; the picture is decoded by the processor instead (preview size only)
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');   // AppImage on newer Ubuntu blocks the sandbox
// Blank / white window protection: if the browser's graphics process crashes, the next start runs without GPU drawing (the flag is a small file).
const gpuFlag = () => path.join(app.getPath('userData'), 'gpu-off.flag');
try { if (fs.existsSync(gpuFlag())) app.disableHardwareAcceleration(); } catch {}
app.on('child-process-gone', (e, d) => {
  try { if (d && d.type === 'GPU' && d.reason !== 'clean-exit') { fs.writeFileSync(gpuFlag(), String(Date.now())); if (mainWindow && !mainWindow.isDestroyed()) setTimeout(() => { try { mainWindow.webContents.reload(); } catch {} }, 800); } } catch {}
});
app.whenReady().then(() => {
  Paths.configure({ userData: app.getPath('userData'), appPath: app.getAppPath(), resourcesPath: process.resourcesPath || '' });
  Paths.setModelsDir(Settings.load().modelsDir);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let forceQuit = false;
app.on('before-quit', () => { forceQuit = true; global.__cfQuitting = true; try { killAll(); } catch {} });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Whisper model download (follows HuggingFace redirects, writes .part then renames) ----
const MODEL_URLS = {
  'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'medium': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  'large-v3-turbo': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
  'aligner': 'https://huggingface.co/Xenova/wav2vec2-base-960h/resolve/main/onnx/model_quantized.onnx'   // caption sync (word-level alignment)
};
const mfile = (id) => id === 'aligner' ? require('./engine/align.cjs').modelPath() : Paths.modelFile(id);
function fetchToFile(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error('Too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'ClipForge' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(fetchToFile(new URL(res.headers.location, url).toString(), dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Download failed: HTTP ${res.statusCode}`)); }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let done = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (c) => { done += c.length; onProgress(done, total); });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Fast download: the file is fetched in several pieces at once (Range requests), so it uses all of the connection's speed instead of one slow stream.
// ctl.cancel() stops it at once. Falls back to one stream when the server does not support ranges.
async function fastDownload(url, dest, onProgress, ctl, parts = 8) {
  const agent = new https.Agent({ keepAlive: true, maxSockets: 16 });
  const reqs = new Set(); let cancelled = false;
  ctl.cancel = () => { cancelled = true; for (const r of reqs) { try { r.destroy(); } catch {} } };
  const probe = (u, redirects = 0) => new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error('Too many redirects'));
    const r = https.get(u, { agent, headers: { 'User-Agent': 'ClipForge', Range: 'bytes=0-0' } }, (res) => {
      res.resume();
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) return resolve(probe(new URL(res.headers.location, u).toString(), redirects + 1));
      if (res.statusCode === 206) { const m = /\/(\d+)$/.exec(String(res.headers['content-range'] || '')); return resolve({ url: u, total: m ? parseInt(m[1], 10) : 0, ranged: !!m }); }
      resolve({ url: u, total: parseInt(res.headers['content-length'] || '0', 10), ranged: false });
    }); reqs.add(r); r.on('error', reject);
  });
  const info = await probe(url);
  if (cancelled) throw new Error('CANCELLED');
  const fh = await fs.promises.open(dest, 'w');
  let done = 0, last = 0;
  const tick = (n) => { done += n; const now = Date.now(); if (now - last > 150) { last = now; onProgress(done, info.total); } };
  // One request for the byte range [from, to] (to = -1: until the end). Every received piece gets its own file position the moment it arrives and
  // we wait for ALL of its writes before returning, so a dropped connection + retry can never write over or skip bytes (that corrupted the installer).
  const fetchRange = (from, to) => new Promise((resolve, reject) => {
    let got = 0, failed = false; const writes = [];
    const fail = (e) => { if (!failed) { failed = true; done = Math.max(0, done - got); reject(e); } };
    const hdr = { 'User-Agent': 'ClipForge' }; if (to >= 0) hdr.Range = `bytes=${from}-${to}`;
    const r = https.get(info.url, { agent, headers: hdr }, (res) => {
      if (res.statusCode !== (to >= 0 ? 206 : 200)) { res.resume(); return fail(new Error(`Download failed: HTTP ${res.statusCode}`)); }
      res.on('data', (b) => { const at = from + got; got += b.length; tick(b.length); writes.push(fh.write(b, 0, b.length, at)); if (writes.length > 64) { res.pause(); Promise.all(writes.splice(0)).then(() => res.resume(), fail); } });
      res.on('end', () => Promise.all(writes).then(() => resolve(got), fail));
      res.on('aborted', () => fail(new Error('Connection lost')));
      res.on('error', fail);
      res.on('close', () => { if (!res.complete) fail(new Error('Connection lost')); });
    }); reqs.add(r); r.on('error', fail);
  });
  try {
    if (!parts || !info.ranged || !info.total || info.total < 8e6) {
      const got = await fetchRange(0, -1);
      if (info.total && got !== info.total) throw new Error(`Download incomplete (${got} of ${info.total} bytes)`);
    } else {
      const size = Math.ceil(info.total / (parts * 4)), chunks = []; for (let s0 = 0; s0 < info.total; s0 += size) chunks.push([s0, Math.min(info.total - 1, s0 + size - 1)]);
      let next = 0;
      const worker = async () => {
        while (!cancelled) {
          const c = chunks[next++]; if (!c) return;
          let tries = 0;
          for (;;) {                                           // a failed piece is fetched again from its own start, so a half-received piece can never leave a hole
            try { const got = await fetchRange(c[0], c[1]); if (got !== c[1] - c[0] + 1) throw new Error('Short piece'); break; }
            catch (e) { if (cancelled) return; if (++tries > 5) throw e; done = Math.max(0, done); await new Promise(r => setTimeout(r, 800 * tries)); }
          }
        }
      };
      await Promise.all(Array.from({ length: parts }, worker));
    }
  } finally { try { await fh.close(); } catch {} agent.destroy(); }
  if (cancelled) { try { fs.unlinkSync(dest); } catch {} throw new Error('CANCELLED'); }
  onProgress(info.total || done, info.total || done);
  return info.total || 0;
}
let updateDl = null;
ipcMain.handle('update-cancel', async () => { if (updateDl) { try { updateDl.cancel(); } catch {} } return true; });
ipcMain.handle('model-status', async () => {
  const out = {};
  for (const id of Object.keys(MODEL_URLS)) {
    const f = mfile(id);
    let size = 0; try { size = fs.statSync(f).size; } catch {}
    out[id] = { exists: size > 0, size };
  }
  return out;
});
const MIN_SIZE = { small: 480e6, medium: 1.5e9, 'large-v3-turbo': 1.6e9, aligner: 90e6 };
ipcMain.handle('verify-model', async (e, { modelId }) => {
  const f = mfile(modelId), dir = Paths.modelsDir();
  if (!MODEL_URLS[modelId]) return { ok: false, message: 'Unknown model.' };
  if (!fs.existsSync(f)) return { ok: false, missing: true, dir, message: `Not downloaded. This model was not found in your models folder (${dir}).` };
  const size = fs.statSync(f).size;
  if (size < MIN_SIZE[modelId] * 0.98) return { ok: false, broken: true, size, dir, message: `Incomplete download (${(size / 1e6).toFixed(0)} MB). Delete it and download again.` };
  const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(4); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd);
  if (modelId === 'aligner' ? b[0] !== 0x08 : b.toString('latin1') !== 'lmgg') return { ok: false, broken: true, size, dir, message: 'The file is corrupted (invalid header). Delete it and download again.' };
  return { ok: true, size, dir, message: `Downloaded and working (${(size / 1e6).toFixed(0)} MB) in ${dir}.` };
});
ipcMain.handle('delete-model', async (e, { modelId }) => {
  if (!MODEL_URLS[modelId]) return false;
  for (const f of [mfile(modelId), mfile(modelId) + '.part']) { try { fs.unlinkSync(f); } catch {} }
  return true;
});
const folderInfo = () => ({ modelsDir: Paths.modelsDir(), clipsDir: Settings.clipsDir(), defaultModelsDir: Paths.defaultModelsDir(), defaultClipsDir: Settings.defaultClipsDir(), ytDir: Settings.ytDir(), defaultYtDir: Settings.defaultYtDir() });
ipcMain.handle('get-folders', async () => folderInfo());
ipcMain.handle('choose-folder', async (e, { kind, reset }) => {
  let dir = '';
  if (!reset) {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], defaultPath: kind === 'models' ? Paths.modelsDir() : kind === 'youtube' ? Settings.ytDir() : Settings.clipsDir() });
    if (r.canceled) return folderInfo();
    dir = r.filePaths[0];
  }
  if (kind === 'models') { Settings.save({ modelsDir: dir }); Paths.setModelsDir(dir); }
  else if (kind === 'youtube') Settings.save({ ytDir: dir });
  else Settings.save({ clipsDir: dir });
  return folderInfo();
});
ipcMain.handle('save-clip-sheet', async (e, { dir, rows }) => {
  const X = require('./engine/xlsx.cjs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'clips_title_description.xlsx');
  fs.writeFileSync(file, X.build(rows, [18, 48, 70, 48]));
  return file;
});
ipcMain.handle('open-folder', async (e, p, projectId) => {
  if (projectId != null) {                                      // a project's own clips folder: it must still exist and still belong to THIS project
    if (!fs.existsSync(p)) return 'MISSING';
    try { const m = JSON.parse(fs.readFileSync(path.join(p, '.clipforge.json'), 'utf8')).projectId; if (m != null && String(m) !== String(projectId)) return 'OTHER'; } catch {}
    return shell.openPath(p);
  }
  try { fs.mkdirSync(p, { recursive: true }); } catch {} return shell.openPath(p);
});
ipcMain.handle('stock-test', async (e, a) => require('./engine/stock.cjs').test(a.provider, a.key));
ipcMain.handle('ai-test', async (e, a) => AI.test(a));
ipcMain.handle('ai-ping', async (e, a) => AI.ping(a));
ipcMain.handle('ai-list-models', async (e, a) => AI.listModels(a));
ipcMain.handle('hw-info', async () => { try { return await require('./engine/hardware.cjs').info(); } catch { return { encoder: null, speechGpu: false }; } });
ipcMain.handle('engine-status', async () => ({
  ffmpeg: !!Paths.resolveBin('ffmpeg'), whisper: !!(Paths.resolveBin('whisper-cli') || Paths.resolveBin('main')),
}));

const activeDl = new Map();                      // one download per model: a second click joins the first instead of starting a parallel one (two streams into the same file made the % jump back and forth)
ipcMain.handle('download-model', async (event, { modelId }) => {
  const url = MODEL_URLS[modelId];
  if (!url) throw new Error(`Unknown model: ${modelId}`);
  if (activeDl.has(modelId)) return activeDl.get(modelId);
  const job = (async () => {
    fs.mkdirSync(Paths.modelsDir(), { recursive: true });
    const finalPath = mfile(modelId), tmp = finalPath + '.part';
    let last = -1;
    try {
      await fetchToFile(url, tmp, (downloadedBytes, totalBytes) => {
        const progress = totalBytes ? Math.round(downloadedBytes / totalBytes * 100) : 0;
        if (progress < last) return;               // never go backwards
        last = progress;
        send('download-progress', { modelId, progress, downloadedBytes, totalBytes });
      });
      fs.renameSync(tmp, finalPath);
      return { success: true, filePath: finalPath };
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {}
      throw e;
    }
  })();
  activeDl.set(modelId, job);
  try { return await job; } finally { activeDl.delete(modelId); }
});

// ---- Real file picker (gives a real disk path; blob: URLs can't be read by ffmpeg) ----
ipcMain.handle('pick-video', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('pick-videos', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
// ---- Projects list (kept on disk between sessions) ----
const projectsFile = () => path.join(app.getPath('userData'), 'projects.json');
// Small settings kept in a real file next to the projects, so they survive even if the browser storage of the window is ever reset (e.g. API keys).
const kvFile = (n) => path.join(app.getPath('userData'), 'kv_' + String(n).replace(/[^\w\-]/g, '_') + '.json');
// Three copies of every small setting: the main file, a .bak, and one outside the app's data folder (so a changed/cleaned data folder cannot lose the API keys).
const kvSpare = (n) => path.join(os.homedir(), '.clipforge', 'kv_' + String(n).replace(/[^\w\-]/g, '_') + '.json');
const kvRead = (n) => { for (const f of [kvFile(n), kvFile(n) + '.bak', kvSpare(n)]) { try { const v = JSON.parse(fs.readFileSync(f, 'utf8')); if (v != null) return v; } catch {} } return null; };
const kvWrite = (n, val) => {
  let ok = false; const t = JSON.stringify(val);
  try { const f = kvFile(n); fs.mkdirSync(path.dirname(f), { recursive: true }); try { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak'); } catch {} fs.writeFileSync(f + '.tmp', t); fs.renameSync(f + '.tmp', f); ok = true; } catch {}
  try { const g = kvSpare(n); fs.mkdirSync(path.dirname(g), { recursive: true }); fs.writeFileSync(g, t); ok = true; } catch {}
  return ok;
};
ipcMain.handle('kv-load', async (e, name) => kvRead(name));
ipcMain.handle('kv-save', async (e, name, val) => kvWrite(name, val));
// Synchronous versions: the window reads/writes keys without waiting, so nothing is lost if the app is closed right after a change.
ipcMain.on('kv-load-sync', (e, name) => { e.returnValue = kvRead(name); });
ipcMain.on('kv-save-sync', (e, name, val) => { e.returnValue = kvWrite(name, val); });
ipcMain.handle('projects-load', async () => { try { return JSON.parse(fs.readFileSync(projectsFile(), 'utf8')); } catch { return []; } });
ipcMain.handle('projects-save', async (e, list) => { try { const f = projectsFile(); fs.writeFileSync(f + '.tmp', JSON.stringify(list)); fs.renameSync(f + '.tmp', f); return true; } catch { return false; } });
// ---- Edit a finished clip (captions + hook only) ----
const EDIT = require('./engine/edit.cjs');
ipcMain.handle('edit-load', async (e, outDir) => { const st = EDIT.loadState(outDir); return st ? { ok: true, captions: st.captions, branding: st.branding, framing: st.framing, grading: st.grading, ratio: st.ratio, clips: st.clips.map(c => ({ hookText: c.hookText, title: c.title })) } : { ok: false }; });
ipcMain.handle('make-still', async (e, srcPath) => {
  try { if (!editJob && !currentRun) resetCancel(); return { ok: true, path: await R.stillOf(String(srcPath), path.join(app.getPath('userData'), 'previews')) }; }
  catch (err) { return { ok: false, path: null, error: String(err.message || err).slice(0, 200) }; }
});
ipcMain.handle('make-preview', async (e, srcPath, force, checkOnly, startPct) => {
  const go = () => R.previewMake(String(srcPath), path.join(app.getPath('userData'), 'previews'), !!force, !!checkOnly, typeof startPct === 'number' ? startPct : null);
  try {
    if (!editJob && !currentRun) resetCancel();      // an old "cancel" must never block the preview (every ffmpeg call fails right away while the flag is set)
    const r0 = await go(); if (r0 === 'needed') return { ok: true, need: true, path: null };
    return r0 ? { ok: true, path: r0.path, sample: r0.sample } : { ok: true, path: null };
  } catch (err) {
    const m = String(err.message || err);
    if (/CANCELLED/.test(m) && !editJob && !currentRun) { try { resetCancel(); const r1 = await go(); return { ok: true, path: r1 && r1.path, sample: r1 && r1.sample }; } catch (e2) { return { ok: false, path: null, error: String(e2.message || e2).slice(0, 400) }; } }
    return { ok: false, path: null, error: m.slice(0, 400) };
  }
});
ipcMain.handle('edit-prepare', async (e, a) => { try { if (!editJob && !currentRun) resetCancel(); /* an old "cancel" flag makes every ffmpeg call fail with CANCELLED */ let r; try { r = await EDIT.prepare(a.outDir, a.index); } catch (e1) { if (/CANCELLED/.test(String(e1.message || e1)) && !editJob && !currentRun) { resetCancel(); r = await EDIT.prepare(a.outDir, a.index); } else throw e1; } return { ok: true, url: require('url').pathToFileURL(r.base).toString(), dims: r.dims, footage: r.footage || null }; } catch (err) { return { ok: false, error: String(err.message || err).slice(0, 300) }; } });
// ---- Edit many clips as one background job (progress events go to the screen; pause / resume / cancel) ----
let editJob = null;
ipcMain.handle('edit-batch-start', async (e, a) => {
  if (editJob) return { ok: false, error: 'An edit is already running.' };
  const ctl = { paused: false, cancel: false }; editJob = { ctl, outDir: a.outDir };
  resetCancel();
  const deps = { segment: (frames) => require('./engine/facetrack.cjs').segmentFrames(frames, { BrowserWindow }), detectFaces: (frames) => require('./engine/facetrack.cjs').detectFaces(frames, { BrowserWindow }) };
  EDIT.rerenderBatch(a.outDir, a.items || [], { hardware: a.hardware, deps, ctl, onEvent: (o) => send('edit-batch', { ...o, outDir: a.outDir }) })
    .catch(err => send('edit-batch', { type: 'error', error: String((err && err.message) || err).slice(0, 300), outDir: a.outDir }))
    .finally(() => { editJob = null; });
  return { ok: true };
});
ipcMain.handle('edit-batch-pause', async () => { if (!editJob) return false; editJob.ctl.paused = true; killAll(); return true; });
ipcMain.handle('edit-batch-resume', async () => { if (!editJob) return false; resetCancel(); editJob.ctl.paused = false; return true; });
ipcMain.handle('edit-batch-cancel', async () => { if (!editJob) return false; editJob.ctl.cancel = true; editJob.ctl.paused = false; killAll(); return true; });
ipcMain.handle('edit-cancel', async () => { killAll(); return true; });
ipcMain.handle('edit-render', async (e, a) => { resetCancel(); try { const r = await EDIT.rerender(a.outDir, a.index, a.overrides || {}, p => send('edit-progress', { index: a.index, p }), { segment: (frames) => require('./engine/facetrack.cjs').segmentFrames(frames, { BrowserWindow }), detectFaces: (frames) => require('./engine/facetrack.cjs').detectFaces(frames, { BrowserWindow }) }); return { ok: true, ...r }; } catch (err) { if (/CANCELLED/.test(String(err.message || err))) return { ok: false, cancelled: true }; return { ok: false, error: String(err.message || err).slice(0, 300) }; } });
// ---- Pro licence (Supabase) ----
const LIC = require('./engine/license.cjs');
ipcMain.handle('license-status', async (e, o) => LIC.status(o));
ipcMain.handle('license-register', async () => LIC.register());
ipcMain.handle('license-gumroad-activate', async (e, key) => { try { return await LIC.gumroadActivate(key); } catch (err) { return { ok: false, error: String(err.message || err).slice(0, 160) }; } });
ipcMain.handle('license-gumroad-remove', async () => { try { return await LIC.gumroadRemove(); } catch (err) { return { ok: false, error: String(err.message || err).slice(0, 160) }; } });
ipcMain.handle('owner-check', async (e, pw) => LIC.owner.check(pw));
ipcMain.handle('owner-lookup', async (e, a) => LIC.owner.lookup(a.pw, a.id));
ipcMain.handle('owner-suggest', async (e, a) => LIC.owner.suggest(a.pw, a.q));
ipcMain.handle('owner-grant', async (e, a) => LIC.owner.grant(a.pw, a.id, a.plan));
ipcMain.handle('owner-remove', async (e, a) => LIC.owner.remove(a.pw, a.id));
// ---- Fonts & images chosen by the user ----
const Fonts = require('./engine/fonts.cjs');
ipcMain.handle('list-user-fonts', async () => Fonts.userFonts().map(f => ({ ...f, cell: f.cell || (() => { try { return Fonts.readCell(fs.readFileSync(path.join(Fonts.userDir(), f.file))); } catch { return null; } })(), url: require('url').pathToFileURL(path.join(Fonts.userDir(), f.file)).toString() })));
ipcMain.handle('import-font', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Fonts', extensions: ['ttf', 'otf'] }] });
  if (r.canceled) return [];
  fs.mkdirSync(Fonts.userDir(), { recursive: true });
  const list = Fonts.userFonts();
  for (const src of r.filePaths) {
    const buf = fs.readFileSync(src);
    const family = Fonts.readFamily(buf) || path.basename(src, path.extname(src));
    const file = path.basename(src);
    fs.writeFileSync(path.join(Fonts.userDir(), file), buf);
    if (!list.some(f => f.family === family)) list.push({ family, file, cell: Fonts.readCell(buf) });
  }
  fs.writeFileSync(path.join(Fonts.userDir(), 'fonts.json'), JSON.stringify(list));
  return Fonts.userFonts().map(f => ({ ...f, url: require('url').pathToFileURL(path.join(Fonts.userDir(), f.file)).toString() }));
});
ipcMain.handle('remove-user-font', async (e, family) => {
  const list = Fonts.userFonts(); const hit = list.find(f => f.family === family);
  if (hit) { try { fs.unlinkSync(path.join(Fonts.userDir(), hit.file)); } catch {} }
  fs.writeFileSync(path.join(Fonts.userDir(), 'fonts.json'), JSON.stringify(list.filter(f => f.family !== family)));
  return true;
});
ipcMain.handle('pick-audio', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus', 'wma'] }] });
  if (r.canceled) return null;
  return { path: r.filePaths[0], name: path.basename(r.filePaths[0]), url: require('url').pathToFileURL(r.filePaths[0]).toString() };
});
ipcMain.handle('pick-image', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'jfif', 'webp'] }] });
  if (r.canceled) return null;
  const p = r.filePaths[0], ext = path.extname(p).toLowerCase().slice(1);
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { path: p, name: path.basename(p), dataUrl: `data:${mime};base64,${fs.readFileSync(p).toString('base64')}` };
});
ipcMain.handle('yt-download', async (e, { url }) => {
  const Y = require('./engine/yt.cjs');
  try {
    const r = await Y.download(url, Settings.ytDir(), (p) => send('yt-progress', p));
    return { ok: true, ...r };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('yt-cancel', async () => { require('./engine/yt.cjs').cancel(); return true; });
// ---- Split screen helpers: find the facecam in a recording / line up two recordings ----
ipcMain.handle('detect-facecam', async (e, { filePath }) => {
  const FC = require('./engine/facecam.cjs');
  const work = path.join(Paths.workRoot(), 'facecam_probe');
  try {
    const info = await R.probe(filePath);
    const smp = await FC.sample(filePath, info.duration, work, 12);
    const frameFile = smp.frames[Math.floor(smp.frames.length / 2)] || smp.frames[0];
    const frame = frameFile ? 'data:image/jpeg;base64,' + fs.readFileSync(frameFile).toString('base64') : '';
    let dets = [];
    try { dets = await require('./engine/facetrack.cjs').detectFaces(smp.frames, { BrowserWindow }); } catch (err) { return { ok: true, found: false, frame, dims: [info.width, info.height], duration: info.duration, hasAudio: info.hasAudio, error: 'Face detection is not available: ' + String(err.message || err).slice(0, 100) }; }
    const r = FC.locate(dets, smp.gray, info.width / info.height);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
    return { ok: true, found: !!r.found, rect: r.rect || null, frame, dims: [info.width, info.height], duration: info.duration, hasAudio: info.hasAudio };
  } catch (err) { return { ok: false, error: String(err.message || err).slice(0, 200) }; }
});
ipcMain.handle('sync-videos', async (e, { mainPath, secondPath }) => {
  const AS = require('./engine/autosync.cjs');
  try { const r = await AS.offsetBetween(mainPath, secondPath, path.join(Paths.workRoot(), 'sync_probe')); return { ok: true, ...r }; }
  catch (err) { return { ok: false, error: String(err.message || err).slice(0, 200) }; }
});
ipcMain.handle('probe-video', async (e, filePath) => R.probe(filePath));
ipcMain.handle('show-in-folder', async (e, p) => { shell.showItemInFolder(p); return true; });

// ---- Real pipeline ----
let currentRun = null;
ipcMain.handle('start-pipeline', async (event, job) => {
  if (currentRun) { try { await currentRun; } catch {} }          // a cancelled run may still be shutting down
  resetCancel();
  job = { ...job, clipsBase: Settings.clipsDir() };
  const p = runPipeline(job, (ev) => send('pipeline-event', ev), {
    detectFaces: (frames) => require('./engine/facetrack.cjs').detectFaces(frames, { BrowserWindow }),
    segment: (frames) => require('./engine/facetrack.cjs').segmentFrames(frames, { BrowserWindow })
  });
  currentRun = p.catch(() => {}).then(() => { if (currentRun === tracked) currentRun = null; });
  const tracked = currentRun;
  return p;
});
// ---- Delete a project's generated clips from disk (never touches the original video) ----
ipcMain.handle('delete-project-files', async (e, { id, name, outputDir, files }) => {
  const slug = (x) => String(x || '').replace(/[^\w\-]+/g, '_').slice(0, 50) || 'project';
  const marker = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, '.clipforge.json'), 'utf8')).projectId; } catch { return null; } };
  const mine = (d) => { const m = marker(d); return !(m != null && id != null && String(m) !== String(id)); };   // a folder stamped with ANOTHER project's id is never touched
  const dirs = new Set();
  if (outputDir) dirs.add(path.resolve(outputDir));
  for (const f of files || []) dirs.add(path.resolve(path.dirname(f)));
  if (!dirs.size) dirs.add(path.join(Settings.clipsDir(), slug(name)));          // very old projects without a saved folder only
  let removed = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    if (path.resolve(d) === path.resolve(Settings.clipsDir())) continue;       // never touch the main clips folder itself
    const emptyShell = () => { try { return fs.readdirSync(d).every(f => /^\./.test(f) || /^(clipforge\.json|work|tmp)$/i.test(f)); } catch { return false; } };   // only ClipForge's own hidden files are left
    if (!mine(d) && !emptyShell()) continue;                                    // several projects can be made from one video: each has its own folder (but a folder with nothing of anyone's left in it is just a leftover)
    for (const f of fs.readdirSync(d)) {
      if (/^clip_\d+[\w.\-]*\.(mp4|srt|jpg|png|txt|json|ass)$/i.test(f) || /^(track_\d+|words|transcript|segments|checkpoint[\w\-]*)\.json$/i.test(f) || /^clips_title_description\.xlsx$/i.test(f) || /^~\$clips_title_description\.xlsx$/i.test(f)) { try { fs.unlinkSync(path.join(d, f)); removed++; } catch {} }   // only files ClipForge created (clips + the title/description sheet)
    }
    try { fs.rmSync(path.join(d, '.edit'), { recursive: true, force: true }); } catch {}
    for (const h of ['.clipforge-edit.json', '.clipforge.json', '.clipforge-settings.json', 'clipforge.json']) { try { fs.rmSync(path.join(d, h), { force: true }); } catch {} }   // the marker files go even if something else in the folder was busy
    try { for (const f of ['work', 'tmp']) { const w = path.join(d, f); if (fs.existsSync(w) && fs.statSync(w).isDirectory() && fs.readdirSync(w).length === 0) fs.rmdirSync(w); } } catch {}
    try { fs.rmdirSync(d); } catch {}    // removes the folder only if it is now empty (anything of yours that is still inside is left alone)
  }
  return { removed };
});
// Delete ONE finished clip file (and its editor preview). Only files ClipForge made (clip_NN.mp4) inside the project folder are touched.
ipcMain.handle('delete-clip-file', async (e, { outputPath, outputDir }) => {
  try {
    const f = path.resolve(String(outputPath || ''));
    const m = /^clip_(\d+)\.mp4$/i.exec(path.basename(f));
    if (!m) return { ok: false, error: 'Not a ClipForge clip file.' };
    if (outputDir && path.resolve(outputDir) !== path.dirname(f)) return { ok: false, error: 'File is outside the project folder.' };
    let removed = 0;
    for (const x of [f, path.join(path.dirname(f), '.edit', `base_${m[1]}.mp4`)]) { try { if (fs.existsSync(x)) { fs.unlinkSync(x); removed++; } } catch {} }
    return { ok: true, removed };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('cancel-pipeline', async () => { killAll(); if (currentRun) { try { await currentRun; } catch {} } return true; });
// ---- Script to Short (voice-over -> finished 9:16 short + thumbnails + platform texts) ----
let storyRun = null;
const storyShot = async (htmlFile) => {              // one thumbnail: load the HTML in a hidden window and take a picture
  // Some PCs squeeze a hidden window to the screen height, which used to stretch the picture. Draw it off-screen first and
  // check the shape; if it is still wrong, draw at half size with page zoom and scale up evenly (never stretch).
  const attempt = async (scale) => {
    const w = new BrowserWindow({ show: false, width: Math.round(1080 * scale), height: Math.round(1920 * scale), useContentSize: true, frame: false, enableLargerThanScreen: true, webPreferences: { offscreen: scale === 1, backgroundThrottling: false, contextIsolation: true, zoomFactor: scale } });
    try {
      await w.loadFile(htmlFile);
      await w.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)))');
      const img = await w.webContents.capturePage();
      const sz = img.getSize();
      if (Math.abs(sz.width / sz.height - 1080 / 1920) > 0.02 || sz.width < 300) return null;
      return (sz.width !== 1080 ? img.resize({ width: 1080, height: 1920, quality: 'best' }) : img).toPNG();
    } finally { try { w.destroy(); } catch {} }
  };
  let fit = 0.5; try { const wa = require('electron').screen.getPrimaryDisplay().workAreaSize; fit = Math.max(0.2, Math.min(0.5, Math.floor(wa.height * 0.85) / 1920)); } catch {}
  let a = null, why = '';
  try { a = await attempt(1); } catch (e) { why = String(e.message); }
  if (!a) { try { a = await attempt(fit); } catch (e) { why += ' / ' + String(e.message); } }
  if (!a) throw new Error('could not draw the thumbnail on this screen' + (why ? ' (' + why.slice(0, 120) + ')' : ''));
  return a;
};
// Animated motion-graphics scenes: seek the page to each moment and save the frame (see-through where the page is empty).
const storyFrames = async ({ htmlFile, outDir, dur, fps, bg }) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const attempt = async (offscreen) => {
    // a normal hidden window is squeezed to the screen (and Windows display scaling of 125-175% makes it even smaller): pick a size that always fits, draw zoomed out, scale up evenly
    let sc = 1;
    if (!offscreen) { try { const wa = require('electron').screen.getPrimaryDisplay().workAreaSize; sc = Math.max(0.2, Math.min(0.5, Math.floor(wa.height * 0.85) / 1920)); } catch { sc = 0.3; } }
    const w = new BrowserWindow({ show: false, width: Math.round(1080 * sc), height: Math.round(1920 * sc), useContentSize: true, frame: false, backgroundColor: '#000000', enableLargerThanScreen: true, webPreferences: { offscreen, backgroundThrottling: false, contextIsolation: true, zoomFactor: sc } });
    try {
      await w.loadFile(htmlFile);
      await w.webContents.executeJavaScript(`document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300))).then(() => { window.setBg && window.setBg(${JSON.stringify(bg || '#000000')}); })`);
      const grab = async () => {           // the first picture of an off-screen window can be empty: wait for a real paint
        for (let k = 0; k < 40; k++) { const img = await w.webContents.capturePage(); const z = img.getSize(); if (z.width > 0 && z.height > 0) return img; await sleep(100); }
        throw new Error('the drawing window never painted');
      };
      const n = Math.max(1, Math.round(dur * fps));
      for (let i = 0; i < n; i++) {
        await w.webContents.executeJavaScript(`window.seek(${(i / fps).toFixed(4)}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
        const img = await grab(); const sz = img.getSize();
        if (Math.abs(sz.width / sz.height - 1080 / 1920) > 0.02) throw new Error(`the drawing window has the wrong shape (${sz.width}x${sz.height})`);
        fs.writeFileSync(path.join(outDir, String(i + 1).padStart(5, '0') + '.png'), (sz.width !== 1080 ? img.resize({ width: 1080, height: 1920, quality: 'good' }) : img).toPNG());
        if (i % 12 === 0) require('./engine/proc.cjs').checkCancel();
      }
      return { frames: n, alpha: true };
    } finally { try { w.destroy(); } catch {} }
  };
  try { return await attempt(true); }
  catch (e1) {
    if (/CANCELLED/.test(String(e1.message))) throw e1;
    try { return await attempt(false); }
    catch (e2) { if (/CANCELLED/.test(String(e2.message))) throw e2; throw new Error(`${String(e2.message)}; first try: ${String(e1.message)}`); }
  }
};
ipcMain.handle('story-start', async (e, job) => {
  if (currentRun || storyRun) return { ok: false, error: 'Another job is still running. Wait for it to finish first.' };
  resetCancel();
  job = { ...job, clipsBase: Settings.clipsDir() };
  const p = require('./engine/story.cjs').runStory(job, (ev) => send('story-event', ev), { shot: storyShot, frames: storyFrames });
  const tracked = storyRun = p.catch(() => {}).then(() => { if (storyRun === tracked) storyRun = null; });
  try { return { ok: true, result: await p }; }
  catch (err) { const m = String(err && err.message || err); return { ok: false, cancelled: /CANCELLED/.test(m), error: m.slice(0, 500) }; }
});
ipcMain.handle('story-analyze', async (e, job) => {
  if (currentRun || storyRun) return { ok: false, error: 'Another job is still running. Wait for it to finish first.' };
  resetCancel();
  const p = require('./engine/story.cjs').analyzeStory(job, (ev) => send('story-event', ev));
  const tracked = storyRun = p.catch(() => {}).then(() => { if (storyRun === tracked) storyRun = null; });
  try { return { ok: true, analysis: await p }; }
  catch (err) { const m = String(err && err.message || err); return { ok: false, cancelled: /CANCELLED/.test(m), error: m.slice(0, 500) }; }
});
ipcMain.handle('story-pick-video', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Screen recording', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }] });
  return r.canceled ? null : { path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
});
ipcMain.handle('story-cancel', async () => { killAll(); if (storyRun) { try { await storyRun; } catch {} } return true; });
ipcMain.handle('story-pick-voice', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Voice-over (audio or video)', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus', 'wma', 'mp4', 'mov', 'mkv', 'webm'] }] });
  return r.canceled ? null : { path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
});
ipcMain.handle('story-characters', async () => {
  const U = require('url'); const C = require('./engine/characters.cjs');
  return C.summary().map(c => ({ ...c, preview: c.preview ? U.pathToFileURL(c.preview).toString() : null, previewHead: c.previewHead ? U.pathToFileURL(c.previewHead).toString() : null }));
});
ipcMain.handle('story-open-characters', async () => shell.openPath(require('./engine/characters.cjs').userDir()));
ipcMain.handle('discard-checkpoint', async (e, job) => { try { fs.rmSync(workDirFor(job), { recursive: true, force: true }); } catch {} return true; });

// Utility: version check of bundled ffmpeg
ipcMain.handle('run-ffmpeg', async (event, args) => {
  const { run } = require('./engine/proc.cjs');
  const r = await run(Paths.binOrPath('ffmpeg'), args);
  return { success: true, stdout: r.stdout };
});

// IPC Handler: Query actual computer hardware specifications
ipcMain.handle('get-system-specs', async () => require('./engine/system.cjs').specs(app));
ipcMain.handle('engine-check', async () => require('./engine/system.cjs').engine());

// ---- Updates (GitHub) ----
const pkgInfo = (() => { try { return require('../package.json'); } catch { return {}; } })();
const updateRepo = () => Settings.load().updateRepo || (pkgInfo.clipforge && pkgInfo.clipforge.updateRepo) || '';
ipcMain.handle('update-check', async (e, { repo } = {}) => {
  const U = require('./engine/update.cjs');
  if (repo != null && String(repo).trim()) Settings.save({ updateRepo: U.cleanRepo(repo) });
  const r = await U.check(updateRepo(), pkgInfo.version || app.getVersion());
  try { const iv = Settings.load().installedVersion; if (r.ok && iv && !U.newer(r.latest, iv)) r.available = false; } catch {}   // already installed this one (or older)
  if (r && r.asset) lastAsset = r.asset;
  return { ...r, current: pkgInfo.version || app.getVersion(), repo: U.cleanRepo(updateRepo()) };
});
let lastAsset = null;
const sha256File = (f) => new Promise((res, rej) => { const h = require('crypto').createHash('sha256'); fs.createReadStream(f).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
ipcMain.handle('update-download', async (e, { url, name }) => {
  const dir = path.join(app.getPath('downloads'), 'ClipForge Update');
  const safe = String(name || 'ClipForge-update.exe').replace(/[\\/:*?"<>|]/g, '_');
  const dest = path.join(dir, safe), tmp = dest + '.part';
  try {
    fs.mkdirSync(dir, { recursive: true });
    const exp = lastAsset && lastAsset.name === name ? lastAsset : null;
    const t0 = Date.now(); let verified = false, lastErr = '';
    for (const parts of [8, 0]) {                                     // 1st: 8 pieces at once; if the finished file does not check out, once more as one plain stream
      try { fs.unlinkSync(tmp); } catch {}
      updateDl = {};
      await fastDownload(url, tmp, (d, t) => send('update-progress', { done: d, total: t, percent: t ? Math.round(d / t * 100) : 0, speed: d / Math.max(0.5, (Date.now() - t0) / 1000) }), updateDl, parts);
      updateDl = null;
      const size = fs.statSync(tmp).size;
      if (exp && exp.size && size !== exp.size) { lastErr = `The downloaded file has the wrong size (${size} instead of ${exp.size} bytes).`; continue; }
      const m = exp && /^sha256:([0-9a-f]{64})$/i.exec(String(exp.digest || ''));
      if (m && (await sha256File(tmp)).toLowerCase() !== m[1].toLowerCase()) { lastErr = 'The downloaded file is damaged (checksum does not match).'; continue; }
      verified = true; break;
    }
    if (!verified) { try { fs.unlinkSync(tmp); } catch {} return { ok: false, error: lastErr + ' Please try again.' }; }
    try { fs.unlinkSync(dest); } catch {}
    fs.renameSync(tmp, dest);
    return { ok: true, path: dest };
  } catch (err) {
    updateDl = null; try { fs.unlinkSync(tmp); } catch {}
    if (/CANCELLED/.test(String(err.message))) return { ok: false, cancelled: true, error: 'Download cancelled.' };
    return { ok: false, error: String(err.message || err).slice(0, 300) };
  }
});
// Installs the downloaded update by itself: silent installer for an installed app (it keeps the install folder, then reopens ClipForge).
ipcMain.handle('update-install', async (e, { filePath, version }) => {
  try {
    if (version) Settings.save({ installedVersion: String(version).replace(/^v/i, '') });   // remembered so the same update is not offered again after it was installed
    const f = String(filePath || ''); if (!f || !fs.existsSync(f)) return { ok: false, error: 'The update file was not found.' };
    if (process.platform === 'win32' && /\.exe$/i.test(f)) {
      const installed = fs.existsSync(path.join(path.dirname(process.execPath), 'Uninstall ClipForge.exe')) && !process.env.PORTABLE_EXECUTABLE_FILE;
      const { spawn } = require('child_process');
      const child = spawn(f, installed ? ['/S', '--force-run'] : [], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      setTimeout(() => { try { app.quit(); } catch {} }, 600);
      setTimeout(() => { try { app.exit(0); } catch {} }, 4000);
      return { ok: true, mode: installed ? 'silent' : 'installer' };
    }
    if (process.platform === 'android') {                       // opens Android's installer straight away; one tap on Install finishes the update
      const err = await shell.openPath(f);
      return err ? { ok: false, error: err } : { ok: true, mode: 'manual' };
    }
    if (process.platform === 'darwin') { await shell.openPath(f); return { ok: true, mode: 'manual' }; }
    shell.showItemInFolder(f); return { ok: true, mode: 'manual' };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('open-external', async (e, url) => { if (/^https:\/\/(github\.com|discord\.(gg|com)|wa\.me|api\.whatsapp\.com|(www\.)?instagram\.com)\//i.test(String(url))) { await shell.openExternal(url); return true; } return false; });

// Window control handlers for custom titlebar
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.on('window-reload', () => {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.reload();
  }
});


