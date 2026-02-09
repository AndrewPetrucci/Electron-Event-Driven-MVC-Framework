const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute a pythonkeys script with the given wheel result and application config
 * @param {object} wheelResult - The wheel result object with config
 * @param {object} applicationConfigs - Map of all application configurations
 * @returns {Promise<void>}
 */
function getUnpackedPath(p) {
    if (p.includes('app.asar.unpacked')) return p;
    return p.includes('app.asar') ? p.replace('app.asar', 'app.asar.unpacked') : p;
}

function executeController(wheelResult, applicationConfigs) {
    console.log('[PythonKeys] executeController called', { wheelResult, applicationConfigs });
    return new Promise((resolve, reject) => {
        try {
            const fs = require('fs');
            let pyScript = path.join(__dirname, 'send_keys.py');
            // Always resolve to unpacked if running from asar
            if (pyScript.includes('app.asar')) {
                pyScript = getUnpackedPath(pyScript);
            }
            // Extra: check if script exists, else try resourcesPath
            if (!fs.existsSync(pyScript) && typeof process.resourcesPath === 'string') {
                const altPath = path.join(process.resourcesPath, 'src', 'controllers', 'pythonkeys', 'send_keys.py');
                if (fs.existsSync(altPath)) pyScript = altPath;
            }
            // Final check
            if (!fs.existsSync(pyScript)) {
                console.error(`[PythonKeys] FATAL: Python script not found at: ${pyScript}`);
                return reject(new Error(`Python script not found at: ${pyScript}`));
            }

            // Get the application's PythonKeys configuration (use lowercase for lookup)
            const application = wheelResult.application || 'Notepad';
            const appConfig = applicationConfigs[application.toLowerCase()] || {};
            const pythonKeysConfig = appConfig.controllers?.PythonKeys || {};

            // Extract keys and target window from config
            const keys = wheelResult.config?.value || '';
            const targetApp = pythonKeysConfig.windowTitle || application;

            // Find Python executable
            let pythonExe = 'python';
            let triedPythonPaths = [pythonExe];
            let bundledPython = null;
            // Try to find a bundled python in .venv/Scripts/python.exe (Windows)
            const pathParts = __dirname.split(path.sep);
            const winUnpackedIdx = pathParts.lastIndexOf('win-unpacked');
            if (winUnpackedIdx !== -1) {
                const baseDir2 = pathParts.slice(0, winUnpackedIdx + 1).join(path.sep);
                const candidate = path.join(baseDir2, '.venv', 'Scripts', 'python.exe');
                triedPythonPaths.push(candidate);
                if (fs.existsSync(candidate)) {
                    bundledPython = candidate;
                }
            }
            if (bundledPython) {
                pythonExe = bundledPython;
                console.log(`[PythonKeys] Using bundled Python: ${pythonExe}`);
            } else {
                console.log(`[PythonKeys] Using system Python: ${pythonExe}`);
            }
            if (!fs.existsSync(pyScript)) {
                console.error(`[PythonKeys] ERROR: Python script not found at: ${pyScript}`);
            }
            console.log(`[PythonKeys] Attempted python executables: ${triedPythonPaths.join(' | ')}`);
            console.log(`[PythonKeys] Using pythonExe: ${pythonExe}`);
            console.log(`[PythonKeys] Using pyScript: ${pyScript}`);
            console.log(`[PythonKeys] Full spawn command: ${pythonExe} ${pyScript} --keys "${keys}" --target "${targetApp}"`);

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
