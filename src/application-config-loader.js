/**
 * Application Configuration Loader
 * Dynamically loads application-specific settings and executors
 */


// Patch: resolve asar to asar.unpacked for runtime file access
function resolveUnpackedPath(filePath) {
    return typeof filePath === 'string' ? filePath.replace('app.asar', 'app.asar.unpacked') : filePath;
}

const fs = require('fs');
const path = require('path');

class ApplicationConfigLoader {
    /**
     * @param {string} [applicationName='skyrim'] - Application name (folder under applications/)
     * @param {object} [pathResolver] - Optional path resolver from getPathResolver(); if provided, uses configured paths
     */
    constructor(applicationName = 'skyrim', pathResolver) {
        this.applicationName = applicationName;
        let applicationDir;
        if (pathResolver && pathResolver.resolveApplicationPath) {
            applicationDir = pathResolver.resolveApplicationPath(applicationName);
        }
        if (!applicationDir) {
            applicationDir = path.join(__dirname, '..', 'applications', applicationName);
        }
        this.applicationDir = resolveUnpackedPath(applicationDir);
        this.configDir = resolveUnpackedPath(path.join(this.applicationDir, 'config'));
        this.executorDir = resolveUnpackedPath(path.join(this.applicationDir, 'executors'));

        this.wheelOptions = [];
        this.controllers = {};
        this.modConfig = {};
    }

    loadWheelOptions() {
        try {
            const optionsFile = path.join(this.configDir, 'wheel-options.json');
            const controllerOptionsFile = path.join(this.configDir, 'controller-options.json');

            if (fs.existsSync(optionsFile)) {
                const content = fs.readFileSync(optionsFile, 'utf-8');
                const data = JSON.parse(content);
                // Handle both flat array and {options: []} format
                this.wheelOptions = Array.isArray(data) ? data : (data.options || []);
                console.log(`[Config] Loaded ${this.wheelOptions.length} wheel options for ${this.applicationName}`);
            } else {
                console.warn(`[Config] wheel-options.json not found at ${optionsFile}`);
            }

            // Load controller-specific options if available
            if (fs.existsSync(controllerOptionsFile)) {
                const content = fs.readFileSync(controllerOptionsFile, 'utf-8');
                const data = JSON.parse(content);
                this.controllers = data.controllers || {};
                console.log(`[Config] Loaded controller options for ${this.applicationName}`);
            } else {
                console.warn(`[Config] controller-options.json not found at ${controllerOptionsFile}`);
            }

            return this.wheelOptions;
        } catch (error) {
            console.error('[Config] Error loading wheel options:', error.message);
            return [];
        }
    }
    getExecutorScript(scriptName = 'console-executor.py') {
        const scriptPath = path.join(this.executorDir, scriptName);
        if (fs.existsSync(scriptPath)) {
            console.log(`[Config] Found ${scriptName} for ${this.applicationName}`);
            return scriptPath;
        } else {
            console.warn(`[Config] ${scriptName} not found at ${scriptPath}`);
            return null;
        }
    }

    /**
     * @param {object} [pathResolver] - Optional path resolver; if provided, uses listApplicationNames()
     */
    listAvailableApplications(pathResolver) {
        try {
            if (pathResolver && typeof pathResolver.listApplicationNames === 'function') {
                return pathResolver.listApplicationNames();
            }
            const applicationsDir = path.join(__dirname, '..', 'applications');
            if (!fs.existsSync(applicationsDir)) {
                return [];
            }
            const applications = fs.readdirSync(applicationsDir).filter(file => {
                const fullPath = path.join(applicationsDir, file);
                return fs.statSync(fullPath).isDirectory() && file !== 'README.md';
            });
            return applications;
        } catch (error) {
            console.error('[Config] Error listing applications:', error.message);
            return [];
        }
    }

    loadAll() {
        console.log(`[Config] Loading configuration for application: ${this.applicationName}`);
        console.log(`[Config] Application directory: ${this.applicationDir}`);

        this.loadWheelOptions();

        return {
            application: this.applicationName,
            wheelOptions: this.wheelOptions,
            controllers: this.controllers,
            executorScript: this.getExecutorScript('console-executor.py')
        };
    }

    getWheelOptionNames() {
        return this.wheelOptions.map(opt => opt.name);
    }

    getModNames() {
        return Object.keys(this.modConfig.mods || {});
    }
}

module.exports = ApplicationConfigLoader;
