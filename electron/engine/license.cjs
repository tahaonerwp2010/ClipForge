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
  if (process.env.CF_MACHINE_ID) return process.env.CF_MACHINE_ID;      // Android: ANDROID_ID survives reinstalling the app
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

// What does this PC get? Asks Supabase (server time decides trial / pro days); when offline, the last answer is used with the saved clock offset.
const DAY = 86400e3, TRIAL_DAYS = 7;
let registered = false;
function shape(id, raw, online, wantTrial) {
  // raw = { forever, proUntil(ms|null), trialEnd(ms|null), offset(ms: serverNow - localNow) }
  let now = Date.now() + (raw.offset || 0);
  const c = readCache();
  if (c.lastSeen && now < c.lastSeen - 600e3) now = c.lastSeen;               // the clock was turned back: do not go back in time
  writeCache({ lastSeen: Math.max(now, c.lastSeen || 0) });
  const proActive = !!raw.forever || (raw.proUntil != null && raw.proUntil > now);
  const trialActive = !proActive && wantTrial && raw.trialEnd != null && raw.trialEnd > now;
  const left = (t) => Math.max(0, Math.ceil((t - now) / DAY));
  return { id, pro: proActive, forever: !!raw.forever, proDaysLeft: proActive && !raw.forever ? left(raw.proUntil) : null,
    trial: trialActive, trialDaysLeft: trialActive ? left(raw.trialEnd) : 0, configured: configured(), online };
}
async function status(opt) {
  const id = deviceId(), c = readCache(), wantTrial = !!(opt && opt.trial);
  if (!configured()) {
    const t0 = c.localTrialStart || Date.now(); if (wantTrial && !c.localTrialStart) writeCache({ localTrialStart: t0 });
    return shape(id, { forever: false, proUntil: null, trialEnd: wantTrial ? t0 + TRIAL_DAYS * DAY : null }, false, wantTrial);
  }
  try {
    if (!registered) { await rpc('cf_register', { p_id: id }); registered = true; }
    const r = await rpc('cf_status', { p_id: id, p_trial: wantTrial });
    const raw = { forever: !!r.forever, proUntil: r.proUntil ? Date.parse(r.proUntil) : null, trialEnd: r.trialEnd ? Date.parse(r.trialEnd) : null, offset: Date.parse(r.now) - Date.now() };
    writeCache({ raw, checkedAt: Date.now(), id });
    return shape(id, raw, true, wantTrial);
  } catch (e) {
    const old = c.id === id && c.raw && c.checkedAt && Date.now() - c.checkedAt < 30 * DAY ? c.raw : null;
    if (old) return shape(id, old, false, wantTrial);
    // never reached the server yet: a local 7-day trial, replaced by the server's answer as soon as it is reachable
    const t0 = c.localTrialStart || Date.now(); if (wantTrial && !c.localTrialStart) writeCache({ localTrialStart: t0 });
    return shape(id, { forever: false, proUntil: null, trialEnd: wantTrial ? t0 + TRIAL_DAYS * DAY : null }, false, wantTrial);
  }
}
async function register() { const id = deviceId(); if (configured()) { try { await rpc('cf_register', { p_id: id }); } catch {} } return { id, configured: configured() }; }

const owner = {
  check: async (pw) => { try { return { ok: (await rpc('cf_owner_check', { p_pw: pw })) === true }; } catch (e) { return { ok: false, error: e.message }; } },
  lookup: async (pw, id) => { try { return { ok: true, ...(await rpc('cf_owner_lookup', { p_pw: pw, p_id: id })) }; } catch (e) { return { ok: false, error: e.message }; } },
  suggest: async (pw, q) => { try { return { ok: true, list: (await rpc('cf_owner_suggest', { p_pw: pw, p_q: q })) || [] }; } catch (e) { return { ok: false, error: e.message, list: [] }; } },
  grant: async (pw, id, plan) => { try { return { ok: true, ...(await rpc('cf_owner_grant', { p_pw: pw, p_id: id, p_plan: plan })) }; } catch (e) { return { ok: false, error: e.message }; } },
  remove: async (pw, id) => { try { return { ok: true, ...(await rpc('cf_owner_remove', { p_pw: pw, p_id: id })) }; } catch (e) { return { ok: false, error: e.message }; } },
};
module.exports = { deviceId, status, register, owner, configured };
