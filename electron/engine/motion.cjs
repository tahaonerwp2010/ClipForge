// AI-designed motion graphics: each scene is a small animated HTML page (1080x1920). It is drawn frame by frame by a hidden
// browser window (hooks.frames) as transparent / opaque PNG sequences, then laid over the video with ffmpeg.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cut = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const hex = (c, d) => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : d;
const FULL = ['hero', 'step', 'flow', 'compare', 'checks', 'link', 'stat'];
const OVER = ['callout', 'badge'];
const THEMES = {
  light: { bg: '#f3f3f6', ink: '#0f1115', sub: '#6b7280', card: '#ffffff', line: '#d9dbe1', shadow: 'rgba(20,24,40,.16)' },
  dark: { bg: '#0a0c11', ink: '#ffffff', sub: '#9aa3b2', card: '#171b24', line: '#2a3040', shadow: 'rgba(0,0,0,.55)' }
};
const E_ = 'cubic-bezier(.2,.9,.25,1.15)';
const a = (name, dur, delay, ease) => `animation:${name} ${dur}s ${ease || E_} ${delay}s both`;

function css(o) {
  const T = THEMES[o.mode] || THEMES.light, fd = o.fontsDir ? pathToFileURL(o.fontsDir).toString() + '/' : '';
  return `@font-face{font-family:'MH';src:url('${fd}OutfitExtraBold.ttf')}
@font-face{font-family:'MB';src:url('${fd}PoppinsBold.ttf')}
@font-face{font-family:'MI';src:url('${fd}InterExtraBold.ttf')}
@font-face{font-family:'MAr';src:url('${fd}NotoSansArabic.ttf');unicode-range:U+0600-06FF}
@font-face{font-family:'MDe';src:url('${fd}NotoSansDevanagari.ttf');unicode-range:U+0900-097F}
:root{--bg:${T.bg};--ink:${T.ink};--sub:${T.sub};--card:${T.card};--line:${T.line};--sh:${T.shadow};--ac:${o.accent};--ac2:${o.accent2}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:transparent}
body{font-family:'MH','MAr','MDe',sans-serif;color:var(--ink);position:relative}
.sc{position:absolute;inset:0;overflow:hidden}
.full{background:var(--bg)}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.75}
.abs{position:absolute}
.c{left:0;right:0;text-align:center;width:100%}.abs.c{width:auto}
.sub{font-family:'MB','MAr','MDe',sans-serif;color:var(--sub);font-size:46px;font-weight:700}
.card{background:var(--card);border-radius:44px;box-shadow:0 30px 70px var(--sh),0 0 0 2px var(--line) inset}
.pill{display:inline-flex;align-items:center;gap:18px;background:var(--card);border-radius:80px;padding:22px 42px;font-family:'MI','MAr','MDe',sans-serif;font-size:50px;box-shadow:0 18px 40px var(--sh),0 0 0 2px var(--line) inset;white-space:nowrap}
.dot{width:58px;height:58px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:30px;flex:none}
.mk{background:linear-gradient(var(--ac2),var(--ac2)) no-repeat left 88%/0% 52%;color:inherit;padding:0 8px;margin:0 -8px}
.w{display:inline-block;white-space:pre}
@keyframes pop{0%{opacity:0;transform:translateY(46px) scale(.86)}100%{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes up{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
@keyframes lft{from{opacity:0;transform:translateX(-380px) rotate(-8deg)}to{opacity:1;transform:none}}
@keyframes rgt{from{opacity:0;transform:translateX(380px) rotate(8deg)}to{opacity:1;transform:none}}
@keyframes out{from{opacity:1;transform:none}to{opacity:0;transform:scale(.94)}}
@keyframes hl{from{background-size:0% 52%}to{background-size:100% 52%}}
@keyframes draw{from{stroke-dashoffset:var(--l)}to{stroke-dashoffset:0}}
@keyframes flo{0%,100%{transform:translateY(-10px)}50%{transform:translateY(10px)}}
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(70px,-50px)}}
@keyframes ring{0%{transform:translate(-50%,-50%) scale(.55);opacity:.95}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes grow{from{width:0}to{width:100%}}
@keyframes press{0%,100%{transform:translateY(0)}50%{transform:translateY(14px)}}
@keyframes type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes chinL{from{transform:translateX(-110%)}to{transform:none}}
@keyframes chinR{from{transform:translateX(110%)}to{transform:none}}
@keyframes bump{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`;
}
const exit = D => `${a('out', .28, Math.max(0, D - .28), 'ease-in')}`;
const blobs = () => `<div class="blob" style="width:760px;height:760px;left:-200px;top:80px;background:var(--ac2);animation:drift 6s ease-in-out infinite"></div>
<div class="blob" style="width:700px;height:700px;right:-220px;top:260px;background:#ff9ec7;opacity:.5;animation:drift 7s ease-in-out -2s infinite"></div>
<div class="blob" style="width:640px;height:640px;left:160px;top:-260px;background:var(--ac);opacity:.35;animation:drift 8s ease-in-out -4s infinite"></div>`;

