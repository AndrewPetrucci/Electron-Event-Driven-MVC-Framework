/**
 * Boilerplate Window App
 * 
 * This is the main application logic for the window.
 * Customize this file to add your own functionality.
 */

class BoilerplateApp {
    constructor() {
        console.log('[BoilerplateApp] Initializing...');
        this.setupEventListeners();

        // Listen for OAuth token from main process
        if (window.electron && window.electron.onTwitchOAuthToken) {
            window.electron.onTwitchOAuthToken(token => {
                console.log('[Twitch OAuth] Access token received in renderer:', token);
                // You can now use the token in your app logic
            });
        }
    }

    setupEventListeners() {
        // Setup interactive element mouse events
        const interactiveElements = document.querySelectorAll('.interactive-overlay-element');
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                if (window.electron) {
                    window.electron.mouseOverInteractive(true);
                }
            });

            element.addEventListener('mouseleave', () => {
                if (window.electron) {
                    window.electron.mouseOverInteractive(false);
                }
            });
        });

        // Setup action button
        const actionBtn = document.getElementById('actionBtn');
        if (actionBtn) {
            actionBtn.addEventListener('click', () => this.onActionButtonClick());
        }

        console.log('[BoilerplateApp] Event listeners setup complete');

        // Set Twitch OAuth link using credentials from main process
        const twitchConnectLink = document.getElementById('twitchConnectLink');
        if (twitchConnectLink && window.electron && window.electron.getTwitchCredentials) {
            window.electron.getTwitchCredentials().then(creds => {
                const clientId = creds.clientId || 'YOUR_CLIENT_ID';
                const redirectUri = 'http://localhost:3000/';
                const responseType = 'token';
                // Request chat-related scopes
                const scope = [
                    'chat:read'
                ].join(' ');
                const oauthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;
                console.log('[Twitch OAuth] Generated URL:', oauthUrl);
                twitchConnectLink.href = oauthUrl;
            });
        }
    }

    onActionButtonClick() {
        console.log('[BoilerplateApp] Action button clicked');
        if (window.electron) {
            window.electron.sendMessage('button-click', {
                buttonId: 'actionBtn',
                timestamp: Date.now()
            });
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BoilerplateApp();
});
