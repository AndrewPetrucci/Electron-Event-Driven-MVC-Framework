# Strudel Overlay View

Live-coding view for [Strudel](https://strudel.cc/) with pattern evaluation, inline visualizations, and active-token highlighting in the editor.

### Active-token highlighting

Highlighting uses the **Strudel REPL’s implementation** from **@strudel/codemirror**: `updateMiniLocations(view, locations)` (after eval) and `highlightMiniLocations(view, atTime, haps)` (each frame). The editor is created with the same extension (`highlightExtension`) via `initEditor()`. Because we evaluate wrapped code (IIFE with setup + pattern), we map `meta.miniLocations` and `hap.context.locations` from evaluated-code coordinates to document coordinates before calling the REPL API.

**Debugging highlighting:** In the Strudel window, open DevTools (e.g. Ctrl+Shift+I), then in the console run:

```js
window.STRUDEL_DEBUG_HIGHLIGHT = true
```

Evaluate your pattern again (Ctrl+Enter). The console will log: REPL mini-location count and sample positions (in codeToEval space), `offset`/`setupCodeStart`/`playCode` length, block count and `blockStarts`, and for the first few locations the full chain (REPL → playCode → block index → block local → doc range) plus the **exact document slice** we highlight. Compare those slices to what you expect to see highlighted to find off-by-one or wrong-block issues. Set `window.STRUDEL_DEBUG_HIGHLIGHT = false` to turn logging off.

## Build requirements

The Strudel view uses ES modules and bare specifiers (`@strudel/core`, `@strudel/codemirror`, etc.). The Electron renderer cannot resolve these directly, so the app is **bundled** before load.

- **Entry:** `app.js` (this folder)
- **Output:** `dist/strudel-app.js` at the **project root** (no `dist` directory is created inside this view)
- **Build script:** From the project root, run:
  ```bash
  npm run build:strudel
  ```
  This runs `node build-strudel.js`, which uses **esbuild** to bundle `app.js` and all `@strudel/*` (and related) dependencies into a single IIFE at `dist/strudel-app.js`.

### When the bundle is built

- **On demand:** When you open the Strudel window via `npm start`, the main process checks for `dist/strudel-app.js`. If it is missing, it runs the build once, then loads the window. So you can use `npm start` without running a Strudel build step yourself.
- **Manual:** Run `npm run build:strudel` whenever you change `app.js` or want a fresh bundle.
- **Packaging:** `npm run build` (electron-builder) runs `prebuild`, which runs the Strudel build so the packaged app includes `dist/strudel-app.js`.

### Dependencies

- **esbuild** (dev) – used by `build-strudel.js` at project root
- **@strudel/codemirror**, **@strudel/core**, **@strudel/draw**, **@strudel/mini**, **@strudel/tonal**, **@strudel/transpiler**, **@strudel/webaudio** – installed in the project root `node_modules`; the bundle resolves them at build time

### Loading

`index.html` loads the bundle with:

```html
<script src="../../../dist/strudel-app.js"></script>
```

So the Strudel window expects `dist/strudel-app.js` at the project root. There is no fallback to unbundled `app.js` (it would fail in the renderer).

## Audio and effects

Audio is handled by **@strudel/webaudio** → **superdough**. LPF (`.lpf()`, `.lpq()`), reverb (`.room()`), delay, and other superdough controls are supported.

### Default sample packs

The app loads **dirt-samples** by default, so sounds like `bd`, `sd`, `hh`, `gtr`, `moog`, etc. work without adding `samples('...')` in your code.

### Chord voicings vs sounds

**`dict('ireal')`** is the chord **voicing** dictionary (from @strudel/tonal): it only defines *which notes* to play for chord symbols like Bbm9, Fm9. The actual **sounds** (what you hear) come from the sample map: `.s("gm_epiano1")` and `.s("triangle")` are sample/synth names loaded via `samples(...)` or built-in synths. So voicings come from dict('ireal'); sounds come from samples/synths.

### GM sounds (gm_epiano1, gm_acoustic_bass, etc.)

General MIDI sounds (`gm_epiano1`, `gm_acoustic_bass`, etc.) come from **VCSL** on the [Strudel REPL](https://strudel.cc/); that pack is not available via a public `strudel.json`, so we cannot load it by default here. If you use `gm_*` without loading a pack that provides them, you’ll see “sound … not found”. **Options:** use built-in synths **triangle**, **sawtooth**, **sine**, **square** (e.g. `.s("triangle")`, `.s("sawtooth")`), or add `samples('github:...')` at the top of your file if you have a pack that provides GM names.

The build emits **AudioWorklet** bundles (`dist/superdough-worklets.js`, `dist/supradough-worklet.js`) and injects file URLs so `addModule()` loads them from disk. Electron does not reliably support data URLs for AudioWorklets, so the Strudel build uses an esbuild plugin to replace `?audioworklet` imports with these file paths instead of inlining worklets as data URLs.
