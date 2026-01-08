const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const TwitchClient = require('./src/twitch');
const ModIntegration = require('./src/mod-integration');
const ApplicationConfigLoader = require('./src/application-config-loader');

let mainWindow;
let twitchClient;
let modIntegration;
let gameConfig;
let applicationConfigs = {};

// Get auto-spin setting from environment (default: false)
// Set AUTO_SPIN=true to enable
const AUTO_SPIN = process.env.AUTO_SPIN === 'true' || process.argv.includes('--enable-auto-spin');

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 600;

function createWindow() {
    mainWindow = new BrowserWindow({
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

    mainWindow.loadFile('src/index.html');

    // Force window to stay at exact size (set after load to ensure it takes effect)
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.setMinimumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
        mainWindow.setMaximumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    });

    // Register global hotkey for wheel spin (disabled - using auto-spin instead)
    // Uncomment below to enable manual hotkey
    // globalShortcut.register('Shift+F1', () => {
    //     mainWindow.webContents.send('spin-wheel-hotkey');
    //     console.log('Global Shift+F1 hotkey triggered - spinning wheel');
    // });

    // Start with mouse events ignored so clicks pass through
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // Listen for messages from renderer about interactive elements
    ipcMain.on('mouse-over-interactive', (event, isOver) => {
        mainWindow.setIgnoreMouseEvents(!isOver, { forward: true });
    });

    ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
        const bounds = mainWindow.getBounds();
        mainWindow.setBounds({
            x: bounds.x + deltaX,
            y: bounds.y + deltaY,
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT
        });
    });

    ipcMain.on('move-window-to', (event, { x, y }) => {
        mainWindow.setBounds({
            x: x,
            y: y,
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT
        });
    });

    ipcMain.on('get-window-position', (event) => {
        const [x, y] = mainWindow.getPosition();
        event.returnValue = { x, y };
    });

    ipcMain.on('resize-window', (event, { width, height }) => {
        mainWindow.setSize(width, height);
    });

    // Mod integration handlers
    ipcMain.on('wheel-spin-result', (event, result) => {
        console.log('Wheel result:', result);
        modIntegration.writeWheelResult(result);
    });

    ipcMain.on('get-mapped-mods', (event, wheelResult) => {
        const mods = modIntegration.getMappedMods(wheelResult);
        event.returnValue = mods;
    });

    ipcMain.on('trigger-mod-action', (event, { modKey, actionKey }) => {
        const result = modIntegration.triggerModAction(modKey, actionKey);
        event.returnValue = result;
    });

    ipcMain.on('get-all-mods', (event) => {
        const mods = modIntegration.getAllMods();
        event.returnValue = mods;
    });

    ipcMain.on('get-mod-config', (event, modKey) => {
        const config = modIntegration.getModConfig(modKey);
        event.returnValue = config;
    });

    ipcMain.on('set-mod-enabled', (event, { modKey, enabled }) => {
        const result = modIntegration.setModEnabled(modKey, enabled);
        event.returnValue = result;
    });

    ipcMain.on('add-wheel-mapping', (event, { wheelResult, modKey }) => {
        const result = modIntegration.addWheelMapping(wheelResult, modKey);
        event.returnValue = result;
    });

    ipcMain.on('remove-wheel-mapping', (event, { wheelResult, modKey }) => {
        const result = modIntegration.removeWheelMapping(wheelResult, modKey);
        event.returnValue = result;
    });

    ipcMain.handle('get-game-name', () => {
        return null; // No default application
    });

    ipcMain.handle('get-auto-spin-config', () => {
        return AUTO_SPIN;
    });

    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });

    ipcMain.on('close-window', () => {
        mainWindow.close();
    });

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();

    // Load master wheel-options.json to discover applications
    const wheelOptionsPath = path.join(__dirname, 'wheel-options.json');
    let allWheelOptions = [];
    let uniqueApplications = new Set();

    try {
        const wheelOptionsContent = fs.readFileSync(wheelOptionsPath, 'utf-8');
        const wheelOptionsData = JSON.parse(wheelOptionsContent);
        allWheelOptions = Array.isArray(wheelOptionsData) ? wheelOptionsData : (wheelOptionsData.options || []);

        // Extract unique applications
        allWheelOptions.forEach(option => {
            if (option.application) {
                uniqueApplications.add(option.application.toLowerCase());
            }
        });

        console.log(`[Main] Discovered applications: ${Array.from(uniqueApplications).join(', ')}`);
    } catch (error) {
        console.warn(`[Main] Failed to load wheel-options.json: ${error.message}`);
    }

    // Load configuration for each discovered application
    const applicationConfigs = {};
    uniqueApplications.forEach(appName => {
        try {
            const configLoader = new ApplicationConfigLoader(appName);
            applicationConfigs[appName] = configLoader.loadAll();
            console.log(`[Main] Loaded configuration for application: ${appName}`);
        } catch (error) {
            console.warn(`[Main] Failed to load config for ${appName}: ${error.message}`);
        }
    });

    // Use first discovered application as reference (or null if none)
    gameConfig = Object.values(applicationConfigs)[0] || {
        wheelOptions: allWheelOptions,
        executorScript: null
    };

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

    // Initialize Mod Integration with current application
    const currentApp = Array.from(uniqueApplications)[0] || null;
    modIntegration = new ModIntegration('mod-config.json', appToControllersLog, controllerToAppsLog, currentApp);
    console.log('Mod Integration initialized');

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
    const userProfile = process.env.USERPROFILE;
    const commandQueueFile = path.join(userProfile, 'Documents/My Games/Skyrim Special Edition/SKSE/Plugins/overlay-commands.txt');
    const logFile = path.join(__dirname, 'command-executor.log');

    // Clear command queue
    try {
        if (fs.existsSync(commandQueueFile)) {
            fs.writeFileSync(commandQueueFile, '');
            console.log('Cleared command queue');
        }
    } catch (error) {
        console.warn('Could not clear command queue:', error);
    }

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
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.on('spin-wheel', (event, wheelResult) => {
    try {
        console.log('Wheel spun! Result:', wheelResult);

        // wheelResult is now the full option object with config
        if (wheelResult.config) {
            // Determine which executor to use based on application
            const application = wheelResult.application || 'Notepad';

            if (application === 'Notepad') {
                // Execute notepad-executor.ahk with entire config object as JSON
                const ahkScript = path.join(__dirname, 'controllers', 'autohotkey', 'notepad-executor.ahk');
                const configJson = JSON.stringify(wheelResult.config);
                console.log(`Executing: ${ahkScript} with config: ${configJson}`);

                spawn('powershell.exe', [
                    '-NoProfile',
                    '-ExecutionPolicy', 'Bypass',
                    '-File', ahkScript,
                    configJson
                ], {
                    detached: false,
                    stdio: 'ignore'
                }).unref();
            }
        }

        // TODO: Send to Skyrim mod via HTTP or file I/O
        // For now, just broadcast back to renderer
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('spin-result', wheelResult.name || wheelResult);
        }
    } catch (error) {
        console.error('Error handling spin-wheel:', error);
        // Silently handle errors (e.g., broken pipe, closed window)
        // Don't crash the process
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
