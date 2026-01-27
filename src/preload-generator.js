const fs = require('fs');
const path = require('path');

/**
 * Generate preload.js from lifecycle manager API definitions
 * Can be called with either:
 * 1. Map of instantiated managers (after initialization)
 * 2. Array of window configs (before initialization, scans for lifecycle managers)
 * 
 * @param {Map|Array} managersOrConfigs - Either Map of managers or array of window configs
 * @param {string} outputPath - Path where preload.js should be written
 */
function generatePreload(managersOrConfigs, outputPath) {
    const apiDefinitions = {};
    
    if (managersOrConfigs instanceof Map) {
        // Use instantiated managers
        collectFromManagers(managersOrConfigs, apiDefinitions);
    } else if (Array.isArray(managersOrConfigs)) {
        // Scan lifecycle manager files before instantiation
        collectFromConfigs(managersOrConfigs, apiDefinitions);
    }

    // Add core APIs that are always needed (from main.js)
    addCoreAPIs(apiDefinitions);

    // Generate the preload.js content
    const preloadContent = generatePreloadContent(apiDefinitions);
    
    // Write to file
    try {
        fs.writeFileSync(outputPath, preloadContent, 'utf8');
        console.log(`[PreloadGenerator] Generated preload.js with ${Object.keys(apiDefinitions).length} API methods`);
    } catch (error) {
        console.error(`[PreloadGenerator] Failed to write preload.js:`, error);
        throw error;
    }
}

/**
 * Collect API definitions from instantiated managers
 */
function collectFromManagers(queueManagers, apiDefinitions) {
    queueManagers.forEach((manager, windowType) => {
        if (manager && typeof manager.getPreloadAPI === 'function') {
            try {
                const api = manager.getPreloadAPI();
                mergeAPIs(api, windowType, apiDefinitions);
            } catch (error) {
                console.error(`[PreloadGenerator] Error getting preload API from ${windowType}:`, error);
            }
        }
    });
}

/**
 * Collect API definitions by scanning lifecycle manager files
 */
function collectFromConfigs(windowConfigs, apiDefinitions) {
    const baseDir = path.join(__dirname, '..');
    
    windowConfigs.forEach(windowConfig => {
        if (!windowConfig.enabled) return;
        
        const windowType = windowConfig.id;
        const lifecycleManagerPath = path.join(baseDir, `src/views/${windowType}/lifecycle-manager.js`);
        
        if (fs.existsSync(lifecycleManagerPath)) {
            try {
                // Temporarily require the lifecycle manager to get its static preload API
                // Clear require cache to avoid issues
                delete require.cache[require.resolve(lifecycleManagerPath)];
                const LifecycleManagerClass = require(lifecycleManagerPath);
                
                // Try to get preload API from class (static method) or create instance
                let api = {};
                if (typeof LifecycleManagerClass.getPreloadAPI === 'function') {
                    // Static method
                    api = LifecycleManagerClass.getPreloadAPI();
                } else {
                    // Try creating a temporary instance
                    try {
                        const tempInstance = new LifecycleManagerClass(windowConfig);
                        if (typeof tempInstance.getPreloadAPI === 'function') {
                            api = tempInstance.getPreloadAPI();
                        }
                    } catch (err) {
                        // Some managers might need full initialization, skip for now
                        console.log(`[PreloadGenerator] Could not instantiate ${windowType} for preload API, will collect after initialization`);
                    }
                }
                
                mergeAPIs(api, windowType, apiDefinitions);
            } catch (error) {
                console.error(`[PreloadGenerator] Error loading lifecycle manager for ${windowType}:`, error);
            }
        }
    });
}

/**
 * Merge API definitions, handling conflicts
 */
function mergeAPIs(api, windowType, apiDefinitions) {
    if (api && typeof api === 'object') {
        Object.keys(api).forEach(key => {
            if (apiDefinitions[key]) {
                // Conflict - prefix with window type
                const prefixedKey = `${windowType}_${key}`;
                console.warn(`[PreloadGenerator] API conflict: "${key}" already exists. Using "${prefixedKey}" for ${windowType}`);
                apiDefinitions[prefixedKey] = api[key];
            } else {
                apiDefinitions[key] = api[key];
            }
        });
    }
}

/**
 * Add core APIs that are always needed (from main.js handlers)
 * These are APIs that are registered in main.js's registerIpcHandlers()
 */
function addCoreAPIs(apiDefinitions) {
    const { send, sendSync, invoke, invokeWithArgs, on } = require('./preload-helpers');
    
    // Core window management APIs (always available from main.js)
    const coreAPIs = {
        mouseOverInteractive: send('mouse-over-interactive', 'isOver'),
        moveWindowBy: send('move-window', 'deltaX, deltaY'),
        moveWindowTo: send('move-window-to', 'x, y, width, height'),
        getWindowPosition: sendSync('get-window-position'),
        resizeWindow: send('resize-window', 'width, height'),
        minimizeWindow: send('minimize-window'),
        closeWindow: send('close-window'),
        getAutoSpinConfig: invoke('get-auto-spin-config'),
        getConfig: invoke('get-config'),
        sendMessage: '(channel, data) => ipcRenderer.send(channel, data)',
        // File dialog APIs
        showSaveDialog: invokeWithArgs('show-save-dialog', 'options'),
        showOpenDialog: invokeWithArgs('show-open-dialog', 'options'),
        writeFile: invokeWithArgs('write-file', 'filePath, content'),
        readFile: invokeWithArgs('read-file', 'filePath'),
        // Wheel APIs (handled in main.js)
        spinWheel: send('spin-wheel', 'result', true), // Send result directly, don't wrap
        onSpinResult: on('spin-result'),
        onLoadWheelOptions: on('load-wheel-options'),
        onSpinHotkey: '(callback) => ipcRenderer.on("spin-wheel-hotkey", () => callback())',
        // Button click API
        buttonClick: send('button-click', 'clickData'),
        // Twitch APIs (if registered in main.js)
        getTwitchCredentials: invoke('get-twitch-credentials'),
        onTwitchOAuthToken: on('twitch-oauth-token'),
        onTwitchSpinTriggered: '(callback) => ipcRenderer.on("twitch-spin-triggered", () => callback())',
        onTwitchStatusChanged: on('twitch-status-changed')
    };
    
    // Only add if not already defined by lifecycle managers
    Object.keys(coreAPIs).forEach(key => {
        if (!apiDefinitions[key]) {
            apiDefinitions[key] = coreAPIs[key];
        }
    });
}

/**
 * Generate preload.js content from API definitions
 * @param {Object} apiDefinitions - Object mapping method names to their code strings or functions
 */
function generatePreloadContent(apiDefinitions) {
    const methods = [];
    
    // Sort keys for consistent output
    const sortedKeys = Object.keys(apiDefinitions).sort();
    
    sortedKeys.forEach(methodName => {
        let methodCode = apiDefinitions[methodName];
        
        // If it's a function, convert to string
        if (typeof methodCode === 'function') {
            methodCode = methodCode.toString();
        }
        
        // Ensure it's a string at this point
        if (typeof methodCode === 'string') {
            methods.push(`    ${methodName}: ${methodCode}`);
        } else {
            console.warn(`[PreloadGenerator] Skipping ${methodName} - invalid type: ${typeof methodCode}`);
        }
    });

    return `const { contextBridge, ipcRenderer } = require('electron');

// Auto-generated preload.js from lifecycle manager APIs
// This file is generated automatically - do not edit manually
contextBridge.exposeInMainWorld('electron', {
${methods.join(',\n')}
});
`;
}

module.exports = { generatePreload };
