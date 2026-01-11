const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const TwitchClient = require('./src/twitch');
const ApplicationConfigLoader = require('./src/application-config-loader');

const windows = {}; // Map to store windows by ID
let twitchClient;
let applicationConfigs = {};
let uniqueApplications = new Set(); // Move to global scope

// Queue managers for different window types
const queueManagers = new Map(); // Map of windowType -> manager instance
const windowConfigs = new Map(); // Map of windowType -> {windowId, config}

// Get auto-spin setting from environment (default: false)
// Set AUTO_SPIN=true to enable
const AUTO_SPIN = process.env.AUTO_SPIN === 'true' || process.argv.includes('--enable-auto-spin');

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 600;

function createWindow(windowConfig = { html: 'src/windows/boilderplate/index.html' }) {
    const htmlFile = windowConfig.html || 'src/windows/boilderplate/index.html';
    const window = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        minWidth: WINDOW_WIDTH,
        minHeight: WINDOW_HEIGHT,
        maxWidth: WINDOW_WIDTH,
        maxHeight: WINDOW_HEIGHT,
        x: require('electron').screen.getPrimaryDisplay().workAreaSize.width - WINDOW_WIDTH,
        y: require('electron').screen.getPrimaryDisplay().workAreaSize.height - WINDOW_HEIGHT,
        alwaysOnTop: true,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: false,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    const windowId = window.id;
    windows[windowId] = window;
    console.log(`Created window with ID: ${windowId} - Loading: ${htmlFile}`);

    window.loadFile(htmlFile);

    // Start with mouse events ignored so clicks pass through
    // todo: this needs to be handled at the view level.
    window.setIgnoreMouseEvents(true, { forward: true });

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        window.webContents.openDevTools({ mode: 'detach' });
    }

    window.on('closed', () => {
        delete windows[windowId];
        console.log(`Window ${windowId} closed`);
    });

    return windowId;
}

/**
 * Dynamically load and initialize queue managers based on window configuration
 * @param {object} windowsConfig - Windows configuration object
 * @param {object} appConfigs - Application configurations
 */
function initializeQueueManagers(windowsConfig, appConfigs) {
    if (!windowsConfig || !windowsConfig.windows) {
        console.log('[QueueManager] No windows configuration found');
        return;
    }

    windowsConfig.windows.forEach((windowConfig) => {
        // Only initialize queue managers for enabled windows
        if (!windowConfig.enabled) {
            return;
        }

        const windowType = windowConfig.id;

        try {
            // Try to load the queue manager for this window type
            const queueManagerPath = path.join(__dirname, `src/views/${windowType}/queue-manager`);

            // Check if the queue manager file exists
            if (!fs.existsSync(queueManagerPath + '.js')) {
                console.log(`[QueueManager] No queue manager found for window type: "${windowType}"`);
                return;
            }

            // Dynamically require the queue manager
            const QueueManagerClass = require(queueManagerPath);
            console.log(`[QueueManager] Loaded queue manager for window type: "${windowType}"`);

            // Initialize queue manager with window config
            const manager = new QueueManagerClass(windowConfig);
            manager.setApplicationConfigs(appConfigs);
            manager.startQueueWorker();
            queueManagers.set(windowType, manager);
            console.log(`[QueueManager] Initialized queue manager for "${windowType}"`);
        } catch (error) {
            console.error(`[QueueManager] Failed to initialize queue manager for "${windowType}": ${error.message}`);
            console.error(`[QueueManager] Stack trace:`, error.stack);
        }
    });
}

