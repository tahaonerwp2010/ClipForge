// Builds the built-in character styles (flat vector mascots) as transparent PNG layers: body_<pose>.png + head_<face>.png + manifest.json
// Run: node scripts/make-characters.cjs   (needs playwright + chromium; the PNGs are committed, users never run this)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'assets', 'characters');
const W = 800, H = 980, HEAD = 270, HX = 265, HY = 20;           // body canvas, head canvas size and where the head sits on the body
const SK = '#f1c7a1', SKD = '#c99772', LN = '#14181c';

const STYLES = {
  suit:   { name: 'Suit', shirt: '#f4f4f4', shirtD: '#cfcfcf', sleeve: '#f4f4f4', pants: '#1b1d22', tie: '#15171b', belt: '#0e0f12', head: '#0b0b0d', ink: '#ffffff', hood: null },
  hoodie: { name: 'Hoodie', shirt: '#23262e', shirtD: '#14161b', sleeve: '#23262e', pants: '#2b3140', tie: null, belt: null, head: '#0b0b0d', ink: '#bef264', hood: '#23262e', strings: '#e9e9e9' },
  casual: { name: 'Casual', shirt: '#ff7a1a', shirtD: '#d85f08', sleeve: '#ff7a1a', pants: '#3a5ea8', tie: null, belt: '#2a2118', head: '#ffd23f', ink: '#1b1b1b', hood: null },
};
// shoulder->elbow->wrist per arm (viewer's left = L). hand: kind + angle
const L0 = [225, 365], R0 = [575, 365];
const POSES = {
  idle:      { L: [L0, [195, 560], [200, 735], 'fist', 0], R: [R0, [605, 560], [600, 735], 'fist', 0] },
  wave:      { L: [L0, [95, 470], [95, 285], 'palm', 0], R: [R0, [605, 560], [600, 735], 'fist', 0] },
  stop:      { L: [L0, [110, 520], [150, 330], 'palmBig', 0], R: [R0, [605, 560], [600, 735], 'fist', 0] },
  point:     { L: [L0, [195, 560], [200, 735], 'fist', 0], R: [R0, [655, 430], [716, 398], 'point', -20] },
  point_up:  { L: [L0, [195, 560], [200, 735], 'fist', 0], R: [R0, [670, 470], [660, 290], 'point', -90] },
  point_down:{ L: [L0, [195, 560], [200, 735], 'fist', 0], R: [R0, [655, 540], [660, 690], 'point', 90] },
  thumbs:    { L: [L0, [195, 560], [200, 735], 'fist', 0], R: [R0, [660, 520], [640, 395], 'thumb', 0] },
  present:   { L: [L0, [195, 560], [200, 735], 'fist', 0], R: [R0, [655, 470], [706, 545], 'palmUp', 0] },
  shrug:     { L: [L0, [100, 520], [72, 432], 'palmUp', 0], R: [R0, [700, 520], [728, 432], 'palmUp', 0] },
  cross:     { L: [L0, [250, 590], [515, 500], 'fist', 0], R: [R0, [550, 610], [300, 520], 'fist', 0] },
  hips:      { L: [L0, [105, 565], [235, 745], 'fist', 0], R: [R0, [695, 565], [565, 745], 'fist', 0] },
};
const FACES = {
  question: g => `<text x="150" y="212" font-family="Arial Black,Impact,sans-serif" font-size="210" font-weight="900" fill="#fff" text-anchor="middle">?</text>`,
  exclaim:  g => `<text x="150" y="212" font-family="Arial Black,Impact,sans-serif" font-size="210" font-weight="900" fill="#ffd400" text-anchor="middle">!</text>`,
  dollar:   g => `<text x="150" y="208" font-family="Arial Black,Impact,sans-serif" font-size="190" font-weight="900" fill="#3ddc84" text-anchor="middle">$</text>`,
  check:    g => `<path d="M80 150 L130 200 L222 96" fill="none" stroke="#3ddc84" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross:    g => `<path d="M92 92 L208 208 M208 92 L92 208" fill="none" stroke="#ff4d4d" stroke-width="30" stroke-linecap="round"/>`,
  dots:     g => `<g fill="${g.ink}"><circle cx="85" cy="165" r="19"/><circle cx="150" cy="165" r="19"/><circle cx="215" cy="165" r="19"/></g>`,
  smile:    g => `<g fill="${g.ink}"><circle cx="105" cy="120" r="17"/><circle cx="195" cy="120" r="17"/></g><path d="M85 170 Q150 245 215 170" fill="none" stroke="${g.ink}" stroke-width="15" stroke-linecap="round"/>`,
  laugh:    g => `<path d="M82 120 Q105 92 128 120 M172 120 Q195 92 218 120" fill="none" stroke="${g.ink}" stroke-width="14" stroke-linecap="round"/><path d="M78 160 Q150 270 222 160 Z" fill="${g.ink}"/><path d="M110 205 Q150 235 190 205 Q150 222 110 205Z" fill="#ff6b81"/>`,
  shock:    g => `<g fill="#fff" stroke="${g.ink}" stroke-width="6"><circle cx="105" cy="120" r="30"/><circle cx="195" cy="120" r="30"/></g><g fill="${g.ink}"><circle cx="105" cy="125" r="11"/><circle cx="195" cy="125" r="11"/></g><ellipse cx="150" cy="205" rx="24" ry="32" fill="${g.ink}"/>`,
  wink:     g => `<circle cx="105" cy="120" r="17" fill="${g.ink}"/><path d="M176 122 Q195 100 214 122" fill="none" stroke="${g.ink}" stroke-width="14" stroke-linecap="round"/><path d="M85 170 Q150 240 215 170" fill="none" stroke="${g.ink}" stroke-width="15" stroke-linecap="round"/>`,
  love:     g => `<g fill="#ff3b5c"><path d="M105 155 C70 125 80 90 105 100 C130 90 140 125 105 155Z" transform="translate(-4 -6) scale(1.1)"/><path d="M195 155 C160 125 170 90 195 100 C220 90 230 125 195 155Z" transform="translate(4 -6) scale(1.1)"/></g><path d="M95 195 Q150 245 205 195" fill="none" stroke="${g.ink}" stroke-width="14" stroke-linecap="round"/>`,
  sad:      g => `<g fill="${g.ink}"><circle cx="105" cy="125" r="16"/><circle cx="195" cy="125" r="16"/></g><path d="M92 215 Q150 160 208 215" fill="none" stroke="${g.ink}" stroke-width="14" stroke-linecap="round"/><path d="M215 150 Q228 180 215 192 Q202 180 215 150Z" fill="#5ac8fa"/>`,
  idea:     g => `<circle cx="150" cy="125" r="52" fill="#ffd400"/><rect x="128" y="170" width="44" height="40" rx="8" fill="#e8e8e8"/><rect x="132" y="212" width="36" height="12" rx="6" fill="#bbb"/><path d="M130 160 L145 135 L155 150 L170 125" fill="none" stroke="#c28f00" stroke-width="7" stroke-linecap="round"/><g stroke="#ffd400" stroke-width="9" stroke-linecap="round"><path d="M60 80 L82 95 M240 80 L218 95 M45 130 L72 130 M255 130 L228 130"/></g>`,
  cool:     g => `<path d="M62 105 H238 V135 Q238 168 205 168 Q172 168 165 135 H135 Q128 168 95 168 Q62 168 62 135Z" fill="#111" stroke="${g.ink}" stroke-width="6"/><path d="M85 205 Q150 245 215 205" fill="none" stroke="${g.ink}" stroke-width="14" stroke-linecap="round"/>`,
};
const poly = (pts) => pts.map(p => p.join(',')).join(' ');
function hand(kind, [x, y], ang, g) {
  const f = (inner) => `<g transform="translate(${x} ${y}) rotate(${ang})" stroke="${LN}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
  const fist = `<rect x="-38" y="-34" width="76" height="68" rx="26" fill="${SK}"/><path d="M-16 -30 V-6 M4 -30 V-6 M24 -30 V-6" stroke="${SKD}" stroke-width="5" fill="none"/>`;
  const fingers = (n, sc = 1) => { let s = ''; const xs = [-34, -12, 10, 32]; for (let i = 0; i < 4; i++) { const h = [58, 70, 66, 52][i] * sc; s += `<rect x="${xs[i] - 10 * sc}" y="${-h - 20 * sc}" width="${21 * sc}" height="${h + 14 * sc}" rx="${10 * sc}" fill="${SK}"/>`; } return s; };
  switch (kind) {
    case 'fist': return f(fist);
    case 'palm': return f(`${fingers(4)}<rect x="-46" y="-34" width="92" height="82" rx="28" fill="${SK}"/><rect x="-58" y="-6" width="26" height="62" rx="13" fill="${SK}" transform="rotate(-38 -45 25)"/>`);
    case 'palmBig': return f(`<g transform="scale(1.55) translate(0 -20)">${fingers(4)}<rect x="-46" y="-34" width="92" height="82" rx="28" fill="${SK}"/><rect x="-58" y="-6" width="26" height="62" rx="13" fill="${SK}" transform="rotate(-38 -45 25)"/></g>`);
    case 'palmUp': return f(`<g transform="rotate(-90)">${fingers(4, 0.95)}<rect x="-46" y="-34" width="92" height="82" rx="28" fill="${SK}"/></g>`);
    case 'point': return f(`${fist}<rect x="-8" y="-86" width="26" height="76" rx="13" fill="${SK}" transform="rotate(90)"/>`);
    case 'thumb': return f(`${fist}<rect x="-14" y="-82" width="28" height="64" rx="14" fill="${SK}"/>`);
  }
  return '';
}
function arm(a, g) {
  const [s, e, w, kind, ang] = a;
  return `<polyline points="${poly([s, e, w])}" fill="none" stroke="${LN}" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${poly([s, e, w])}" fill="none" stroke="${g.sleeve}" stroke-width="78" stroke-linecap="round" stroke-linejoin="round"/>${g.id === 'casual' ? `<polyline points="${poly([e, w])}" fill="none" stroke="${SK}" stroke-width="64" stroke-linecap="round"/>` : ''}` + hand(kind, w, ang, g);
}
function body(g, pose) {
  const P = POSES[pose];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  if (g.hood) s += `<path d="M210 330 Q175 150 400 105 Q625 150 590 330Z" fill="${g.hood}" stroke="${LN}" stroke-width="5"/>`;
  // trousers + legs
  s += `<path d="M262 760 H538 L555 ${H} H415 L400 880 L385 ${H} H245Z" fill="${g.pants}" stroke="${LN}" stroke-width="5" stroke-linejoin="round"/>`;
  // torso
  s += `<path d="M215 360 Q215 318 270 306 L530 306 Q585 318 585 360 L578 790 H222Z" fill="${g.shirt}" stroke="${LN}" stroke-width="5" stroke-linejoin="round"/>`;
  s += `<path d="M300 330 Q400 390 500 330 L500 790 H300Z" fill="${g.shirtD}" opacity=".35"/>`;
  if (g.tie) {
    s += `<path d="M345 300 L400 345 L455 300 L440 285 H360Z" fill="#fff" stroke="${LN}" stroke-width="5"/>`;
    s += `<path d="M385 340 H415 L432 372 L412 392 L452 760 L400 790 L348 760 L388 392 L368 372Z" fill="${g.tie}" stroke="${LN}" stroke-width="5" stroke-linejoin="round"/>`;
  } else if (g.hood) {
    s += `<path d="M300 306 Q400 395 500 306 L520 330 Q400 430 280 330Z" fill="${g.shirtD}" stroke="${LN}" stroke-width="5"/>`;
    s += `<path d="M370 380 L368 470 M430 380 L432 470" stroke="${g.strings}" stroke-width="9" stroke-linecap="round"/><path d="M285 650 Q400 700 515 650 L505 770 H295Z" fill="${g.shirtD}" stroke="${LN}" stroke-width="5"/>`;
  } else {
    s += `<path d="M335 306 Q400 360 465 306" fill="${SK}" stroke="${LN}" stroke-width="5"/>`;
  }
  if (g.belt) s += `<rect x="222" y="760" width="356" height="46" fill="${g.belt}" stroke="${LN}" stroke-width="5"/><rect x="375" y="766" width="50" height="34" rx="5" fill="#cfcfcf" stroke="${LN}" stroke-width="4"/><rect x="385" y="774" width="30" height="18" rx="3" fill="${g.belt}"/>`;
  // neck
  s += `<rect x="360" y="270" width="80" height="50" fill="${SK}" stroke="${LN}" stroke-width="5"/>`;
  s += arm(P.L, g) + arm(P.R, g);
  return s + '</svg>';
}
const headSvg = (g, face) => `<svg xmlns="http://www.w3.org/2000/svg" width="${HEAD}" height="${HEAD}" viewBox="-15 -15 330 330"><circle cx="150" cy="150" r="138" fill="${g.head}" stroke="${LN}" stroke-width="6"/><ellipse cx="105" cy="75" rx="52" ry="26" fill="#fff" opacity=".10" transform="rotate(-25 105 75)"/>${FACES[face](g)}</svg>`;

