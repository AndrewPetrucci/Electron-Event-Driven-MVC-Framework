# Window Implementations

This directory contains different window implementations for the Electron app.

## Structure

Each window is a self-contained folder with its own:
- `index.html` - Window UI
- `styles.css` - Window styling
- `*.js` - Window logic and features
- Optional shared assets

## Current Windows

### `wheel/`
The main spinning wheel window with Twitch integration and mod support.

**Files:**
- `index.html` - Wheel UI with spin button and info panel
- `styles.css` - Wheel styling
- `wheel.js` - SpinWheel class and spin logic
- `window-bar.js` - Window dragging and control buttons
- `twitch-client.js` - Twitch chat integration

**Features:**
- Spinning wheel with configurable options
- Twitch chat integration
- Window dragging and resizing
- Auto-spin support
- Mod execution and mapping

### `boilerplate/`
A template for creating new window implementations.

**Files:**
- `index.html` - Basic template UI
- `styles.css` - Base styling with interactive elements
- `app.js` - Main application class (customize this!)
- `window-controls.js` - Minimize/close button handling

**How to use this template:**

1. Copy the entire `boilerplate/` folder
2. Rename it to your window name (e.g., `settings/`, `dashboard/`)
3. Customize:
   - `index.html` - Update the UI content
   - `styles.css` - Update styling
   - `app.js` - Add your application logic
   - Add additional `.js` files as needed

4. Update `main.js` to create your window:
   ```javascript
   const windowId1 = createWindow();
   mainWindow.loadFile('src/windows/your-window/index.html');
   
   const windowId2 = createWindow();
   mainWindow.loadFile('src/windows/another-window/index.html');
   ```

## Common Patterns

### Interactive Elements
Mark elements that should pass through mouse events:
```html
<button class="interactive-overlay-element">Click me</button>
```

In your JS:
```javascript
element.addEventListener('mouseenter', () => {
    window.electron.mouseOverInteractive(true);
});
element.addEventListener('mouseleave', () => {
    window.electron.mouseOverInteractive(false);
});
```

### Window Controls
Use the standard minimize/close buttons:
```html
<button class="window-btn minimize-btn" id="minimizeBtn">−</button>
<button class="window-btn close-btn" id="closeBtn">×</button>
```

Include `window-controls.js` to handle them automatically.

### Electron API Access
Access the preload API through `window.electron`:
```javascript
window.electron.minimizeWindow();
window.electron.closeWindow();
window.electron.mouseOverInteractive(true);
window.electron.getWindowPosition();
window.electron.moveWindowTo(x, y);
```

## Creating a New Window

1. **Copy the boilerplate:**
   ```
   boilerplate/ → my-window/
   ```

2. **Edit `index.html`:**
   - Update title and content
   - Keep the control panel structure

3. **Edit `styles.css`:**
   - Customize colors and layout
   - Keep the base styles for buttons

4. **Edit `app.js`:**
   - Rename the class (e.g., `MyWindowApp`)
   - Add your feature logic
   - Use standard event patterns

5. **Update `main.js`:**
   - Add `createWindow()` call
   - Set the correct HTML file path

## Best Practices

- **Keep windows modular** - Each window should be independent
- **Use relative imports** - For paths like `../../wheel-options.json`
- **Handle missing electron** - Check `if (window.electron)` before calling APIs
- **Log initialization** - Use console.log with window names for debugging
- **Consistent styling** - Use the color scheme from `styles.css`
- **Error handling** - Gracefully handle errors in async operations

## Styling Conventions

```css
/* Colors */
Primary: #667eea
Secondary: #764ba2
Success: #4caf50
Error: #f44336

/* Backgrounds */
Dark overlay: rgba(20, 20, 40, 0.8)
Light overlay: rgba(102, 126, 234, 0.1)

/* Transitions */
Standard: 0.2s
Use for: hover states, scale changes
```

## Debugging

Each window logs with a prefix:
```javascript
console.log('[BoilerplateApp] Message here');
console.log('[Wheel] Message here');
```

Search for these prefixes in the DevTools console to find window-specific logs.

Enable DevTools for the window:
```javascript
if (process.argv.includes('--dev')) {
    window.webContents.openDevTools({ mode: 'detach' });
}
```

Run with: `npm start -- --dev`
