# Migrating Overlay from Monorepo to Multi-Repo

This document describes how to convert the Overlay monorepo into a **core framework repo** plus **separate repositories** for views, applications, and controllers—so each sub-repo can be developed and tested on its own while still plugging into the core.

---

## 1. Current Structure (What We Have)

### Core (must stay in one place)

| Location | Role |
|----------|------|
| `main.js` | Electron main process, window creation, IPC |
| `preload.js` | Generated; exposes APIs to renderer |
| `preload-generator.js`, `preload-helpers.js` | Preload generation and helpers |
| `src/load-from-exe-dir.js` | Load .env / config from exe directory |
| `src/application-config-loader.js` | Load app configs from `applications/<name>` |
| `src/token-storage.js`, `src/twitch.js` | Twitch OAuth and state |
| `src/views/shared/` | Shared lifecycle manager, queue-worker, settings-panel, window-bar |
| `windows-config.json` | Window definitions and HTML paths |

### Pluggable units (candidates for separate repos)

| Type | Current path | Examples |
|------|--------------|----------|
| **Views** | `src/views/<id>/` | wheel, strudel, fileWatcher, oauthConnections, sticky, boilerplate |
| **Controllers** | `src/controllers/<name>/` | pythonkeys, file-writer, mod-file-writer |
| **Applications** | `src/applications/<name>/` | skyrim, notepad |

### Current coupling (hardcoded paths)

- **main.js**: `path.join(__dirname, 'src/views/${windowType}/lifecycle-manager')`
- **preload-generator.js**: `path.join(baseDir, 'src/views/${windowType}/lifecycle-manager.js')`
- **queue-worker.js**: `path.join(__dirname, '../../controllers/${controller}/executor-controller')`
- **application-config-loader.js**: `path.join(__dirname, '..', 'applications', applicationName)`
- **windows-config.json**: `"html": "src/views/wheel/index.html"` (and similar)

To allow sub-repos, the core must **resolve these paths from configuration** (or from installed packages) instead of fixed `src/` paths.

---

## 2. Target Model: Core + Pluggable Packages

- **overlay-core** (one repo): Electron app shell, shared runtime, config loading, and a **plugin contract**.
- **Sub-repos**: Each view, controller, or application is a separate repo (and optionally an npm package) that:
  - Implements the core’s contract (entry HTML, lifecycle manager, or executor interface).
  - Can be developed in isolation using a small “dev harness” that depends on overlay-core.
  - When used in the full app, is either installed (e.g. `npm install` or linked) or placed in a configured directory.

---

## 3. Define the Contracts

### View contract

- **Entry**: `index.html` (and optional assets).
- **Lifecycle**: A `lifecycle-manager.js` that:
  - Is loadable via `require(path)`.
  - Exposes a class that extends the shared base (e.g. `SharedQueueManager`).
  - Optionally exposes `getPreloadAPI()` (static or instance) for preload generation.
- **Discovery**: Either a path to the view folder, or an npm package with `package.json` field e.g. `"overlay": { "type": "view", "id": "wheel" }` and a `main` or `viewEntry` pointing to the folder.

### Controller contract

- **Entry**: `executor-controller.js` in the controller folder.
- **Interface**: Exports `executeController(eventData, applicationConfigs)` (or equivalent).
- **Discovery**: Path to controller folder or package with `"overlay": { "type": "controller", "id": "pythonkeys" }`.

### Application contract

- **Layout**: Directory with `config/wheel-options.json`, optional `config/controller-options.json`, optional `executors/`.
- **Discovery**: Path to application folder or package with `"overlay": { "type": "application", "id": "skyrim" }`.

These contracts allow the core to treat every view/controller/application the same whether it lives under `src/` or in `node_modules` or a configured plugin dir.

---

## 4. Implementation Strategy

### Phase 1: Configurable base paths (no new repos yet) — **DONE**

1. **Add a small runtime config** (e.g. `overlay.config.json` or a section in `windows-config.json`) that defines base directories:
   ```json
   {
     "paths": {
       "views": ["src/views"],
       "controllers": ["src/controllers"],
       "applications": ["src/applications"]
     }
   }
   ```
   Support **arrays** so you can later add `["src/views", "node_modules"]` or `["plugins/views"]`.

2. **Refactor core to use a path resolver**:
   - **Views**: Resolve `html` and `lifecycle-manager` by:
     - For each base in `paths.views`, check `<base>/<windowType>/index.html` and `<base>/<windowType>/lifecycle-manager.js`.
   - **Controllers**: In `queue-worker.js`, resolve `executor-controller` by iterating `paths.controllers` and checking `<base>/<controller>/executor-controller.js`.
   - **Applications**: In `application-config-loader.js`, resolve application dir by iterating `paths.applications` and checking `<base>/<applicationName>`.

3. **Keep default behavior**: If no config or empty paths, fall back to current `src/views`, `src/controllers`, `src/applications` so existing setup keeps working.

4. **windows-config.json**: Either keep `html` as full path (e.g. `src/views/wheel/index.html`) or move to a symbolic form (e.g. `view:wheel`) and resolve via the view paths. The latter is nicer for multi-repo because config doesn’t depend on repo layout.

After Phase 1, the core no longer hardcodes `src/`; it only uses the configured path lists. You can then add a second path (e.g. `plugins/views`) and put a cloned view repo there to test.

### Phase 2: Package-based discovery (optional but recommended) — **DONE**

1. **Scan `node_modules`** for packages that have `overlay.type` in `package.json` (view | controller | application) and `overlay.id`.
2. **Resolve paths**:
   - View: use `package.main` or a `viewEntry` field to get the folder that contains `index.html` and `lifecycle-manager.js`.
   - Controller: folder that contains `executor-controller.js`.
   - Application: folder that contains `config/wheel-options.json`.
