// Gumroad licence check (card payments for ClipForge Pro). A buyer gets a licence key from Gumroad after subscribing;
// ClipForge asks Gumroad whether that key still belongs to a running subscription. No secret is needed for this call.
const PRODUCT_ID = String(process.env.CF_GUMROAD_PRODUCT || '0cQiuocRTV9d7CPon2AfJw==');
const URL_ = 'https://api.gumroad.com/v2/licenses/verify';

// -> { ok:true, active, reason, email } | { ok:false, error:'invalid'|'network' }
async function verify(key) {
  const k = String(key || '').trim();
  if (!/^[A-Za-z0-9\-]{16,64}$/.test(k)) return { ok: false, error: 'invalid' };
  let r, j;
  try {
    r = await fetch(URL_, { method: 'POST', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ClipForge' },
      body: new URLSearchParams({ product_id: PRODUCT_ID, license_key: k, increment_uses_count: 'false' }).toString() });
    j = await r.json().catch(() => null);
  } catch { return { ok: false, error: 'network' }; }
  if (!j) return { ok: false, error: r && r.status >= 500 ? 'network' : 'invalid' };
  if (!j.success) return r.status === 404 || /not.*exist|invalid|found/i.test(String(j.message || '')) ? { ok: false, error: 'invalid' } : { ok: false, error: 'network' };
  const p = j.purchase || {};
  // running = nothing ended or failed, and not refunded / charged back. (A cancelled subscription keeps working until Gumroad ends it.)
  let reason = '';
  if (p.refunded) reason = 'This purchase was refunded.';
  else if (p.chargebacked || p.disputed) reason = 'This purchase was disputed.';
  else if (p.subscription_ended_at) reason = 'This subscription has ended. Subscribe again to use Pro.';
  else if (p.subscription_failed_at) reason = 'The last payment failed. Update your payment method on Gumroad.';
  return { ok: true, active: !reason, reason, email: p.email || '' };
}
module.exports = { verify, PRODUCT_ID };
