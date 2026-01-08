/**
 * Application Configuration Loader
 * Dynamically loads application-specific settings and executors
 */

const fs = require('fs');
const path = require('path');

class ApplicationConfigLoader {
    constructor(applicationName = 'skyrim') {
        this.applicationName = applicationName;
        this.applicationDir = path.join(__dirname, '..', 'applications', applicationName);
        this.configDir = path.join(this.applicationDir, 'config');
        this.executorDir = path.join(this.applicationDir, 'executors');

        this.wheelOptions = [];
        this.controllers = {};
        this.modConfig = {};
    }

    loadWheelOptions() {
        try {
            const optionsFile = path.join(this.configDir, 'wheel-options.json');
            if (fs.existsSync(optionsFile)) {
                const content = fs.readFileSync(optionsFile, 'utf-8');
                const data = JSON.parse(content);
                // Handle both flat array and {options: [], controllers: {}} format
                this.wheelOptions = Array.isArray(data) ? data : (data.options || []);
                this.controllers = Array.isArray(data) ? {} : (data.controllers || {});
                console.log(`[Config] Loaded ${this.wheelOptions.length} wheel options for ${this.applicationName}`);
                return this.wheelOptions;
            } else {
                console.warn(`[Config] wheel-options.json not found at ${optionsFile}`);
                return [];
            }
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

    listAvailableApplications() {
        try {
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
