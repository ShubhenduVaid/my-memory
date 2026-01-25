const esbuild = require('esbuild');
const path = require('path');

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
    '.css': 'css',
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
