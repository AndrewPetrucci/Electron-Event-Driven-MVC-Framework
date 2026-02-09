/**
 * Path resolver for overlay views, controllers, and applications.
 * Resolves paths from overlay.config.json and discovers overlay packages in node_modules.
 */

const fs = require('fs');
const path = require('path');

/** Package.json overlay field: { type: 'view'|'controller'|'application', id: string, viewEntry?: string } */
const OVERLAY_TYPES = ['view', 'controller', 'application'];

const DEFAULT_PATHS = {
    views: ['src/views'],
    controllers: ['src/controllers'],
    applications: ['src/applications']
};

/**
 * Load overlay path config from a base directory (or use provided config).
 * @param {string} baseDir - Absolute path to app root
 * @param {object} [overlayConfig] - Pre-loaded config (e.g. from loadFromExeDir). If provided, paths from this are used.
 * @returns {{ views: string[], controllers: string[], applications: string[] }}
 */
function loadPathConfig(baseDir, overlayConfig) {
    if (overlayConfig && overlayConfig.paths) {
        return {
            views: Array.isArray(overlayConfig.paths.views) ? overlayConfig.paths.views : DEFAULT_PATHS.views,
            controllers: Array.isArray(overlayConfig.paths.controllers) ? overlayConfig.paths.controllers : DEFAULT_PATHS.controllers,
            applications: Array.isArray(overlayConfig.paths.applications) ? overlayConfig.paths.applications : DEFAULT_PATHS.applications
        };
    }
    const configPath = path.join(baseDir, 'overlay.config.json');
    if (fs.existsSync(configPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (data.paths) {
                return {
                    views: Array.isArray(data.paths.views) ? data.paths.views : DEFAULT_PATHS.views,
                    controllers: Array.isArray(data.paths.controllers) ? data.paths.controllers : DEFAULT_PATHS.controllers,
                    applications: Array.isArray(data.paths.applications) ? data.paths.applications : DEFAULT_PATHS.applications
                };
            }
        } catch (err) {
            console.warn('[PathResolver] Failed to parse overlay.config.json:', err.message);
        }
    }
    return { ...DEFAULT_PATHS };
}

/**
 * Scan node_modules for packages that declare overlay plugin (package.json "overlay" field).
 * @param {string} baseDir - Absolute path to app root (where node_modules lives)
 * @returns {{ views: Map<string,{root:string,viewEntry?:string}>, controllers: Map<string,{root:string}>, applications: Map<string,{root:string}> }}
 */
function discoverOverlayPackages(baseDir) {
    const base = path.resolve(baseDir);
    const nodeModules = path.join(base, 'node_modules');
    const result = {
        views: new Map(),
        controllers: new Map(),
        applications: new Map()
    };
    if (!fs.existsSync(nodeModules) || !fs.statSync(nodeModules).isDirectory()) {
        return result;
    }
    const entries = fs.readdirSync(nodeModules);
    for (const name of entries) {
        if (name.startsWith('.')) continue;
        const pkgDir = path.join(nodeModules, name);
        if (!fs.statSync(pkgDir).isDirectory()) continue;
        const pkgPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgPath)) continue;
        let pkg;
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch {
            continue;
        }
        const overlay = pkg.overlay;
        if (!overlay || typeof overlay !== 'object' || !OVERLAY_TYPES.includes(overlay.type) || !overlay.id) {
            continue;
        }
        const id = String(overlay.id).toLowerCase();
        const root = pkgDir;
        if (overlay.type === 'view') {
            const viewEntry = overlay.viewEntry != null ? String(overlay.viewEntry) : '.';
            const viewDir = path.join(root, viewEntry);
            const indexHtml = path.join(viewDir, 'index.html');
            const lifecyclePath = path.join(viewDir, 'lifecycle-manager.js');
            if (fs.existsSync(indexHtml) && fs.existsSync(lifecyclePath)) {
                result.views.set(id, { root, viewEntry });
            }
        } else if (overlay.type === 'controller') {
            const entryDir = overlay.controllerEntry != null ? path.join(root, overlay.controllerEntry) : root;
            const executorPath = path.join(entryDir, 'executor-controller.js');
            if (fs.existsSync(executorPath)) {
                result.controllers.set(id, { root: entryDir });
            }
        } else if (overlay.type === 'application') {
            const entryDir = overlay.applicationEntry != null ? path.join(root, overlay.applicationEntry) : root;
            const configDir = path.join(entryDir, 'config');
            if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
                result.applications.set(id, { root: entryDir });
            }
        }
    }
    return result;
}

