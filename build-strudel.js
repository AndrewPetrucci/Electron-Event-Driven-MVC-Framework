/**
 * Bundle the Strudel view (app.js) with esbuild so that @strudel/codemirror
 * and other bare specifiers resolve in the Electron renderer.
 * Also bundles superdough and supradough AudioWorklets so LPF and other
 * effects work (addModule needs a loadable URL; ?audioworklet is Vite-only).
 * Run: node build-strudel.js
 * Output: packages/overlay-view-strudel/dist/app.js, dist/superdough-worklets.js, dist/supradough-worklet.js
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const strudelRoot = path.join(__dirname, 'packages', 'overlay-view-strudel');
const entry = path.join(strudelRoot, 'app.js');
const outDir = path.join(strudelRoot, 'dist');
const outFile = path.join(outDir, 'app.js');

// Populated during main build so we can emit worklet bundles afterward.
const workletEntries = [];
const workletPathToOutName = new Map();

const superdoughSource = path.join(__dirname, 'node_modules', 'superdough', 'index.mjs');
const supradoughSource = path.join(__dirname, 'node_modules', 'supradough', 'index.mjs');

function audioworkletPlugin() {
  return {
    name: 'audioworklet',
    setup(build) {
      // Use superdough/supradough source (not dist) so we see ?audioworklet imports.
      build.onResolve({ filter: /^superdough$/ }, () => ({ path: superdoughSource }));
      build.onResolve({ filter: /^supradough$/ }, () => ({ path: supradoughSource }));

      // Replace ?audioworklet imports with a file URL so worklets load reliably in Electron.
      // (Electron's addModule() does not reliably support data URLs; use file URL instead.)
      // Match both "path?audioworklet" and "path" (in case esbuild strips the query).
      const handleWorklet = (args) => {
        const withoutQuery = args.path.replace(/\?audioworklet$/, '');
        const resolved = path.resolve(path.dirname(args.importer), withoutQuery);
        let outName = 'worklets.js';
        if (args.importer.includes('superdough')) outName = 'superdough-worklets.js';
        else if (args.importer.includes('supradough')) outName = 'supradough-worklet.js';
        else return null;
        workletEntries.push({ entry: resolved, outName });
        workletPathToOutName.set(resolved, outName);
        return { path: resolved, namespace: 'audioworklet-url' };
      };
      build.onResolve({ filter: /\?audioworklet$/ }, handleWorklet);
      build.onResolve({ filter: /(worklets|dough-worklet)\.mjs$/ }, (args) => {
        if (!args.importer.includes('superdough') && !args.importer.includes('supradough')) return null;
        return handleWorklet(args);
      });
      build.onLoad({ filter: /.*/, namespace: 'audioworklet-url' }, (args) => {
        const outName = workletPathToOutName.get(args.path) || 'worklets.js';
        return {
          contents: `export default "dist/${outName}";`,
          loader: 'js',
        };
      });
    },
  };
}

if (!fs.existsSync(entry)) {
  console.error('[build-strudel] Entry not found:', entry);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

async function buildWorklets() {
  for (const { entry: entryPath, outName } of workletEntries) {
    if (!fs.existsSync(entryPath)) {
      console.warn('[build-strudel] Worklet entry not found:', entryPath);
      continue;
    }
    const workletOut = path.join(outDir, outName);
    try {
      await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        format: 'iife',
        outfile: workletOut,
        platform: 'browser',
        target: ['chrome90'],
        mainFields: ['module', 'main'],
        conditions: ['import', 'module', 'default'],
      });
      console.log('[build-strudel] Worklet built:', workletOut);
    } catch (err) {
      console.error('[build-strudel] Worklet build failed for', entryPath, err);
      throw err;
    }
  }
}

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
    mainFields: ['module', 'main'],
    conditions: ['import', 'module', 'default'],
    alias: {
      // Use webaudio source so we can intercept ?audioworklet imports.
      '@strudel/webaudio': path.join(__dirname, 'node_modules', '@strudel', 'webaudio', 'index.mjs'),
    },
    plugins: [audioworkletPlugin()],
    // Strudel app intentionally uses eval() for user code when REPL is unavailable
    logOverride: { 'direct-eval': 'silent' },
  })
  .then(() => {
    console.log('[build-strudel] Built:', outFile);
    return buildWorklets();
  })
  .then(() => {
    console.log('[build-strudel] Done.');
  })
  .catch((err) => {
    console.error('[build-strudel] Build failed:', err);
    process.exit(1);
  });
