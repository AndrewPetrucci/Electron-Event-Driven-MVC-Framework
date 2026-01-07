/**
 * Game Configuration Loader
 * Dynamically loads game-specific settings and executors
 */

const fs = require('fs');
const path = require('path');

class GameConfigLoader {
    constructor(gameName = 'skyrim') {
        this.gameName = gameName;
        this.gameDir = path.join(__dirname, '..', 'applications', gameName);
        this.configDir = path.join(this.gameDir, 'config');
        this.executorDir = path.join(this.gameDir, 'executors');

        this.wheelOptions = [];
        this.modConfig = {};
    }

    loadWheelOptions() {
        try {
            const optionsFile = path.join(this.configDir, 'wheel-options.json');
            if (fs.existsSync(optionsFile)) {
                const content = fs.readFileSync(optionsFile, 'utf-8');
                const data = JSON.parse(content);
                // Handle both flat array and {options: []} format
                this.wheelOptions = Array.isArray(data) ? data : (data.options || []);
                console.log(`[Config] Loaded ${this.wheelOptions.length} wheel options for ${this.gameName}`);
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
            console.log(`[Config] Found ${scriptName} for ${this.gameName}`);
            return scriptPath;
        } else {
            console.warn(`[Config] ${scriptName} not found at ${scriptPath}`);
            return null;
        }
    }

    listAvailableGames() {
        try {
            const applicationsDir = path.join(__dirname, '..', 'applications');
            if (!fs.existsSync(applicationsDir)) {
                return [];
            }

            const games = fs.readdirSync(applicationsDir).filter(file => {
                const fullPath = path.join(applicationsDir, file);
                return fs.statSync(fullPath).isDirectory() && file !== 'README.md';
            });

            return games;
        } catch (error) {
            console.error('[Config] Error listing games:', error.message);
            return [];
        }
    }

    loadAll() {
        console.log(`[Config] Loading configuration for game: ${this.gameName}`);
        console.log(`[Config] Game directory: ${this.gameDir}`);

        this.loadWheelOptions();

        return {
            game: this.gameName,
            wheelOptions: this.wheelOptions,
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

module.exports = GameConfigLoader;
