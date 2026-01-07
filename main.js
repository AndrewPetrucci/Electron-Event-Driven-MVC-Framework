const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const TwitchClient = require('./src/twitch');
const ModIntegration = require('./src/mod-integration');

let mainWindow;
let twitchClient;
let modIntegration;

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

    // Initialize Mod Integration
    modIntegration = new ModIntegration();
    console.log('Mod Integration initialized');

    // Initialize Twitch Client
    twitchClient = new TwitchClient();
    twitchClient.connect();

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
    console.log('Wheel spun! Result:', wheelResult);

    // TODO: Send to Skyrim mod via HTTP or file I/O
    // For now, just broadcast back to renderer
    mainWindow.webContents.send('spin-result', wheelResult);
});

ipcMain.on('twitch-status-request', (event) => {
    event.sender.send('twitch-status', {
        isConnected: twitchClient && twitchClient.isConnected
    });
});

ipcMain.handle('get-config', async () => {
    let wheelOptions = [];
    try {
        const jsonPath = path.join(__dirname, 'wheel-options.json');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(jsonContent);
        wheelOptions = data.options.map(opt => opt.name);
    } catch (error) {
        console.error('Failed to read wheel-options.json:', error);
        wheelOptions = [
            'Dragons',
            'Spiders',
            'Fire',
            'Ice',
            'Lightning',
            'Teleport to random location',
            'Give random weapon',
            'Spawn enemy',
            'Apply random spell',
            'Set difficulty to max',
            'Give 10000 gold',
            'Blind effect',
            'Speed boost'
        ];
    }

    return {
        channel: process.env.TWITCH_CHANNEL || 'your_channel',
        wheelOptions: wheelOptions
    };
});
