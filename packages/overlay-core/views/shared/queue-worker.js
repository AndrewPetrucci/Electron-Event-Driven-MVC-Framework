/**
 * Queue Worker Process
 * Each worker process handles a single queue and executes items
 * Spawned by QueueManager as a child process
 */

console.log('[QueueWorker] queue-worker.js loaded and running');

const path = require('path');
const { getPathResolver } = require('../../path-resolver');

// App root: from env (set by main when spawning) or when in node_modules/overlay-core/views/shared use ../../..
const appRoot = process.env.OVERLAY_APP_ROOT || path.resolve(path.join(__dirname, '..', '..', '..'));
const pathResolver = getPathResolver(appRoot);

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
    * @param {string} controller - Controller name (e.g., 'pythonkeys')
     * @returns {object} - Controller module with executeController function
     */
    getControllerModule(controller) {
        const key = (controller || '').toLowerCase();
        // Return cached module if already loaded
        if (this.controllerModuleCache[key]) {
            return this.controllerModuleCache[key];
        }

        try {
            const controllerDir = pathResolver.resolveControllerPath(key);
            if (!controllerDir) {
                throw new Error(`Controller "${key}" not found in configured paths`);
            }
            const controllerPath = path.join(controllerDir, 'executor-controller');
            console.log(`[QueueWorker:${this.queueName}] Attempting to require controller at: ${controllerPath}`);
            const module = require(controllerPath);
            this.controllerModuleCache[key] = module;
            console.log(`[QueueWorker:${this.queueName}] Loaded controller module: ${key}`);
            return module;
        } catch (error) {
            console.error(`[QueueWorker:${this.queueName}] Failed to load controller ${key}: ${error.message}`);
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
                const eventData = this.queue.shift();
                console.log(`[QueueWorker:${this.queueName}] Processing item (${this.queue.length} remaining)`);
                console.log(`[QueueWorker:${this.queueName}] Event data:`, JSON.stringify(eventData, null, 2));

                try {
                    // Handle wrapped result structure (from wheel) or direct structure (from buttons)
                    let actualData = eventData;
                    if (eventData.result && eventData.result.config) {
                        // Data is wrapped in a 'result' property - unwrap it
                        actualData = eventData.result;
                        // Preserve controller from outer object if present
                        if (eventData.controller && !actualData.controller) {
                            actualData.controller = eventData.controller;
                        }
                        console.log(`[QueueWorker:${this.queueName}] Unwrapped result structure`);
                    }
                    
                    if (actualData.config) {
                        const controller = actualData.controller || 'file-writer';
                        console.log(`[QueueWorker:${this.queueName}] Using controller: ${controller}`);

                        // Dynamically load and execute the controller
                        const controllerModule = this.getControllerModule(controller);
                        if (controllerModule.executeController) {
                            console.log(`[QueueWorker:${this.queueName}] Calling executeController for controller: ${controller}`);
                            await controllerModule.executeController(actualData, this.applicationConfigs);
                        } else {
                            console.error(`[QueueWorker:${this.queueName}] Controller module does not export executeController`);
                        }
                    } else {
                        console.warn(`[QueueWorker:${this.queueName}] Item missing 'config' property, skipping. Event data keys:`, Object.keys(actualData || {}));
                    }
                } catch (error) {
                    console.error(`[QueueWorker:${this.queueName}] Error processing item: ${error.message}`);
                    console.error(`[QueueWorker:${this.queueName}] Error stack:`, error.stack);
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
