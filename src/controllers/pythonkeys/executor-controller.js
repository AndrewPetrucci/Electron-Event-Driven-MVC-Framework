const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute a pythonkeys script with the given wheel result and application config
 * @param {object} wheelResult - The wheel result object with config
 * @param {object} applicationConfigs - Map of all application configurations
 * @returns {Promise<void>}
 */
function executeController(wheelResult, applicationConfigs) {
    return new Promise((resolve, reject) => {
        try {
            const pyScript = path.join(__dirname, 'send_keys.py');
            const configJson = JSON.stringify(wheelResult.config);

            // Get the application's PythonKeys configuration (use lowercase for lookup)
            const application = wheelResult.application || 'Notepad';
            const appConfig = applicationConfigs[application.toLowerCase()] || {};
            const pythonKeysConfig = appConfig.controllers?.PythonKeys || {};
            const pythonKeysJson = JSON.stringify(pythonKeysConfig);

            // Extract keys and target window from config
            const keys = wheelResult.config?.value || '';
            const action = wheelResult.config?.action || '';
            // Use application name as window title
            const targetApp = pythonKeysConfig.windowTitle || application;

            console.log(`[PythonKeys] Executing: ${pyScript} with keys: ${keys}, target: ${targetApp}`);
            console.log(`[PythonKeys] With config: ${pythonKeysJson}`);

            // Spawn Python process
            const pyProcess = spawn('python', [pyScript, '--keys', keys, '--target', targetApp], {
                detached: false,
                stdio: 'ignore'
            });

            pyProcess.on('close', (code) => {
                console.log(`[PythonKeys] Process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Python script exited with code ${code}`));
                }
            });

            pyProcess.on('error', (err) => {
                console.error(`[PythonKeys] Error spawning process: ${err.message}`);
                reject(err);
            });

            pyProcess.unref();
        } catch (error) {
            console.error(`[PythonKeys] Error: ${error.message}`);
            reject(error);
        }
    });
}

/**
 * Initialize the PythonKeys controller (empty placeholder)
 */
function initializeController() {
    // TODO: Add initialization logic if needed
}

module.exports = {
    executeController,
    initializeController
}
