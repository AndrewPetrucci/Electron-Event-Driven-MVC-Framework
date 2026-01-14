const { spawn } = require('child_process');
const path = require('path');
const { BrowserWindow } = require('electron');

/**
 * Base class for all window queue managers
 * Provides common queue management and worker spawning functionality
 */
class SharedQueueManager {
    constructor(windowConfig = {}) {
        this.ipcQueues = new Map();
        this.workers = new Map(); // Map of queueName -> child process
        this.applicationConfigs = {};
        this.windowConfig = windowConfig;
        // Note: initializeQueues() should be called by subclasses after they set up their properties
    }

    /**
     * Initialize queues - to be overridden by subclasses
     * Subclasses should implement this to create queues based on their configuration
     */
    initializeQueues() {
        console.log('[SharedQueueManager] initializeQueues not implemented in base class');
    }

    /**
     * Create a new IPC queue with the given name
     * @param {string} queueName - Name of the queue to create
     */
    createQueue(queueName) {
        if (!this.ipcQueues.has(queueName)) {
            this.ipcQueues.set(queueName, []);
            console.log(`[${this.constructor.name}] Created queue: "${queueName}"`);
        }
    }

    /**
     * Spawn a worker process for a queue
     * @param {string} queueName - Name of the queue
     */
    spawnWorker(queueName) {
        if (this.workers.has(queueName)) {
            return; // Worker already exists
        }

        let workerPath = path.join(__dirname, 'queue-worker.js');
        // Handle asar-unpacked path for packaged Electron apps
        if (workerPath.includes('.asar')) {
            workerPath = workerPath.replace(/app\.asar(\\|\/|$)/, 'app.asar.unpacked$1');
        }
        const worker = spawn('node', [workerPath, queueName], {
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });

        worker.on('message', (message) => {
            if (message.type === 'worker-ready') {
                console.log(`[${this.constructor.name}] Worker ready for queue: "${queueName}"`);
                // Send application configs to worker
                worker.send({
                    type: 'set-config',
                    config: this.applicationConfigs
                });
            } else if (message.type === 'queue-empty') {
                console.log(`[${this.constructor.name}] Queue empty: "${queueName}"`);
            } else if (message.type === 'file-writer-event') {
                // Broadcast file-writer-event to all windows
                console.log(`[${this.constructor.name}] Received file-writer-event from worker, broadcasting to windows`);
                try {
                    const allWindows = BrowserWindow.getAllWindows();
                    allWindows.forEach(win => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('file-writer-event', {
                                type: 'file-written',
                                filePath: message.filePath,
                                filename: message.filename,
                                timestamp: message.timestamp,
                                entry: message.entry
                            });
                        }
                    });
                    console.log(`[${this.constructor.name}] Broadcast file-writer-event to ${allWindows.length} window(s)`);
                } catch (err) {
                    console.error(`[${this.constructor.name}] Error broadcasting file-writer-event: ${err.message}`);
                }
            }
        });

        worker.on('error', (error) => {
            console.error(`[${this.constructor.name}] Worker error for "${queueName}": ${error.message}`);
        });

        worker.on('exit', (code) => {
            console.log(`[${this.constructor.name}] Worker exited for "${queueName}" with code ${code}`);
            this.workers.delete(queueName);
        });

        this.workers.set(queueName, worker);
        console.log(`[${this.constructor.name}] Spawned worker for queue: "${queueName}"`);
    }

    /**
     * Add an item to a specific queue
     * @param {string} queueName - Name of the queue
     * @param {object} item - Item to add
     */
    addToQueue(queueName, item) {
        if (!this.ipcQueues.has(queueName)) {
            this.createQueue(queueName);
            this.spawnWorker(queueName);
        }

        // Ensure worker exists for this queue
        if (!this.workers.has(queueName)) {
            this.spawnWorker(queueName);
        }

        // Send item to worker process
        const worker = this.workers.get(queueName);
        if (worker && worker.connected) {
            worker.send({
                type: 'add-item',
                item: item
            });
            console.log(`[${this.constructor.name}] Sent item to worker for "${queueName}"`);
        } else {
            console.error(`[${this.constructor.name}] Worker not available for "${queueName}"`);
        }
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        const stats = {};
        this.ipcQueues.forEach((items, queueName) => {
            stats[queueName] = items.length;
        });
        return stats;
    }

    /**
     * Set application configurations for workers
     * @param {object} applicationConfigs - Map of application configurations
     */
    setApplicationConfigs(applicationConfigs) {
        this.applicationConfigs = applicationConfigs;

        // Send configs to all running workers
        this.workers.forEach((worker, queueName) => {
            if (worker && worker.connected) {
                worker.send({
                    type: 'set-config',
                    config: applicationConfigs
                });
            }
        });
    }

    /**
     * Start all queue workers
     * Note: Workers are now spawned on-demand when items are added
     */
    startQueueWorker() {
        console.log(`[${this.constructor.name}] Queue workers will be spawned on-demand`);
    }

    /**
     * Stop all queue workers
     */
    stopQueueWorkers() {
        this.workers.forEach((worker, queueName) => {
            if (worker && worker.connected) {
                console.log(`[${this.constructor.name}] Sending shutdown signal to worker: "${queueName}"`);
                worker.send({ type: 'shutdown' });
            }
        });
        this.workers.clear();
        console.log(`[${this.constructor.name}] All workers stopped`);
    }
}

module.exports = SharedQueueManager;
