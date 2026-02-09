# Overlay packages (Phase 3)

This directory contains **overlay plugin packages** that are discovered by the main app from `node_modules` (via `overlay.config.json` and path resolver).

## Current packages

| Package | Type | Id | Description |
|--------|------|-----|-------------|
| **overlay-controller-pythonkeys** | controller | pythonkeys | Send keys / insert text via Python (pywinauto). |
| **overlay-controller-file-writer** | controller | file-writer | Writes wheel/button results to JSON files (e.g. tmp). |
| **overlay-controller-mod-file-writer** | controller | mod-file-writer | Writes Skyrim ConsoleCommands.json-style payloads. |
| **overlay-application-skyrim** | application | skyrim | Skyrim wheel options and controller config. |
| **overlay-core** | (shared runtime) | - | Path resolver, preload-helpers, twitch, shared lifecycle-manager and queue-worker for view packages. |
| **overlay-view-wheel** | view | wheel | Twitch wheel overlay view. |
| **overlay-view-boilerplate** | view | boilerplate | Boilerplate button window. |
| **overlay-view-filewatcher** | view | fileWatcher | File watcher display window. |
| **overlay-view-oauthconnections** | view | oauthConnections | Twitch OAuth connections window. |
| **overlay-view-sticky** | view | sticky | Sticky button window. |
| **overlay-view-strudel** | view | strudel | Strudel code editor window. |

All views and controllers now live in packages; `src/views` and `src/controllers` no longer contain view/controller code (only shared docs or scripts that reference packages).

## Adding a new package

1. Create a folder under `packages/`, e.g. `packages/overlay-controller-mycontroller/` or `packages/overlay-view-myview/`.
2. Add `package.json` with:
   - `"overlay": { "type": "view"|"controller"|"application", "id": "myid" }`
   - Optional: `overlay.viewEntry` / `controllerEntry` / `applicationEntry` (path relative to package root).
   - For **view** packages: add `"overlay-core": "file:../overlay-core"` (or published version) to `dependencies`.
3. Implement the [contract](../docs/MIGRATION-MONOREPO-TO-MULTIREPO.md) (e.g. `executor-controller.js` for controllers, `config/` for applications; for views: `lifecycle-manager.js` extending overlay-core's shared base, `index.html`, and assets—include any shared UI like window-bar inside the package).
4. In the repo root: add the package to `dependencies` (e.g. `"overlay-view-myview": "file:packages/overlay-view-myview"`) and run `npm install`.
5. Remove the corresponding folder from `src/views/`, `src/controllers/`, or `src/applications/` (or leave both; directory paths are checked first).
6. For views and core: add `node_modules/overlay-view-myview/**` and `node_modules/overlay-core/**` to `asarUnpack` in the build config so the packaged app can load them.

## Running on its own (dev harness)

To develop a single package in isolation:

- From the **integration app** (repo root), run `npm run dev`; only enabled windows and their options are loaded. Point `windows-config.json` at the options that use your package.
- For a **standalone repo** later: clone the package into its own repo, add a `scripts/dev.js` that sets `OVERLAY_APP_ROOT` to a minimal app dir and requires the main app (or overlay-core when extracted), then run Electron with that config.

## Splitting into separate repos

To move a package into its own git repository:

1. **Prepare a standalone copy** (optional): From the monorepo root, run:
   ```bash
   node scripts/prepare-package-for-repo.js <package-name>
   ```
   Example: `node scripts/prepare-package-for-repo.js overlay-view-wheel`
   This copies the package to `../<package-name>/` (sibling of the Overlay repo), inits git, and writes `REPO-README.md` there with next steps.

2. **In the new directory** (`../overlay-view-wheel`):
   - Replace `file:../overlay-core` in `package.json` with a published or git dependency, e.g. `"overlay-core": "^1.0.0"` or `"overlay-core": "git+https://github.com/you/overlay-core.git"`.
   - Add a remote and push:
     ```bash
   git remote add origin https://github.com/you/overlay-view-wheel.git
   git add -A && git commit -m "Initial extract from monorepo"
   git push -u origin main
   ```

3. **In the integration app** (this repo): To use the package from its new repo instead of the workspace:
   - In `package.json`, replace `"overlay-view-wheel": "file:packages/overlay-view-wheel"` with `"overlay-view-wheel": "git+https://github.com/you/overlay-view-wheel.git"` (or an npm scope after publishing).
   - Run `npm install`. Keep `asarUnpack` entries for that package so the built app can load it.

Controllers and applications have no `overlay-core` dependency; views do. When publishing, use semver and pin `overlay-core` to a compatible version.
