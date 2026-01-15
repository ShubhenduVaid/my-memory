const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src', 'renderer');
const outDir = path.join(rootDir, 'dist', 'renderer');

function copyRendererAssets() {
  fs.mkdirSync(outDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.ts')) continue;

    const from = path.join(srcDir, entry.name);
    const to = path.join(outDir, entry.name);
    fs.copyFileSync(from, to);
  }
}

copyRendererAssets();