function registerIpcHandlers() {
    // Helper to get window from IPC event
    const getWindowFromEvent = (event) => {
        return BrowserWindow.fromWebContents(event.sender);
    };

    // Listen for messages from renderer about interactive elements
    ipcMain.on('mouse-over-interactive', (event, isOver) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.setIgnoreMouseEvents(!isOver, { forward: true });
        }
    });

    ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            const bounds = window.getBounds();
            window.setBounds({
                x: bounds.x + deltaX,
                y: bounds.y + deltaY,
                width: WINDOW_WIDTH,
                height: WINDOW_HEIGHT
            });
        }
    });

    ipcMain.on('move-window-to', (event, { x, y }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.setBounds({
                x: x,
                y: y,
                width: WINDOW_WIDTH,
                height: WINDOW_HEIGHT
            });
        }
    });

    ipcMain.on('get-window-position', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            const [x, y] = window.getPosition();
            event.returnValue = { x, y };
        }
    });

    ipcMain.on('resize-window', (event, { width, height }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.setSize(width, height);
        }
    });

    // Mod integration handlers removed
    ipcMain.handle('get-auto-spin-config', () => {
        return AUTO_SPIN;
    });

    ipcMain.on('minimize-window', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.minimize();
        }
    });

    ipcMain.on('close-window', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.close();
        }
    });
}

