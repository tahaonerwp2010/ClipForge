// 4 clickbait 9:16 thumbnail layouts, drawn as HTML/CSS and captured by a hidden window (hooks.shot) -> PNG.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const url = f => f ? pathToFileURL(f).toString() : '';
const SCRIPTS = /[؀-ۿऀ-ॿ]/;

function head(text) {   // last word gets the accent colour
  const w = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return `<span class="a">${esc(w[0] || '')}</span>`;
  const n = w.length > 4 ? 2 : 1;
  return esc(w.slice(0, -n).join(' ')) + ' <span class="a">' + esc(w.slice(-n).join(' ')) + '</span>';
}
function css(o) {
  const fd = o.fontsDir ? url(o.fontsDir) + '/' : '';
  return `@font-face{font-family:'TAnton';src:url('${fd}Anton.ttf')}
@font-face{font-family:'TAr';src:url('${fd}NotoSansArabic.ttf');unicode-range:U+0600-06FF}
@font-face{font-family:'TDe';src:url('${fd}NotoSansDevanagari.ttf');unicode-range:U+0900-097F}
@font-face{font-family:'TMont';src:url('${fd}MontserratExtraBold.ttf')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#000}
body{font-family:'TAnton','TAr','TDe',Impact,sans-serif;position:relative;color:#fff}
.a{color:${o.accent}}
.h{font-size:190px;line-height:1.0;text-transform:uppercase;letter-spacing:1px;text-shadow:0 8px 0 rgba(0,0,0,.55),0 0 40px rgba(0,0,0,.4);-webkit-text-stroke:6px #000;paint-order:stroke fill}
.rib{font-family:'TMont','TAr','TDe',sans-serif;font-weight:800;font-size:58px;background:#e11d1d;color:#fff;padding:22px 48px;border-radius:18px;box-shadow:0 10px 0 #7f0d0d;display:inline-block;text-transform:uppercase}
.abs{position:absolute}
.scr{background:#111 center/cover no-repeat;border-radius:14px}
.arrow{position:absolute;width:300px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.5))}
.chip{font-family:'TMont','TAr','TDe',sans-serif;font-weight:800;font-size:58px;background:#fff;color:#111;border-radius:60px;padding:20px 40px 20px 28px;display:flex;align-items:center;gap:22px;box-shadow:0 8px 0 rgba(0,0,0,.45)}
.chip i{width:68px;height:68px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:46px;flex:none}`;
}
const ARROW = c => `<svg class="arrow" viewBox="0 0 300 220"><path d="M20 20 C 120 20, 210 70, 215 150" stroke="${c}" stroke-width="34" fill="none" stroke-linecap="round"/><path d="M165 140 L222 205 L270 128 Z" fill="${c}"/></svg>`;
const scr = (o, extra) => o.screenshot ? `<div class="scr abs" style="background-image:url('${url(o.screenshot)}');${extra}"></div>` : `<div class="scr abs" style="background:linear-gradient(135deg,#1e293b,#0f172a);${extra}"></div>`;
const ch = (o, extra) => o.character ? `<img class="abs" src="${url(o.character)}" style="${extra}">` : '';
const star = () => `<div class="abs" style="inset:0;background:repeating-conic-gradient(from 0deg at 50% 38%,rgba(255,255,255,.07) 0 6deg,transparent 6deg 14deg)"></div>`;

