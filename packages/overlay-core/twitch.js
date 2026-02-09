

const tmi = require('tmi.js');
const { BrowserWindow } = require('electron');
const EventEmitter = require('events');

// Create an event emitter for Twitch events that lifecycle managers can listen to
const twitchEventEmitter = new EventEmitter();

// Store client reference so we can recreate it with new credentials
let client = null;

/**
 * Setup event handlers for the Twitch client
 */
function setupClientHandlers(clientInstance) {
    clientInstance.on('connected', () => {
        console.log('Connected to Twitch Chat');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('twitch-status-changed', { isConnected: true });
        }
    });

    clientInstance.on('message', (channel, tags, message, self) => {
        if (self) return;
        // Log every chat message
        console.log(`[Twitch Chat] ${tags.username}: ${message}`);
        if (message.toLowerCase() === '!spin') {
            console.log(`${tags.username} triggered spin`);
            const spinData = {
                user: tags.username,
                timestamp: new Date()
            };
            
            // Emit event for lifecycle managers to listen to
            twitchEventEmitter.emit('twitch-spin-triggered', spinData);
            
            // Also send directly to wheel window as fallback
            const allWindows = BrowserWindow.getAllWindows();
            let wheelWindow = null;
            
            // Find wheel window by checking URL
            for (const win of allWindows) {
                if (win && !win.isDestroyed()) {
                    const url = win.webContents.getURL();
                    if (url && (url.includes('wheel') || url.includes('wheel/index.html'))) {
                        wheelWindow = win;
                        break;
                    }
                }
            }
            
            if (wheelWindow && !wheelWindow.isDestroyed()) {
                console.log(`[Twitch] Sending spin event to wheel window`);
                wheelWindow.webContents.send('twitch-spin-triggered', spinData);
            } else {
                console.warn(`[Twitch] Wheel window not found`);
            }
        }
    });

    clientInstance.on('disconnected', () => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('twitch-status-changed', { isConnected: false });
        }
    });

    clientInstance.on('error', (error) => {
        console.error('Twitch client error:', error);
    });
}

/**
 * Create a new Twitch client with current credentials
 */
function createClient() {
    // Get current credentials from environment
    const username = process.env.TWITCH_BOT_USERNAME || 'your_bot_username';
    let password = process.env.TWITCH_OAUTH_TOKEN || 'oauth:your_token_here';
    const channel = process.env.TWITCH_CHANNEL || 'your_channel';
    
    // Ensure token has "oauth:" prefix
    if (password && !password.startsWith('oauth:')) {
        password = 'oauth:' + password;
        console.log('[Twitch] Added oauth: prefix to token');
    }
    
    console.log(`[Twitch] Creating client with username: ${username}, channel: ${channel}`);
    
    const newClient = new tmi.Client({
        options: { debug: false },
        connection: { reconnect: true, secure: true },
        identity: {
            username: username,
            password: password
        },
        channels: [channel]
    });
    
    setupClientHandlers(newClient);
    return newClient;
}

function connectTwitch() {
    // Check if we have valid credentials
    const username = process.env.TWITCH_BOT_USERNAME;
    const token = process.env.TWITCH_OAUTH_TOKEN;
    const channel = process.env.TWITCH_CHANNEL;
    
    if (!username || !token || !channel) {
        console.warn('[Twitch] Missing credentials. Need TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN, and TWITCH_CHANNEL');
        return;
    }
    
    // Disconnect existing client if it exists
    if (client) {
        try {
            const readyState = client.readyState();
            if (readyState === 'OPEN' || readyState === 'CONNECTING') {
                console.log('[Twitch] Disconnecting existing client');
                client.disconnect();
            }
        } catch (err) {
            console.log('[Twitch] Error disconnecting old client:', err.message);
        }
    }
    
    // Create new client with current credentials
    client = createClient();
    
    // Connect the new client
    client.connect().catch((error) => {
        console.error('Failed to connect to Twitch:', error);
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('twitch-status-changed', { isConnected: false });
        }
    });
}


module.exports = { connectTwitch, twitchEventEmitter };
