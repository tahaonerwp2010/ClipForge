// whisper.cpp CLI wrapper -> word-level timestamps
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('./paths.cjs');
const { run, checkCancel } = require('./proc.cjs');

const DTW = { small: 'small', medium: 'medium', 'large-v3-turbo': 'large.v3.turbo' };
let dtwOk;
// Chunked + checkpointed: every finished chunk is saved (chunk_N.json) so a paused/cancelled run resumes at the same chunk.
async function transcribe(wavPath, { prompt = '', modelId = 'small', language = 'auto', workDir, duration = 0, chunkSec = 300, onProgress, slice }) {
  const model = P.modelFile(modelId);
  if (!fs.existsSync(model)) throw new Error(`Whisper model "${modelId}" is not downloaded. Settings → Models → Download.`);
  const bin = P.resolveBin('whisper-cli') || P.resolveBin('main');
  if (!bin) throw new Error('The speech engine (whisper-cli) was not found in the "binaries" folder.');
  if (!/^[a-z]{2,3}$/.test(String(language || ''))) language = 'auto';   // whisper only understands codes like en, hi, ur
  const n = duration > chunkSec * 1.4 && slice ? Math.ceil(duration / chunkSec) : 1;
  const all = [];
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : i * chunkSec;
    const base = path.join(workDir, `chunk_${i}`);
    if (!fs.existsSync(base + '.json')) {
      checkCancel();
      let f = wavPath;
      if (n > 1) { f = path.join(workDir, `chunk_${i}.wav`); await slice(wavPath, offset, chunkSec, f); }
      const baseArgs = ['-m', model, '-f', f, '-oj', '-of', base, '-ml', '1', '-sow',
        '-l', language || 'auto', '-pp', '-t', String(Math.max(1, os.cpus().length))];
      // DTW token timestamps = much tighter word timing. Not every whisper-cli build supports it, so fall back step by step.
      const dtw = DTW[modelId];
      let attempts = dtw && dtwOk !== false ? [[...baseArgs, '-dtw', dtw, '-nfa'], [...baseArgs, '-dtw', dtw], baseArgs] : [baseArgs];
      // A Roman-letter initial prompt makes the model write Hindi/Urdu speech in English letters (Hinglish). If this build rejects the flag, the plain attempts below still run.
      if (prompt) attempts = [...attempts.map(a => [...a, '--prompt', prompt]), ...attempts];
      let lastErr;
      for (let a = 0; a < attempts.length; a++) {
        try {
          await run(bin, attempts[a], {
            cwd: path.dirname(bin),
            onStderr: s => { const m = s.match(/progress\s*=\s*(\d+)%/); if (m && onProgress) onProgress((i + +m[1] / 100) / n); },
          });
          if (!fs.existsSync(base + '.json')) throw new Error('The speech engine finished without writing a result' + (a < attempts.length - 1 ? ', retrying another way…' : '.'));
          if (dtw) dtwOk = a < attempts.length - 1;
          lastErr = null; break;
        } catch (e) { if (String(e.message) === 'CANCELLED') throw e; lastErr = e; try { fs.unlinkSync(base + '.json'); } catch {} }
      }
      if (lastErr) throw lastErr;
      if (f !== wavPath) { try { fs.unlinkSync(f); } catch {} }
    }
    const part = parseWhisperJson(JSON.parse(fs.readFileSync(base + '.json', 'utf8')));
    for (const w of part) all.push({ ...w, start: +(w.start + offset).toFixed(2), end: +(w.end + offset).toFixed(2) });
    if (onProgress) onProgress((i + 1) / n);
  }
  return all;
}

function parseWhisperJson(json) {
  const words = [];
  for (const seg of json.transcription || []) {
    const raw = seg.text || '';
    const text = raw.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();
    if (!text) continue;
    const start = seg.offsets.from / 1000, end = seg.offsets.to / 1000;
    const startsNewWord = /^\s/.test(raw) || words.length === 0;
    const onlyPunct = /^[\p{P}\p{S}]+$/u.test(text);
    if ((onlyPunct || !startsNewWord) && words.length) {
      const last = words[words.length - 1];
      last.word += text; last.end = Math.max(last.end, +end.toFixed(2));
    } else words.push({ word: text, start: +start.toFixed(2), end: +end.toFixed(2) });
  }
  return words;
}
module.exports = { transcribe, parseWhisperJson };
