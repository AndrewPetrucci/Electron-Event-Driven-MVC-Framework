const fs = require('fs');
const path = require('path');

class ModAction {
    constructor(actionConfig) {
        this.type = actionConfig.type;
        this.config = actionConfig;
    }

    execute(modKey, modConfig) {
        switch (this.type) {
            case 'toggle':
                return this.executeToggle(modKey, modConfig);
            case 'execute':
                return this.executeCommand(modKey, modConfig);
            case 'set':
                return this.executeSet(modKey, modConfig);
            default:
                console.warn(`Unknown action type: ${this.type}`);
                return null;
        }
    }

    executeToggle(modKey, modConfig) {
        return {
            action: 'toggle',
            mod: modKey,
            key: this.config.key,
            timestamp: new Date().toISOString()
        };
    }

    executeCommand(modKey, modConfig) {
        return {
            action: 'execute',
            mod: modKey,
            command: this.config.command,
            timestamp: new Date().toISOString()
        };
    }

    executeSet(modKey, modConfig) {
        return {
            action: 'set',
            mod: modKey,
            key: this.config.key,
            value: this.config.value,
            timestamp: new Date().toISOString()
        };
    }
}

class ModRegistry {
    constructor() {
        this.mods = {};
    }

    register(modKey, modConfig) {
        this.mods[modKey] = {
            config: modConfig,
            actions: this.parseActions(modConfig.actions || {}),
            enabled: modConfig.enabled !== false
        };
    }

    parseActions(actionsConfig) {
        const actions = {};
        for (const [actionKey, actionConfig] of Object.entries(actionsConfig)) {
            actions[actionKey] = new ModAction(actionConfig);
        }
        return actions;
    }

    get(modKey) {
        return this.mods[modKey] || null;
    }

    getAll() {
        return Object.keys(this.mods);
    }

    isEnabled(modKey) {
        const mod = this.get(modKey);
        return mod && mod.enabled;
    }

    executeAction(modKey, actionKey) {
        const mod = this.get(modKey);
        if (!mod) {
            console.warn(`Mod not found: ${modKey}`);
            return null;
        }

        if (!mod.enabled) {
            console.log(`Mod is disabled: ${modKey}`);
            return null;
        }

        const action = mod.actions[actionKey];
        if (!action) {
            // Default to first available action if not specified
            const firstActionKey = Object.keys(mod.actions)[0];
            if (!firstActionKey) {
                console.warn(`No actions available for mod: ${modKey}`);
                return null;
            }
            return action.execute(modKey, mod.config);
        }

        return action.execute(modKey, mod.config);
    }
}

class ModIntegration {
    constructor(configPath = 'mod-config.json', appToControllers = {}, controllerToApps = {}, currentApp = null) {
        this.registry = new ModRegistry();
        this.config = this.loadConfig(configPath);
        this.currentApp = currentApp;
        this.setDataPath();
        this.appToControllers = appToControllers;
        this.controllerToApps = controllerToApps;
        this.ensureDataDirectory();
        this.registerMods();
        this.logMappings();
    }

    setDataPath() {
        // Use application-specific data path if available
        if (this.currentApp && this.config.applicationDataPaths && this.config.applicationDataPaths[this.currentApp]) {
            this.dataPath = this.expandPath(this.config.applicationDataPaths[this.currentApp]);
            console.log(`[ModIntegration] Using application-specific data path for ${this.currentApp}: ${this.dataPath}`);
        } else {
            // Fall back to default data path
            this.dataPath = this.expandPath(this.config.dataPath);
            if (this.currentApp) {
                console.log(`[ModIntegration] No application-specific path for ${this.currentApp}, using default: ${this.dataPath}`);
            }
        }
    }

    setCurrentApplication(appName) {
        this.currentApp = appName;
        this.setDataPath();
    }

    logMappings() {
        console.log('[ModIntegration] Applications to Controllers:');
        for (const app of Object.keys(this.appToControllers)) {
            console.log(`  - ${app}`);
        }

        console.log('[ModIntegration] Controllers to Applications:');
        for (const controller of Object.keys(this.controllerToApps)) {
            console.log(`  - ${controller}`);
        }
    }

