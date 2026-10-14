// Deletes onnxruntime-node binaries of other platforms from node_modules so the app stays small.
// Usage: node scripts/prune-onnx.cjs win32|linux|darwin
const fs = require('fs'), path = require('path');
const keep = process.argv[2] || ({ win32: 'win32', linux: 'linux', darwin: 'darwin' }[process.platform]);
const base = path.join(__dirname, '..', 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6');
if (!fs.existsSync(base)) { console.log('onnxruntime-node binaries not found, nothing to prune'); process.exit(0); }
for (const os of fs.readdirSync(base)) {
  const p = path.join(base, os);
  if (os !== keep) { fs.rmSync(p, { recursive: true, force: true }); console.log('removed', os); }
  else if (os === 'win32') { const a = path.join(p, 'arm64'); if (fs.existsSync(a)) { fs.rmSync(a, { recursive: true, force: true }); console.log('removed win32/arm64'); } }
}
