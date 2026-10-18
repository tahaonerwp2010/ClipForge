// Runs face detection inside a hidden Chromium window (Electron) – no native deps, works offline.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function assetDir() {
  const d = path.join(__dirname, 'facetrack');
  const unpacked = d.replace('app.asar', 'app.asar.unpacked');
  return fs.existsSync(unpacked) ? unpacked : d;
}

async function detectFaces(frameFiles, { BrowserWindow }) {
  const dir = assetDir();
  const win = new BrowserWindow({ show: false, width: 800, height: 600,
    webPreferences: { webSecurity: false, contextIsolation: true, sandbox: false, backgroundThrottling: false } });
  try {
    await win.loadFile(path.join(dir, 'page.html'));
    const md = path.join(dir, 'models');
    const model = { manifest: JSON.parse(fs.readFileSync(path.join(md, 'tiny_face_detector_model-weights_manifest.json'), 'utf8')),
      binB64: fs.readFileSync(path.join(md, 'tiny_face_detector_model.bin')).toString('base64') };
    const urls = frameFiles.map(f => pathToFileURL(f).toString());
    return await win.webContents.executeJavaScript(`window.runDetect(${JSON.stringify(model)}, ${JSON.stringify(urls)})`);
  } finally { try { win.destroy(); } catch {} }
}
// Tiny local web server (127.0.0.1, random port) for the cut-out page: browsers cannot fetch() file:// URLs, and the
// segmentation model + wasm are loaded with fetch(). Serves the facetrack folder and the extracted frame images only.
const http = require('http');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.jpg': 'image/jpeg', '.png': 'image/png' };
function serve(allowRoot) {
  const root = assetDir();
  const srv = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      let file = null;
      if (u.pathname === '/f') { const p = path.resolve(u.searchParams.get('p') || ''); if (/\.(jpg|png)$/i.test(p) && (!allowRoot || p.startsWith(path.resolve(allowRoot)))) file = p; }
      else if (u.pathname.startsWith('/a/')) { const p = path.resolve(root, decodeURIComponent(u.pathname.slice(3))); if (p.startsWith(root)) file = p; }
      if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(500); res.end(); }
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ port: srv.address().port, close: () => { try { srv.close(); } catch {} } })));
}
// Person cut-out masks for frames (grey PNG data URLs, white = person). null for a frame that failed.
async function segmentFrames(frameFiles, { BrowserWindow }) {
  if (!frameFiles.length) return [];
  const sv = await serve(path.dirname(path.dirname(frameFiles[0])));
  const win = new BrowserWindow({ show: false, width: 800, height: 600,
    webPreferences: { webSecurity: false, contextIsolation: true, sandbox: false, backgroundThrottling: false } });
  try {
    await win.loadURL(`http://127.0.0.1:${sv.port}/a/page.html`);
    const urls = frameFiles.map(f => `http://127.0.0.1:${sv.port}/f?p=${encodeURIComponent(f)}`);
    return await win.webContents.executeJavaScript(`window.runSeg(${JSON.stringify(urls)})`);
  } finally { try { win.destroy(); } catch {} sv.close(); }
}
module.exports = { detectFaces, segmentFrames, serve, assetDir };