const LAYOUTS = [
  // 1) laptop + headline on top + red arrow + ribbon
  (o, t) => `<div class="abs" style="inset:0;background:linear-gradient(160deg,#0b1020,#1d2a5b 60%,#0b1020)"></div>${star()}
   <div class="abs h" data-mh="600" style="left:50px;right:50px;top:90px;text-align:center">${head(t)}</div>
   <div class="abs" style="left:70px;top:760px;width:940px;height:590px;background:#1a1a1f;border-radius:34px;padding:26px 26px 0;box-shadow:0 30px 60px rgba(0,0,0,.6)">${scr(o, 'position:relative;width:100%;height:100%;border-radius:14px 14px 0 0')}</div>
   <div class="abs" style="left:20px;top:1340px;width:1040px;height:40px;background:linear-gradient(#c9ccd3,#8c919c);border-radius:0 0 60px 60px"></div>
   ${ARROW('#ef4444').replace('class="arrow"', 'class="arrow" style="left:700px;top:560px;transform:rotate(18deg)"')}
   ${o.tool ? `<div class="abs" style="left:60px;right:420px;top:1480px;text-align:left;font-size:110px;color:${o.accent};-webkit-text-stroke:5px #000;paint-order:stroke fill">${esc(o.tool).toUpperCase()}</div>` : ''}
   <div class="abs" style="left:0;right:0;bottom:90px;text-align:center"><span class="rib">${esc(o.cta)}</span></div>
   ${ch(o, 'right:-30px;bottom:190px;height:560px')}`,
  // 2) character shocked, huge headline, blurred screenshot background
  (o, t) => `${scr(o, 'inset:-40px;filter:blur(26px) brightness(.45) saturate(1.3);border-radius:0')}${star()}
   <div class="abs" style="left:0;right:0;top:0;height:900px;background:linear-gradient(#000a,transparent)"></div>
   <div class="abs h" data-mh="820" style="left:50px;right:50px;top:120px;font-size:230px;text-align:left">${head(t)}</div>
   ${scr(o, 'left:90px;right:90px;top:1010px;height:560px;border:12px solid #fff;border-radius:22px;transform:rotate(-3deg);box-shadow:0 24px 50px #000a')}
   ${ch(o, 'left:-60px;bottom:-40px;height:1000px')}
   <div class="abs" style="right:60px;bottom:110px"><span class="rib" style="transform:rotate(-3deg)">${esc(o.cta)}</span></div>`,
  // 3) checklist
  (o, t) => `<div class="abs" style="inset:0;background:linear-gradient(180deg,#14532d,#052e16)"></div>${star()}
   <div class="abs h" data-mh="600" style="left:50px;right:50px;top:100px;text-align:center;font-size:200px">${head(t)}</div>
   <div class="abs" style="left:80px;top:770px;display:flex;flex-direction:column;gap:30px">${(o.checklist.length ? o.checklist : ['100% FREE', 'NO SIGN UP', 'WORKS NOW']).slice(0, 3).map(x => `<div class="chip"><i>✓</i>${esc(String(x).toUpperCase())}</div>`).join('')}</div>
   ${scr(o, 'right:60px;bottom:330px;width:620px;height:420px;border:10px solid #fff;transform:rotate(5deg);box-shadow:0 20px 40px #000a')}
   ${ch(o, 'left:-40px;bottom:-30px;height:760px')}
   <div class="abs" style="right:50px;bottom:120px"><span class="rib">${esc(o.cta)}</span></div>`,
  // 4) split: screenshot on top, loud accent block below
  (o, t) => `${scr(o, 'left:0;right:0;top:0;height:1000px;border-radius:0')}
   <div class="abs" style="left:0;right:0;top:1000px;height:920px;background:${o.accent}"></div>
   <div class="abs" style="left:0;right:0;top:940px;height:90px;background:#000;transform:skewY(-3deg)"></div>
   <div class="abs h" data-mh="640" style="left:50px;right:420px;top:1090px;text-align:left;color:#000;-webkit-text-stroke:0;text-shadow:none;font-size:170px">${esc(t)}</div>
   <div class="abs" style="left:0;right:0;bottom:50px;text-align:center"><span class="rib" style="background:#000;box-shadow:0 10px 0 #333">${esc(o.cta)}</span></div>
   ${ch(o, 'right:-10px;bottom:120px;height:800px')}`
];
function html(i, o) {
  const t = (o.titles[i % Math.max(1, o.titles.length)] || o.tool || 'WATCH THIS');
  const fs_ = SCRIPTS.test(t) ? 'font-size:150px;' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(o)}${fs_ ? '.h{' + fs_ + '}' : ''}</style></head><body>${LAYOUTS[i](o, t)}<script>document.querySelectorAll('.h').forEach(function(e){var m=+e.dataset.mh||600,f=parseFloat(getComputedStyle(e).fontSize),n=0;while((e.offsetHeight>m||e.scrollWidth>e.clientWidth+2)&&f>50&&n++<60){f-=6;e.style.fontSize=f+'px';}});</script></body></html>`;
}
// shot(htmlFilePath) -> Buffer(PNG 1080x1920)
async function make(o, shot) {
  const opt = { titles: (o.titles || []).filter(Boolean), tool: o.tool || '', screenshot: o.screenshot, character: o.character, accent: o.accent || '#FFD400', fontsDir: o.fontsDir, cta: o.cta || 'LINK IN COMMENTS', checklist: o.checklist || [] };
  const out = [];
  for (let i = 0; i < 4; i++) {
    const hf = path.join(o.outDir, `.thumb_${i + 1}.html`);
    fs.writeFileSync(hf, html(i, opt));
    try { const png = await shot(hf); const f = path.join(o.outDir, `thumb_${i + 1}.png`); fs.writeFileSync(f, png); out.push(f); } finally { try { fs.unlinkSync(hf); } catch {} }
  }
  return out;
}
module.exports = { make, html, LAYOUTS };
