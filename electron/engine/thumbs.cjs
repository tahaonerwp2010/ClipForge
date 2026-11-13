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
.rough{filter:url(#rough)}
.h2{font-family:'TAnton','TAr','TDe',Impact,sans-serif;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;line-height:1}
.st{-webkit-text-stroke:8px #000;paint-order:stroke fill;text-shadow:0 10px 0 rgba(0,0,0,.5)}
.scr{background:#111 center/cover no-repeat;border-radius:14px}
.arrow{position:absolute;width:300px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.5))}
.chip{font-family:'TMont','TAr','TDe',sans-serif;font-weight:800;font-size:58px;background:#fff;color:#111;border-radius:60px;padding:20px 40px 20px 28px;display:flex;align-items:center;gap:22px;box-shadow:0 8px 0 rgba(0,0,0,.45)}
.chip i{width:68px;height:68px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:46px;flex:none}`;
}
const ARROW = c => `<svg class="arrow" viewBox="0 0 300 220"><path d="M20 20 C 120 20, 210 70, 215 150" stroke="${c}" stroke-width="34" fill="none" stroke-linecap="round"/><path d="M165 140 L222 205 L270 128 Z" fill="${c}"/></svg>`;
const scr = (o, extra) => o.screenshot ? `<div class="scr abs" style="background-image:url('${url(o.screenshot)}');${extra}"></div>` : `<div class="scr abs" style="background:linear-gradient(135deg,#1e293b,#0f172a);${extra}"></div>`;
const ch = (o, extra) => o.character ? `<img class="abs" src="${url(o.character)}" style="${extra}">` : '';
const star = () => `<div class="abs" style="inset:0;background:repeating-conic-gradient(from 0deg at 50% 38%,rgba(255,255,255,.07) 0 6deg,transparent 6deg 14deg)"></div>`;

// ---- loud "creator" thumbnails: brush banners, big stroked headline, emoji, laptop mock-up, checklist, character, call-to-action bar ----
const EMO = [[/money|dollar|earn|cash|paid|pay|rich|income|\$/i, '1f4b0'], [/video|clip|movie|film|short|reel|edit/i, '1f3ac'], [/game|gta|play|gaming/i, '1f3ae'], [/pc|laptop|computer|windows/i, '1f4bb'], [/phone|app|mobile|android/i, '1f4f1'], [/free|gift|win|giveaway/i, '1f381'], [/ai|robot|bot/i, '1f916'], [/link|website|site|download/i, '1f517'], [/fast|speed|instant|viral|rocket/i, '1f680'], [/secret|hidden|shock|crazy|insane/i, '1f92f']];
const emo = (o, text, skip) => { const cand = []; EMO.forEach(([re, c]) => { if (re.test(text)) cand.push(c); }); ['1f525', '2b50', '1f4b0'].forEach(c => cand.push(c)); const c = cand.find(x => x !== skip && o.emojiDir && fs.existsSync(path.join(o.emojiDir, x + '.png'))); return c ? url(path.join(o.emojiDir, c + '.png')) : ''; };
const em = (src, style) => src ? `<img class="abs" src="${src}" style="${style};filter:drop-shadow(0 12px 0 rgba(0,0,0,.45))">` : '';
const THEMES = [
  { bg: 'linear-gradient(165deg,#050b24,#0a1f6b 55%,#04081c)', glow: '#2b6bff', ban: '#FFD400', ink: '#111', hi: '#FFD400', red: '#e11d1d', side: 'left' },
  { bg: 'linear-gradient(165deg,#12020a,#5c0a1c 55%,#0e0206)', glow: '#ff2d55', ban: '#ffffff', ink: '#111', hi: '#FFE14D', red: '#d90429', side: 'right' },
  { bg: 'linear-gradient(165deg,#021a10,#0b5a34 55%,#02100a)', glow: '#22d3a0', ban: '#FFD400', ink: '#0b1a10', hi: '#7CFFB2', red: '#e11d1d', side: 'left' },
  { bg: 'linear-gradient(165deg,#12062e,#4a1d96 55%,#0b0420)', glow: '#c026d3', ban: '#22d3ee', ink: '#0a0a18', hi: '#FFE14D', red: '#e11d6a', side: 'right' }
];
const lines = text => {                       // headline -> 3 lines: top banner, middle, big last line
  const w = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (w.length <= 1) return [w[0] || '', '', ''];
  if (w.length === 2) return [w[0], '', w[1]];
  if (w.length === 3) return [w[0], w[1], w[2]];
  const last = w.length > 5 ? w.slice(-2) : w.slice(-1), rest = w.slice(0, w.length - last.length), cut = Math.ceil(rest.length / 2);
  return [rest.slice(0, cut).join(' '), rest.slice(cut).join(' '), last.join(' ')];
};
const mock = (o, th, tilt) => {
  const inner = o.screenshot ? `<div class="abs" style="inset:0;background:#0b0b10 url('${url(o.screenshot)}') center/cover no-repeat"></div>`
    : `<div class="abs" style="inset:0;background:linear-gradient(135deg,#0d1226,#1b2455)"></div><div class="abs" style="left:0;right:0;top:46px;text-align:center;font-size:76px;color:#fff;font-family:'TMont','TAr','TDe',sans-serif;font-weight:800" data-fit="880">${esc(String(o.tool || o.titles[0] || '').toUpperCase())}</div>
       <div class="abs" style="left:46px;right:46px;top:190px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">${(o.checklist.length ? o.checklist : ['FAST', 'EASY', 'FREE']).slice(0, 3).map((x, i) => `<div style="height:150px;border-radius:20px;border:3px solid ${th.hi}55;background:${th.hi}${i === 2 ? '' : '22'};color:${i === 2 ? '#111' : '#fff'};font-family:'TMont',sans-serif;font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px">${esc(String(x).toUpperCase().slice(0, 18))}</div>`).join('')}</div>`;
  return `<div class="abs" style="left:150px;top:930px;width:780px;transform:perspective(1500px) rotateY(${tilt}deg) rotateX(3deg);transform-origin:center">
    <div style="height:470px;background:linear-gradient(#2a2d3a,#14161f);border-radius:30px 30px 8px 8px;padding:20px 20px 24px;box-shadow:0 0 0 4px ${th.glow}88,0 0 90px ${th.glow}99,0 40px 70px rgba(0,0,0,.7)"><div style="position:relative;width:100%;height:100%;border-radius:14px;overflow:hidden">${inner}</div></div>
    <div style="height:34px;margin:0 -60px;background:linear-gradient(#d5d8e0,#8b909c);border-radius:0 0 90px 90px;box-shadow:0 26px 40px rgba(0,0,0,.6)"></div></div>`;
};
const ctaBar = (o, th) => {
  const t = String(o.cta || 'LINK IN COMMENTS').toUpperCase(), m = /"([^"]+)"|“([^”]+)”/.exec(t);
  const body = m ? esc(t.slice(0, m.index)) + `<span style="color:${th.red};font-size:1.45em">"${esc(m[1] || m[2])}"</span>` + esc(t.slice(m.index + m[0].length)) : esc(t);
  return `<div class="abs" style="left:200px;right:30px;bottom:36px;height:200px"><div class="abs rough" style="inset:0;background:#fff;transform:rotate(-2deg)"></div>
    <div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center;font-size:92px;line-height:1;color:#0a0a0a;transform:rotate(-2deg) skewX(-6deg);padding:0 130px 0 30px;text-align:center" data-fit="820">${body}</div></div>
    <svg class="abs" style="left:40px;bottom:50px;width:150px;transform:rotate(8deg);filter:drop-shadow(0 8px 0 rgba(0,0,0,.45))" viewBox="0 0 160 160"><path d="M20 30 C 20 120, 70 135, 120 120" stroke="#FFD400" stroke-width="26" fill="none" stroke-linecap="round"/><path d="M95 78 L150 125 L88 160 Z" fill="#FFD400"/></svg>
    <svg class="abs" style="right:0px;bottom:190px;width:190px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.45))" viewBox="0 0 120 110"><path d="M10 12 Q10 4 18 4 H102 Q110 4 110 12 V68 Q110 76 102 76 H58 L30 100 L34 76 H18 Q10 76 10 68 Z" fill="#e11d1d"/><circle cx="38" cy="40" r="7" fill="#fff"/><circle cx="60" cy="40" r="7" fill="#fff"/><circle cx="82" cy="40" r="7" fill="#fff"/></svg>`;
};
function layout(o, t, i) {
  const th = THEMES[i % THEMES.length], [l1, l2, l3] = lines(t), all = o.titles.join(' ') + ' ' + (o.tool || ''), e1 = emo(o, all), e2 = emo(o, all, (e1.match(/([0-9a-f]+)\.png/) || [])[1]);
  const left = th.side === 'left';
  const sub = (o.checklist.length ? o.checklist.slice(0, 3).join(' • ') : (o.tool || '')).toUpperCase();
  return `<svg width="0" height="0" style="position:absolute"><filter id="rough" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035 .05" numOctaves="3" seed="${3 + i}"/><feDisplacementMap in="SourceGraphic" scale="16"/></filter></svg>
   <div class="abs" style="inset:0;background:${th.bg}"></div>
   <div class="abs" style="left:-200px;top:380px;width:760px;height:760px;border-radius:50%;background:${th.glow};filter:blur(150px);opacity:.55"></div>
   <div class="abs" style="right:-240px;top:900px;width:700px;height:700px;border-radius:50%;background:${th.hi};filter:blur(170px);opacity:.28"></div>
   <div class="abs" style="inset:0;background:repeating-conic-gradient(from 0deg at 50% 30%,rgba(255,255,255,.05) 0 5deg,transparent 5deg 13deg)"></div>
   ${l1 ? `<div class="abs" style="left:28px;right:28px;top:60px;height:210px;transform:rotate(-2.5deg)"><div class="abs rough" style="inset:0;background:${th.ban}"></div><div class="abs h2" data-fit="960" style="inset:0;display:flex;align-items:center;justify-content:center;font-size:150px;color:${th.ink};transform:skewX(-7deg);padding:0 40px">${esc(l1.toUpperCase())}</div></div>` : ''}
   ${l2 ? `<div class="abs h2 st" data-fit="980" style="left:20px;right:20px;top:285px;height:190px;display:flex;align-items:center;justify-content:center;font-size:170px;color:#fff;transform:rotate(-1.5deg) skewX(-7deg)">${esc(l2.toUpperCase())}</div>` : ''}
   ${l3 ? `<div class="abs" style="left:10px;right:10px;top:${l2 ? 470 : 330}px;height:300px"><div class="abs rough" style="left:30px;right:30px;top:60px;bottom:30px;background:${th.red};transform:rotate(-2deg) skewX(-6deg)"></div><div class="abs h2 st" data-fit="900" style="left:90px;right:150px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:260px;color:${th.hi};transform:rotate(-2deg) skewX(-7deg)">${esc(l3.toUpperCase())}</div></div>` : ''}
   ${em(e1, `right:${left ? 10 : 30}px;top:${l2 ? 440 : 300}px;width:200px;transform:rotate(10deg)`)}
   ${sub ? `<div class="abs" style="left:60px;right:60px;top:800px;height:120px"><div class="abs rough" style="inset:0;background:${th.red};transform:rotate(-2deg) skewX(-6deg)"></div><div class="abs h2" data-fit="900" style="inset:0;display:flex;align-items:center;justify-content:center;font-size:66px;color:#fff;font-family:'TMont','TAr','TDe',sans-serif;transform:rotate(-2deg) skewX(-6deg);padding:0 40px;text-align:center;line-height:1.1">${esc(sub)}</div></div>` : ''}
   ${mock(o, th, left ? -7 : 7)}
   ${em(e2, `left:${left ? 'auto' : '-10px'};right:${left ? '-10px' : 'auto'};top:880px;width:230px;transform:rotate(${left ? 12 : -12}deg)`)}
   ${ARROW('#ef4444').replace('class="arrow"', `class="arrow" style="${left ? 'right:-20px' : 'left:-20px'};top:1120px;width:260px;transform:${left ? 'rotate(30deg)' : 'scaleX(-1) rotate(30deg)'}"`)}
   <div class="abs" style="${left ? 'right:230px' : 'left:230px'};top:1440px;display:flex;flex-direction:column;gap:8px">${(o.checklist.length ? o.checklist : []).slice(0, 3).map((x, k) => `<div style="display:flex;align-items:center;gap:18px;font-family:'TMont','TAr','TDe',sans-serif;font-weight:800;font-size:42px;font-style:italic;color:${k === 1 ? th.hi : '#fff'};text-shadow:0 4px 0 #000"><i style="width:54px;height:54px;border-radius:50%;background:#16a34a;color:#fff;font-style:normal;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 5px 0 #0a5a28;flex:none">✓</i>${esc(String(x).slice(0, 22))}</div>`).join('')}</div>
   ${ch(o, `${left ? 'left:-70px' : 'right:-70px'};bottom:200px;height:760px;filter:drop-shadow(0 16px 30px rgba(0,0,0,.6))`)}
   ${ctaBar(o, th)}`;
}
const LAYOUTS = [0, 1, 2, 3].map(i => (o, t) => layout(o, t, i));
function html(i, o) {
  const t = (o.titles[i % Math.max(1, o.titles.length)] || o.tool || 'WATCH THIS');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(o)}</style></head><body>${LAYOUTS[i](o, t)}<script>
function fitAll(){document.querySelectorAll('[data-fit]').forEach(function(e){
  if(!e.__w){e.__f=getComputedStyle(e).fontSize;var sp=document.createElement('span');sp.style.whiteSpace='nowrap';sp.style.display='inline-block';while(e.firstChild)sp.appendChild(e.firstChild);e.appendChild(sp);e.__w=sp;}
  var sp=e.__w,m=+e.dataset.fit,f=parseFloat(getComputedStyle(e).fontSize),n=0;
  while(sp.offsetWidth>m&&f>28&&n++<80){f-=4;e.style.fontSize=f+'px';}
});}
fitAll();document.fonts.ready.then(function(){document.querySelectorAll('[data-fit]').forEach(function(e){e.style.fontSize=e.__f||'';});fitAll();});
</script></body></html>`;
}
// shot(htmlFilePath) -> Buffer(PNG 1080x1920)
async function make(o, shot) {
  const opt = { titles: (o.titles || []).filter(Boolean), tool: o.tool || '', screenshot: o.screenshot, character: o.character, accent: o.accent || '#FFD400', fontsDir: o.fontsDir, emojiDir: o.emojiDir, cta: o.cta || 'LINK IN COMMENTS', checklist: o.checklist || [] };
  const out = [];
  for (let i = 0; i < 4; i++) {
    const hf = path.join(o.outDir, `.thumb_${i + 1}.html`);
    fs.writeFileSync(hf, html(i, opt));
    try { const png = await shot(hf); const f = path.join(o.outDir, `thumb_${i + 1}.png`); fs.writeFileSync(f, png); out.push(f); } finally { try { fs.unlinkSync(hf); } catch {} }
  }
  return out;
}
module.exports = { make, html, LAYOUTS };
