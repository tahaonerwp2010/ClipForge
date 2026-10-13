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
module.exports = { detectFaces, assetDir };
