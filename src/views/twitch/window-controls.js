/**
 * Window Controls
 * 
 * Handles minimize and close button functionality.
 * This is shared across all window implementations.
 */

document.addEventListener('DOMContentLoaded', () => {
    const minimizeBtn = document.getElementById('minimizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    if (minimizeBtn && window.electron) {
        minimizeBtn.addEventListener('click', () => {
            console.log('[WindowControls] Minimize clicked');
            window.electron.minimizeWindow();
        });
    }

    if (closeBtn && window.electron) {
        closeBtn.addEventListener('click', () => {
            console.log('[WindowControls] Close clicked');
            window.electron.closeWindow();
        });
    }
});