3. **Merge** these with the directory-based paths from Phase 1 so both “folders on disk” and “npm packages” work.

This lets a sub-repo be published (or linked) as e.g. `@your-scope/overlay-view-wheel` and the core will discover it when installed.

**Overlay package contract:** In each plugin package's `package.json`, set `overlay.type` (`"view"` | `"controller"` | `"application"`), `overlay.id` (lowercase id), and optionally `overlay.viewEntry` / `overlay.controllerEntry` / `overlay.applicationEntry` (path relative to package root; default `"."`). Views must expose `index.html` and `lifecycle-manager.js` in that folder; controllers must expose `executor-controller.js`; applications must expose a `config/` directory.

### Phase 3: Split into separate repos — **STARTED**

1. **Create the core repo** (e.g. `overlay-core`):
   - Move only core files (main, preload, shared, config loader, twitch, token-storage, path resolution).
   - Publish or depend on it as `overlay-core` (or keep as a git dependency).

2. **Create one repo per view/controller/application** (or group by domain if you prefer):
   - Each repo contains only that view/controller/application.
   - Add `package.json` with `overlay.type` and `overlay.id` (if using package discovery).
   - Depend on `overlay-core` as a devDependency.

3. **“Functions on its own”** for each sub-repo:
   - **Option A – Dev harness**: In the sub-repo, add a small runner (e.g. `scripts/dev.js` or an Electron entry) that:
     - Requires `overlay-core`.
     - Registers only this view/controller/application (e.g. by setting `paths.views = [path.join(__dirname, 'dist')]` or by passing a minimal windows-config that only references this view).
     - Starts the core so you can develop and test this one piece in isolation.
   - **Option B – Integration app repo**: Keep a separate “full app” repo that depends on `overlay-core` and all overlay packages (e.g. `overlay-view-wheel`, `overlay-controller-pythonkeys`, …). That repo’s `windows-config.json` and path config list the installed packages. Sub-repos don’t need to run the full app; they only need to run their own tests and optionally the small harness from Option A.

4. **Versioning**: Pin overlay-core and packages to compatible versions (e.g. semver; core exports a “plugin API version” if you want to enforce compatibility later).

---

## 5. Where to change the code

| Goal | File(s) to change |
|------|-------------------|
| Configurable view/controller/application paths | New: `src/path-resolver.js` or extend `load-from-exe-dir.js` to load overlay config; then use in main.js, preload-generator.js, queue-worker.js, application-config-loader.js |
| Resolve view HTML and lifecycle path | main.js (createWindow / window loading), preload-generator.js (collectFromConfigs) |
| Resolve controller path | queue-worker.js (getControllerModule) |
| Resolve application dir | application-config-loader.js (constructor, listAvailableApplications) |
| windows-config and “view:id” | main.js (where config is read), path resolver returns full path for `view:wheel` → `.../wheel/index.html` |

---

## 6. Suggested order of work

1. Add `overlay.config.json` (or equivalent) with `paths.views`, `paths.controllers`, `paths.applications` (default: current `src/` dirs).
2. Implement path resolution in one module; use it in application-config-loader, then queue-worker, then main.js and preload-generator.
3. Test with current layout (no new repos) to ensure behavior is unchanged.
4. Add one external view: create a repo with e.g. wheel, add it as a second path or as a package; confirm the core loads it.
5. Repeat for one controller and one application.
6. Add a minimal dev harness so a view-only repo can run with core for local dev.
7. Split remaining views/controllers/applications into repos as needed.

---

## 7. Summary

- **Core stays in one repo**; it gets a **path/plugin layer** so it doesn’t depend on fixed `src/views`, `src/controllers`, `src/applications`.
- **Sub-repos** implement the same **contracts** (view lifecycle, controller executor, application config layout) and are discovered via **configurable directories** and optionally **npm packages**.
- Each sub-repo **can function on its own** by depending on overlay-core and using a **dev harness** (or integration app) that registers only that package, so you get independent development and CI without losing the single-app experience when you combine everything.

**Phase 1 implemented:** `overlay.config.json`, `src/path-resolver.js`, and wiring in main.js, preload-generator.js, queue-worker.js (+ OVERLAY_APP_ROOT in lifecycle-manager spawn), and application-config-loader.js. Optional `view:wheel` HTML syntax is supported in windows-config; legacy paths still work.

**Phase 2 implemented:** `discoverOverlayPackages()` in `src/path-resolver.js` scans `node_modules` for packages with `overlay.type` and `overlay.id`; view/controller/application resolution merges directory-based and package-based results. Optional `scanNodeModules: false` in `overlay.config.json` disables scanning.

**Phase 3 implemented:** All views and controllers live in **packages**. npm **workspaces** (`packages/*`) include: **overlay-core** (shared runtime); view packages **overlay-view-wheel**, **overlay-view-boilerplate**, **overlay-view-filewatcher**, **overlay-view-oauthconnections**, **overlay-view-sticky**, **overlay-view-strudel**; controller packages **overlay-controller-pythonkeys**, **overlay-controller-file-writer**, **overlay-controller-mod-file-writer**; **overlay-application-skyrim**. `src/views` and `src/controllers` no longer contain view/controller code. Root sets `process.env.OVERLAY_APP_ROOT`; build `asarUnpack` includes all overlay packages. **Moving to separate repos:** Run `node scripts/prepare-package-for-repo.js <package-name>` to copy a package to `../<package-name>/` with its own git repo; then follow that folder’s `REPO-README.md` to add remote and push. See `packages/README.md` for the full list and for using packages from git/npm in the integration app.
