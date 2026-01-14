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

            // Determine Python executable path
            let pythonExe = 'python';
            // If running from packaged app, use the bundled .venv Python
            // __dirname points to .../dist/win-unpacked/resources/app.asar.unpacked/src/controllers/pythonkeys in production
            // and .../src/controllers/pythonkeys in development
            const pathParts = __dirname.split(path.sep);
            const isPackaged = pathParts.includes('win-unpacked');
            if (isPackaged) {
                // Go up to win-unpacked
                const winUnpackedIdx = pathParts.lastIndexOf('win-unpacked');
                const baseDir = pathParts.slice(0, winUnpackedIdx + 1).join(path.sep);
                pythonExe = path.join(baseDir, '.venv', 'Scripts', 'python.exe');
            }
            // Spawn Python process and capture stdout/stderr
            const pyProcess = spawn(pythonExe, [pyScript, '--keys', keys, '--target', targetApp], {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            pyProcess.stdout.on('data', (data) => {
                const msg = data.toString();
                stdout += msg;
                console.log(`[PythonKeys][stdout] ${msg.trim()}`);
            });

            pyProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                stderr += msg;
                console.error(`[PythonKeys][stderr] ${msg.trim()}`);
            });

            pyProcess.on('close', (code) => {
                console.log(`[PythonKeys] Process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    const errorMsg = `Python script exited with code ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
                    reject(new Error(errorMsg));
                }
            });

            pyProcess.on('error', (err) => {
                console.error(`[PythonKeys] Error spawning process: ${err.message}`);
                reject(err);
            });
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
