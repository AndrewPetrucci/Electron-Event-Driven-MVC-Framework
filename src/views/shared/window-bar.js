/**
 * Reusable Window Bar Component
 * 
 * Provides draggable window bar functionality with minimize/close buttons.
 * Usage: Add data-window-bar attribute to any element you want to be draggable.
 * 
 * Example in HTML:
 * <div class="window-bar" data-window-bar id="windowBar">
 *     <div class="window-bar-content">Your content here</div>
 *     <div class="window-bar-controls">
 *         <button class="window-btn minimize-btn" id="minimizeBtn">−</button>
 *         <button class="window-btn close-btn" id="closeBtn">×</button>
 *     </div>
 * </div>
 */

class WindowBar {
    constructor(element) {
        this.element = element;
        this.isMoving = false;
        this.initialMouseX = 0;
        this.initialMouseY = 0;
        this.initialWindowX = 0;
        this.initialWindowY = 0;
        this.initialWindowWidth = 0;
        this.initialWindowHeight = 0;
        this.minimizeBtn = element.querySelector('.minimize-btn');
        this.closeBtn = element.querySelector('.close-btn');

        this.init();
    }

    init() {
        if (!window.electron) {
            console.warn('[WindowBar] Electron IPC not available');
            return;
        }

        // Prevent auto-focus on window-bar elements
        this.element.setAttribute('tabindex', '-1');
        if (this.minimizeBtn) {
            this.minimizeBtn.setAttribute('tabindex', '-1');
        }
        if (this.closeBtn) {
            this.closeBtn.setAttribute('tabindex', '-1');
        }

        // Mouse events for interactive overlay
        this.element.addEventListener('mouseenter', () => this.onMouseEnter());
        this.element.addEventListener('mouseleave', () => this.onMouseLeave());

        // Drag functionality
        this.element.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        document.addEventListener('pointermove', (e) => this.onPointerMove(e));
        document.addEventListener('pointerup', (e) => this.onPointerUp(e));

        // Button handlers
        if (this.minimizeBtn) {
            this.minimizeBtn.addEventListener('click', () => this.minimize());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
    }

    onMouseEnter() {
        if (window.electron && window.electron.mouseOverInteractive) {
            window.electron.mouseOverInteractive(true);
        }
    }

    onMouseLeave() {
        if (!this.isMoving && window.electron && window.electron.mouseOverInteractive) {
            window.electron.mouseOverInteractive(false);
        }
    }

    onPointerDown(e) {
        // Don't drag if clicking on buttons or interactive elements
        if (e.target.closest('.window-btn') || e.target.closest('[data-no-drag]')) {
            return;
        }

        this.isMoving = true;
        this.element.classList.add('dragging');
        this.initialMouseX = e.screenX;
        this.initialMouseY = e.screenY;

        // Capture pointer to continue receiving events outside window
        this.element.setPointerCapture(e.pointerId);

        // Get initial window position and size from main process
        if (window.electron && window.electron.getWindowPosition) {
            const bounds = window.electron.getWindowPosition();
            this.initialWindowX = bounds.x;
            this.initialWindowY = bounds.y;
            this.initialWindowWidth = bounds.width;
            this.initialWindowHeight = bounds.height;
        }

        e.preventDefault();
    }

    onPointerMove(e) {
        if (this.isMoving && window.electron && window.electron.moveWindowTo) {
            const totalDeltaX = e.screenX - this.initialMouseX;
            const totalDeltaY = e.screenY - this.initialMouseY;

            const newX = this.initialWindowX + totalDeltaX;
            const newY = this.initialWindowY + totalDeltaY;

            // Use the initial width/height captured at drag start
            window.electron.moveWindowTo(newX, newY, this.initialWindowWidth, this.initialWindowHeight);
            e.preventDefault();
        }
    }

    onPointerUp(e) {
        if (this.isMoving) {
            this.isMoving = false;
            this.element.classList.remove('dragging');
            if (window.electron && window.electron.mouseOverInteractive) {
                window.electron.mouseOverInteractive(true);
            }
        }
    }

    minimize() {
        if (window.electron && window.electron.minimizeWindow) {
            window.electron.minimizeWindow();
        }
    }

    close() {
        if (window.electron && window.electron.closeWindow) {
            window.electron.closeWindow();
        }
    }
}

// Auto-initialize all elements with data-window-bar attribute
document.addEventListener('DOMContentLoaded', () => {
    const windowBars = document.querySelectorAll('[data-window-bar]');
    windowBars.forEach(el => new WindowBar(el));
});
