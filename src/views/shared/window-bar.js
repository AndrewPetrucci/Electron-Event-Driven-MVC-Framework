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
        this.maximizeBtn = element.querySelector('.maximize-btn');
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
        if (this.maximizeBtn) {
            this.maximizeBtn.setAttribute('tabindex', '-1');
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
        if (this.maximizeBtn) {
            this.maximizeBtn.addEventListener('click', () => this.maximize());
            this.updateMaximizeButton();
            if (window.electron && window.electron.onWindowMaximized) {
                window.electron.onWindowMaximized((data) => this.updateMaximizeButton(data && data.maximized));
            }
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
    }

    updateMaximizeButton(maximized) {
        if (!this.maximizeBtn) return;
        if (maximized === undefined && window.electron && window.electron.getWindowMaximized) {
            const result = window.electron.getWindowMaximized();
            maximized = result && result.maximized;
        }
        const maximizeIcon = this.maximizeBtn.querySelector('.maximize-icon');
        const restoreIcon = this.maximizeBtn.querySelector('.restore-icon');
        if (maximizeIcon) maximizeIcon.hidden = !!maximized;
        if (restoreIcon) restoreIcon.hidden = !maximized;
        this.maximizeBtn.title = maximized ? 'Restore' : 'Maximize';
        this.maximizeBtn.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
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

    maximize() {
        if (window.electron && window.electron.maximizeWindow) {
            window.electron.maximizeWindow();
        }
    }

    close() {
        if (window.electron && window.electron.closeWindow) {
            window.electron.closeWindow();
        }
    }
}

/**
 * Resize handles for frameless windows: drag outer borders to resize.
 * Creates 8 hit areas (4 edges + 4 corners) and uses moveWindowTo to set bounds.
 */
class ResizeHandles {
    static get MIN_SIZE() { return 100; }

    constructor() {
        this.container = null;
        this.isResizing = false;
        this.edge = null;
        this.initialMouseX = 0;
        this.initialMouseY = 0;
        this.initialBounds = null;
        this.boundMove = (e) => this.onPointerMove(e);
        this.boundUp = (e) => this.onPointerUp(e);
    }

    init() {
        if (!window.electron || !window.electron.getWindowPosition || !window.electron.moveWindowTo) {
            return;
        }
        if (this.container && this.container.parentNode) {
            return;
        }
        const edges = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        this.container = document.createElement('div');
        this.container.className = 'window-resize-handles';
        this.container.setAttribute('aria-hidden', 'true');
        edges.forEach((edge) => {
            const handle = document.createElement('div');
            handle.className = 'window-resize-handle';
            handle.setAttribute('data-edge', edge);
            this.container.appendChild(handle);
        });
        document.body.appendChild(this.container);

        this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        const handle = e.target.closest('.window-resize-handle');
        if (!handle) return;
        this.edge = handle.getAttribute('data-edge');
        if (!this.edge) return;

        this.isResizing = true;
        this.initialMouseX = e.screenX;
        this.initialMouseY = e.screenY;
        this.initialBounds = window.electron.getWindowPosition();
        if (!this.initialBounds || typeof this.initialBounds.width !== 'number' || typeof this.initialBounds.height !== 'number') {
            this.isResizing = false;
            return;
        }
        handle.setPointerCapture(e.pointerId);
        document.addEventListener('pointermove', this.boundMove);
        document.addEventListener('pointerup', this.boundUp);
        e.preventDefault();
    }

    onPointerMove(e) {
        if (!this.isResizing || !this.initialBounds) return;
        const dx = e.screenX - this.initialMouseX;
        const dy = e.screenY - this.initialMouseY;
        const { x, y, width, height } = this.initialBounds;
        const min = ResizeHandles.MIN_SIZE;
        let newX = x;
        let newY = y;
        let newW = width;
        let newH = height;

        if (this.edge.includes('e')) {
            newW = Math.max(min, width + dx);
        }
        if (this.edge.includes('w')) {
            const dw = Math.min(dx, width - min);
            newX = x + dw;
            newW = width - dw;
        }
        if (this.edge.includes('s')) {
            newH = Math.max(min, height + dy);
        }
        if (this.edge.includes('n')) {
            const dh = Math.min(dy, height - min);
            newY = y + dh;
            newH = height - dh;
        }

        window.electron.moveWindowTo(newX, newY, newW, newH);
        e.preventDefault();
    }

    onPointerUp(e) {
        if (!this.isResizing) return;
        this.isResizing = false;
        this.initialBounds = null;
        this.edge = null;
        document.removeEventListener('pointermove', this.boundMove);
        document.removeEventListener('pointerup', this.boundUp);
        e.preventDefault();
    }
}

// Auto-initialize all elements with data-window-bar attribute and resize handles
document.addEventListener('DOMContentLoaded', () => {
    const windowBars = document.querySelectorAll('[data-window-bar]');
    windowBars.forEach(el => new WindowBar(el));
    const resizeHandles = new ResizeHandles();
    resizeHandles.init();
});
