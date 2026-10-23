// whisper.cpp CLI wrapper -> word-level timestamps
const fs = require('fs');
const PUNCT_ONLY = (() => { try { return new RegExp('^[\\p{P}\\p{S}]+$', 'u'); } catch { return /^[!-\/:-@\[-`{-~\u00A1-\u00BF\u2000-\u206F\u20A0-\u20CF\u2190-\u2BFF\u3000-\u303F\uFF00-\uFF0F]+$/; } })();   // Android's Node has no Unicode property tables
const os = require('os');
const path = require('path');
const P = require('./paths.cjs');
const { run, checkCancel } = require('./proc.cjs');

const DTW = { small: 'small', medium: 'medium', 'large-v3-turbo': 'large.v3.turbo' };
let dtwOk;
// Chunked + checkpointed: every finished chunk is saved (chunk_N.json) so a paused/cancelled run resumes at the same chunk.
async function transcribe(wavPath, { prompt = '', modelId = 'small', language = 'auto', workDir, duration = 0, chunkSec = 300, onProgress, slice, hardware = 'cpu', log = () => {} }) {
  const model = P.modelFile(modelId);
  if (!fs.existsSync(model)) throw new Error(`Whisper model "${modelId}" is not downloaded. Settings → Models → Download.`);
  const HW = require('./hardware.cjs'), sb = HW.speechBins();
  const bin = sb.cpu;
  if (!bin) throw new Error('The speech engine (whisper-cli) was not found in the "binaries" folder.');
  if (!/^[a-z]{2,3}$/.test(String(language || ''))) language = 'auto';   // whisper only understands codes like en, hi, ur
  const n = duration > chunkSec * 1.4 && slice ? Math.ceil(duration / chunkSec) : 1;
  const cores = Math.max(1, os.cpus().length);
  // runners = who can transcribe a chunk: the processor build, the graphics-card build (or Metal on Mac)
  const cpuRun = { id: 'cpu', bin, extra: sb.cpuExtra, threads: cores };
  const gpuRun = sb.gpu ? { id: 'gpu', bin: sb.gpu, extra: [], threads: Math.max(2, Math.min(4, Math.floor(cores / 2))) } : null;
  const mode = HW.normMode(hardware);
  let workers;
  if (mode === 'cpu') workers = [cpuRun];
  else if (mode === 'gpu') { workers = [gpuRun || cpuRun]; if (!gpuRun) log('Whisper', 'This build has no graphics-card speech engine, so the processor transcribes', 'warn'); }
  else if (gpuRun) workers = [gpuRun, { ...cpuRun, threads: Math.max(1, cores - gpuRun.threads) }];
  else workers = [cpuRun];
  if (n === 1 && workers.length > 1) workers = [workers[0]];
  log('Whisper', `Speech engine on: ${workers.map(w => w.id === 'gpu' ? 'graphics card' : 'processor').join(' + ')}`, 'info');
  const prog = new Array(n).fill(0);
  const report = () => { if (onProgress) onProgress(prog.reduce((a, b) => a + b, 0) / n); };
  const dtw = DTW[modelId];

  async function runChunk(i, wk) {
    const offset = n === 1 ? 0 : i * chunkSec;
    const base = path.join(workDir, `chunk_${i}`);
    if (fs.existsSync(base + '.json')) { prog[i] = 1; report(); return; }
    checkCancel();
    let f = wavPath;
    if (n > 1) { f = path.join(workDir, `chunk_${i}${wk.id === 'gpu' ? '_g' : ''}.wav`); await slice(wavPath, offset, chunkSec, f); }
    const attemptWith = async (runner) => {
      const baseArgs = ['-m', model, '-f', f, '-oj', '-of', base, '-ml', '1', '-sow', '-l', language || 'auto', '-pp', '-t', String(runner.threads), ...runner.extra];
      // DTW token timestamps = much tighter word timing. Not every whisper-cli build supports it, so fall back step by step.
      let attempts = dtw && dtwOk !== false ? [[...baseArgs, '-dtw', dtw, '-nfa'], [...baseArgs, '-dtw', dtw], baseArgs] : [baseArgs];
      // A Roman-letter initial prompt makes the model write Hindi/Urdu speech in English letters (Hinglish). If this build rejects the flag, the plain attempts below still run.
      if (prompt) attempts = [...attempts.map(a => [...a, '--prompt', prompt]), ...attempts];
      let lastErr = null;
      for (let a = 0; a < attempts.length; a++) {
        try {
          await run(runner.bin, attempts[a], {
            cwd: path.dirname(runner.bin),
            onStderr: s => { const m = s.match(/progress\s*=\s*(\d+)%/); if (m) { prog[i] = Math.max(prog[i], +m[1] / 100); report(); } },
          });
          if (!fs.existsSync(base + '.json')) throw new Error('The speech engine finished without writing a result' + (a < attempts.length - 1 ? ', retrying another way…' : '.'));
          if (dtw && runner.id === 'cpu') dtwOk = a < attempts.length - 1;
          return null;
        } catch (e) { if (String(e.message) === 'CANCELLED') throw e; lastErr = e; try { fs.unlinkSync(base + '.json'); } catch {} }
      }
      return lastErr;
    };
    let err = await attemptWith(wk);
    if (err && wk.id === 'gpu') {                              // the graphics-card engine could not run (no Vulkan driver…): this chunk goes to the processor
      log('Whisper', 'Graphics-card speech engine did not start, using the processor for this part', 'warn');
      prog[i] = 0; err = await attemptWith({ ...cpuRun, threads: cores });
    }
    if (err) throw err;
    if (f !== wavPath) { try { fs.unlinkSync(f); } catch {} }
    prog[i] = 1; report();
  }
  await HW.pool(n, workers, runChunk);
  const all = [];
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : i * chunkSec;
    const part = parseWhisperJson(JSON.parse(fs.readFileSync(path.join(workDir, `chunk_${i}`) + '.json', 'utf8')));
    for (const w of part) all.push({ ...w, start: +(w.start + offset).toFixed(2), end: +(w.end + offset).toFixed(2) });
  }
  if (onProgress) onProgress(1);
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
    const onlyPunct = PUNCT_ONLY.test(text);
    if ((onlyPunct || !startsNewWord) && words.length) {
      const last = words[words.length - 1];
      last.word += text; last.end = Math.max(last.end, +end.toFixed(2));
    } else words.push({ word: text, start: +start.toFixed(2), end: +end.toFixed(2) });
  }
  return words;
}
module.exports = { transcribe, parseWhisperJson };
