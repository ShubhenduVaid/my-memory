const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Collect all CSS files
const cssFiles = [];
function collectCss(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCss(fullPath);
    } else if (entry.name.endsWith('.css')) {
      cssFiles.push(fullPath);
    }
  }
}
collectCss(path.join(__dirname, '../src/renderer'));

// Bundle CSS separately
const cssContent = cssFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
fs.mkdirSync(path.join(__dirname, '../dist/renderer'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../dist/renderer/bundle.css'), cssContent);

esbuild.build({
  entryPoints: [path.join(__dirname, '../src/renderer/index.tsx')],
  bundle: true,
  outfile: path.join(__dirname, '../dist/renderer/index.js'),
  platform: 'browser',
  target: 'chrome120',
  format: 'iife',
  sourcemap: true,
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'empty',  // Ignore CSS imports in JS
  },
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}).then(() => {
  console.log('Renderer bundled successfully');
}).catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
