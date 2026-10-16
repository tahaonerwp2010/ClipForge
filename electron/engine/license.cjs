// Pro licence: every PC has one unique id; Supabase says whether that id is pro. Only the PUBLIC (anon) key is in the app.
// All real checks happen inside Supabase functions (see supabase/setup.sql), the owner password never lives in the app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const P = require('./paths.cjs');

let cfg = {};
try { cfg = require('./license-config.json'); } catch {}
const URL_ = String(process.env.CF_SUPABASE_URL || cfg.supabaseUrl || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const KEY = String(process.env.CF_SUPABASE_KEY || cfg.anonKey || '');
const configured = () => !!(URL_ && KEY);
const CACHE_DAYS = 30;                                  // how long "pro" is trusted while offline

const file = () => path.join(P.userDataDir(), 'license.json');
const readCache = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; } };
const writeCache = (o) => { try { fs.writeFileSync(file(), JSON.stringify({ ...readCache(), ...o })); } catch {} };

function machineGuid() {
  try {
    if (process.platform === 'win32') {
      const o = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true, timeout: 5000 }).toString();
      const m = o.match(/MachineGuid\s+REG_SZ\s+([^\s]+)/i); if (m) return m[1];
    } else if (process.platform === 'darwin') {
      const o = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { timeout: 5000 }).toString();
      const m = o.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/); if (m) return m[1];
    } else {
      for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) { try { const t = fs.readFileSync(f, 'utf8').trim(); if (t) return t; } catch {} }
    }
  } catch {}
  return '';
}
// Unique per PC: derived from the operating system's machine id; reinstalling ClipForge gives the same id.
function deviceId() {
  const c = readCache();
  let g = machineGuid();
  if (!g) { g = c.fallbackGuid || crypto.randomBytes(16).toString('hex'); if (!c.fallbackGuid) writeCache({ fallbackGuid: g }); }
  const h = crypto.createHash('sha256').update('clipforge|' + g).digest('hex').slice(0, 16).toUpperCase();
  return `CF-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}`;
}

async function rpc(name, body) {
  if (!configured()) throw new Error('not-configured');
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) { let m = t; try { m = JSON.parse(t).message || t; } catch {} throw new Error(/denied/i.test(m) ? 'denied' : String(m).slice(0, 160)); }
  return t ? JSON.parse(t) : null;
}

// Is this PC pro? Asks Supabase; when offline, a recent "pro" answer is still trusted for a while.
let registered = false;
async function status() {
  const id = deviceId(), c = readCache();
  if (!configured()) return { id, pro: false, configured: false, online: false };
  try {
    if (!registered) { await rpc('cf_register', { p_id: id }); registered = true; }   // every PC that opens ClipForge is stored (starts as free)
    const pro = (await rpc('cf_get_pro', { p_id: id })) === true;
    writeCache({ pro, checkedAt: Date.now(), id });
    return { id, pro, configured: true, online: true };
  } catch (e) {
    const fresh = c.id === id && c.pro && c.checkedAt && Date.now() - c.checkedAt < CACHE_DAYS * 86400e3;
    return { id, pro: !!fresh, configured: true, online: false };
  }
}
async function register() { const id = deviceId(); if (configured()) { try { await rpc('cf_register', { p_id: id }); } catch {} } return { id, configured: configured() }; }

const owner = {
  check: async (pw) => { try { return { ok: (await rpc('cf_owner_check', { p_pw: pw })) === true }; } catch (e) { return { ok: false, error: e.message }; } },
  lookup: async (pw, id) => { try { return { ok: true, ...(await rpc('cf_owner_lookup', { p_pw: pw, p_id: id })) }; } catch (e) { return { ok: false, error: e.message }; } },
  suggest: async (pw, q) => { try { return { ok: true, list: (await rpc('cf_owner_suggest', { p_pw: pw, p_q: q })) || [] }; } catch (e) { return { ok: false, error: e.message, list: [] }; } },
  set: async (pw, id, pro) => { try { await rpc('cf_owner_set', { p_pw: pw, p_id: id, p_pro: !!pro }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
};
module.exports = { deviceId, status, register, owner, configured };
