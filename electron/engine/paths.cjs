// Resolves bundled binaries + model/work folders. Plain node, no 'electron' import (testable).
const path = require('path');
const fs = require('fs');
const os = require('os');

const ctx = { userData: path.join(os.homedir(), '.clipforge'), appPath: process.cwd(), resourcesPath: '' };
function configure(o) { Object.assign(ctx, o); }

function resolveBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const dirs = [
    path.join(ctx.userData, 'bin'),
    path.join(ctx.appPath, 'binaries'),
    ctx.resourcesPath && path.join(ctx.resourcesPath, 'binaries'),
    path.join(__dirname, '..', '..', 'binaries'),
  ].filter(Boolean);
  for (const d of dirs) { const p = path.join(d, exe); if (fs.existsSync(p)) return p; }
  return null;
}
const binOrPath = (name) => resolveBin(name) || name;
let modelsOverride = '';
const setModelsDir = d => { modelsOverride = d || ''; };
const defaultModelsDir = () => path.join(ctx.userData, 'models');
const modelsDir = () => modelsOverride || defaultModelsDir();
const modelFile = (id) => path.join(modelsDir(), `ggml-${id}.bin`);
const workRoot = () => path.join(ctx.userData, 'work');
const userDataDir = () => ctx.userData;
const fontsDir = () => {
  const c = [path.join(ctx.appPath, 'public', 'fonts'), ctx.resourcesPath && path.join(ctx.resourcesPath, 'fonts'), path.join(__dirname, '..', '..', 'public', 'fonts')].filter(Boolean);
  return c.find(fs.existsSync) || null;
};
const emojiDir = () => {
  const c = [path.join(ctx.appPath, 'assets', 'emoji'), ctx.resourcesPath && path.join(ctx.resourcesPath, 'emoji'), path.join(__dirname, '..', '..', 'assets', 'emoji')].filter(Boolean);
  return c.find(fs.existsSync) || null;
};
const sfxDir = () => {
  const c = [path.join(ctx.appPath, 'assets', 'sfx'), ctx.resourcesPath && path.join(ctx.resourcesPath, 'sfx'), path.join(__dirname, '..', '..', 'assets', 'sfx')].filter(Boolean);
  return c.find(d => fs.existsSync(path.join(d, 'manifest.json'))) || null;
};
module.exports = { sfxDir, setModelsDir, defaultModelsDir, userDataDir, emojiDir, configure, resolveBin, binOrPath, modelsDir, modelFile, workRoot, fontsDir };
