// --- Simple Express server for OAuth redirect ---
const express = require('express');
const oauthApp = express();
const OAUTH_PORT = 3000;

oauthApp.get('/', (req, res) => {
    // Serve a simple HTML page that extracts the access token from the URL fragment and sends it to Electron
    res.send(`
        <html>
        <body>
            <h2>Twitch OAuth Complete</h2>
            <p>You may now close this window.</p>
            <script>
                // Parse access_token from URL fragment
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const token = params.get('access_token');
                if (token) {
                    // Send token to Electron main process via fetch to /token endpoint
                    fetch('/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint to receive token from browser and send to Electron
let latestOAuthToken = null;
oauthApp.post('/token', express.json(), (req, res) => {
    latestOAuthToken = req.body.token;
    console.log('[OAuth] Received access token:', latestOAuthToken);
    
    // Save token securely for future sessions
    if (tokenStorage.saveToken(latestOAuthToken)) {
        console.log('[OAuth] Token saved securely for future sessions');
    }
    
    // Optionally, send to all renderer windows
    for (const win of Object.values(windows)) {
        if (win && win.webContents) {
            win.webContents.send('twitch-oauth-token', latestOAuthToken);
        }
    }
    // Update process.env and connect to Twitch with new token
    process.env.TWITCH_OAUTH_TOKEN = latestOAuthToken;
    try {
        const { connectTwitch } = require('./src/twitch');
        connectTwitch();
    } catch (err) {
        console.error('[OAuth] Failed to connect Twitch after receiving token:', err);
    }
    res.sendStatus(200);
});

oauthApp.listen(OAUTH_PORT, () => {
    console.log(`[OAuth] Listening for Twitch OAuth redirect on http://localhost:${OAUTH_PORT}/`);
});
// Load .env and windows-config.json from the directory of the running executable (for packaged .exe)
const { loadFromExeDir } = require('./src/load-from-exe-dir');
// Load .env file and set process.env variables
loadFromExeDir('.env');
console.log('[DEBUG] TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID);
console.log('[DEBUG] TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET);
const { app, BrowserWindow, ipcMain, dialog } = require('electron');

const path = require('path');
const fs = require('fs');

const ApplicationConfigLoader = require('./src/application-config-loader');
const TokenStorage = require('./src/token-storage');
const { generatePreload } = require('./src/preload-generator');

const windows = {}; // Map to store windows by ID
let applicationConfigs = {};
let uniqueApplications = new Set(); // Move to global scope

// Initialize token storage
const tokenStorage = new TokenStorage();

// Queue managers for different window types
const queueManagers = new Map(); // Map of windowType -> manager instance
const windowConfigs = new Map(); // Map of windowType -> {windowId, config}

// Get auto-spin setting from environment (default: false)
// Set AUTO_SPIN=true to enable
const AUTO_SPIN = process.env.AUTO_SPIN === 'true' || process.argv.includes('--enable-auto-spin');

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 600;

/**
 * Helper function to set stored width and height on a window object
 * @param {BrowserWindow} window - The BrowserWindow instance
 * @param {number} width - The width to store
 * @param {number} height - The height to store
 */
function setStoredWindowDimensions(window, width, height) {
    if (window && !window.isDestroyed()) {
        window._storedWidth = width;
        window._storedHeight = height;
    }
}

function createWindow(windowConfig = { html: 'src/windows/boilderplate/index.html' }, defaults = {}) {
    const htmlFile = windowConfig.html || 'src/windows/boilderplate/index.html';
    
    // Merge defaults with window-specific windowConfig
    const windowOptions = {
        width: defaults.width ?? WINDOW_WIDTH,
        height: defaults.height ?? WINDOW_HEIGHT,
        alwaysOnTop: defaults.alwaysOnTop ?? false,
        transparent: defaults.transparent ?? false,
        frame: defaults.frame ?? false,
        resizable: defaults.resizable ?? true,
        skipTaskbar: defaults.skipTaskbar ?? false,
        ...(windowConfig.windowConfig || {}) // Override with window-specific config
    };
    
    // Calculate position
    const screen = require('electron').screen.getPrimaryDisplay();
    const x = screen.workAreaSize.width - windowOptions.width;
    const y = screen.workAreaSize.height - windowOptions.height;
    

    const window = new BrowserWindow({
        ...windowOptions,
        x: x,
        y: y,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            backgroundThrottling: false
        }
    });

    const windowId = window.id;
    windows[windowId] = window;
    
    // Set stored dimensions using helper function on initialization
    setStoredWindowDimensions(window, windowOptions.width, windowOptions.height);
    
    console.log(`Created window with ID: ${windowId} - Loading: ${htmlFile}`);

    window.loadFile(htmlFile);

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
function initializeQueueManagers(ecosystemConfig, appConfigs) {
    if (!ecosystemConfig || !ecosystemConfig.windows) {
        console.log('[QueueManager] No windows configuration found');
        return;
    }

    ecosystemConfig.windows.forEach((windowConfig) => {
        // Only initialize queue managers for enabled windows
        if (!windowConfig.enabled) {
            return;
        }

        const windowType = windowConfig.id;

        try {
            // Try to load the queue manager for this window type
            const queueManagerPath = path.join(__dirname, `src/views/${windowType}/lifecycle-manager`);

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
        // const window = getWindowFromEvent(event);
        // if (window) {
        //     window.setIgnoreMouseEvents(!isOver, { forward: true });
        // }
    });

    ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            const bounds = window.getBounds();
            const width = window._storedWidth || bounds.width;
            const height = window._storedHeight || bounds.height;
            window.setBounds({
                x: bounds.x + deltaX,
                y: bounds.y + deltaY,
                width: width,
                height: height
            });
        }
    });

    ipcMain.on('move-window-to', (event, { x, y, width, height }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            // Use provided width/height, or fall back to stored values, or current bounds
            const storedWidth = width !== undefined ? width : (window._storedWidth || window.getBounds().width);
            const storedHeight = height !== undefined ? height : (window._storedHeight || window.getBounds().height);
            window.setBounds({
                x: x,
                y: y,
                width: storedWidth,
                height: storedHeight
            });
        }
    });

    ipcMain.on('get-window-position', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            const bounds = window.getBounds();
            // Use stored dimensions if available, otherwise use current bounds
            const width = window._storedWidth || bounds.width;
            const height = window._storedHeight || bounds.height;
            event.returnValue = { x: bounds.x, y: bounds.y, width: width, height: height };
        }
    });

    ipcMain.on('resize-window', (event, { width, height }) => {
        const window = getWindowFromEvent(event);
        if (window && !window.isDestroyed()) {
            const w = Math.round(Number(width));
            const h = Math.round(Number(height));
            if (w >= 100 && h >= 100) {
                const bounds = window.getBounds();
                window.setBounds({ x: bounds.x, y: bounds.y, width: w, height: h });
                setStoredWindowDimensions(window, w, h);
            }
        }
    });

    // File dialog handlers for strudel save/load
    ipcMain.handle('show-save-dialog', async (event, options) => {
        const window = getWindowFromEvent(event);
        const result = await dialog.showSaveDialog(window || BrowserWindow.getAllWindows()[0], {
            filters: [
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            ...options
        });
        return result;
    });

    ipcMain.handle('show-open-dialog', async (event, options) => {
        const window = getWindowFromEvent(event);
        const result = await dialog.showOpenDialog(window || BrowserWindow.getAllWindows()[0], {
            filters: [
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile'],
            ...options
        });
        return result;
    });

    ipcMain.handle('write-file', async (event, ...args) => {
        // Handle both direct args and object format
        let filePath, content;
        if (args.length === 2) {
            [filePath, content] = args;
        } else if (args.length === 1 && typeof args[0] === 'object') {
            ({ filePath, content } = args[0]);
        } else {
            return { success: false, error: 'Invalid arguments' };
        }
        
        try {
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('read-file', async (event, filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return { success: true, content: content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('rename-file', async (event, filePath, newName) => {
        if (!filePath || !newName || typeof newName !== 'string') {
            return { success: false, error: 'Invalid arguments' };
        }
        try {
            const dir = path.dirname(filePath);
            const ext = path.extname(filePath);
            const name = newName.trim();
            const newPath = path.join(dir, name.includes('.') ? name : name + ext);
            fs.renameSync(filePath, newPath);
            return { success: true, newFilePath: newPath };
        } catch (error) {
            return { success: false, error: error.message };
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

    ipcMain.on('maximize-window', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            if (window.isMaximized()) {
                window.unmaximize();
            } else {
                window.maximize();
            }
            event.sender.send('window-maximized', { maximized: window.isMaximized() });
        }
    });

    ipcMain.on('get-window-maximized', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            event.returnValue = { maximized: window.isMaximized() };
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

    // Load saved OAuth token if available
    const savedToken = tokenStorage.loadToken();
    if (savedToken) {
        console.log('[Main] Loaded saved OAuth token from secure storage');
        process.env.TWITCH_OAUTH_TOKEN = savedToken;
        
        // Try to connect to Twitch with saved token if credentials are available
        if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_CHANNEL) {
            try {
                const { connectTwitch } = require('./src/twitch');
                connectTwitch();
            } catch (err) {
                console.error('[Main] Failed to connect Twitch with saved token:', err);
            }
        }
    }

    // Load ecosystem configuration from exe dir if present, else fall back to __dirname
    let ecosystemConfig = loadFromExeDir('windows-config.json');
    if (!ecosystemConfig) {
        const ecosystemConfigPath = path.join(__dirname, 'windows-config.json');
        try {
            const configContent = fs.readFileSync(ecosystemConfigPath, 'utf-8');
            ecosystemConfig = JSON.parse(configContent);
            console.log(`[Main] Loaded ecosystem configuration from app directory`);
        } catch (error) {
            console.warn(`[Main] Failed to load windows-config.json from app directory: ${error.message}. Using default.`);
            ecosystemConfig = { windows: [] };
        }
    }

    const windowsToCreate = ecosystemConfig.windows.filter(w => w.enabled);

    // Generate preload.js from lifecycle manager APIs before creating windows
    try {
        const preloadPath = path.join(__dirname, 'preload.js');
        generatePreload(windowsToCreate, preloadPath);
    } catch (error) {
        console.error('[Main] Failed to generate preload.js:', error);
        console.warn('[Main] Continuing with existing preload.js');
    }

    // Create windows from config
    const createdWindows = [];
    const defaults = ecosystemConfig.defaults || {};
    windowsToCreate.forEach((windowConfig, index) => {
        const windowId = createWindow(windowConfig, defaults);
        createdWindows.push({ id: windowId, config: windowConfig });
        windowConfigs.set(windowConfig.id, { windowId: windowId, config: windowConfig });
        console.log(`[Main] Created window "${windowConfig.name}" (ID: ${windowId}) from ${windowConfig.html}`);

        // Apply position offset if configured
        const window = windows[windowId];

        // Pass wheel options to wheel window via IPC (exclude options with enabled: false)
        if (windowConfig.id === 'wheel' && windowConfig?.options?.wheel) {
            const enabledWheelOptions = windowConfig.options.wheel.filter(opt => opt.enabled !== false);
            window.webContents.once('did-finish-load', () => {
                window.webContents.send('load-wheel-options', enabledWheelOptions);
                console.log(`[Main] Sent ${enabledWheelOptions.length} wheel options to wheel window (${windowConfig.options.wheel.length} total in config)`);
                
                // Send connection status if token is available
                if (savedToken || process.env.TWITCH_OAUTH_TOKEN) {
                    window.webContents.send('twitch-status-changed', { isConnected: true });
                    console.log(`[Main] Sent connected status to wheel window (token available)`);
                }
            });
        } else if (windowConfig.id === 'wheel') {
            // Even if no wheel options, still send connection status
            window.webContents.once('did-finish-load', () => {
                if (savedToken || process.env.TWITCH_OAUTH_TOKEN) {
                    window.webContents.send('twitch-status-changed', { isConnected: true });
                    console.log(`[Main] Sent connected status to wheel window (token available)`);
                }
            });
        }

    });

    // Extract wheel options from config (exclude options with enabled: false)
    const wheelWindowConfig = ecosystemConfig.windows.find(w => w.id === 'wheel');
    const rawWheelOptions = wheelWindowConfig?.options?.wheel || [];
    let allWheelOptions = rawWheelOptions.filter(opt => opt.enabled !== false);
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
    initializeQueueManagers(ecosystemConfig, applicationConfigs);

    // Regenerate preload.js after all lifecycle managers are initialized
    // This ensures we capture any APIs that require full initialization
    try {
        const preloadPath = path.join(__dirname, 'preload.js');
        generatePreload(queueManagers, preloadPath);
    } catch (error) {
        console.error('[Main] Failed to regenerate preload.js after initialization:', error);
    }

    // Twitch integration is now handled directly in src/twitch.js
    if (!(process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && process.env.TWITCH_CHANNEL)) {
        console.log('Twitch credentials not configured - Twitch integration disabled');
        const spinStatus = AUTO_SPIN ? 'Auto-spin enabled' : 'Auto-spin disabled';
        console.log(`[Main] ${spinStatus} (configurable via AUTO_SPIN environment variable)`);
    }

    // Clear log files and event queue on startup
    clearStartupQueues();
});

function clearStartupQueues() {
    const logFile = path.join(__dirname, 'command-executor.log');

    // Clear pythonkeys log
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

// Expose Twitch credentials to renderer
ipcMain.handle('get-twitch-credentials', () => {
    return {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
    };
});

// IPC Handlers
ipcMain.on('spin-wheel', (event, wheelResult) => {
    try {
        console.log('Wheel spun! Result:', wheelResult);

        // Create queue name from application and controller
        const application = wheelResult.application || 'Notepad';
        // Normalize controller name to lowercase for consistency
        const controller = (wheelResult.controller || 'pythonkeys').toLowerCase();
        const queueName = `${application}-${controller}`;
        
        // Normalize controller name in wheelResult for worker
        wheelResult.controller = controller;

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
