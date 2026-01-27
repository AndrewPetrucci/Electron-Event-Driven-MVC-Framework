const { contextBridge, ipcRenderer } = require('electron');

// Auto-generated preload.js from lifecycle manager APIs
// This file is generated automatically - do not edit manually
contextBridge.exposeInMainWorld('electron', {
    buttonClick: (clickData) => ipcRenderer.send("button-click", {clickData}),
    closeWindow: (data) => ipcRenderer.send("close-window", {data}),
    getAutoSpinConfig: () => ipcRenderer.invoke("get-auto-spin-config"),
    getConfig: () => ipcRenderer.invoke("get-config"),
    getTwitchCredentials: () => ipcRenderer.invoke("get-twitch-credentials"),
    getWindowPosition: () => ipcRenderer.sendSync("get-window-position"),
    minimizeWindow: (data) => ipcRenderer.send("minimize-window", {data}),
    mouseOverInteractive: (isOver) => ipcRenderer.send("mouse-over-interactive", {isOver}),
    moveWindowBy: (deltaX, deltaY) => ipcRenderer.send("move-window", {deltaX: deltaX, deltaY: deltaY}),
    moveWindowTo: (x, y, width, height) => ipcRenderer.send("move-window-to", {x: x, y: y, width: width, height: height}),
    onLoadWheelOptions: (callback) => ipcRenderer.on("load-wheel-options", (event, data) => callback(data)),
    onSpinHotkey: (callback) => ipcRenderer.on("spin-wheel-hotkey", () => callback()),
    onSpinResult: (callback) => ipcRenderer.on("spin-result", (event, data) => callback(data)),
    onTwitchOAuthToken: (callback) => ipcRenderer.on("twitch-oauth-token", (event, data) => callback(data)),
    onTwitchSpinTriggered: (callback) => ipcRenderer.on("twitch-spin-triggered", () => callback()),
    onTwitchStatusChanged: (callback) => ipcRenderer.on("twitch-status-changed", (event, data) => callback(data)),
    readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
    resizeWindow: (width, height) => ipcRenderer.send("resize-window", {width: width, height: height}),
    sendMessage: (channel, data) => ipcRenderer.send(channel, data),
    showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
    showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
    spinWheel: (result) => ipcRenderer.send("spin-wheel", result),
    writeFile: (filePath, content) => ipcRenderer.invoke("write-file", filePath, content)
});
