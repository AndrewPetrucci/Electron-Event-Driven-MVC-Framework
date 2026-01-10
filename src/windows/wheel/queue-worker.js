/**
 * Queue Worker Process
 * Each worker process handles a single queue and executes items
 * Spawned by WheelQueueManager as a child process
 */

const path = require('path');

class QueueWorker {
    constructor(queueName) {
        this.queueName = queueName;
        this.queue = [];
        this.applicationConfigs = {};
        this.isProcessing = false;
        this.controllerModuleCache = {}; // Cache loaded controller modules

        console.log(`[QueueWorker:${this.queueName}] Worker process started`);
        this.setupMessageHandlers();
    }

    /**
     * Dynamically load a controller module based on controller type
     * @param {string} controller - Controller name (e.g., 'AutoHotkey')
     * @returns {object} - Controller module with executeController function
     */
    getControllerModule(controller) {
        // Return cached module if already loaded
        if (this.controllerModuleCache[controller]) {
            return this.controllerModuleCache[controller];
        }

        try {
            const controllerPath = path.join(__dirname, `../../../controllers/${controller.toLowerCase()}/executor-controller`);
            const module = require(controllerPath);
            this.controllerModuleCache[controller] = module;
            console.log(`[QueueWorker:${this.queueName}] Loaded controller module: ${controller}`);
            return module;
        } catch (error) {
            console.error(`[QueueWorker:${this.queueName}] Failed to load controller ${controller}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Setup message handlers from parent process
     */
    setupMessageHandlers() {
        process.on('message', (message) => {
            if (message.type === 'add-item') {
                this.addToQueue(message.item);
            } else if (message.type === 'set-config') {
                this.applicationConfigs = message.config;
                console.log(`[QueueWorker:${this.queueName}] Application configs loaded`);
            } else if (message.type === 'shutdown') {
                console.log(`[QueueWorker:${this.queueName}] Shutting down`);
                process.exit(0);
            }
        });

        // Handle parent process disconnect
        process.on('disconnect', () => {
            console.log(`[QueueWorker:${this.queueName}] Parent process disconnected, exiting`);
            process.exit(0);
        });
    }

    /**
     * Add an item to the queue
     * @param {object} item - Item to add to queue
     */
    addToQueue(item) {
        this.queue.push(item);
        console.log(`[QueueWorker:${this.queueName}] Added item to queue. Queue size: ${this.queue.length}`);

        // Start processing if not already
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process queue items
     */
    processQueue() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        const processAsync = async () => {
            while (this.queue.length > 0) {
                const wheelResult = this.queue.shift();
                console.log(`[QueueWorker:${this.queueName}] Processing item (${this.queue.length} remaining)`);

                try {
                    if (wheelResult.config) {
                        const controller = wheelResult.controller || 'AutoHotkey';

                        // Dynamically load and execute the controller
                        const controllerModule = this.getControllerModule(controller);
                        if (controllerModule.executeController) {
                            await controllerModule.executeController(wheelResult, this.applicationConfigs);
                        } else {
                            console.error(`[QueueWorker:${this.queueName}] Controller module does not export executeController`);
                        }
                    }
                } catch (error) {
                    console.error(`[QueueWorker:${this.queueName}] Error processing item: ${error.message}`);
                }
            }

            this.isProcessing = false;

            // Notify parent that queue is empty
            if (process.send) {
                process.send({
                    type: 'queue-empty',
                    queueName: this.queueName
                });
            }
        };

        processAsync();
    }
}

// Start the worker
const queueName = process.argv[2] || 'default';
const worker = new QueueWorker(queueName);

// Signal that worker is ready
if (process.send) {
    process.send({
        type: 'worker-ready',
        queueName: queueName
    });
}
