const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute an AutoHotkey script with the given wheel result and application config
 * @param {object} wheelResult - The wheel result object with config
 * @param {object} applicationConfigs - Map of all application configurations
 * @returns {Promise<void>}
 */
function executeController(wheelResult, applicationConfigs) {
    return new Promise((resolve, reject) => {
        try {
            const ahkScript = path.join(__dirname, 'executor.ahk');
            const configJson = JSON.stringify(wheelResult.config);

            // Get the application's AutoHotkey configuration (use lowercase for lookup)
            const application = wheelResult.application || 'Notepad';
            const appConfig = applicationConfigs[application.toLowerCase()] || {};
            const autohotKeyConfig = appConfig.controllers?.AutoHotkey || {};
            const autohotKeyJson = JSON.stringify(autohotKeyConfig);

            console.log(`[AutoHotkey] Executing: ${ahkScript} with config: ${configJson}`);
            console.log(`[AutoHotkey] With application config: ${autohotKeyJson}`);

            // Use AutoHotkey executable directly
            const ahkExe = 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe';
            const ahkProcess = spawn(ahkExe, [ahkScript, configJson, autohotKeyJson], {
                detached: false,
                stdio: 'ignore'
            });

            ahkProcess.on('close', (code) => {
                console.log(`[AutoHotkey] Process exited with code ${code}`);
                resolve();
            });

            ahkProcess.on('error', (err) => {
                console.error(`[AutoHotkey] Error spawning process: ${err.message}`);
                reject(err);
            });

            ahkProcess.unref();
        } catch (error) {
            console.error(`[AutoHotkey] Error: ${error.message}`);
            reject(error);
        }
    });
}

module.exports = {
    executeController
};
