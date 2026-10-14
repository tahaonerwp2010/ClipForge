// Prompt-driven reframing: asks Gemini where the described person/object is (about once per second) so the crop can follow them.
const fs = require('fs');
const G = require('./ai.cjs');

// frames: jpg paths sampled at `fps`; returns an array (same length as frames) of x in 0..1 or null
async function subjectHints(frames, fps, subject, g) {
  const step = Math.max(1, Math.round(fps * (frames.length / fps > 40 ? 2 : 1)));        // ~1 frame/s (every 2 s for long clips)
  const idx = []; for (let i = 0; i < frames.length; i += step) idx.push(i);
  const parts = [{ text: `These ${idx.length} images are consecutive frames of one video. For EACH image give the horizontal centre (0 = left edge, 1 = right edge) of: ${subject}. Use null when it is not visible.
Return ONLY a JSON array of exactly ${idx.length} numbers or nulls, in order.` }];
  idx.forEach(i => parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(frames[i]).toString('base64') } }));
  const r = await G.generate(g, { parts, json: true, timeoutMs: 180000 });
  const arr = G.parseJson(r.text);
  const xs = Array.isArray(arr) ? arr : (arr.positions || arr.x || []);
  if (xs.length !== idx.length) throw new Error('unexpected answer length');
  const hints = new Array(frames.length).fill(null);
  idx.forEach((fi, k) => { const v = xs[k]; if (typeof v === 'number' && v >= 0 && v <= 1) { for (let d = 0; d < step && fi + d < frames.length; d++) hints[fi + d] = v; } });
  return hints;
}
module.exports = { subjectHints };
