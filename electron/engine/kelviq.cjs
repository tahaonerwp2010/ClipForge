// Kelviq licence check (second card-payment option for ClipForge Pro). A buyer gets a licence key from Kelviq after paying;
// ClipForge asks Kelviq whether that key is still valid. Only the CLIENT API key is used here (it is made for distributed apps and is safe to ship);
// never put the Server API key in the app.
// MODE: 'live' for real sales ('sandbox' only for testing with the sandbox Client key + sandbox checkout link in src/config/proConfig.ts).
const MODE = 'live';
const CLIENT_KEY = String(process.env.CF_KELVIQ_KEY || 'client-0afde58c-73d2-4075-a5c8-420d0a4cb00b:78b8a20c-a23b-40a2-a653-8a573b92b2d2').trim();
const BASE = (process.env.CF_KELVIQ_SANDBOX || MODE === 'sandbox') ? 'https://sandboxapi.kelviq.com' : 'https://api.kelviq.com';
const configured = () => !!CLIENT_KEY;

// -> { ok:true, active, reason, email } | { ok:false, error:'invalid'|'network'|'not-configured' }
async function verify(key) {
  const k = String(key || '').trim();
  if (!configured()) return { ok: false, error: 'not-configured' };
  if (!/^[A-Za-z0-9\-_.]{8,128}$/.test(k)) return { ok: false, error: 'invalid' };
  let r, j;
  try {
    r = await fetch(`${BASE}/api/v1/license/validate/`, { method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CLIENT_KEY}`, 'User-Agent': 'ClipForge' }, body: JSON.stringify({ licenseKey: k }) });
    j = await r.json().catch(() => null);
  } catch { return { ok: false, error: 'network' }; }
  if (!j) return { ok: false, error: r && r.status >= 500 ? 'network' : 'invalid' };
  if (r.status === 401 || r.status === 403) return { ok: false, error: 'network' };            // wrong/missing app key: never blame the buyer's key
  if (r.status >= 500) return { ok: false, error: 'network' };
  if (!j.valid) return r.status === 404 || r.status === 400 || j.code === 'INVALID_KEY' ? { ok: false, error: 'invalid' } : { ok: true, active: false, reason: String(j.detail || 'This licence is not valid.'), email: '' };
  const l = j.license || {};
  let reason = '';
  const sub = l.subscription || null;
  if (l.enabled === false) reason = 'This licence was deactivated (for example after a refund).';
  else if (l.expiresOn && Date.parse(l.expiresOn) < Date.now()) reason = 'This licence has expired. Renew it to use Pro.';
  else if (sub && sub.billingType !== 'ONE_TIME') {
    // Monthly plan: Pro lasts for the paid month. A renewal moves the period end forward; if it is not paid, Pro stops after a short grace (3 days).
    const st = String(sub.status || '').toLowerCase();
    const end = sub.billingPeriodEndTime ? Date.parse(sub.billingPeriodEndTime) : (sub.endDate ? Date.parse(sub.endDate) : NaN);
    const over = Number.isFinite(end) && Date.now() > end + 3 * 86400e3;
    if (/unpaid|past[_ ]?due|expired|ended|incomplete|failed/.test(st) || (over && !/trial/.test(st))) reason = 'Your monthly Pro period has ended. Renew your subscription to keep using Pro.';
    else if (/cancel/.test(st) && Number.isFinite(end) && Date.now() > end) reason = 'This subscription was cancelled and its paid month is over. Subscribe again to use Pro.';
  }
  return { ok: true, active: !reason, reason, email: (l.customer && l.customer.email) || '' };
}
module.exports = { verify, configured };
