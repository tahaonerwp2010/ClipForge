const { spawn } = require('child_process');
const live = new Set();
let cancelled = false;
function run(cmd, args, { cwd, onStderr, onStdout } = {}) {
  return new Promise((resolve, reject) => {
    if (cancelled) return reject(new Error('CANCELLED'));
    const child = spawn(cmd, args, { cwd, windowsHide: true });
    live.add(child);
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; onStdout && onStdout(d.toString()); });
    child.stderr.on('data', d => { err += d; onStderr && onStderr(d.toString()); });
    child.on('error', e => { live.delete(child); reject(new Error(`Cannot start "${cmd}": ${e.message}`)); });
    child.on('close', code => {
      live.delete(child);
      if (child.__cancelled || cancelled) return reject(new Error('CANCELLED'));
      code === 0 ? resolve({ stdout: out, stderr: err }) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-1200)}`));
    });
  });
}
function killAll() { cancelled = true; for (const c of live) { c.__cancelled = true; try { c.kill(); } catch {} } }
const resetCancel = () => { cancelled = false; };
const isCancelled = () => cancelled;
const checkCancel = () => { if (cancelled) throw new Error('CANCELLED'); };
module.exports = { run, killAll, resetCancel, isCancelled, checkCancel };
