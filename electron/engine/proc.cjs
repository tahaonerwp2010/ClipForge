// The end of ffmpeg's log is usually only the knock-on errors; the first real error line ("Invalid argument", "Missing ')'"...) is kept too
function errTail(e) {
  const lines = String(e).split(/\r?\n/).filter(Boolean);
  const key = lines.filter(l => /error|invalid|undefined|missing|no such|cannot|unable|could not|failed to/i.test(l) && !/fc#0|aost#|vost#|out#0|Terminating thread/i.test(l)).slice(0, 3).map(l => l.slice(0, 260));
  const tail = String(e).slice(-700);
  return key.length && !key.every(k => tail.includes(k.slice(0, 80))) ? key.join('\n') + '\n...\n' + tail : String(e).slice(-1200);
}
const { spawn } = require('child_process');
const live = new Set();
let cancelled = false;
function run(cmd, args, { cwd, onStderr, onStdout } = {}) {
  return new Promise((resolve, reject) => {
    if (cancelled) return reject(new Error('CANCELLED'));
    const child = spawn(cmd, args, { cwd, windowsHide: true });
    live.add(child);
    try { require('os').setPriority(child.pid, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* the app window stays smooth while ffmpeg works */ }
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; onStdout && onStdout(d.toString()); });
    child.stderr.on('data', d => { err += d; onStderr && onStderr(d.toString()); });
    child.on('error', e => { live.delete(child); reject(new Error(`Cannot start "${cmd}": ${e.message}`)); });
    child.on('close', code => {
      live.delete(child);
      if (child.__cancelled || cancelled) return reject(new Error('CANCELLED'));
      code === 0 ? resolve({ stdout: out, stderr: err }) : reject(new Error(`${cmd} exited ${code}: ${errTail(err)}`));
    });
  });
}
// a child process started elsewhere (reading ffmpeg's output directly) is stopped by Cancel too
function track(child) { if (cancelled) { try { child.kill(); } catch {} return; } live.add(child); child.on('close', () => live.delete(child)); }
function killAll() { cancelled = true; for (const c of live) { c.__cancelled = true; try { c.kill(); } catch {} } }
const resetCancel = () => { cancelled = false; };
const isCancelled = () => cancelled;
const checkCancel = () => { if (cancelled) throw new Error('CANCELLED'); };
module.exports = { run, track, killAll, resetCancel, isCancelled, checkCancel };
