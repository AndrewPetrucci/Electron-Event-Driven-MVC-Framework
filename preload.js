const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    spinWheel: (result) => ipcRenderer.send('spin-wheel', result),
    onSpinResult: (callback) => ipcRenderer.on('spin-result', (event, result) => callback(result)),
    onLoadWheelOptions: (callback) => ipcRenderer.on('load-wheel-options', (event, options) => callback(options)),
    onSpinHotkey: (callback) => ipcRenderer.on('spin-wheel-hotkey', () => callback()),
    onTwitchStatusChanged: (callback) => ipcRenderer.on('twitch-status-changed', (event, status) => callback(status)),
    mouseOverInteractive: (isOver) => ipcRenderer.send('mouse-over-interactive', isOver),
    moveWindowBy: (deltaX, deltaY) => ipcRenderer.send('move-window', { deltaX, deltaY }),
    moveWindowTo: (x, y) => ipcRenderer.send('move-window-to', { x, y }),
    getWindowPosition: () => ipcRenderer.sendSync('get-window-position'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    getAutoSpinConfig: () => ipcRenderer.invoke('get-auto-spin-config'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),

    // Mod Integration
    wheelSpinResult: (result) => ipcRenderer.send('wheel-spin-result', result),
    getMappedMods: (wheelResult) => ipcRenderer.sendSync('get-mapped-mods', wheelResult),
    triggerModAction: (modKey, actionKey) => ipcRenderer.sendSync('trigger-mod-action', { modKey, actionKey }),
    getAllMods: () => ipcRenderer.sendSync('get-all-mods'),
    getModConfig: (modKey) => ipcRenderer.sendSync('get-mod-config', modKey),
    setModEnabled: (modKey, enabled) => ipcRenderer.sendSync('set-mod-enabled', { modKey, enabled }),
    addWheelMapping: (wheelResult, modKey) => ipcRenderer.sendSync('add-wheel-mapping', { wheelResult, modKey }),
    removeWheelMapping: (wheelResult, modKey) => ipcRenderer.sendSync('remove-wheel-mapping', { wheelResult, modKey })
});
