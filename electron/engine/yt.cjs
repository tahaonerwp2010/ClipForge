// YouTube download via yt-dlp (auto-fetched once into userData/bin).
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn: realSpawn } = require('child_process');
// Android: yt-dlp runs inside the native side (python is bundled there), so 'spawn' is routed to a bridge that looks like a normal child process.
const spawn = (cmd, ...r) => (cmd === '__mobile_ytdlp__' && global.__cfMobileSpawn) ? global.__cfMobileSpawn(cmd, ...r) : realSpawn(cmd, ...r);
const P = require('./paths.cjs');

let cur = null;
let cancelled = false;
const procs = new Set();
function killTree(p) {
  if (!p) return;
  try {
    if (process.platform === 'win32' && p.pid) spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true });
    else p.kill('SIGKILL');
  } catch { try { p.kill(); } catch {} }
}
// Newer yt-dlp needs a JavaScript runtime (Deno 2.3+) to read YouTube. Electron's built-in Node is too old for it, so we fetch Deno once into userData/bin.
let jsRt = null;
async function ensureDeno(onStatus) {
  if (global.__cfMobileSpawn) return null;
  if (jsRt && fs.existsSync(jsRt)) return jsRt;
  const win = process.platform === 'win32';
  const dest = path.join(P.userDataDir(), 'bin', win ? 'deno.exe' : 'deno');
  const works = (b) => { try { return /deno\s+\d/.test(require('child_process').execFileSync(b, ['--version'], { timeout: 15000, windowsHide: true }).toString()); } catch { return false; } };
  if (fs.existsSync(dest)) { if (works(dest)) return (jsRt = dest); try { fs.unlinkSync(dest); } catch {} }
  const sys = P.resolveBin('deno'); if (sys) return (jsRt = sys);
  const arm = process.arch === 'arm64';
  const triple = win ? 'x86_64-pc-windows-msvc' : process.platform === 'darwin' ? (arm ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin') : (arm ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu');
  const dir = path.join(P.userDataDir(), 'bin'); fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'deno.zip');
  onStatus && onStatus('Preparing downloader helper (one-time, ~40 MB)…', 0);
  try {
    await fetchTo(`https://github.com/denoland/deno/releases/latest/download/deno-${triple}.zip`, zip, (p) => onStatus && onStatus('Preparing downloader helper (one-time, ~40 MB)…', p));
    await new Promise((ok, bad) => {
      const c = win ? spawn('tar', ['-xf', zip, '-C', dir], { windowsHide: true }) : spawn('unzip', ['-o', zip, '-d', dir], { windowsHide: true });
      c.on('error', bad); c.on('close', (code) => code === 0 ? ok() : bad(new Error('extract failed ' + code)));
    }).catch(() => new Promise((ok, bad) => {
      if (!win) return bad(new Error('extract failed'));
      const c = spawn('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${zip}' -DestinationPath '${dir}'`], { windowsHide: true });
      c.on('error', bad); c.on('close', (code) => code === 0 ? ok() : bad(new Error('extract failed ' + code)));
    }));
    try { fs.chmodSync(dest, 0o755); } catch {}
    try { fs.unlinkSync(zip); } catch {}
    if (fs.existsSync(dest) && works(dest)) return (jsRt = dest);
  } catch { try { fs.unlinkSync(zip); } catch {} }
  return null;
}
function jsArgs() {
  if (global.__cfMobileSpawn) return [];
  return jsRt ? ['--js-runtimes', 'deno:' + jsRt] : [];
}
const jsEnv = () => process.env;
const isUrl = (u) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(u || '').trim());

function fetchTo(url, dest, onPct, hops = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ClipForge' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 6) {
        res.resume(); return fetchTo(new URL(res.headers.location, url).toString(), dest, onPct, hops + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const total = +res.headers['content-length'] || 0; let got = 0, lastQ = -1;
      const out = fs.createWriteStream(dest);
      res.on('data', (d) => { got += d.length; if (total && onPct) { const q = Math.round(got / total * 100); if (q !== lastQ) { lastQ = q; onPct(q); } } });
      res.pipe(out); out.on('finish', () => out.close(resolve)); out.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function ensureYtDlp(onStatus) {
  if (global.__cfMobileSpawn) { onStatus && onStatus('Preparing downloader…', 0); await global.__cfMobileInitYt(); return '__mobile_ytdlp__'; }
  const have = P.resolveBin('yt-dlp');
  const userCopy = path.join(P.userDataDir(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  // Always use our own freshly downloaded copy (refreshed every 12 h). A copy that shipped inside the installer is only a fallback because YouTube breaks old versions within weeks.
  const fresh = fs.existsSync(userCopy) && (Date.now() - fs.statSync(userCopy).mtimeMs < 12 * 3600e3);
  if (fresh) return userCopy;
  const win = process.platform === 'win32';
  const name = win ? 'yt-dlp.exe' : (process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp');
  const binDir = path.join(P.userDataDir(), 'bin'); fs.mkdirSync(binDir, { recursive: true });
  const dest = path.join(binDir, win ? 'yt-dlp.exe' : 'yt-dlp');
  const url = process.env.CF_YTDLP_URL || `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${name}`;
  onStatus && onStatus('Preparing downloader (one-time, ~15 MB)…', 0);
  try { await fetchTo(url, dest + '.part', (p) => onStatus && onStatus('Preparing downloader (one-time, ~15 MB)…', p)); }
  catch (e) { try { fs.unlinkSync(dest + '.part'); } catch {} if (fs.existsSync(userCopy)) return userCopy; if (have) return have; throw new Error('Could not fetch the downloader. Check your internet connection. (' + e.message + ')'); }
  fs.renameSync(dest + '.part', dest);
  try { fs.chmodSync(dest, 0o755); } catch {}
  return dest;
}

function cancel() { cancelled = true; for (const p of procs) killTree(p); procs.clear(); cur = null; }

function friendly(err) {
  const t = String(err || '');
  if (/Private video|Sign in|members-only/i.test(t)) return 'This video is private or needs a sign-in.';
  if (/Requested format is not available|Only images are available|n challenge|challenge solving|JavaScript runtime|js.?runtime/i.test(t)) return 'YouTube did not give a downloadable stream (the downloader helper may be missing). ' + (jsRt ? '' : 'The helper could not be installed — check your internet and try again. ') + '[' + ((t.match(/ERROR:[^\n]*/g) || []).pop() || '').replace(/^ERROR:\s*(\[youtube\]\s*)?/, '').slice(0, 170) + '] Log: ytdlp-log.txt in the app data folder.';
  if (/ERROR:[^\n]*(Video unavailable|has been removed|no longer available|not made this video available)/i.test(t)) return 'This video is unavailable.';
  if (/Unsupported URL/i.test(t)) return 'This link is not supported. Paste a YouTube video link.';
  if (/Unable to download|getaddrinfo|Temporary failure|timed out|Network/i.test(t)) return 'Network problem. Check your internet and try again.';
  if (/ZZZZ/.test(t)) return 'The downloader helper could not be prepared. Check your internet connection and try again. (' + (t.trim().split('\n').pop() || '').slice(0, 140) + ')';
  return 'Download failed. ' + (t.trim().split('\n').pop() || '').slice(0, 160);
}

const num = (x) => { const n = Number(x); return isFinite(n) && x !== '' && x !== 'NA' && x !== 'None' ? n : null; };

// Ask yt-dlp for the size of the chosen formats first, so the bar can show a real total (video + audio).
function probeSize(bin, url, fmt, extra = []) {
  return new Promise((resolve) => {
    let out = '', done = false;
    const p = spawn(bin, ['--no-playlist', ...jsArgs(), ...extra, '-f', fmt, '--print', 'CFSZ|%(requested_formats.0.filesize,requested_formats.0.filesize_approx)s|%(requested_formats.1.filesize,requested_formats.1.filesize_approx)s|%(filesize,filesize_approx)s', url], { windowsHide: true, env: jsEnv() }); procs.add(p);
    const fin = (v) => { if (!done) { done = true; clearTimeout(t); procs.delete(p); killTree(p); resolve(v); } };
    const t = setTimeout(() => fin(0), 30000);
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', () => fin(0));
    p.on('close', () => {
      const m = out.match(/CFSZ\|([^|\n]*)\|([^|\n]*)\|([^|\n\r]*)/);
      if (!m) return fin(0);
      const a = num(m[1].trim()), b = num(m[2].trim()), c = num(m[3].trim());
      fin(a != null && b != null ? a + b : (c || a || 0));
    });
  });
}

// Different "routes" to YouTube. The first is yt-dlp's default; if a route is throttled (a few KB/s) we switch to the next one and resume.
const ROUTES = [
  { name: 'default', args: [] },
  { name: 'android_vr', args: ['--extractor-args', 'youtube:player_client=android_vr'] },
  { name: 'tv', args: ['--extractor-args', 'youtube:player_client=tv'] },
  { name: 'ios', args: ['--extractor-args', 'youtube:player_client=ios'] },
];
const SLOW_BPS = 40 * 1024;                        // below this for ~15 s = really throttled (a merely slow connection is left alone)
const FAST_ARGS = ['-N', '4', '--http-chunk-size', '10M', '--retries', '15', '--fragment-retries', '15', '--retry-sleep', '2', '--socket-timeout', '60'];

async function download(url, dir, onProgress) {
  url = String(url || '').trim();
  if (!isUrl(url)) throw new Error('Please paste a valid video link.');
  fs.mkdirSync(dir, { recursive: true });
  cancelled = false;
  const bin = await ensureYtDlp((m, p) => { if (!cancelled) onProgress({ phase: 'prepare', percent: p, text: m }); });
  if (cancelled) throw new Error('Cancelled');
  await ensureDeno((m, p) => { if (!cancelled) onProgress({ phase: 'prepare', percent: p, text: m }); });
  if (cancelled) throw new Error('Cancelled');
  const ff = global.__cfMobileSpawn ? null : P.resolveBin('ffmpeg');
  const fmt = 'bv*[height<=1080]+ba/b[height<=1080]/b';
  let lastErr = '';
  const NET = /Unable to download|getaddrinfo|Temporary failure|timed out|Network|Connection (reset|aborted)|Read timed out|IncompleteRead|HTTP Error 5\d\d|EOF occurred/i;
  // Routes 0..n-1 may be abandoned when throttled. The last pass (default route, patient) never gives up because of speed.
  const passes = [...ROUTES.map((rt, i) => ({ rt, canSwitch: i < ROUTES.length - 1 })), { rt: ROUTES[0], canSwitch: false, last: true }];
  for (let r = 0; r < passes.length; r++) {
    const { rt, canSwitch, last } = passes[r];
    onProgress({ phase: 'prepare', percent: 0, text: r === 0 ? 'Reading video info…' : (last ? 'Continuing the download…' : 'Slow connection to YouTube — trying another route…') });
    if (cancelled) throw new Error('Cancelled');
    const grand = await probeSize(bin, url, fmt, rt.args);
    if (cancelled) throw new Error('Cancelled');
    let res;
    for (let t = 0; t < 3; t++) {                               // brief network hiccups: retry the same route (the partial file is resumed)
      res = await attempt(bin, url, dir, fmt, ff, rt, grand, onProgress, canSwitch);
      if (res.ok || res.cancelled || cancelled || res.slow || !NET.test(res.error || '')) break;
      onProgress({ phase: 'prepare', percent: 0, text: 'Connection dropped — reconnecting…' });
      await new Promise(ok => setTimeout(ok, 2500));
    }
    if (res.ok) return res.value;
    if (res.cancelled || cancelled) throw new Error('Cancelled');
    lastErr = res.slow ? lastErr : (res.error || lastErr);
    if (!res.slow && /Private video|Sign in|unavailable|Unsupported URL/i.test(res.error || '') && r === 0) break;
  }
  throw new Error(friendly(lastErr));
}

function attempt(bin, url, dir, fmt, ff, route, grand, onProgress, canSwitch) {
  const args = ['--no-playlist', '--newline', '--no-colors', '--progress', '-f', fmt, '--merge-output-format', 'mp4', ...FAST_ARGS, ...jsArgs(), ...route.args,
    '--progress-template', 'download:CFP|%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '-o', path.join(dir, '%(title).80B [%(id)s].%(ext)s'), '--print', 'after_move:CFFILE:%(filepath)s', '--print', 'CFTITLE:%(title)s'];
  if (ff) args.push('--ffmpeg-location', path.dirname(ff));
  args.push(url);
  return new Promise((resolve) => {
    const p = spawn(bin, args, { windowsHide: true, env: jsEnv() }); cur = p; procs.add(p);
    let file = '', title = '', errBuf = '', buf = '', slowFlag = false;
    let base = 0, lastD = 0, lastT = 0, lastEmit = 0, tStart = 0, ema = 0, slowSince = 0;
    const line = (l) => {
      if (l.startsWith('CFFILE:')) { file = l.slice(7).trim(); return; }
      if (l.startsWith('CFTITLE:')) { title = l.slice(8).trim(); return; }
      if (l.startsWith('CFP|')) {
        const [, status, d, t1, t2, sp, eta] = l.split('|').map(x => x.trim());
        const done = num(d) || 0, tot = num(t1) || num(t2) || 0, speed = num(sp), etaS = num(eta);
        if (done < lastD - 1024) base += lastT || lastD;
        lastD = done; if (tot) lastT = tot; else lastT = Math.max(lastT, done);
        const overall = base + done;
        const total = Math.max(grand || 0, base + (tot || done));
        const now = Date.now();
        if (!tStart) tStart = now;
        if (speed != null) ema = ema ? ema * 0.7 + speed * 0.3 : speed;
        // throttled? (slow for 9 s in a row while a lot is still left) -> switch route and resume
        if (canSwitch && ema && ema < SLOW_BPS && total - overall > 8 * 1024 * 1024 && now - tStart > 4000) { if (!slowSince) slowSince = now; if (now - slowSince > 30000) { slowFlag = true; killTree(p); return; } }
        else slowSince = 0;
        if (now - lastEmit < 120 && status !== 'finished') return;
        lastEmit = now;
        const percent = total ? Math.min(99.5, overall / total * 100) : 0;
        onProgress({ phase: 'download', percent, done: overall, total, speed: speed || 0, eta: etaS != null ? etaS : null, text: 'Downloading…' });
        return;
      }
      if (/\[Merger\]|\[ExtractAudio\]|\[VideoRemuxer\]|\[FixupM/.test(l)) onProgress({ phase: 'merge', percent: 100, text: 'Finishing…' });
    };
    p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); } });
    p.stderr.on('data', (d) => { errBuf += d; });
    const logIt = () => { try { fs.appendFileSync(path.join(P.userDataDir(), 'ytdlp-log.txt'), `\n==== ${new Date().toISOString()} route=${route.name} deno=${jsRt || 'none'}\n${errBuf.slice(-4000)}\n`); } catch {} };
    p.on('error', (e) => { cur = null; procs.delete(p); resolve({ ok: false, error: e.message }); });
    p.on('close', (code) => {
      if (errBuf) logIt(); procs.delete(p); const wasCancelled = cancelled; if (cur === p) cur = null;
      if (wasCancelled) return resolve({ ok: false, cancelled: true });
      if (slowFlag) return resolve({ ok: false, slow: true, error: 'slow' });
      if (code === 0 && file && fs.existsSync(file)) return resolve({ ok: true, value: { path: file, title } });
      resolve({ ok: false, error: errBuf });
    });
  });
}
module.exports = { download, cancel, isUrl, ensureYtDlp, ensureDeno };