// words of a title appear one by one; `hi` is highlighted with a swipe
function words(title, hi, t0, size) {
  const T = String(title || ''), H = String(hi || '').trim(); let html = '', i = 0;
  const parts = H && T.toLowerCase().includes(H.toLowerCase()) ? (() => { const k = T.toLowerCase().indexOf(H.toLowerCase()); return [T.slice(0, k), T.slice(k, k + H.length), T.slice(k + H.length)]; })() : [T, '', ''];
  const wr = (txt, mk) => txt.split(/(\s+)/).filter(x => x !== '').map(tok => /^\s+$/.test(tok) ? ' ' : `<span class="w${mk ? ' mk' : ''}" style="${a('pop', .5, t0 + (i++) * .09)}${mk ? `;--d:${t0 + i * .09 + .2}` : ''}">${esc(tok)}</span>`).join('');
  html = wr(parts[0]) + (parts[1] ? `<span class="mk" style="animation:hl .6s ease-out ${t0 + (i) * .09 + .15}s both">${wr(parts[1], false)}</span>` : '') + wr(parts[2]);
  return `<div class="c title" style="font-size:${size || 150}px;line-height:1.04;padding:0 70px;letter-spacing:-2px;font-weight:800" dir="auto">${html}</div>`;
}

// when each part appears: seconds after the scene starts, worked out from the moment its words are spoken (s.cue); `def` when unknown
const cu = (s, k, i, def) => { const v = s && s.cue && s.cue[k]; const x = Array.isArray(v) ? v[i] : (i === undefined || i === null ? v : undefined); return typeof x === 'number' && isFinite(x) ? Math.max(0, x) : def; };

