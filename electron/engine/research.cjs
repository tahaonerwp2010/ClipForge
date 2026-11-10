// Reads the web pages the creator names (links in the answers) so the editor knows what the video is about.
const https = require('https');
const http = require('http');
const dec = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch { return reject(new Error('bad link')); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClipForge)', 'Accept': 'text/html,*/*;q=0.8', 'Accept-Language': 'en' }, timeout: 9000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) { res.resume(); return resolve(get(new URL(res.headers.location, u).toString(), hops + 1)); }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const ch = []; let n = 0;
      res.on('data', d => { n += d.length; if (n > 600000) { req.destroy(); resolve(Buffer.concat(ch).toString('utf8')); } else ch.push(d); });
      res.on('end', () => resolve(Buffer.concat(ch).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}
function digest(url, html) {
  const meta = n => { const m = html.match(new RegExp('<meta[^>]+(?:name|property)=["\\\']' + n + '["\\\'][^>]*content=["\\\']([^"\\\']*)', 'i')) || html.match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:name|property)=["\\\']' + n + '["\\\']', 'i')); return m ? dec(m[1]) : ''; };
  const title = dec((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) || meta('og:title');
  const desc = meta('description') || meta('og:description');
  const body = html.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ');
  const heads = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => dec(m[1].replace(/<[^>]+>/g, ' '))).filter(x => x && x.length < 120).slice(0, 8).join(' | ');
  const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => dec(m[1].replace(/<[^>]+>/g, ' '))).filter(x => x.length > 40).slice(0, 6).join(' ');
  return { url, title: title.slice(0, 120), desc: desc.slice(0, 300), text: (heads ? 'Headings: ' + heads + '. ' : '') + paras.slice(0, 700) };
}
async function research(urls, log) {
  const out = [];
  for (const raw of urls.slice(0, 4)) {
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    try { const d = digest(url, await get(url)); out.push(d); log && log('Research', `Read ${url}: ${d.title || 'ok'}`, 'success'); }
    catch (e) { log && log('Research', `Could not open ${url} (${String(e.message).slice(0, 60)})`, 'warn'); }
  }
  return out;
}
module.exports = { research, digest };