app.on('ready', () => {
    registerIpcHandlers();

    // Load windows configuration
    const windowsConfigPath = path.join(__dirname, 'windows-config.json');
    let windowsConfig = { windows: [] };

    try {
        const configContent = fs.readFileSync(windowsConfigPath, 'utf-8');
        windowsConfig = JSON.parse(configContent);
        console.log(`[Main] Loaded windows configuration with ${windowsConfig.windows.length} window(s)`);
    } catch (error) {
        console.warn(`[Main] Failed to load windows-config.json: ${error.message}. Using default.`);
    }

    // Create windows from config
    const createdWindows = [];
    windowsConfig.windows.forEach((windowConfig, index) => {
        if (windowConfig.enabled) {
            const windowId = createWindow(windowConfig);
            createdWindows.push({ id: windowId, config: windowConfig });
            windowConfigs.set(windowConfig.id, { windowId: windowId, config: windowConfig });
            console.log(`[Main] Created window "${windowConfig.name}" (ID: ${windowId}) from ${windowConfig.html}`);

            // Apply position offset if configured
            const window = windows[windowId];
            if (window && windowConfig.position && (windowConfig.position.xOffset !== 0 || windowConfig.position.yOffset !== 0)) {
                window.webContents.once('did-finish-load', () => {
                    const bounds = window.getBounds();
                    window.setBounds({
                        x: bounds.x + windowConfig.position.xOffset,
                        y: bounds.y + windowConfig.position.yOffset,
                        width: bounds.width,
                        height: bounds.height
                    });
                    console.log(`[Main] Positioned window "${windowConfig.name}" at offset (${windowConfig.position.xOffset}, ${windowConfig.position.yOffset})`);
                });
            }

            // Pass wheel options to wheel window via IPC
            if (windowConfig.id === 'wheel' && windowConfig.wheelOptions) {
                window.webContents.once('did-finish-load', () => {
                    window.webContents.send('load-wheel-options', windowConfig.wheelOptions);
                    console.log(`[Main] Sent ${windowConfig.wheelOptions.length} wheel options to wheel window`);
                });
            }
        } else {
            console.log(`[Main] Window "${windowConfig.name}" is disabled, skipping creation`);
        }
    });

    // Extract wheel options from config instead of loading from file
    const wheelWindowConfig = windowsConfig.windows.find(w => w.id === 'wheel');
    let allWheelOptions = wheelWindowConfig?.wheelOptions || [];
    uniqueApplications.clear(); // Clear any previous applications

    // Extract unique applications
    allWheelOptions.forEach(option => {
        if (option.application) {
            uniqueApplications.add(option.application.toLowerCase());
        }
    });

    console.log(`[Main] Discovered applications: ${Array.from(uniqueApplications).join(', ')}`);
    console.log(`[Main] Loaded ${allWheelOptions.length} wheel options from windows-config.json`);

    // Load configuration for each discovered application
    uniqueApplications.forEach(appName => {
        try {
            const configLoader = new ApplicationConfigLoader(appName);
            applicationConfigs[appName] = configLoader.loadAll();
            console.log(`[Main] Loaded configuration for application: ${appName}`);
        } catch (error) {
            console.warn(`[Main] Failed to load config for ${appName}: ${error.message}`);
        }
    });

    console.log(`[Main] Loaded configuration for ${uniqueApplications.size} application(s): ${Array.from(uniqueApplications).join(', ')}`);
    console.log(`[Main] Total wheel options: ${allWheelOptions.length}`);
    console.log(`[Main] System is application-agnostic - applications defined by wheel-options.json`);

    // Build application -> controller and controller -> application mappings
    const appToControllers = {};  // app -> Set<controllers>
    const controllerToApps = {}; // controller -> Set<apps>

    allWheelOptions.forEach(option => {
        const app = option.application;
        const controller = option.controller;

        if (app && controller) {
            // Add to appToControllers mapping
            if (!appToControllers[app]) {
                appToControllers[app] = new Set();
            }
            appToControllers[app].add(controller);

            // Add to controllerToApps mapping
            if (!controllerToApps[controller]) {
                controllerToApps[controller] = new Set();
            }
            controllerToApps[controller].add(app);
        }
    });

    // Convert Sets to Arrays for logging and saving
    const appToControllersLog = {};
    const controllerToAppsLog = {};

    Object.keys(appToControllers).forEach(app => {
        appToControllersLog[app] = Array.from(appToControllers[app]);
    });

    Object.keys(controllerToApps).forEach(controller => {
        controllerToAppsLog[controller] = Array.from(controllerToApps[controller]);
    });

    console.log('[Main] Application -> Controller Mappings:', appToControllersLog);
    console.log('[Main] Controller -> Application Mappings:', controllerToAppsLog);

    // Save mapping files to application data directory (not game-specific)
    const appDataDir = path.join(process.env.APPDATA, 'TwitchWheel');
    const appToControllersFile = path.join(appDataDir, 'app-to-controllers.json');
    const controllerToAppsFile = path.join(appDataDir, 'controller-to-apps.json');

    try {
        // Ensure directory exists
        if (!fs.existsSync(appDataDir)) {
            fs.mkdirSync(appDataDir, { recursive: true });
            console.log(`[Main] Created application data directory: ${appDataDir}`);
        }

        // Write app -> controllers mapping
        fs.writeFileSync(appToControllersFile, JSON.stringify(appToControllersLog, null, 2));
        console.log(`[Main] Saved app-to-controllers mapping to ${appToControllersFile}`);

        // Write controller -> apps mapping
        fs.writeFileSync(controllerToAppsFile, JSON.stringify(controllerToAppsLog, null, 2));
        console.log(`[Main] Saved controller-to-apps mapping to ${controllerToAppsFile}`);
    } catch (error) {
        console.warn(`[Main] Failed to save mapping files: ${error.message}`);
    }

    // Initialize queue managers based on window configuration
    initializeQueueManagers(windowsConfig, applicationConfigs);

    // Initialize Twitch Client (optional - skip if credentials missing)
    try {
        if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && process.env.TWITCH_CHANNEL) {
            twitchClient = new TwitchClient();
            twitchClient.connect();
        } else {
            console.log('Twitch credentials not configured - Twitch integration disabled');
            const spinStatus = AUTO_SPIN ? 'Auto-spin enabled' : 'Auto-spin disabled';
            console.log(`[Main] ${spinStatus} (configurable via AUTO_SPIN environment variable)`);
        }
    } catch (error) {
        console.warn('Failed to initialize Twitch client:', error.message);
        console.log('Continuing without Twitch integration...');
    }

    // Clear log files and event queue on startup
    clearStartupQueues();
});

