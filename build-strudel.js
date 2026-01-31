/**
 * Bundle the Strudel view (app.js) with esbuild so that @strudel/codemirror
 * and other bare specifiers resolve in the Electron renderer.
 * Run: node build-strudel.js
 * Output: src/views/strudel/dist/app.js
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const entry = path.join(__dirname, 'src', 'views', 'strudel', 'app.js');
const outDir = path.join(__dirname, 'src', 'views', 'strudel', 'dist');
const outFile = path.join(outDir, 'app.js');

if (!fs.existsSync(entry)) {
  console.error('[build-strudel] Entry not found:', entry);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    outfile: outFile,
    platform: 'browser',
    target: ['chrome90'],
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    // Resolve .mjs and node_modules
    mainFields: ['module', 'main'],
    conditions: ['import', 'module', 'default'],
  })
  .then(() => {
    console.log('[build-strudel] Built:', outFile);
  })
  .catch((err) => {
    console.error('[build-strudel] Build failed:', err);
    process.exit(1);
  });
