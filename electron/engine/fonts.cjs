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

// Line-cell height of a font in em: libass (the caption / hook renderer) sizes text by (OS/2 winAscent + winDescent), so the app preview needs the same number
function readCell(buf) {
  try {
    let base = 0;
    if (buf.toString('latin1', 0, 4) === 'ttcf') base = buf.readUInt32BE(12);
    const n = buf.readUInt16BE(base + 4), tab = {};
    for (let i = 0; i < n; i++) { const r = base + 12 + i * 16; tab[buf.toString('latin1', r, r + 4)] = buf.readUInt32BE(r + 8); }
    const upm = buf.readUInt16BE(tab.head + 18);
    if (tab['OS/2'] != null) { const w = buf.readUInt16BE(tab['OS/2'] + 74) + buf.readUInt16BE(tab['OS/2'] + 76); if (w > 0) return +(w / upm).toFixed(4); }
    if (tab.hhea != null) { const h = buf.readInt16BE(tab.hhea + 4) - buf.readInt16BE(tab.hhea + 6); if (h > 0) return +(h / upm).toFixed(4); }
  } catch {}
  return null;
}

// Real text width in em from the font file (cmap + hmtx), so a size can be filled exactly to the screen edges. Returns a function(text) -> em, or null.
function measurerFor(family) {
  try {
    let file = null;
    const b = bundled().find(f => f.family === family); if (b && bundledDir()) file = path.join(bundledDir(), b.file);
    if (!file) { const u = userFonts().find(f => f.family === family); if (u) file = path.join(userDir(), u.file); }
    if (!file && process.env.WINDIR) for (const n of SYSTEM[family] || []) { const c = path.join(process.env.WINDIR, 'Fonts', n); if (fs.existsSync(c)) { file = c; break; } }
    if (!file || !fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    let base = 0; if (buf.toString('latin1', 0, 4) === 'ttcf') base = buf.readUInt32BE(12);
    const n = buf.readUInt16BE(base + 4), tab = {};
    for (let i = 0; i < n; i++) { const r = base + 12 + i * 16; tab[buf.toString('latin1', r, r + 4)] = buf.readUInt32BE(r + 8); }
    const upm = buf.readUInt16BE(tab.head + 18), nH = buf.readUInt16BE(tab.hhea + 34), hm = tab.hmtx;
    const adv = g => buf.readUInt16BE(hm + 4 * Math.min(g, nH - 1));
    // pick a Unicode cmap (format 4 or 12)
    const c0 = tab.cmap, cn = buf.readUInt16BE(c0 + 2); let sub = null;
    for (let i = 0; i < cn; i++) { const pl = buf.readUInt16BE(c0 + 4 + i * 8), en = buf.readUInt16BE(c0 + 6 + i * 8), off = c0 + buf.readUInt32BE(c0 + 8 + i * 8); const fm = buf.readUInt16BE(off); if ((pl === 3 && en === 10 && fm === 12) || (!sub || sub.fm !== 12) && (pl === 3 && en === 1 || pl === 0) && (fm === 4 || fm === 12)) sub = { off, fm }; }
    if (!sub) return null;
    const glyph = (cp) => {
      const o = sub.off;
      if (sub.fm === 12) { const g = buf.readUInt32BE(o + 12); for (let i = 0; i < g; i++) { const r = o + 16 + i * 12, a = buf.readUInt32BE(r), z = buf.readUInt32BE(r + 4); if (cp >= a && cp <= z) return buf.readUInt32BE(r + 8) + cp - a; } return 0; }
      const sc = buf.readUInt16BE(o + 6) / 2, endO = o + 14, startO = endO + sc * 2 + 2, deltaO = startO + sc * 2, rangeO = deltaO + sc * 2;
      for (let i = 0; i < sc; i++) {
        if (cp > buf.readUInt16BE(endO + i * 2)) continue;
        if (cp < buf.readUInt16BE(startO + i * 2)) return 0;
        const ro = buf.readUInt16BE(rangeO + i * 2), dl = buf.readInt16BE(deltaO + i * 2);
        if (!ro) return (cp + dl) & 0xFFFF;
        const g = buf.readUInt16BE(rangeO + i * 2 + ro + (cp - buf.readUInt16BE(startO + i * 2)) * 2);
        return g ? (g + dl) & 0xFFFF : 0;
      }
      return 0;
    };
    const fn = (text) => { let w = 0; for (const ch of String(text)) { const g = glyph(ch.codePointAt(0)); w += g ? adv(g) / upm : 0.6; } return w; };
    fn.cell = readCell(buf);
    return fn;
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
  const wanted = new Set([...families.filter(Boolean), 'Noto Sans Arabic ExtraBold', 'Noto Sans Devanagari ExtraBold']);   // the two script fonts are always staged so Urdu / Arabic / Hindi captions never show empty boxes
  const add = (dir, list) => { for (const f of list) if (wanted.has(f.family)) put(path.join(dir, f.file)); };
  if (bundledDir()) add(bundledDir(), bundled());
  add(userDir(), userFonts());
  const win = process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts') : null;
  if (win) for (const fam of wanted) for (const file of SYSTEM[fam] || []) put(path.join(win, file));
}
// Arabic / Urdu and Hindi (Devanagari) need a font that has those letters; libass cannot always find one by itself, so the word is set in a bundled Noto font.
const ARABIC = 'Noto Sans Arabic ExtraBold', DEVA = 'Noto Sans Devanagari ExtraBold';
const scriptFont = t => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(t)) ? ARABIC : /[\u0900-\u097F]/.test(String(t)) ? DEVA : null;
module.exports = { measurerFor, scriptFont, bundled, userFonts, userDir, readFamily, readCell, boldFlag, stageFonts, SYSTEM };