    loadConfig(configPath) {
        try {
            const fullPath = path.join(__dirname, '..', configPath);
            const rawConfig = fs.readFileSync(fullPath, 'utf8');
            return JSON.parse(rawConfig);
        } catch (error) {
            console.error('Failed to load mod config:', error);
            return {
                mods: {},
                wheelMappings: {}
            };
        }
    }

    registerMods() {
        for (const [modKey, modConfig] of Object.entries(this.config.mods || {})) {
            this.registry.register(modKey, modConfig);
        }
    }

    expandPath(dataPath) {
        // Handle null/undefined paths
        if (!dataPath) {
            return null;
        }
        // Expand environment variables like %USERPROFILE%
        return dataPath.replace(/%([^%]+)%/g, (match, varName) => {
            return process.env[varName] || match;
        });
    }

    ensureDataDirectory() {
        // Skip if no data path configured
        if (!this.dataPath) {
            return;
        }
        const dir = path.dirname(this.dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    writeData(data) {
        try {
            console.log('Writing data to:', this.dataPath);
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to write data:', error);
            return false;
        }
    }

    writeWheelResult(wheelResult) {
        try {
            const mappedMods = this.config.wheelMappings[wheelResult] || [];
            const data = {
                result: wheelResult,
                timestamp: new Date().toISOString(),
                mods: mappedMods.length > 0 ? mappedMods : [],
                actions: this.executeMappedMods(mappedMods)
            };

            this.writeData(data);
            console.log(`Wheel result written:`, data);
            return data;
        } catch (error) {
            console.error('Failed to write wheel result:', error);
            return null;
        }
    }

    executeMappedMods(mappedMods) {
        const actions = [];
        for (const modKey of mappedMods) {
            if (this.registry.isEnabled(modKey)) {
                const action = this.registry.executeAction(modKey);
                if (action) {
                    actions.push(action);
                }
            }
        }
        return actions;
    }

    triggerModAction(modKey, actionKey = null) {
        try {
            const action = this.registry.executeAction(modKey, actionKey);
            if (!action) {
                return null;
            }

            const data = {
                action: 'mod-triggered',
                mod: modKey,
                details: action,
                timestamp: new Date().toISOString()
            };

            this.writeData(data);
            console.log(`Triggered mod action:`, data);
            return data;
        } catch (error) {
            console.error('Failed to trigger mod action:', error);
            return null;
        }
    }

    getMappedMods(wheelResult) {
        return this.config.wheelMappings[wheelResult] || [];
    }

    getAllMods() {
        return this.registry.getAll();
    }

    getModConfig(modKey) {
        const mod = this.registry.get(modKey);
        return mod ? mod.config : null;
    }

    setModEnabled(modKey, enabled) {
        const mod = this.registry.get(modKey);
        if (mod) {
            mod.enabled = enabled;
            console.log(`Mod ${modKey} is now ${enabled ? 'enabled' : 'disabled'}`);
            return true;
        }
        return false;
    }

    addWheelMapping(wheelResult, modKey) {
        if (!this.config.wheelMappings[wheelResult]) {
            this.config.wheelMappings[wheelResult] = [];
        }
        if (!this.config.wheelMappings[wheelResult].includes(modKey)) {
            this.config.wheelMappings[wheelResult].push(modKey);
            console.log(`Added mapping: ${wheelResult} -> ${modKey}`);
            return true;
        }
        return false;
    }

    removeWheelMapping(wheelResult, modKey) {
        if (this.config.wheelMappings[wheelResult]) {
            const index = this.config.wheelMappings[wheelResult].indexOf(modKey);
            if (index > -1) {
                this.config.wheelMappings[wheelResult].splice(index, 1);
                console.log(`Removed mapping: ${wheelResult} -> ${modKey}`);
                return true;
            }
        }
        return false;
    }
}

module.exports = ModIntegration;
