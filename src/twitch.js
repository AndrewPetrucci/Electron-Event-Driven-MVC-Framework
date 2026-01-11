

const tmi = require('tmi.js');
const { BrowserWindow } = require('electron');

// Simple Twitch chat integration for !spin command
const twitchConfig = {
    username: process.env.TWITCH_BOT_USERNAME || 'your_bot_username',
    password: process.env.TWITCH_OAUTH_TOKEN || 'oauth:your_token_here',
    channel: process.env.TWITCH_CHANNEL || 'your_channel'
};

const client = new tmi.Client({
    options: { debug: false },
    connection: { reconnect: true, secure: true },
    identity: {
        username: twitchConfig.username,
        password: twitchConfig.password
    },
    channels: [twitchConfig.channel]
});

client.on('connected', () => {
    console.log('Connected to Twitch Chat');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        mainWindow.webContents.send('twitch-status-changed', { isConnected: true });
    }
});

client.on('message', (channel, tags, message, self) => {
    if (self) return;
    // Log every chat message
    console.log(`[Twitch Chat] ${tags.username}: ${message}`);
    if (message.toLowerCase() === '!spin') {
        console.log(`${tags.username} triggered spin`);
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('twitch-spin-triggered', {
                user: tags.username,
                timestamp: new Date()
            });
        }
    }
});

client.on('disconnected', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        mainWindow.webContents.send('twitch-status-changed', { isConnected: false });
    }
});

client.on('error', (error) => {
    console.error('Twitch client error:', error);
});

function connectTwitch() {
    client.connect().catch((error) => {
        console.error('Failed to connect to Twitch:', error);
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('twitch-status-changed', { isConnected: false });
        }
    });
}


module.exports = { connectTwitch };