// meaning tags + trigger words (many languages, lower case) -> used by the planner when no AI is available and as hints for the AI
const POSE_INFO = {
  idle: ['neutral', 'listening', 'default'], wave: ['hello', 'hi', 'greeting', 'welcome', 'bye', 'goodbye'], stop: ['stop', 'wait', 'hold on', 'attention', 'warning', 'before you'],
  point: ['look here', 'this', 'check this', 'pointing aside'], point_up: ['idea', 'top', 'tip', 'number one', 'listen'], point_down: ['link below', 'comment', 'description', 'download below', 'click below'],
  thumbs: ['good', 'great', 'approved', 'like', 'works', 'free'], present: ['introducing', 'here it is', 'showing', 'offer', 'presenting'], shrug: ['who knows', 'no idea', 'why', 'whatever', 'maybe'],
  cross: ['no', 'never', 'not allowed', 'serious', 'skeptical'], hips: ['confident', 'ready', 'proud', 'done', 'boss'],
};
const FACE_INFO = {
  question: ['question', 'why', 'what', 'how', 'secret', 'mystery', 'unknown'], exclaim: ['warning', 'attention', 'important', 'wait', 'stop'], dollar: ['money', 'dollar', 'earn', 'pay', 'income', 'price', 'cash', 'rich'],
  check: ['yes', 'correct', 'works', 'done', 'free', 'verified', 'no sign up'], cross: ['no', 'wrong', 'scam', 'not', 'fake', 'never'], dots: ['thinking', 'wait', 'loading', 'hmm'], smile: ['happy', 'nice', 'welcome', 'friendly'],
  laugh: ['funny', 'lol', 'crazy', 'joke'], shock: ['shock', 'wow', 'unbelievable', 'insane', 'omg', 'huge', 'crazy'], wink: ['trust me', 'secret tip', 'hint'], love: ['love', 'favorite', 'best', 'amazing'],
  sad: ['sad', 'lose', 'problem', 'pain', 'miss out', 'sorry'], idea: ['idea', 'tip', 'trick', 'hack', 'solution', 'tool'], cool: ['cool', 'pro', 'smart', 'easy', 'boss'],
};
// default look for a few trigger words in many languages (Roman Urdu/Hindi, Urdu, Hindi, Arabic, Spanish, French, Turkish ...)
const TRIGGERS = [
  { words: ['ruko', 'ruk', 'ruk jao', 'ٹھہرو', 'رکو', 'रुको', 'रुकिए', 'قف', 'انتظر', 'espera', 'alto', 'attends', 'stop', 'wait', 'hold on', 'dur', 'bekle', 'warte'], pose: 'stop', face: 'exclaim' },
  { words: ['hello', 'hi', 'salam', 'assalam', 'السلام', 'سلام', 'नमस्ते', 'हेलो', 'مرحبا', 'hola', 'bonjour', 'merhaba', 'hey', 'welcome'], pose: 'wave', face: 'smile' },
  { words: ['dollar', 'dollars', 'paisa', 'paise', 'earn', 'kamao', 'kamai', 'ڈالر', 'پیسے', 'कमाओ', 'डॉलर', 'money', 'cash', 'دولار', 'dinero', 'argent', 'para', 'income', 'paid', 'pay'], pose: 'present', face: 'dollar' },
  { words: ['link', 'comment', 'description', 'bio', 'لنک', 'کمنٹ', 'लिंक', 'कमेंट', 'رابط', 'enlace', 'lien', 'bağlantı'], pose: 'point_down', face: 'smile' },
  { words: ['free', 'muft', 'mufat', 'مفت', 'मुफ़्त', 'मुफ्त', 'gratis', 'gratuit', 'ücretsiz', 'مجاني'], pose: 'thumbs', face: 'check' },
  { words: ['secret', 'raaz', 'راز', 'राज़', 'سر', 'secreto', 'secret', 'gizli', 'hidden'], pose: 'point', face: 'wink' },
  { words: ['wow', 'unbelievable', 'insane', 'crazy', 'hairat', 'حیرت', 'अविश्वसनीय', 'increíble', 'incroyable', 'inanılmaz', 'omg'], pose: 'shrug', face: 'shock' },
  { words: ['idea', 'tip', 'trick', 'hack', 'tarkeeb', 'ترکیب', 'ट्रिक', 'consejo', 'astuce', 'ipucu'], pose: 'point_up', face: 'idea' },
  { words: ['warning', 'careful', 'scam', 'fraud', 'dhoka', 'دھوکہ', 'धोखा', 'cuidado', 'attention', 'dikkat', 'احذر'], pose: 'stop', face: 'cross' },
  { words: ['best', 'top', 'number one', 'sab se', 'behtareen', 'بہترین', 'सबसे', 'mejor', 'meilleur', 'en iyi', 'أفضل'], pose: 'hips', face: 'cool' },
];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const shot = async (svg, file, w, h) => { await pg.setViewportSize({ width: w, height: h }); await pg.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`); await pg.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } }); };
  for (const [id, st] of Object.entries(STYLES)) {
    const g = { ...st, id }, dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
    for (const p of Object.keys(POSES)) await shot(body(g, p), path.join(dir, `body_${p}.png`), W, H);
    for (const f of Object.keys(FACES)) await shot(headSvg(g, f), path.join(dir, `head_${f}.png`), HEAD, HEAD);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id, name: st.name, mode: 'layered', body: { w: W, h: H }, head: { w: HEAD, x: HX, y: HY }, poses: Object.fromEntries(Object.keys(POSES).map(p => [p, POSE_INFO[p]])), faces: Object.fromEntries(Object.keys(FACES).map(f => [f, FACE_INFO[f]])), triggers: TRIGGERS }, null, 1));
  }
  await br.close(); console.log('ok');
})();
