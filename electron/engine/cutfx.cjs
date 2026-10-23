// Camera-cut effects (always on): every time the source video switches camera angle, a tiny camera click is played and a very short, very light flash is shown.
// Cuts are found with FFmpeg scene detection; cuts that happen under a b-roll cut-away are ignored (nobody sees them).
const fs = require('fs');
const path = require('path');
const SFX = require('./sfxlib.cjs');

async function find(R, input, start, dur) {
  let t = [];
  try { t = await R.detectCuts(input, start, dur, 0.32, 30); } catch (e) { if (String(e.message) === 'CANCELLED') throw e; return []; }
  const out = [];
  for (const x of t) if (x > 0.35 && x < dur - 0.3 && (!out.length || x - out[out.length - 1] > 0.5)) out.push(+x.toFixed(2));
  return out.slice(0, 40);
}
// merge the cuts into the effects plan (creates a plan when Auto Effects is off)
function apply(fx, cuts, broll, hasAudio = true) {
  const list = (cuts || []).filter(t => !(broll || []).some(b => t >= b.t - 0.05 && t <= b.t + b.dur));
  if (!list.length) return fx;
  const out = fx || { sfx: [], flashes: [] };
  out.cutFlash = list.filter(t => !(out.flashes || []).some(f => Math.abs(f - t) < 0.15));
  let click = null; try { click = SFX.list().find(x => x.name === 'camera_shutter') || SFX.list().find(x => (x.roles || []).includes('camera')); } catch {}
  if (click && hasAudio) {
    out.sfx = out.sfx || [];
    for (const t of list) {
      if (out.sfx.some(s => Math.abs((s.t0 ?? s.t) - t) < 0.12 && s.role === 'camera')) continue;
      out.sfx.push({ file: click.path, t: Math.max(0, +(t - 0.015).toFixed(3)), db: +(-8 + (click.gainDb || 0)).toFixed(1), dur: Math.min(click.dur || 0.35, 0.35), role: 'camera', name: click.name, cut: true });
    }
  }
  return out;
}
module.exports = { find, apply };