/**
 * Create a path resolver bound to an app root and optional pre-loaded overlay config.
 * @param {string} baseDir - Absolute path to app root (e.g. __dirname of main.js)
 * @param {object} [overlayConfig] - Optional config from loadFromExeDir('overlay.config.json')
 * @returns {object} Resolver with resolveViewPath, resolveViewHtml, resolveLifecycleManagerPath, resolveControllerPath, resolveApplicationPath, listApplicationNames
 */
function getPathResolver(baseDir, overlayConfig) {
    const pathConfig = loadPathConfig(baseDir, overlayConfig);
    const base = path.resolve(baseDir);
    let scanNodeModules = true;
    if (overlayConfig && typeof overlayConfig.scanNodeModules === 'boolean') {
        scanNodeModules = overlayConfig.scanNodeModules;
    } else {
        const configPath = path.join(base, 'overlay.config.json');
        if (fs.existsSync(configPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (typeof data.scanNodeModules === 'boolean') scanNodeModules = data.scanNodeModules;
            } catch (_) {}
        }
    }
    const overlayPackages = scanNodeModules ? discoverOverlayPackages(base) : { views: new Map(), controllers: new Map(), applications: new Map() };

    function resolveViewPath(windowType) {
        const id = (windowType || '').toLowerCase();
        if (!id) return null;
        for (const basePath of pathConfig.views) {
            const viewDir = path.join(base, basePath, id);
            const indexHtml = path.join(viewDir, 'index.html');
            if (fs.existsSync(indexHtml)) {
                return viewDir;
            }
        }
        const pkg = overlayPackages.views.get(id);
        if (pkg) {
            const viewDir = path.join(pkg.root, pkg.viewEntry || '.');
            return viewDir;
        }
        return null;
    }

    function resolveViewHtml(windowType) {
        const viewDir = resolveViewPath(windowType);
        if (!viewDir) return null;
        const indexHtml = path.join(viewDir, 'index.html');
        return fs.existsSync(indexHtml) ? indexHtml : null;
    }

    function resolveLifecycleManagerPath(windowType) {
        const viewDir = resolveViewPath(windowType);
        if (!viewDir) return null;
        const lmPath = path.join(viewDir, 'lifecycle-manager.js');
        return fs.existsSync(lmPath) ? lmPath : null;
    }

    function resolveControllerPath(controller) {
        const name = (controller || '').toLowerCase();
        if (!name) return null;
        for (const basePath of pathConfig.controllers) {
            const controllerDir = path.join(base, basePath, name);
            const executorPath = path.join(controllerDir, 'executor-controller.js');
            if (fs.existsSync(executorPath)) {
                return controllerDir;
            }
        }
        const pkg = overlayPackages.controllers.get(name);
        if (pkg) return pkg.root;
        return null;
    }

    function resolveApplicationPath(applicationName) {
        const name = applicationName || '';
        if (!name) return null;
        for (const basePath of pathConfig.applications) {
            const appDir = path.join(base, basePath, name);
            const configDir = path.join(appDir, 'config');
            if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
                return appDir;
            }
        }
        const pkg = overlayPackages.applications.get(name.toLowerCase());
        if (pkg) return pkg.root;
        return null;
    }

    function listApplicationNames() {
        const names = new Set();
        for (const basePath of pathConfig.applications) {
            const appsDir = path.join(base, basePath);
            if (!fs.existsSync(appsDir) || !fs.statSync(appsDir).isDirectory()) continue;
            const entries = fs.readdirSync(appsDir);
            for (const entry of entries) {
                const fullPath = path.join(appsDir, entry);
                if (fs.statSync(fullPath).isDirectory() && entry !== 'README.md') {
                    const configDir = path.join(fullPath, 'config');
                    if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
                        names.add(entry);
                    }
                }
            }
        }
        overlayPackages.applications.forEach((_, id) => names.add(id));
        return Array.from(names);
    }

    return {
        resolveViewPath,
        resolveViewHtml,
        resolveLifecycleManagerPath,
        resolveControllerPath,
        resolveApplicationPath,
        listApplicationNames
    };
}

module.exports = {
    getPathResolver,
    loadPathConfig,
    discoverOverlayPackages,
    DEFAULT_PATHS
};
