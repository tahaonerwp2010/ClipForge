// Sound effects that ship inside ClipForge (assets/sfx + manifest.json). Every sound has one or more ROLES:
// hit, whoosh, riser, pop, reward, glitch, camera, fail, funny, tech. The effects planner (fx.cjs) picks by role.
const fs = require('fs');
const path = require('path');
const P = require('./paths.cjs');

let cache = null, cacheDir = null;
function list() {
  const d = P.sfxDir();
  if (!d) return [];
  if (cache && cacheDir === d) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')).map(x => ({ ...x, id: x.name, path: path.join(d, x.file) })).filter(x => fs.existsSync(x.path));
    cacheDir = d;
  } catch { cache = []; }
  return cache;
}
const byRole = (role) => list().filter(x => x.roles.includes(role));
module.exports = { list, byRole };
