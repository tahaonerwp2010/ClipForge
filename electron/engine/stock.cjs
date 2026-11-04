// Auto stock b-roll: the AI turns what is said into short English search words, the stock sites (free: Pexels, Pixabay; paid: Shutterstock, Storyblocks)
// are searched, and the best matching short video is downloaded (once, then cached) and offered to the b-roll planner like one of the user's own videos.
// Needs the user's own API keys (Settings > Stock footage); without a key nothing is searched.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const P = require('./paths.cjs');
const AI = require('./ai.cjs');

const ORDER = ['pexels', 'pixabay', 'shutterstock', 'storyblocks'];
const UA = { 'User-Agent': 'ClipForge' };
const cacheDir = () => { const d = path.join(P.userDataDir(), 'stockcache'); fs.mkdirSync(d, { recursive: true }); return d; };
const jget = async (url, headers = {}, ms = 20000) => {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(ms) });
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error('invalid key'), { kind: 'invalid' });
  if (r.status === 429) throw Object.assign(new Error('rate limit'), { kind: 'limit' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};
// best file of a result: about 720p, not huge (these are short cut-aways)
const pickFile = (files) => files.filter(f => f.link).map(f => ({ ...f, s: Math.max(f.width || 0, f.height || 0) }))
  .sort((a, b) => Math.abs(a.s - 1280) - Math.abs(b.s - 1280))[0];

const PROV = {
  async pexels(key, q, o) {
    const j = await jget(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=12&size=medium`, { Authorization: key });
    return (j.videos || []).map(v => { const f = pickFile((v.video_files || []).filter(x => /mp4/i.test(x.file_type || 'mp4')).map(x => ({ link: x.link, width: x.width, height: x.height }))); return f && { id: 'pexels_' + v.id, url: f.link, dur: v.duration, w: f.width, h: f.height }; }).filter(Boolean);
  },
  async pixabay(key, q) {
    const j = await jget(`https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=12&safesearch=true`);
    return (j.hits || []).map(v => { const f = pickFile(Object.values(v.videos || {}).map(x => ({ link: x.url, width: x.width, height: x.height }))); return f && { id: 'pixabay_' + v.id, url: f.link, dur: v.duration, w: f.width, h: f.height }; }).filter(Boolean);
  },
  // Paid providers (best effort, from their public API documents): the key is a Shutterstock API token / "publicKey:privateKey" of Storyblocks.
  async shutterstock(key, q, o) {
    const [token, sub] = String(key).split('|');
    const j = await jget(`https://api.shutterstock.com/v2/videos/search?query=${encodeURIComponent(q)}&per_page=10&sort=relevance`, { Authorization: 'Bearer ' + token });
    return (j.data || []).map(v => ({ id: 'shutterstock_' + v.id, url: null, dur: v.duration, w: 0, h: 0, lic: sub ? { token, sub, id: v.id } : null, preview: v.assets && v.assets.preview_mp4 && v.assets.preview_mp4.url })).filter(x => x.lic || x.preview);
  },
  async storyblocks(key, q) {
    const [pub, priv] = String(key).split(':'); if (!pub || !priv) throw Object.assign(new Error('invalid key'), { kind: 'invalid' });
    const expires = Math.floor(Date.now() / 1000) + 3600, route = '/api/v2/videos/search';
    const hmac = crypto.createHmac('sha256', priv + expires).update(route).digest('hex');
    const j = await jget(`https://api.storyblocks.com${route}?api_key=${encodeURIComponent(pub)}&project_id=clipforge&user_id=clipforge&keywords=${encodeURIComponent(q)}&results_per_page=10&expires=${expires}&hmac=${hmac}`);
    return (j.results || j.info || []).map(v => { const pu = v.preview_urls || {}; const url = pu._720p || pu._1080p || pu._480p || Object.values(pu)[0]; return url && { id: 'storyblocks_' + (v.id || v.stock_item_id), url, dur: v.duration, w: 0, h: 0 }; }).filter(Boolean);
  },
};
async function test(provider, key) {
  try { const r = await PROV[provider](String(key).trim(), 'nature', {}); return { ok: true, message: r.length ? 'Key works.' : 'Key accepted (no result for the test search).' }; }
  catch (e) { return { ok: false, kind: e.kind || 'error', message: e.kind === 'invalid' ? 'This key was not accepted.' : e.kind === 'limit' ? 'Rate limit reached - the key itself is fine.' : /fetch failed|timeout|abort/i.test(String(e.message)) ? 'Could not reach the website. Check the internet connection.' : String(e.message).slice(0, 120) }; }
}
async function download(h, url) {
  const f = path.join(cacheDir(), h.id.replace(/[^\w-]/g, '_') + '.mp4');
  if (fs.existsSync(f) && fs.statSync(f).size > 20000) return f;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('download HTTP ' + r.status);
  const len = +r.headers.get('content-length') || 0; if (len > 80e6) throw new Error('file too big');
  fs.writeFileSync(f + '.part', Buffer.from(await r.arrayBuffer())); fs.renameSync(f + '.part', f);
  return f;
}
async function fileFor(h, key, prov) {
  if (h.url) return download(h, h.url);
  if (prov === 'shutterstock' && h.lic) {          // licensed download needs the user's subscription id ("token|subscriptionId")
    const r = await fetch(`https://api.shutterstock.com/v2/videos/licenses?subscription_id=${encodeURIComponent(h.lic.sub)}`, { method: 'POST', headers: { ...UA, Authorization: 'Bearer ' + h.lic.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ videos: [{ video_id: h.lic.id, size: 'web' }] }), signal: AbortSignal.timeout(30000) });
    const j = await r.json(); const u = j && j.data && j.data[0] && j.data[0].download && j.data[0].download.url; if (!u) throw new Error('licence failed');
    return download(h, u);
  }
  if (h.preview) return download(h, h.preview);
  throw new Error('no file');
}

// The search words for the sentences of a clip: AI (works for every spoken language), or the plain English words when there is no AI.
const STOP = new Set('this that with have from they them then than what when where which will would there their about because just like really very been were your you and the for are but not can get got how why who'.split(' '));
async function queriesFor(segs, n, gemini, log) {
  if (AI.ready(gemini)) {
    try {
      const lines = segs.slice(0, 50).map(g => `${g.i}. ${g.text}`).join('\n');
      const prompt = `You pick stock-video search words for B-roll cut-aways over a speaker in a vertical short video. The speech may be in ANY language.\n\nSENTENCES (index, text):\n${lines}\n\nChoose up to ${n} sentences where a short cut-away would look good (concrete things that can be filmed: places, objects, actions, nature, city, money, technology...). Skip abstract sentences. For each give an English stock-footage search "query" of 2-4 words (no people talking to camera, no text, no brand names).\nAnswer ONLY JSON: {"queries":[{"seg":<index>,"query":"..."}]}`;
      const r = await AI.generate(gemini, { prompt, json: true, timeoutMs: 40000 });
      const j = AI.parseJson(r.text !== undefined ? r.text : r);
      const out = ((j && j.queries) || []).filter(x => x && x.query && segs[+x.seg]).map(x => ({ seg: +x.seg, q: String(x.query).slice(0, 60) }));
      if (out.length) return out;
    } catch (e) { if (String(e.message) === 'CANCELLED') throw e; log('Stock B-roll', 'AI could not write search words (' + String(e.message).slice(0, 70) + ')', 'warn'); }
  }
  const out = [];
  segs.forEach(g => { const w = String(g.text).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(x => x.length > 4 && !STOP.has(x)); if (w.length >= 2) out.push({ seg: g.i, q: w.slice(0, 3).join(' ') }); });
  return out.sort(() => 0).slice(0, n);
}

// -> prepared videos (same shape as broll.prepare) for ONE clip
async function forClip({ segs, dur, cfg, gemini, log, keys, seen }) {
  const have = ORDER.filter(p => keys && keys[p] && String(keys[p]).trim());
  if (!have.length) { if (!seen.noKey) { seen.noKey = true; log('Stock B-roll', 'Auto stock b-roll needs an API key: add one in Settings > Stock footage.', 'warn'); } return []; }
  const share = Math.max(5, Math.min(32, +cfg.pct || 20)), n = Math.max(2, Math.min(7, Math.ceil(dur * share / 100 / 2.6) + 1));
  const qs = await queriesFor(segs, n + 1, gemini, log);
  const out = [];
  for (const { seg, q } of qs) {
    if (out.length >= n) break;
    let got = null;
    for (const prov of have) {
      try {
        const ck = prov + '|' + q; let list = seen.q.get(ck);
        if (!list) { list = await PROV[prov](String(keys[prov]).trim(), q, {}); seen.q.set(ck, list); }
        const h = list.filter(x => (x.dur || 6) >= 3 && !seen.used.has(x.id))[0]; if (!h) continue;
        const f = await fileFor(h, keys[prov], prov);
        seen.used.add(h.id); got = { path: f, name: q + ' (' + prov + ')', key: h.id, rec: { duration: h.dur || 8, shots: [{ a: 0, b: +Math.min(h.dur || 8, 14).toFixed(2), mid: 2, desc: q, q: 4, uses: 0 }] } };
        break;
      } catch (e) { if (String(e.message) === 'CANCELLED') throw e; if (e.kind === 'invalid' && !seen['bad' + prov]) { seen['bad' + prov] = 1; log('Stock B-roll', prov + ' did not accept the key - check Settings > Stock footage.', 'warn'); } }
    }
    if (got) out.push(got);
  }
  log('Stock B-roll', out.length ? `${out.length} stock clip${out.length === 1 ? '' : 's'} found (${have.join(', ')})` : 'No matching stock clips found for this clip', out.length ? 'info' : 'warn');
  return out;
}
module.exports = { test, forClip, ORDER };
