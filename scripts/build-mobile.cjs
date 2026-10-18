// Assembles the Android app's web + Node.js parts into dist/ (run after `vite build`), then `npx cap sync android` copies dist into the app.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const cp = (a, b) => fs.cpSync(path.join(root, a), path.join(dist, b), { recursive: true, force: true });
const pkg = require('../package.json');
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Run "vite build" first.');

// 1) screen <-> engine bridge (only exists in the Android build)
require('esbuild').buildSync({ entryPoints: [path.join(root, 'src/mobile/entry.ts')], bundle: true, format: 'iife', outfile: path.join(dist, 'mobile.js'), minify: true, target: 'chrome100',
  alias: { electron: path.join(root, 'src/mobile/electron-shim.ts') }, logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"' } });
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!html.includes('mobile.js')) html = html.replace('<head>', '<head>\n    <script src="./mobile.js"></script>');
fs.writeFileSync(path.join(dist, 'index.html'), html);

// 2) face detector page (runs in the WebView itself)
fs.mkdirSync(path.join(dist, 'facetrack'), { recursive: true });
for (const f of ['page.html', 'face-api.js']) fs.copyFileSync(path.join(root, 'electron/engine/facetrack', f), path.join(dist, 'facetrack', f));
fs.cpSync(path.join(root, 'electron/engine/facetrack/selfie'), path.join(dist, 'facetrack/selfie'), { recursive: true });   // person cut-out (MediaPipe, Apache-2.0)

// 3) the engine: same files as the desktop app
const nd = path.join(dist, 'nodejs');
fs.rmSync(nd, { recursive: true, force: true });
fs.mkdirSync(nd, { recursive: true });
fs.copyFileSync(path.join(root, 'mobile/node/index.js'), path.join(nd, 'index.js'));
fs.writeFileSync(path.join(nd, 'package.json'), JSON.stringify({ name: 'clipforge-engine', version: pkg.version, main: 'index.js', clipforge: pkg.clipforge || {} }));
fs.cpSync(path.join(root, 'electron'), path.join(nd, 'electron'), { recursive: true, filter: (s) => !/preload\.cjs$/.test(s) });
fs.cpSync(path.join(root, 'assets/sfx'), path.join(nd, 'assets/sfx'), { recursive: true });
if (fs.existsSync(path.join(root, 'assets/emoji'))) fs.cpSync(path.join(root, 'assets/emoji'), path.join(nd, 'assets/emoji'), { recursive: true });
fs.cpSync(path.join(root, 'public/fonts'), path.join(nd, 'public/fonts'), { recursive: true });
console.log('mobile bundle ready, engine files:', fs.readdirSync(path.join(nd, 'electron/engine')).length);