const S = {
  hero(s, o, D) {
    return `${blobs()}
    <div class="abs" style="left:0;right:0;top:330px;height:700px;display:flex;flex-direction:column;justify-content:center;gap:40px" data-fit="700">
      ${words(cut(s.title, 60), s.hi, .15, 150)}
      ${s.sub ? `<div class="c sub" style="${a('up', .6, cu(s, 'sub', null, 1.0))}" dir="auto">${esc(cut(s.sub, 50))}</div>` : ''}
    </div>`;
  },
  step(s, o, D) {
    const lab = cut(s.label, 28).split(' '), last = lab.pop(), first = lab.join(' ');
    return `<div class="abs" style="left:150px;top:380px;width:780px;height:520px;${a('pop', .7, .1)}">
      <div class="abs" style="inset:-34px;border-radius:70px;border:3px dashed var(--ac);opacity:.55;animation:spin 14s linear infinite;border-style:dashed"></div>
      <div class="abs" style="inset:0;border-radius:56px;background:#14171f;box-shadow:0 40px 90px var(--sh),0 0 0 2px #2a3040 inset"></div>
      <div class="abs" style="left:0;right:0;top:100px;text-align:center;font-family:'MB';font-size:34px;letter-spacing:9px;color:#8a93a6;${a('fade', .5, .5)}">STEP ${esc(String(s.n || '01').padStart(2, '0'))}</div>
      <div class="abs" style="left:30px;right:30px;top:190px;text-align:center;font-size:96px;line-height:1.05;color:#fff;font-weight:800;${a('up', .6, cu(s, 'label', null, .6))}" dir="auto" data-fit="260">${esc(first)} <span style="color:var(--ac)">${esc(last)}</span></div>
      <div class="abs" style="left:150px;right:150px;bottom:80px;height:10px;border-radius:5px;background:#2a3040;overflow:hidden"><div style="height:100%;background:var(--ac);border-radius:5px;animation:grow ${Math.max(1, D - 1)}s linear .6s both"></div></div>
    </div>`;
  },
  flow(s, o, D) {
    const nodes = (s.nodes || []).slice(0, 5).map(x => cut(x, 20)), n = Math.max(2, nodes.length), cx = 540, cy = 800, R = 330;
    const col = ['#ff5d8f', '#7c5cff', '#22b8cf', '#f59f00', '#37b24d'];
    // nodes sit on an oval around the hub, wide enough apart that two chips never touch; long names wrap to two lines instead of being cut
    const pos = nodes.map((_, i) => { const ang = -Math.PI / 2 + (i + .5) * 2 * Math.PI / n; return [cx + R * Math.cos(ang) * 1.02, cy + R * 0.95 * Math.sin(ang)]; });
    const when = i => cu(s, 'nodes', i, .8 + i * .5);
    const lines = pos.map((p, i) => { const L = Math.hypot(p[0] - cx, p[1] - cy); return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="var(--ac)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${L}" style="--l:${L};stroke-dashoffset:${L};${a('draw', .5, when(i) - .1, 'ease-out')}"/>`; }).join('');
    const chips = nodes.map((t, i) => `<div class="abs" style="left:${pos[i][0]}px;top:${pos[i][1]}px;transform:translate(-50%,-50%)"><div style="${a('pop', .5, when(i) + .1)}"><div class="pill" style="animation:flo ${3 + i * .4}s ease-in-out ${-i}s infinite;font-size:40px;white-space:normal;max-width:430px;line-height:1.08;padding:20px 34px;text-align:left"><span class="dot" style="background:${col[i % 5]}">${esc([...t][0] || '•').toUpperCase()}</span><span>${esc(t)}</span></div></div></div>`).join('');
    return `${blobs()}
    ${s.title ? `<div class="abs c" style="top:130px;font-size:88px;line-height:1.05;padding:0 60px;${a('up', .6, .1)}" dir="auto" data-fit="210">${esc(cut(s.title, 32))}</div>` : ''}
    <svg class="abs" style="left:0;top:0" width="1080" height="1500">${lines}</svg>
    <div class="abs" style="left:${cx}px;top:${cy}px;transform:translate(-50%,-50%)"><div style="${a('pop', .6, cu(s, 'center', null, .25))}"><div style="width:290px;height:290px;border-radius:50%;background:#14171f;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font-size:50px;line-height:1.1;padding:30px;box-shadow:0 0 0 10px var(--bg),0 0 0 16px var(--ac),0 30px 60px var(--sh)" dir="auto">${esc(cut(s.center, 22))}</div></div></div>
    ${chips}`;
  },
  compare(s, o, D) {
    const card = (side, label, anim, rot) => `<div class="abs" style="left:${side}px;top:360px;width:440px;${a(anim, .7, .25)}"><div style="text-align:center;margin-bottom:28px"><span style="display:inline-block;background:var(--ac2);color:#111;font-family:'MI','MAr','MDe';font-size:42px;padding:10px 34px;border-radius:14px;transform:rotate(${rot}deg)" dir="auto">${esc(cut(label, 16))}</span></div><div class="card" style="height:600px;background:linear-gradient(160deg,var(--card),var(--line));display:flex;align-items:center;justify-content:center;font-size:150px">${rot < 0 ? '◐' : '◉'}</div></div>`;
    return `${blobs()}${card(60, s.left || 'Before', 'lft', -3)}${card(580, s.right || 'After', 'rgt', 3)}
    <div class="abs" style="left:540px;top:760px;transform:translate(-50%,-50%)"><div style="${a('pop', .5, .9)}"><div style="width:130px;height:130px;border-radius:50%;background:#111;color:#fff;font-size:48px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px var(--bg),0 20px 40px var(--sh)">VS</div></div></div>
    ${s.caption ? `<div class="abs c" style="top:1100px;font-size:80px;${a('up', .6, 1.1)}" dir="auto">${esc(cut(s.caption, 30))}</div>` : ''}`;
  },
  checks(s, o, D) {
    const items = (s.items || []).slice(0, 4).map(x => cut(x, 26));
    return `${blobs()}${s.title ? `<div class="abs c" style="top:170px;font-size:104px;line-height:1.05;padding:0 60px;${a('up', .6, .1)}" dir="auto" data-fit="240">${esc(cut(s.title, 36))}</div>` : ''}
    <div class="abs" style="left:90px;right:90px;top:${s.title ? 470 : 330}px;display:flex;flex-direction:column;gap:34px">${items.map((t, i) => `<div class="pill" style="${a('pop', .5, cu(s, 'items', i, .5 + i * .6))};font-size:62px;padding:30px 48px;justify-content:flex-start" dir="auto"><span class="dot" style="background:#22a559;width:78px;height:78px;font-size:46px">✓</span>${esc(t)}</div>`).join('')}</div>`;
  },
  link(s, o, D) {
    return `${blobs()}
    <div class="abs" style="left:0;right:0;top:420px;text-align:center;${a('pop', .6, cu(s, 'main', null, .15))}"><span class="pill" style="font-size:72px;padding:36px 64px"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" stroke-width="2.6" stroke-linecap="round"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>${esc(cut(s.text || 'Link copied', 22))}</span></div>
    <div class="abs" style="left:0;right:0;top:700px;text-align:center;${a('pop', .6, cu(s, 'url', null, .7))}"><span class="pill" style="font-size:54px;font-family:'MB'"><span style="display:inline-block;animation:type 1.1s steps(18) ${cu(s, 'url', null, .7) + .5}s both">${esc(cut(s.url || '', 34))}</span></span></div>
    <div class="abs" style="left:0;right:0;top:960px;text-align:center;${a('pop', .5, cu(s, 'url', null, .7) + 1.0)}"><span style="display:inline-block;background:#14171f;color:#fff;font-family:'MI';font-size:60px;padding:26px 56px;border-radius:26px;box-shadow:0 14px 0 #000,0 26px 40px var(--sh);animation:press 1.4s ease-in-out ${cu(s, 'url', null, .7) + 1.4}s infinite">Ctrl  C</span></div>`;
  },
  stat(s, o, D) {
    const raw = String(s.value || '0'), m = raw.match(/^(\D*)([\d,.]+)(.*)$/), pre = m ? m[1] : '', num = m ? parseFloat(m[2].replace(/,/g, '')) : 0, suf = m ? m[3] : '', hasC = m && m[2].includes(','), dec = m && m[2].includes('.') ? (m[2].split('.')[1] || '').length : 0;
    const dots = Array.from({ length: 14 }, (_, i) => { const an = i * 2 * Math.PI / 14, d = 420 + (i % 3) * 70; return `<div class="abs" style="left:540px;top:600px;width:26px;height:26px;border-radius:50%;background:${['var(--ac)', 'var(--ac2)', '#ff5d8f'][i % 3]};--x:${Math.cos(an) * d}px;--y:${Math.sin(an) * d}px;animation:burst .9s ease-out .6s both"></div>`; }).join('');
    return `${blobs()}<style>@keyframes burst{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(.3)}}</style>${dots}
    <div id="sv" class="abs c" style="top:430px;font-size:260px;line-height:1;letter-spacing:-6px;${a('pop', .6, cu(s, 'value', null, .2))}" dir="ltr">${esc(raw)}</div>
    <div class="abs c sub" style="top:790px;font-size:62px;${a('up', .6, cu(s, 'label', null, .9))}" dir="auto">${esc(cut(s.label, 40))}</div>
    <div class="abs" style="left:340px;right:340px;top:900px;height:14px;border-radius:7px;background:var(--line);overflow:hidden"><div style="height:100%;background:var(--ac);animation:grow 1.6s ease-out .6s both"></div></div>
    <script>window.__tick=function(t){var k=Math.min(1,Math.max(0,(t-${cu(s, 'value', null, .2) + .1})/1.4));k=1-Math.pow(1-k,3);var v=${num}*k,s=v.toFixed(${dec});${hasC ? "s=s.replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');" : ''}document.getElementById('sv').textContent=${JSON.stringify(pre)}+s+${JSON.stringify(suf)};}</script>`;
  },
  // ---- overlays on top of a recording / stock clip (transparent) ----
  callout(s, o, D) {
    const x = s.px, y = s.py, label = cut(s.text, 26), below = y < 760, w = Math.min(900, 70 + label.length * 30), lx = Math.max(50, Math.min(1080 - 50 - w, x - w / 2)), ly = below ? y + 110 : y - 210;
    return `<div class="abs" style="left:${x}px;top:${y}px;width:190px;height:190px;border-radius:50%;border:10px solid var(--ac);box-shadow:0 0 40px var(--ac);${a('ring', 1.1, .4, 'ease-out').replace(' both', ' infinite')}"></div>
    <div class="abs" style="left:${x}px;top:${y}px;width:26px;height:26px;margin:-13px;border-radius:50%;background:var(--ac);${a('pop', .3, .35)}"></div>
    <div class="abs" style="left:${lx}px;top:${ly}px;${a('pop', .5, .5)}"><div style="position:relative;background:var(--ac);color:#111;border-radius:26px;padding:18px 36px;font-family:'MI','MAr','MDe';font-size:48px;white-space:nowrap;box-shadow:0 16px 34px rgba(0,0,0,.45)" dir="auto">${esc(label)}<div style="position:absolute;left:${Math.max(30, Math.min(w - 50, x - lx - 20))}px;${below ? 'top:-18px' : 'bottom:-18px'};width:0;height:0;border-left:20px solid transparent;border-right:20px solid transparent;${below ? 'border-bottom' : 'border-top'}:22px solid var(--ac)"></div></div></div>`;
  },
  badge(s, o, D) {
    const m = String(s.text || '').match(/^\s*((?:step|steps|stage|part)\s*\d+|\d+)\s*[:.\-]?\s*(.*)$/i), tag = m && m[2] ? m[1].toUpperCase() : '', txt = m ? (m[2] || m[1]) : s.text;
    return `<div class="abs c" style="top:230px;${a('pop', .55, .15)}"><div style="display:inline-block;max-width:940px;background:#14171f;border-radius:40px;padding:34px 56px;box-shadow:0 26px 60px rgba(0,0,0,.5),0 0 0 3px var(--ac) inset;text-align:center" dir="auto">
      ${tag ? `<div style="font-family:'MB';font-size:32px;letter-spacing:8px;color:var(--ac);margin-bottom:10px">${esc(tag)}</div>` : ''}
      <div style="font-size:${txt.length > 22 ? 62 : 78}px;line-height:1.08;color:#fff;font-weight:800">${esc(cut(txt || s.text, 40))}</div></div></div>`;
  },
  cta(s, o, D) {
    return `<div class="abs" style="left:0;right:0;top:1530px;text-align:center;${a('up', .6, .1)}"><div style="display:inline-flex;align-items:center;gap:22px;background:var(--ac);color:#111;border-radius:70px;padding:28px 64px;font-family:'MI','MAr','MDe';font-size:66px;box-shadow:0 20px 44px rgba(0,0,0,.5);animation:bump 1.1s ease-in-out .8s infinite" dir="auto">${esc(cut(s.text, 24))}<svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" style="animation:flo 1s ease-in-out infinite"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div></div>`;
  }
};
S.cta.over = S.callout.over = S.badge.over = true;

function charHtml(c, D) {
  const L = c.side !== 'right', at = Math.max(0, c.at), du = Math.max(.6, c.dur), side = L ? 'left:-40px' : 'right:-40px';
  return `<div class="abs" style="${side};bottom:0;${a('out', .25, Math.max(0, at + du - .25), 'ease-in')}"><div style="${a(L ? 'chinL' : 'chinR', .34, at)}"><img src="${pathToFileURL(c.src).toString()}" style="display:block;height:${c.h || 760}px;animation:flo 1.6s ease-in-out infinite;transform-origin:bottom"></div></div>`;
}
function html(scene, o) {
  const D = Math.max(.8, o.dur), isFull = FULL.includes(scene.type), body = (S[scene.type] || S.hero)(scene, o, D);
  const fit = `<script>(function(){document.querySelectorAll('[data-fit]').forEach(function(e){var m=+e.dataset.fit,f=parseFloat(getComputedStyle(e.querySelector('.title')||e).fontSize),t=e.querySelector('.title')||e,n=0;while((e.scrollHeight>m+4||t.scrollWidth>t.clientWidth+4)&&f>46&&n++<50){f-=6;t.style.fontSize=f+'px';}});window.setBg=function(c){document.documentElement.style.background=c};window.seek=function(t){document.getAnimations().forEach(function(a){a.pause();a.currentTime=t*1000});if(window.__tick)window.__tick(t);};})();</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(o)}</style></head><body><div class="sc${isFull ? ' full' : ''}" style="${exit(D)}">${isFull ? `<div class="abs" style="inset:0;transform:translateY(130px)">${body}</div>` : body}${scene.ch ? charHtml(scene.ch, D) : ''}</div>${fit}</body></html>`;
}

// fix the loop of the "ring" animation (infinite) and keep scene durations sane
function normalize(sc, ctx) {
  if (!sc || typeof sc !== 'object') return null;
  const t = String(sc.type || '').toLowerCase();
  if (![...FULL, ...OVER].includes(t)) return null;
  const o = { ...sc, type: t };
  if (t === 'hero' && !String(o.title || '').trim()) return null;
  if (t === 'step' && !String(o.label || '').trim()) return null;
  if (t === 'flow' && (!o.center || !Array.isArray(o.nodes) || o.nodes.length < 2)) return null;
  if (t === 'checks' && (!Array.isArray(o.items) || !o.items.length)) return null;
  if (t === 'stat' && !String(o.value || '').trim()) return null;
  if (t === 'stat' && !/\d/.test(String(o.value))) return normalize({ type: 'hero', title: o.label || o.value, hi: '', sub: '' }, ctx);   // "$$$" is not a number
  if (t === 'link' && !String(o.url || o.text || '').trim()) return null;
  if ((t === 'callout' || t === 'badge') && !String(o.text || '').trim()) return null;
  return o;
}

// scenes (from the plan) -> PNG sequences. hooks.frames({htmlFile, outDir, dur, fps, needAlpha}) -> {frames, alpha}
async function renderAll(items, ctx, hooks, work, log, onProg) {
  const out = []; let k = 0;
  for (const it of items) {
    k++;
    const hf = path.join(work, `mg_${it.id}.html`);
    fs.writeFileSync(hf, html(it.scene, { mode: it.scene.mode || ctx.mode, accent: ctx.accent, accent2: ctx.accent2, fontsDir: ctx.fontsDir, dur: it.dur }));
    onProg && onProg(k - 1, items.length, it.scene.type);
    const over = !!S[it.scene.type].over, mk = n => { const d = path.join(work, `mg_${it.id}${n}`); fs.mkdirSync(d, { recursive: true }); return d; };
    if (over) {
      // no see-through window needed: draw the same overlay on black and on white, ffmpeg works the transparency out from the difference
      const dB = mk('_k'), dW = mk('_w');
      const rB = await hooks.frames({ htmlFile: hf, outDir: dB, dur: it.dur, fps: ctx.fps, bg: '#000000' });
      const rW = await hooks.frames({ htmlFile: hf, outDir: dW, dur: it.dur, fps: ctx.fps, bg: '#ffffff' });
      if (!rB || !rB.frames || !rW || rW.frames !== rB.frames) throw new Error('no frames');
      out.push({ ...it, dirB: dB, dirW: dW, bw: true, frames: rB.frames, alpha: true, over: true });
    } else {
      const d = mk(''); const r = await hooks.frames({ htmlFile: hf, outDir: d, dur: it.dur, fps: ctx.fps, bg: '#000000' });
      if (!r || !r.frames) throw new Error('no frames');
      out.push({ ...it, dir: d, frames: r.frames, alpha: true, over: false });
    }
  }
  return out;
}
module.exports = { FULL, OVER, normalize, html, renderAll, hex, THEMES };
