const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src', 'renderer');
const outDir = path.join(rootDir, 'dist', 'renderer');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcDir, outDir);
