// Font helpers: bundled (public/fonts), user-added (userData/fonts) and Windows system fonts for libass.
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; } };
const bundledDir = () => P.fontsDir();
const userDir = () => path.join(P.userDataDir(), 'fonts');
const bundled = () => (bundledDir() ? readJson(path.join(bundledDir(), 'fonts.json')) : []);
const userFonts = () => readJson(path.join(userDir(), 'fonts.json'));

// Family name from a TTF/OTF 'name' table (nameID 16 preferred, else 1)
function readFamily(buf) {
  try {
    let base = 0;
    if (buf.toString('latin1', 0, 4) === 'ttcf') base = buf.readUInt32BE(12);
    const n = buf.readUInt16BE(base + 4);
    let off = null;
    for (let i = 0; i < n; i++) { const r = base + 12 + i * 16; if (buf.toString('latin1', r, r + 4) === 'name') { off = buf.readUInt32BE(r + 8); break; } }
    if (off == null) return null;
    const count = buf.readUInt16BE(off + 2), strOff = off + buf.readUInt16BE(off + 4);
    const found = {};
    for (let i = 0; i < count; i++) {
      const r = off + 6 + i * 12;
      const plat = buf.readUInt16BE(r), id = buf.readUInt16BE(r + 6), len = buf.readUInt16BE(r + 8), o = buf.readUInt16BE(r + 10);
      if (id !== 1 && id !== 16) continue;
      const raw = buf.subarray(strOff + o, strOff + o + len);
      const s = (plat === 3 || plat === 0) ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1');
      if (!found[id] || plat === 3) found[id] = s;
    }
    return found[16] || found[1] || null;
  } catch { return null; }
}

const SYSTEM = {   // Windows system fonts -> files in C:\Windows\Fonts (copied next to the render so libass always finds them)
  'Arial': ['arial.ttf', 'arialbd.ttf'], 'Arial Black': ['ariblk.ttf'], 'Impact': ['impact.ttf'],
  'Segoe UI': ['segoeui.ttf', 'segoeuib.ttf'], 'Georgia': ['georgia.ttf', 'georgiab.ttf'], 'Verdana': ['verdana.ttf', 'verdanab.ttf'],
  'Tahoma': ['tahoma.ttf', 'tahomabd.ttf'], 'Trebuchet MS': ['trebuc.ttf', 'trebucbd.ttf'], 'Times New Roman': ['times.ttf', 'timesbd.ttf'],
  'Comic Sans MS': ['comic.ttf', 'comicbd.ttf'], 'Consolas': ['consola.ttf', 'consolab.ttf'], 'Calibri': ['calibri.ttf', 'calibrib.ttf'],
  'Courier New': ['cour.ttf', 'courbd.ttf'],
};
const isBundled = fam => bundled().some(f => f.family === fam) || userFonts().some(f => f.family === fam);
const boldFlag = fam => (isBundled(fam) ? 0 : -1);          // bundled / user fonts already are the weight you picked

// copy everything libass may need into dst
function stageFonts(dst, families = []) {
  fs.mkdirSync(dst, { recursive: true });
  const put = (src) => { try { const t = path.join(dst, path.basename(src)); if (!fs.existsSync(t)) fs.copyFileSync(src, t); } catch {} };
  const wanted = new Set(families.filter(Boolean));
  const add = (dir, list) => { for (const f of list) if (wanted.has(f.family)) put(path.join(dir, f.file)); };
  if (bundledDir()) add(bundledDir(), bundled());
  add(userDir(), userFonts());
  const win = process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts') : null;
  if (win) for (const fam of wanted) for (const file of SYSTEM[fam] || []) put(path.join(win, file));
}
module.exports = { bundled, userFonts, userDir, readFamily, boldFlag, stageFonts, SYSTEM };
