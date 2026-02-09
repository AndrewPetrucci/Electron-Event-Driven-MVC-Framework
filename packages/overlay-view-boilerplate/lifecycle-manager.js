/**
 * Boilerplate Queue Manager
 * Manages queues for button click events in the boilerplate window
 * Extends SharedQueueManager to handle button-to-controller routing
 */

const path = require('path');
const SharedQueueManager = require('overlay-core/views/shared/lifecycle-manager');

class BoilerplateQueueManager extends SharedQueueManager {
    constructor(windowConfig = {}) {
        super(windowConfig);
        this.buttonOptions = windowConfig.options.buttons || [];
        console.log(`[BoilerplateQueueManager] Constructor called with buttonOptions:`, this.buttonOptions.length);
        // Now initialize queues after buttonOptions is set
        this.initializeQueues();
    }

    /**
     * Initialize queues based on button options
     * Creates one queue per unique button-controller pair
     */
    initializeQueues() {
        console.log(`[BoilerplateQueueManager] Initializing queues from buttonOptions`);

        const queueNames = new Set();

        for (const button of this.buttonOptions) {
            if (!button.controller) {
                console.warn(`[BoilerplateQueueManager] Button missing controller configuration`);
                continue;
            }

            // Create queue name from button ID and controller
            const queueName = `${button.id}-${button.controller}`;
            queueNames.add(queueName);
        }

        // Create queues
        for (const queueName of queueNames) {
            this.createQueue(queueName);
            console.log(`[BoilerplateQueueManager] Created queue: ${queueName}`);
        }

        console.log(`[BoilerplateQueueManager] Queue initialization complete. Total queues: ${queueNames.size}`);
    }

    /**
     * Handle button click event
     * @param {string} buttonId - ID of the clicked button
     * @param {object} buttonResult - Button click data
     */
    handleButtonClick(buttonId, buttonResult = {}) {
        // Find the button configuration
        const button = this.buttonOptions.find(b => b.id === buttonId);
        if (!button) {
            console.error(`[BoilerplateQueueManager] Button not found: ${buttonId}`);
            return;
        }

        const controller = button.controller || 'pythonkeys';
        const queueName = `${buttonId}-${controller}`;

        // Prepare the click result
        const clickResult = {
            buttonId: buttonId,
            controller: controller,
            config: button.config || {},
            timestamp: Date.now()
        };

        console.log(`[BoilerplateQueueManager] Button clicked: ${buttonId}`);
        this.addToQueue(queueName, clickResult);
    }
}

module.exports = BoilerplateQueueManager;
