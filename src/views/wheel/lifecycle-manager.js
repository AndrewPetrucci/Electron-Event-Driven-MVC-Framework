const { BrowserWindow, ipcMain } = require('electron');
const SharedQueueManager = require('../shared/lifecycle-manager');
const { twitchEventEmitter } = require('../../twitch');
const { send, on, onNoArgs, invoke } = require('../../preload-helpers');

/**
 * Wheel-specific queue manager
 * Initializes queues based on wheel options from the window configuration
 */
class WheelQueueManager extends SharedQueueManager {
    constructor(windowConfig = {}) {
        super(windowConfig);
        this.windowConfig = windowConfig;
        this.wheelWindow = null; // Will store reference to wheel window
        // Extract wheel options from window config (exclude options with enabled: false)
        const raw = windowConfig.options?.wheel || windowConfig.wheelOptions || [];
        this.wheelOptions = raw.filter(opt => opt.enabled !== false);
        console.log(`[WheelQueueManager] Constructor called with wheelOptions:`, this.wheelOptions.length);
        // Now initialize queues after wheelOptions is set
        this.initializeQueues();
        // Setup IPC listeners for Twitch events
        this.setupIpcListeners();
        // Try to find and store wheel window reference
        this.findWheelWindow();
    }

    /**
     * Initialize queues based on wheel configuration
     * Create a queue for each unique application-controller combination
     */
    initializeQueues() {
        console.log(`[WheelQueueManager] initializeQueues called, wheelOptions:`, this.wheelOptions);
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
     * Find and store reference to the wheel window
     */
    findWheelWindow() {
        const allWindows = BrowserWindow.getAllWindows();
        for (const win of allWindows) {
            if (win && !win.isDestroyed()) {
                const url = win.webContents.getURL();
                if (url && (url.includes('wheel') || url.includes('wheel/index.html'))) {
                    this.wheelWindow = win;
                    console.log(`[WheelQueueManager] Found and stored wheel window reference`);
                    // Re-find window if it closes
                    win.on('closed', () => {
                        this.wheelWindow = null;
                        console.log(`[WheelQueueManager] Wheel window closed, clearing reference`);
                    });
                    break;
                }
            }
        }
    }

    /**
     * Get the wheel window, finding it if not already stored
     */
    getWheelWindow() {
        // If we have a stored reference and it's still valid, use it
        if (this.wheelWindow && !this.wheelWindow.isDestroyed()) {
            return this.wheelWindow;
        }
        
        // Otherwise, try to find it
        this.findWheelWindow();
        return this.wheelWindow;
    }

    /**
     * Setup IPC listeners for Twitch events
     */
    setupIpcListeners() {
        // Listen for Twitch spin trigger events from twitch.js EventEmitter
        twitchEventEmitter.on('twitch-spin-triggered', (data) => {
            console.log(`[WheelQueueManager] Received twitch-spin-triggered event from EventEmitter:`, data);
            
            const wheelWindow = this.getWheelWindow();
            
            if (wheelWindow && !wheelWindow.isDestroyed()) {
                console.log(`[WheelQueueManager] Sending twitch-spin-triggered to wheel window`);
                wheelWindow.webContents.send('twitch-spin-triggered', data);
            } else {
                console.warn(`[WheelQueueManager] Wheel window not found, cannot send twitch-spin-triggered event`);
            }
        });

        // Also listen for IPC messages (if sent via ipcRenderer.send from renderer)
        ipcMain.on('twitch-spin-triggered-ipc', (event, data) => {
            console.log(`[WheelQueueManager] Received twitch-spin-triggered-ipc via IPC:`, data);
            
            const wheelWindow = this.getWheelWindow();
            
            if (wheelWindow && !wheelWindow.isDestroyed()) {
                wheelWindow.webContents.send('twitch-spin-triggered', data);
            }
        });

        console.log('[WheelQueueManager] IPC listeners setup complete');
    }

    /**
     * Return preload API definitions for wheel
     */
    getPreloadAPI() {
        return {
            spinWheel: send('spin-wheel', 'result', true), // Send result directly, don't wrap
            onSpinResult: on('spin-result'),
            onLoadWheelOptions: on('load-wheel-options'),
            onSpinHotkey: onNoArgs('spin-wheel-hotkey')
        };
    }
}

module.exports = WheelQueueManager;
