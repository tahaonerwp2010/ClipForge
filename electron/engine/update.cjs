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

async function check(repoIn, current) {
  const repo = cleanRepo(repoIn);
  if (!/^[\w.\-]+\/[\w.\-]+$/.test(repo)) return { ok: false, error: 'no-repo', message: 'No GitHub repository is set for updates.' };
  try {
    const rel = await getJson(`https://api.github.com/repos/${repo}/releases/latest`);
    if (rel && rel.tag_name) {
      const assets = rel.assets || [];
      const plat = process.platform === 'win32' ? { os: /windows|win/i, ext: /\.exe$/i } : process.platform === 'darwin' ? { os: /mac|darwin|osx/i, ext: /\.dmg$/i } : { os: /linux/i, ext: /\.appimage$/i };
      const asset = assets.find(a => plat.ext.test(a.name)) || assets.find(a => plat.os.test(a.name)) || null;
      return { ok: true, repo, current, latest: String(rel.tag_name).replace(/^v/i, ''), available: newer(rel.tag_name, current), notes: String(rel.body || '').slice(0, 800), pageUrl: rel.html_url, asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null, source: 'release' };
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
