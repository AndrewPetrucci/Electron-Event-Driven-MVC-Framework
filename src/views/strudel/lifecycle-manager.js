/**
 * Strudel Lifecycle Manager
 * Manages lifecycle and strudel-specific IPC for the Strudel editor window.
 * Extends SharedQueueManager for consistency; no queues/workers needed.
 */

const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');
const SharedQueueManager = require('../shared/lifecycle-manager');

class StrudelLifecycleManager extends SharedQueueManager {
    constructor(windowConfig = {}) {
        super(windowConfig);
        this.windowConfig = windowConfig;
        this.strudelOpenFilesPath = path.join(app.getPath('userData'), 'strudel-open-files.json');
        console.log('[StrudelLifecycleManager] Constructor called');
        this.setupIpcListeners();
    }

    /**
     * No queues needed for the Strudel editor (no button/worker routing).
     */
    initializeQueues() {
        console.log('[StrudelLifecycleManager] No queues (editor-only view)');
    }

    /**
     * Register strudel-specific IPC handlers.
     */
    setupIpcListeners() {
        // Load sample pack JSON from local sample-packs/ or strudel.json when pack is "strudel"
        ipcMain.handle('read-sample-pack', async (_event, packName) => {
            try {
                const safeName = path.basename(packName).replace(/[^a-zA-Z0-9-_]/g, '');
                if (!safeName) return { success: false, error: 'Invalid pack name' };
                const packPath = safeName === 'strudel'
                    ? path.join(__dirname, 'strudel.json')
                    : path.join(__dirname, 'sample-packs', safeName + '.json');
                const content = fs.readFileSync(packPath, 'utf-8');
                const json = JSON.parse(content);
                return { success: true, json };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('get-strudel-open-files', async () => {
            try {
                if (fs.existsSync(this.strudelOpenFilesPath)) {
                    const data = JSON.parse(fs.readFileSync(this.strudelOpenFilesPath, 'utf-8'));
                    return {
                        openFilePaths: Array.isArray(data.openFilePaths) ? data.openFilePaths : [],
                        activeFilePath: data.activeFilePath ?? null
                    };
                }
            } catch (err) {
                console.warn('[StrudelLifecycleManager] Failed to read persisted open files:', err);
            }
            return { openFilePaths: [], activeFilePath: null };
        });

        ipcMain.handle('set-strudel-open-files', async (_event, state) => {
            try {
                const dir = path.dirname(this.strudelOpenFilesPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(this.strudelOpenFilesPath, JSON.stringify({
                    openFilePaths: state.openFilePaths || [],
                    activeFilePath: state.activeFilePath ?? null
                }), 'utf-8');
                return { success: true };
            } catch (err) {
                console.warn('[StrudelLifecycleManager] Failed to write persisted open files:', err);
                return { success: false };
            }
        });

        console.log('[StrudelLifecycleManager] IPC listeners setup complete');
    }

    /**
     * Preload API for strudel is provided by core (showSaveDialog, readFile, getStrudelOpenFiles, etc.).
     */
    getPreloadAPI() {
        return {};
    }
}

module.exports = StrudelLifecycleManager;
