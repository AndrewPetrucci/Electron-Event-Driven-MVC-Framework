const fs = require('fs');
const path = require('path');

/**
 * Execute a file writer controller that writes wheel results to a file in the temp folder
 * @param {object} eventData - The wheel result object with config
 * @param {object} applicationConfigs - Map of all application configurations
 * @returns {Promise<void>}
 */
function executeController(eventData, applicationConfigs) {
    return new Promise((resolve, reject) => {
        try {
            const tmpDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Overlay', 'tmp');

            // Ensure tmp directory exists
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            // Get filename from config, default to 'controller-output.json'
            const fileWriterPath = eventData.config?.fileWriterPath || 'controller-output.json';
            const filename = path.basename(fileWriterPath);
            const filepath = path.join(tmpDir, filename);

            // Prepare the data to write with timestamp
            const logEntry = {
                timestamp: new Date().toISOString(),
                data: eventData
            };

            // Read existing file or create new array
            let logArray = [];
            if (fs.existsSync(filepath)) {
                try {
                    const existingData = fs.readFileSync(filepath, 'utf-8');
                    logArray = JSON.parse(existingData);
                    if (!Array.isArray(logArray)) {
                        logArray = [];
                    }
                } catch (parseErr) {
                    console.warn(`[FileWriter] Could not parse existing file, starting fresh: ${parseErr.message}`);
                    logArray = [];
                }
            }

            // Append new entry
            logArray.push(logEntry);

            // Write updated array to file
            fs.writeFile(
                filepath,
                JSON.stringify(logArray, null, 2),
                (err) => {
                    if (err) {
                        console.error(`[FileWriter] Error writing to file: ${err.message}`);
                        reject(err);
                    } else {
                        console.log(`[FileWriter] Successfully appended to: ${filepath}`);

                        // Emit event to parent process (queue manager) to notify fileWatcher
                        if (process.send) {
                            try {
                                process.send({
                                    type: 'file-writer-event',
                                    filePath: filepath,
                                    filename: filename,
                                    timestamp: Date.now(),
                                    entry: logEntry
                                });
                                console.log(`[FileWriter] Sent file-writer-event to parent process`);
                            } catch (sendErr) {
                                console.warn(`[FileWriter] Could not send event to parent: ${sendErr.message}`);
                            }
                        }

                        resolve();
                    }
                }
            );
        } catch (error) {
            console.error(`[FileWriter] Error: ${error.message}`);
            reject(error);
        }
    });
}


/**
 * Initialize the File Writer controller (empty placeholder)
 */
function initializeController() {
    // TODO: Add initialization logic if needed
}

module.exports = {
    executeController,
    initializeController
};
