const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'target', 'release');
const target = path.join(rootDir, 'duoorb-analyzer.node');

const candidates = [
  path.join(releaseDir, 'duoorb_analyzer.dll'),
  path.join(releaseDir, 'libduoorb_analyzer.so'),
  path.join(releaseDir, 'libduoorb_analyzer.dylib')
];

let found = false;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    fs.copyFileSync(cand, target);
    console.log(`[analyzer-rust] Copied native binary ${path.basename(cand)} -> duoorb-analyzer.node`);
    found = true;
    break;
  }
}

if (!found) {
  console.error('[analyzer-rust] Could not find compiled dynamic library in target/release');
  process.exit(1);
}
