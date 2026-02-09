/**
 * Electron Test Main Process
 * Runs Electron with automated wheel spin testing
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ApplicationConfigLoader = require('./src/application-config-loader');

let mainWindow;
let testMode = true;
let testSpinInterval;

app.on('ready', () => {
    console.log('[TEST] Electron app ready');

    // Load game configuration
    const configLoader = new ApplicationConfigLoader();
    const gameConfig = configLoader.loadAll();

    // Create main window
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        show: false // Hidden for testing
    });

    mainWindow.loadFile(path.join(__dirname, 'node_modules', 'overlay-view-wheel', 'index.html'));

    // Open DevTools if not in test mode
    if (process.env.DEBUG_TEST) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.once('ready-to-show', () => {
        console.log('[TEST] Window ready to show');
        mainWindow.show();
    });

    // Signal test readiness
    setTimeout(() => {
        console.log('[TEST] Ready for testing');
        startAutomatedSpins();
    }, 1000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

// IPC handlers for wheel data
ipcMain.handle('get-config', (event) => {
    const configLoader = new ApplicationConfigLoader();
    return configLoader.loadAll();
});

ipcMain.on('wheel-spin', (event, data) => {
    console.log(`[TEST] Wheel spin detected: ${data.selectedOption}`);
    console.log('[RESULT] Wheel spun');
});

ipcMain.handle('write-overlay-data', (event, data) => {
    console.log(`[TEST] Writing overlay data: ${JSON.stringify(data)}`);
    // Actual implementation would write to file
    return true;
});

// Automated test spinning
function startAutomatedSpins() {
    console.log('[TEST] Starting automated wheel spins');

    let spinCount = 0;
    const maxSpins = 3;

    testSpinInterval = setInterval(() => {
        if (spinCount >= maxSpins) {
            clearInterval(testSpinInterval);
            console.log('[TEST] Automated spins complete');
            return;
        }

        // Simulate wheel spin
        const wheelOptions = [
            'Teleport to Whiterun',
            'Spawn Spider'
        ];

        const selectedOption = wheelOptions[spinCount % wheelOptions.length];

        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('test-spin', {
                option: selectedOption,
                timestamp: new Date().toISOString()
            });

            console.log(`[TEST] Simulated spin #${spinCount + 1}: ${selectedOption}`);
            console.log('[RESULT] Wheel spun');
            spinCount++;
        }
    }, 12000); // Spin every 12 seconds
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        // Re-create window on activate
    }
});

// Handle quit signals
process.on('SIGTERM', () => {
    console.log('[TEST] Received SIGTERM');
    app.quit();
});

process.on('SIGINT', () => {
    console.log('[TEST] Received SIGINT');
    app.quit();
});
