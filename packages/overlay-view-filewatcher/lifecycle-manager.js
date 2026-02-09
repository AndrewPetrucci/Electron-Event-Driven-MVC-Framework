/**
 * File Watcher Queue Manager
 * Manages file reading requests for the file watcher window
 * Extends SharedQueueManager for consistency
 */

const path = require('path');
const fs = require('fs');
const { ipcMain } = require('electron');
const SharedQueueManager = require('overlay-core/views/shared/lifecycle-manager');
const { on } = require('overlay-core/preload-helpers');

class FileWatcherQueueManager extends SharedQueueManager {
    constructor(windowConfig = {}) {
        super(windowConfig);
        this.windowConfig = windowConfig;
        console.log(`[FileWatcherQueueManager] Constructor called`);
        this.setupIpcListeners();
    }

    /**
     * Setup IPC listeners for file operations
     */
    setupIpcListeners() {
        ipcMain.on('read-file', (event) => {
            try {
                const filePath = path.join(process.cwd(), this.windowConfig.dataFile);
                console.log(`[FileWatcherQueueManager] Reading file: ${filePath}`);

                if (!fs.existsSync(filePath)) {
                    console.warn(`[FileWatcherQueueManager] File not found: ${filePath}`);
                    event.sender.send('file-content', {
                        error: 'File not found',
                        filePath: filePath
                    });
                    return;
                }

                const content = fs.readFileSync(filePath, 'utf-8');
                let parsedContent;
                try {
                    // Try to parse as JSON for pretty formatting
                    parsedContent = JSON.stringify(JSON.parse(content), null, 2);
                } catch {
                    // Return as plain text if not valid JSON
                    parsedContent = content;
                }

                event.sender.send('file-content', {
                    content: parsedContent,
                    filePath: filePath,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error(`[FileWatcherQueueManager] Error reading file: ${error.message}`);
                event.sender.send('file-content', {
                    error: error.message
                });
            }
        });

        console.log('[FileWatcherQueueManager] IPC listeners setup complete');
    }

    /**
     * Return preload API definitions for file watcher
     */
    getPreloadAPI() {
        return {
            onFileUpdated: on('file-updated'),
            onFileContent: on('file-content'),
            onFileWriterEvent: on('file-writer-event')
        };
    }

    /**
     * Read and return file content
     * @param {string} filePath - Path to the file to read
     * @returns {string} File content
     */
    readFile(filePath) {
        try {
            const fullPath = path.join(process.cwd(), filePath);
            console.log(`[FileWatcherQueueManager] Reading file: ${fullPath}`);

            if (!fs.existsSync(fullPath)) {
                console.warn(`[FileWatcherQueueManager] File not found: ${fullPath}`);
                return JSON.stringify({ error: 'File not found', filePath });
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            try {
                // Try to parse as JSON for pretty formatting
                return JSON.stringify(JSON.parse(content), null, 2);
            } catch {
                // Return as plain text if not valid JSON
                return content;
            }
        } catch (error) {
            console.error(`[FileWatcherQueueManager] Error reading file: ${error.message}`);
            return JSON.stringify({ error: error.message });
        }
    }
}

module.exports = FileWatcherQueueManager;
