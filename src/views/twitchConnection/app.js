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
