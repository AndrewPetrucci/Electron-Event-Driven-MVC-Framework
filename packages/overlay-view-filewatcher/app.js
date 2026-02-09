/**
 * File Watcher Window App
 * 
 * Displays the contents of the overlay-data.json file in real-time
 * Listens for file-writer events to auto-reload
 */

class FileWatcherApp {
    constructor() {
        console.log('[FileWatcherApp] Initializing...');
        this.fileContent = document.getElementById('fileContent');
        this.setupEventListeners();
        this.loadFileContent();

        // Listen for file update events from sticky window
        if (window.electron && window.electron.onFileUpdated) {
            window.electron.onFileUpdated((data) => {
                console.log('[FileWatcherApp] File updated event received from sticky window');
                this.loadFileContent();
            });
        }

        // Listen for file-writer events (emitted when file-writer controller writes a file)
        if (window.electron && window.electron.onFileWriterEvent) {
            window.electron.onFileWriterEvent((data) => {
                console.log('[FileWatcherApp] File writer event received:', data);
                this.loadFileContent();
            });
        }

        // Listen for file content responses
        if (window.electron && window.electron.onFileContent) {
            window.electron.onFileContent((data) => {
                console.log('[FileWatcherApp] File content received');
                if (data.error) {
                    this.fileContent.textContent = `Error: ${data.error}`;
                } else {
                    this.fileContent.textContent = data.content;
                }
                // Scroll to bottom after updating content
                setTimeout(() => {
                    this.fileContent.parentElement.scrollTop = this.fileContent.scrollHeight;
                }, 0);
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

        console.log('[FileWatcherApp] Event listeners setup complete');
    }

    loadFileContent() {
        if (window.electron) {
            window.electron.sendMessage('read-file', {
                timestamp: Date.now()
            });
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FileWatcherApp();
});
