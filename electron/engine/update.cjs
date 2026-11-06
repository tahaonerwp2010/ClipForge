// Update check against GitHub. Looks at the latest Release first; if the repo has none, reads package.json from the default branch.
const UA = { 'User-Agent': 'ClipForge-Updater', Accept: 'application/vnd.github+json' };
const cleanRepo = (r) => String(r || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').replace(/\.git$/i, '').split('/').slice(0, 2).join('/');
const parse = (v) => String(v || '').replace(/^[^\d]*/, '').split(/[.\-+]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
function newer(a, b) { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (r.status === 404) return null;
  if (r.status === 403) throw new Error('GitHub is limiting requests right now. Try again in a few minutes.');
  if (!r.ok) throw new Error(`GitHub answered HTTP ${r.status}`);
  return r.json();
}

// What changed in the new version: RELEASE_NOTES.md from the release's own commit (written by hand, in plain English), else the release text
async function whatsNew(repo, rel) {
  const get = async (ref) => { try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/RELEASE_NOTES.md`, { headers: { 'User-Agent': 'ClipForge-Updater' }, signal: AbortSignal.timeout(8000) }); return r.ok ? await r.text() : ''; } catch { return ''; } };
  let t = await get(encodeURIComponent(rel.tag_name));
  if (!t.trim()) t = String(rel.body || '').replace(/\*\*Full Changelog\*\*:.*$/im, '').replace(/^#+\s*What's Changed\s*$/im, '');
  const h = [...t.matchAll(/^#{1,3}\s/gm)].map(m => m.index);      // only the first section = this version; older sections are never shown
  if (h.length > 1 && h[0] === 0) t = t.slice(0, h[1]);
  return t.trim().slice(0, 2500);
}

async function check(repoIn, current) {
  const repo = cleanRepo(repoIn);
  if (!/^[\w.\-]+\/[\w.\-]+$/.test(repo)) return { ok: false, error: 'no-repo', message: 'No GitHub repository is set for updates.' };
  try {
    const rel = await getJson(`https://api.github.com/repos/${repo}/releases/latest`);
    if (rel && rel.tag_name) {
      const assets = rel.assets || [];
      const plat = process.platform === 'android' ? { os: /android/i, ext: /\.apk$/i } : process.platform === 'win32' ? { os: /windows|win/i, ext: /\.exe$/i } : process.platform === 'darwin' ? { os: /mac|darwin|osx/i, ext: /\.dmg$/i } : { os: /linux/i, ext: /\.appimage$/i };
      const archRe = process.arch === 'arm64' ? /arm64/i : /x64|x86_64/i;
      const asset = (process.platform === 'win32' && assets.find(a => /setup.*\.exe$/i.test(a.name))) || (process.platform === 'darwin' && assets.find(a => plat.ext.test(a.name) && archRe.test(a.name))) || assets.find(a => plat.ext.test(a.name)) || assets.find(a => plat.os.test(a.name)) || null;
      const isNew = newer(rel.tag_name, current);
      const notes = isNew ? await whatsNew(repo, rel) : '';
      return { ok: true, repo, current, latest: String(rel.tag_name).replace(/^v/i, ''), available: isNew, notes, pageUrl: rel.html_url, asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size, digest: asset.digest || '' } : null, source: 'release' };
    }
    const r = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/package.json`, { headers: { 'User-Agent': 'ClipForge-Updater' }, signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return { ok: false, error: 'not-found', message: `Repository "${repo}" was not found. Check the name (owner/repo) and that it is public.` };
    if (!r.ok) throw new Error(`GitHub answered HTTP ${r.status}`);
    const pkg = await r.json();
    return { ok: true, repo, current, latest: String(pkg.version || '0.0.0'), available: newer(pkg.version, current), notes: '', pageUrl: `https://github.com/${repo}`, asset: null, source: 'package' };
  } catch (e) {
    return { ok: false, error: 'network', message: /fetch failed|ENOTFOUND|network|timeout|aborted/i.test(String(e.message)) ? 'Could not reach GitHub. Check your internet connection.' : String(e.message || e) };
  }
}
module.exports = { check, cleanRepo, newer };