function clearStartupQueues() {
    const logFile = path.join(__dirname, 'command-executor.log');

    // Clear AutoHotkey log
    try {
        if (fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '');
            console.log('Cleared command executor log');
        }
    } catch (error) {
        console.warn('Could not clear log:', error);
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Stop all queue workers before quitting
        queueManagers.forEach((manager, windowType) => {
            if (manager && manager.stopQueueWorkers) {
                console.log(`[Main] Stopping queue workers for "${windowType}"`);
                manager.stopQueueWorkers();
            }
        });
        queueManagers.clear();
        app.quit();
    }
});

app.on('activate', () => {
    
});

// IPC Handlers
ipcMain.on('spin-wheel', (event, wheelResult) => {
    try {
        console.log('Wheel spun! Result:', wheelResult);

        // Create queue name from application and controller
        const application = wheelResult.application || 'Notepad';
        const controller = wheelResult.controller || 'AutoHotkey';
        const queueName = `${application}-${controller}`;

        // Get the wheel queue manager
        const wheelQueueManager = queueManagers.get('wheel');
        if (wheelQueueManager) {
            wheelQueueManager.addToQueue(queueName, wheelResult);
        } else {
            console.error('Wheel queue manager not initialized');
        }

        // Broadcast back to renderer immediately
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && window.webContents) {
            window.webContents.send('spin-result', wheelResult.name || wheelResult);
        }
    } catch (error) {
        console.error('Error handling spin-wheel:', error);
    }
});

ipcMain.on('button-click', (event, clickData) => {
    try {
        console.log('Button clicked! Data:', clickData);

        // Find which window sent this event by matching webContents ID
        const sendingWebContents = event.sender;
        let windowType = null;

        for (const [winType, queueMgr] of queueManagers.entries()) {
            // queueManagers are keyed by windowType, check if any active window matches
            const windowConfig = windowConfigs.get(winType);
            if (windowConfig && windowConfig.windowId) {
                const win = BrowserWindow.fromId(windowConfig.windowId);
                if (win && win.webContents === sendingWebContents) {
                    windowType = winType;
                    break;
                }
            }
        }

        if (windowType) {
            const queueManager = queueManagers.get(windowType);
            if (queueManager) {
                queueManager.handleButtonClick(clickData.buttonId, clickData);

                // Notify fileWatcher window if a sticky button was clicked
                if (windowType === 'sticky') {
                    const fileWatcherConfig = windowConfigs.get('fileWatcher');
                    if (fileWatcherConfig && fileWatcherConfig.windowId) {
                        const fileWatcherWindow = BrowserWindow.fromId(fileWatcherConfig.windowId);
                        if (fileWatcherWindow && !fileWatcherWindow.isDestroyed()) {
                            fileWatcherWindow.webContents.send('file-updated', {
                                trigger: 'sticky-action',
                                buttonId: clickData.buttonId,
                                timestamp: clickData.timestamp
                            });
                            console.log('[Main] Notified fileWatcher of sticky action');
                        }
                    }
                }
            } else {
                console.warn(`Queue manager not initialized for window type: ${windowType}`);
            }
        } else {
            console.warn('Could not determine which window sent the button-click event');
        }
    } catch (error) {
        console.error('Error handling button-click:', error);
    }
});

ipcMain.on('twitch-status-request', (event) => {
    event.sender.send('twitch-status', {
        isConnected: twitchClient && twitchClient.isConnected
    });
});

ipcMain.handle('get-config', async () => {
    // Return available applications and their wheel options
    const wheelOptionsMap = {};
    Object.entries(applicationConfigs).forEach(([appName, config]) => {
        wheelOptionsMap[appName] = config.wheelOptions ? config.wheelOptions.map(opt => opt.name) : [];
    });

    return {
        applications: Array.from(uniqueApplications),
        wheelOptions: wheelOptionsMap,
        channel: process.env.TWITCH_CHANNEL || 'your_channel'
    };
});
