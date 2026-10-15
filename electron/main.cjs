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
    title: 'ClipForge',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false
    }
  });

  // Enable F12 or Ctrl+Shift+I to inspect console if needed
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
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
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');   // AppImage on newer Ubuntu blocks the sandbox
app.whenReady().then(() => {
  Paths.configure({ userData: app.getPath('userData'), appPath: app.getAppPath(), resourcesPath: process.resourcesPath || '' });
  Paths.setModelsDir(Settings.load().modelsDir);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { try { killAll(); } catch {} });

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
ipcMain.handle('open-folder', async (e, p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} return shell.openPath(p); });
ipcMain.handle('ai-test', async (e, a) => AI.test(a));
ipcMain.handle('ai-ping', async (e, a) => AI.ping(a));
ipcMain.handle('ai-list-models', async (e, a) => AI.listModels(a));
ipcMain.handle('engine-status', async () => ({
  ffmpeg: !!Paths.resolveBin('ffmpeg'), whisper: !!(Paths.resolveBin('whisper-cli') || Paths.resolveBin('main')),
}));

ipcMain.handle('download-model', async (event, { modelId }) => {
  const url = MODEL_URLS[modelId];
  if (!url) throw new Error(`Unknown model: ${modelId}`);
  fs.mkdirSync(Paths.modelsDir(), { recursive: true });
  const finalPath = mfile(modelId), tmp = finalPath + '.part';
  try {
    await fetchToFile(url, tmp, (downloadedBytes, totalBytes) => {
      send('download-progress', { modelId, progress: totalBytes ? Math.round(downloadedBytes / totalBytes * 100) : 0, downloadedBytes, totalBytes });
    });
    fs.renameSync(tmp, finalPath);
    return { success: true, filePath: finalPath };
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
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
// ---- Fonts & images chosen by the user ----
const Fonts = require('./engine/fonts.cjs');
ipcMain.handle('list-user-fonts', async () => Fonts.userFonts().map(f => ({ ...f, url: require('url').pathToFileURL(path.join(Fonts.userDir(), f.file)).toString() })));
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
    if (!list.some(f => f.family === family)) list.push({ family, file });
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
    detectFaces: (frames) => require('./engine/facetrack.cjs').detectFaces(frames, { BrowserWindow })
  });
  currentRun = p.catch(() => {}).then(() => { if (currentRun === tracked) currentRun = null; });
  const tracked = currentRun;
  return p;
});
// ---- Delete a project's generated clips from disk (never touches the original video) ----
ipcMain.handle('delete-project-files', async (e, { name, outputDir, files }) => {
  const slug = (x) => String(x || '').replace(/[^\w\-]+/g, '_').slice(0, 50) || 'project';
  const dirs = new Set();
  if (outputDir) dirs.add(path.resolve(outputDir));
  dirs.add(path.join(Settings.clipsDir(), slug(name)));
  for (const f of files || []) dirs.add(path.resolve(path.dirname(f)));
  let removed = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (/^clip_\d+\.mp4$/i.test(f)) { try { fs.unlinkSync(path.join(d, f)); removed++; } catch {} }   // only files ClipForge created
    }
    try { fs.rmdirSync(d); } catch {}    // removes the folder only if it is now empty
  }
  return { removed };
});
ipcMain.handle('cancel-pipeline', async () => { killAll(); if (currentRun) { try { await currentRun; } catch {} } return true; });
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
  return { ...r, current: pkgInfo.version || app.getVersion(), repo: U.cleanRepo(updateRepo()) };
});
ipcMain.handle('update-download', async (e, { url, name }) => {
  try {
    const dir = path.join(app.getPath('downloads'), 'ClipForge Update'); fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, String(name || 'ClipForge-update.exe').replace(/[\\/:*?"<>|]/g, '_')), tmp = dest + '.part';
    await fetchToFile(url, tmp, (d, t) => send('update-progress', { done: d, total: t, percent: t ? Math.round(d / t * 100) : 0 }));
    fs.renameSync(tmp, dest);
    return { ok: true, path: dest };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
// Installs the downloaded update by itself: silent installer for an installed app (it keeps the install folder, then reopens ClipForge).
ipcMain.handle('update-install', async (e, { filePath }) => {
  try {
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
    if (process.platform === 'darwin') { await shell.openPath(f); return { ok: true, mode: 'manual' }; }
    shell.showItemInFolder(f); return { ok: true, mode: 'manual' };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('open-external', async (e, url) => { if (/^https:\/\/github\.com\//i.test(String(url))) { await shell.openExternal(url); return true; } return false; });

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


