/**
 * Helper functions for generating preload API code strings
 * These make it easier for lifecycle managers to define their preload APIs
 */

/**
 * Generate code for an IPC invoke handler
 * @param {string} channel - IPC channel name
 * @returns {string} Code string for the preload method
 */
function invoke(channel) {
    return `() => ipcRenderer.invoke("${channel}")`;
}

/**
 * Generate code for an IPC invoke handler with arguments
 * @param {string} channel - IPC channel name
 * @param {string} args - Function arguments string (e.g., "arg1, arg2")
 * @returns {string} Code string for the preload method
 */
function invokeWithArgs(channel, args) {
    return `(${args}) => ipcRenderer.invoke("${channel}", ${args})`;
}

/**
 * Generate code for an IPC send handler
 * @param {string} channel - IPC channel name
 * @param {string} args - Function arguments string (e.g., "data" or "arg1, arg2")
 * @param {boolean} sendDirect - If true, send argument directly instead of wrapping in object
 * @returns {string} Code string for the preload method
 */
function send(channel, args = 'data', sendDirect = false) {
    if (sendDirect) {
        // Send argument directly without wrapping
        return `(${args}) => ipcRenderer.send("${channel}", ${args})`;
    }
    
    if (args.includes(',')) {
        // Multiple arguments - send as object
        const argNames = args.split(',').map(a => a.trim());
        const objProps = argNames.map(a => `${a}: ${a}`).join(', ');
        return `(${args}) => ipcRenderer.send("${channel}", {${objProps}})`;
    } else {
        // Single argument - send as object property
        return `(${args}) => ipcRenderer.send("${channel}", {${args}})`;
    }
}

/**
 * Generate code for an IPC sendSync handler
 * @param {string} channel - IPC channel name
 * @param {string} args - Function arguments string (e.g., "arg1" or "arg1, arg2")
 * @returns {string} Code string for the preload method
 */
function sendSync(channel, args = '') {
    if (!args) {
        return `() => ipcRenderer.sendSync("${channel}")`;
    }
    if (args.includes(',')) {
        // Multiple arguments - send as object
        const argNames = args.split(',').map(a => a.trim());
        const objProps = argNames.map(a => `${a}: ${a}`).join(', ');
        return `(${args}) => ipcRenderer.sendSync("${channel}", {${objProps}})`;
    } else {
        // Single argument - send as object property
        return `(${args}) => ipcRenderer.sendSync("${channel}", {${args}})`;
    }
}

/**
 * Generate code for an IPC event listener
 * @param {string} channel - IPC channel name
 * @returns {string} Code string for the preload method
 */
function on(channel) {
    return `(callback) => ipcRenderer.on("${channel}", (event, data) => callback(data))`;
}

/**
 * Generate code for an IPC event listener that passes the event
 * @param {string} channel - IPC channel name
 * @returns {string} Code string for the preload method
 */
function onWithEvent(channel) {
    return `(callback) => ipcRenderer.on("${channel}", (event, ...args) => callback(...args))`;
}

/**
 * Generate code for an IPC event listener with no arguments
 * @param {string} channel - IPC channel name
 * @returns {string} Code string for the preload method
 */
function onNoArgs(channel) {
    return `(callback) => ipcRenderer.on("${channel}", () => callback())`;
}

module.exports = {
    invoke,
    invokeWithArgs,
    send,
    sendSync,
    on,
    onWithEvent,
    onNoArgs
};
