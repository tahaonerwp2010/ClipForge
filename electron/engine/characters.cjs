// Character styles for "Script to Short". Built-in styles live in assets/characters/<style> (layered: body_<pose>.png + head_<face>.png + manifest.json);
// users can add their own folders in <userData>/characters/<style>: either the same layered files, or plain PNGs (any name, e.g. "wave__smile.png").
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');
const { run } = require('./proc.cjs');

const builtinDir = () => P.charactersDir();
const userDir = () => { const d = path.join(P.userDataDir(), 'characters'); try { fs.mkdirSync(d, { recursive: true }); } catch {} return d; };
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const ID = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const words = s => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function loadDir(dir, id, builtin) {
  const man = readJson(path.join(dir, 'manifest.json'));
  if (man && man.mode === 'layered') return { id: man.id || id, name: man.name || id, mode: 'layered', dir, builtin, man };
  // plain pictures: every png is one look (pose + face); the file name says what it shows
  const files = fs.readdirSync(dir).filter(f => /\.(png|webp)$/i.test(f) && !/^(preview|cover)\./i.test(f));
  if (!files.length) return null;
  const looks = files.map(f => { const b = f.replace(/\.[a-z]+$/i, ''); const [pose, face] = b.split('__'); return { id: ID(b), file: f, pose: ID(pose || b), face: ID(face || ''), tags: words(b) }; });
  return { id, name: (man && man.name) || id.replace(/_/g, ' '), mode: 'flat', dir, builtin, looks, triggers: (man && man.triggers) || [] };
}
let cache = null;
function all(force) {
  if (cache && !force) return cache;
  const out = [];
  for (const [d, b] of [[builtinDir(), true], [userDir(), false]]) {
    if (!d) continue;
    let names = []; try { names = fs.readdirSync(d).filter(n => fs.statSync(path.join(d, n)).isDirectory()); } catch {}
    for (const n of names) { try { const s = loadDir(path.join(d, n), ID(n), b); if (s && !out.some(o => o.id === s.id)) out.push(s); } catch {} }
  }
  return (cache = out);
}
const get = id => all().find(s => s.id === id) || null;
// what the UI needs: id, name, how many looks, a preview picture
function summary() {
  return all(true).map(s => {
    const prev = s.mode === 'layered' ? path.join(s.dir, 'body_stop.png') : path.join(s.dir, s.looks[0].file);
    const prevHead = s.mode === 'layered' ? path.join(s.dir, 'head_smile.png') : null;
    return { id: s.id, name: s.name, builtin: !!s.builtin, mode: s.mode, count: s.mode === 'layered' ? Object.keys(s.man.poses).length * Object.keys(s.man.faces).length : s.looks.length, preview: fs.existsSync(prev) ? prev : null, previewHead: prevHead && fs.existsSync(prevHead) ? prevHead : null, head: s.mode === 'layered' ? s.man.head : null, body: s.mode === 'layered' ? s.man.body : null };
  });
}
// the menu the AI chooses from: [{pose, face, tags}] or the flat look list
function menu(id) {
  const s = get(id); if (!s) return null;
  if (s.mode === 'layered') return { poses: s.man.poses, faces: s.man.faces };
  return { looks: s.looks.map(l => ({ id: l.id, tags: l.tags })) };
}
// hard-coded trigger words (many languages): a spoken word that has its own look
const norm = w => String(w || '').toLowerCase().replace(/[.,!?;:"'()\[\]{}،۔؟।…]/g, '').trim();
function trigger(id, word) {
  const s = get(id); if (!s) return null;
  const w = norm(word); if (!w) return null;
  const trigs = s.mode === 'layered' ? s.man.triggers : s.triggers;
  const hit = (trigs || []).find(t => (t.words || []).some(x => norm(x) === w));
  if (!hit) return null;
  if (s.mode === 'layered') return { pose: hit.pose, face: hit.face };
  return hit.look ? { look: hit.look } : null;
}
// -> path of a ready PNG for this look (layered ones are merged once and cached)
async function compose(id, look) {
  const s = get(id); if (!s) throw new Error('Unknown character style: ' + id);
  if (s.mode === 'flat') { const l = s.looks.find(x => x.id === (look.look || look.id)) || s.looks[0]; return path.join(s.dir, l.file); }
  const poses = Object.keys(s.man.poses), faces = Object.keys(s.man.faces);
  const pose = poses.includes(look.pose) ? look.pose : 'idle', face = faces.includes(look.face) ? look.face : 'smile';
  const cdir = path.join(P.userDataDir(), 'charcache'); fs.mkdirSync(cdir, { recursive: true });
  const out = path.join(cdir, `${s.id}_${pose}_${face}.png`);
  if (fs.existsSync(out) && fs.statSync(out).size > 500) return out;
  const { x, y } = s.man.head;
  await run(P.binOrPath('ffmpeg'), ['-y', '-i', path.join(s.dir, `body_${pose}.png`), '-i', path.join(s.dir, `head_${face}.png`), '-filter_complex', `[0][1]overlay=${x}:${y}:format=auto`, '-frames:v', '1', out]);
  return out;
}
// size of the composed picture (for placing it)
const sizeOf = id => { const s = get(id); return s && s.mode === 'layered' ? { w: s.man.body.w, h: s.man.body.h } : { w: 0, h: 0 };};
module.exports = { all, get, summary, menu, trigger, compose, userDir, sizeOf, norm };
