// Small JSON settings file in userData (folders chosen by the user).
const fs = require('fs');
const path = require('path');
const os = require('os');
const P = require('./paths.cjs');
const file = () => path.join(P.userDataDir(), 'settings.json');
const defaults = () => ({ modelsDir: '', clipsDir: '', ytDir: '', updateRepo: '' });
function load() { try { return { ...defaults(), ...JSON.parse(fs.readFileSync(file(), 'utf8')) }; } catch { return defaults(); } }
function save(patch) { const s = { ...load(), ...patch }; fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(s, null, 1)); return s; }
const defaultClipsDir = () => path.join(os.homedir(), 'Videos', 'ClipForge');
const clipsDir = () => load().clipsDir || defaultClipsDir();
const defaultYtDir = () => path.join(os.homedir(), 'Videos', 'ClipForge Downloads');
const ytDir = () => load().ytDir || defaultYtDir();
module.exports = { load, save, clipsDir, defaultClipsDir, ytDir, defaultYtDir };
