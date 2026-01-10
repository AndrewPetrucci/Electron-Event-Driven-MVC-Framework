const { spawn } = require('child_process');
const path = require('path');

class WheelQueueManager {
    constructor(wheelOptions = []) {
        this.ipcQueues = new Map();
        this.workers = new Map(); // Map of queueName -> child process
        this.applicationConfigs = {};
        this.wheelOptions = wheelOptions;
        this.initializeQueuesFromWheelConfig();
    }

    /**
     * Initialize queues based on wheel configuration
     * Create a queue for each unique application-controller combination
     */
    initializeQueuesFromWheelConfig() {
        const queueMap = new Set();

        this.wheelOptions.forEach(option => {
            if (option.application && option.controller) {
                const queueName = `${option.application}-${option.controller}`;
                queueMap.add(queueName);
            }
        });

        queueMap.forEach(queueName => {
            this.createQueue(queueName);
        });

        console.log(`[WheelQueueManager] Initialized ${queueMap.size} queue(s) from wheel config`);
    }

    /**
     * Create a new IPC queue with the given name
     * @param {string} queueName - Name of the queue to create
     */
    createQueue(queueName) {
        if (!this.ipcQueues.has(queueName)) {
            this.ipcQueues.set(queueName, []);
            console.log(`[WheelQueueManager] Created queue: "${queueName}"`);
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

        const workerPath = path.join(__dirname, 'queue-worker.js');
        const worker = spawn('node', [workerPath, queueName], {
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });

        worker.on('message', (message) => {
            if (message.type === 'worker-ready') {
                console.log(`[WheelQueueManager] Worker ready for queue: "${queueName}"`);
                // Send application configs to worker
                worker.send({
                    type: 'set-config',
                    config: this.applicationConfigs
                });
            } else if (message.type === 'queue-empty') {
                console.log(`[WheelQueueManager] Queue empty: "${queueName}"`);
            }
        });

        worker.on('error', (error) => {
            console.error(`[WheelQueueManager] Worker error for "${queueName}": ${error.message}`);
        });

        worker.on('exit', (code) => {
            console.log(`[WheelQueueManager] Worker exited for "${queueName}" with code ${code}`);
            this.workers.delete(queueName);
        });

        this.workers.set(queueName, worker);
        console.log(`[WheelQueueManager] Spawned worker for queue: "${queueName}"`);
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
            console.log(`[WheelQueueManager] Sent item to worker for "${queueName}"`);
        } else {
            console.error(`[WheelQueueManager] Worker not available for "${queueName}"`);
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
        console.log('[WheelQueueManager] Queue workers will be spawned on-demand');
    }

    /**
     * Stop all queue workers
     */
    stopQueueWorkers() {
        this.workers.forEach((worker, queueName) => {
            if (worker && worker.connected) {
                console.log(`[WheelQueueManager] Sending shutdown signal to worker: "${queueName}"`);
                worker.send({ type: 'shutdown' });
            }
        });
        this.workers.clear();
        console.log('[WheelQueueManager] All workers stopped');
    }
}

module.exports = WheelQueueManager;
