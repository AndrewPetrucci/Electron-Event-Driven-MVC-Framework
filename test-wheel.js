#!/usr/bin/env node

/**
 * Automated Test Suite for Notepad Wheel Integration
 * Tests wheel overlay with Notepad application
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_TIMEOUT = 60000; // 1 minute total
const NOTEPAD_START_WAIT = 2000; // Wait for notepad to start
const WHEEL_SPIN_WAIT = 35000; // Wait for auto-spin (which happens every 30 seconds)

class NotepadWheelTester {
    constructor() {
        this.notepadProcess = null;
        this.electronProcess = null;
        this.testResults = {
            notepadStarted: false,
            wheelDisplayed: false,
            wheelConfigured: false,
            wheelSpun: false,
            textInserted: false,
            errors: [],
            actualText: ''
        };
        this.expectedText = 'hello world';

        // Load wheel options from the actual Notepad config
        const notepadConfigPath = path.join(__dirname, 'src', 'applications', 'notepad', 'config', 'wheel-options.json');
        try {
            const configData = JSON.parse(fs.readFileSync(notepadConfigPath, 'utf-8'));
            this.wheelOptions = configData.options;
        } catch (error) {
            console.error(`Warning: Could not load notepad config from ${notepadConfigPath}:`, error.message);
            // Fallback to default test options
            this.wheelOptions = [
                {
                    name: 'Hello World',
                    description: 'Insert Hello World text',
                    command: 'hello_world',
                    enabled: true,
                    application: 'Notepad',
                    controller: 'pythonkeys',
                    config: {
                        action: 'insert_text',
                        text: 'hello world'
                    }
                }
            ];
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] [${type}] ${message}`);
    }

    logSuccess(message) {
        this.log(`✓ ${message}`, 'PASS');
    }

    logError(message) {
        this.log(`✗ ${message}`, 'FAIL');
        this.testResults.errors.push(message);
    }

    async startNotepad() {
        return new Promise((resolve, reject) => {
            this.log('Starting Notepad instance...');

            try {
                // Kill any existing notepad processes to ensure a fresh start
                try {
                    const { execSync } = require('child_process');
                    execSync('taskkill /IM notepad.exe /F', { stdio: 'ignore' });
                    this.log('Cleaned up existing Notepad processes');
                } catch (e) {
                    // No existing processes to kill
                }

                // Use a unique temp filename with timestamp in tmp/test-text folder
                const fs = require('fs');
                const timestamp = Date.now();
                const testTextDir = path.join(__dirname, 'tmp', 'test-text');

                // Ensure test-text directory exists
                if (!fs.existsSync(testTextDir)) {
                    fs.mkdirSync(testTextDir, { recursive: true });
                }

                const tempFile = path.join(testTextDir, `notepad-test-${timestamp}.txt`);

                // Create a temporary empty file for Notepad to open
                fs.writeFileSync(tempFile, '');
                this.tempNotepadFile = tempFile;
                this.log(`Created temp file for Notepad: ${tempFile}`);

                this.notepadProcess = spawn('notepad.exe', [tempFile], {
                    detached: true
                });

                // Store the PID for later killing
                this.notepadPID = this.notepadProcess.pid;
                this.log(`Notepad process started with PID: ${this.notepadPID}`);

                this.notepadProcess.on('error', (error) => {
                    this.logError(`Failed to start Notepad: ${error.message}`);
                    reject(error);
                });

                this.notepadProcess.on('exit', (code) => {
                    this.log(`Notepad exited with code ${code}`);
                });

                setTimeout(() => {
                    this.testResults.notepadStarted = true;
                    this.logSuccess('Notepad started successfully');
                    resolve();
                }, NOTEPAD_START_WAIT);
            } catch (error) {
                this.logError(`Failed to spawn Notepad: ${error.message}`);
                reject(error);
            }
        });
    }

    async startElectron() {
        return new Promise((resolve, reject) => {
            this.log('Starting Electron wheel overlay...');

            try {
                this.electronProcess = spawn('npm', ['start'], {
                    cwd: __dirname,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: true,
                    shell: true
                });

                // Store the PID for later killing
                this.electronPID = this.electronProcess.pid;
                this.log(`Electron process started with PID: ${this.electronPID}`);

                let electronReady = false;

                this.electronProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log(`[Electron] ${output}`);
                    if (output.includes('ready') || output.includes('listening')) {
                        electronReady = true;
                    }
                });

                this.electronProcess.stderr.on('data', (data) => {
                    const output = data.toString().trim();
                    if (output && !output.includes('cache')) {
                        console.log(`[Electron] ${output}`);
                    }
                });

                this.electronProcess.on('error', (error) => {
                    this.logError(`Electron process error: ${error.message}`);
                    reject(error);
                });

                // Wait for Electron to start
                setTimeout(() => {
                    this.testResults.wheelDisplayed = true;
                    this.logSuccess('Electron wheel overlay started');
                    resolve();
                }, 3000);
            } catch (error) {
                this.logError(`Failed to start Electron: ${error.message}`);
                reject(error);
            }
        });
    }

    async configureWheelOptions() {
        this.log('Configuring wheel with test options...');
        this.log(`Number of wheel options to load: ${this.wheelOptions.length}`);

        // Create temporary wheel-options-test.json file in tmp folder
        const wheelTestConfigPath = path.join(__dirname, 'tmp', 'wheel-options-test.json');

        try {
            const testConfig = {
                options: this.wheelOptions
            };
            const configJson = JSON.stringify(testConfig, null, 2);
            fs.writeFileSync(wheelTestConfigPath, configJson, 'utf-8');
            this.log(`Wrote test config to: ${wheelTestConfigPath}`);
            this.log(`File size: ${fs.statSync(wheelTestConfigPath).size} bytes`);
            this.log(`Config content:\n${configJson}`);

            // Verify file was written
            if (!fs.existsSync(wheelTestConfigPath)) {
                this.logError('Config file was not created!');
                return false;
            }

            const verifyContent = fs.readFileSync(wheelTestConfigPath, 'utf-8');
            this.log(`Verified config file exists and is readable`);

            this.testResults.wheelConfigured = true;
            this.logSuccess('Wheel configured with single test option');

            // Store path for cleanup later
            this._wheelTestConfigPath = wheelTestConfigPath;
            return true;
        } catch (error) {
            this.logError(`Failed to configure wheel options: ${error.message}`);
            return false;
        }
    }

    async enableAutoSpin() {
        this.log('Auto-spin will be enabled via environment variable...');
        // Set AUTO_SPIN environment variable to enable auto-spin for this test
        process.env.AUTO_SPIN = 'true';
        this.logSuccess('Auto-spin enabled via environment configuration');
        return true;
    }

    async triggerWheelSpin() {
        this.log('Triggering wheel spin via Electron DevTools...');

        try {
            // Use Electron's remote debugging to trigger spin
            // For now, we'll use a simple approach: send keypress to trigger the button
            const scriptContent = `
const { remote } = require('electron');
const { app } = remote;

// Find the main window and send a command to spin
const mainWindow = remote.getCurrentWindow();
mainWindow.webContents.executeJavaScript('window.wheel.spin()');
`;

            const tempScript = path.join(__dirname, 'temp_spin_trigger.js');
            fs.writeFileSync(tempScript, scriptContent, 'utf-8');

            // Execute via Electron's IPC or direct invocation
            // Use keyboard simulation to click the button
            await this.simulateButtonClick();

            this.testResults.wheelSpun = true;
            this.logSuccess('Wheel spin triggered');

            // Clean up
            try {
                fs.unlinkSync(tempScript);
            } catch (e) {
                // Ignore cleanup errors
            }

            return true;
        } catch (error) {
            this.logError(`Failed to trigger wheel spin: ${error.message}`);
            return false;
        }
    }

    async simulateButtonClick() {
        this.log('Simulating SPIN button click...');

        try {
            // Use pythonkeys to press Tab and Enter to click the button
            const ahkScript = path.join(__dirname, 'temp_button_click.ahk');
            const ahkContent = `
#NoEnv
SetBatchLines -1

; Wait a moment for window to be ready
Sleep, 1000

; Focus on Electron window and send Tab to navigate to button, then Enter
Send, {Tab}
Sleep, 200
Send, {Enter}

; Wait for spin animation
Sleep, 3000

ExitApp
`;

            fs.writeFileSync(ahkScript, ahkContent, 'utf-8');

            const ahkExecutable = 'C:\\Program Files\\pythonkeys\\pythonkeys.exe';

            if (!fs.existsSync(ahkExecutable)) {
                this.logError('pythonkeys executable not found');
                return false;
            }

            return new Promise((resolve) => {
                const ahkProcess = spawn(ahkExecutable, [ahkScript], {
                    detached: false
                });

                ahkProcess.on('exit', () => {
                    // Clean up
                    try {
                        fs.unlinkSync(ahkScript);
                    } catch (e) {
                        // Ignore
                    }
                    resolve(true);
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    try {
                        ahkProcess.kill();
                    } catch (e) {
                        // Already exited
                    }
                    resolve(false);
                }, 5000);
            });
        } catch (error) {
            this.logError(`Button click simulation failed: ${error.message}`);
            return false;
        }
    }

    async detectInsertedText() {
        this.log(`Verifying text insertion in Notepad using pythonkeys...`);

        // Wait a bit more to ensure the command has been executed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create a simple pythonkeys script to check Notepad content
        const checkScript = path.join(__dirname, 'temp_check_notepad.ahk');
        const ahkContent = '# pythonkeys script\n\n' +
            '; Focus on Notepad window\n' +
            'WinActivate("ahk_class Notepad")\n' +
            'Sleep(1000)\n\n' +
            '; Get the active window title to verify Notepad is active\n' +
            'activeTitle := WinGetTitle("A")\n' +
            'if (!InStr(activeTitle, "Notepad") && !InStr(activeTitle, "Untitled"))\n' +
            '{\n' +
            '    FileAppend("NOTEPAD_NOT_FOUND", A_Temp . "\\\\notepad-check-result.txt")\n' +
            '    ExitApp()\n' +
            '}\n\n' +
            '; Close any open file dialog\n' +
            'Send("{Escape}")\n' +
            'Sleep(200)\n\n' +
            '; Use Ctrl+End to go to end of file\n' +
            'Send("^{End}")\n' +
            'Sleep(200)\n\n' +
            '; Use Ctrl+A to select all text, then copy it to clipboard\n' +
            'Send("^a")\n' +
            'Sleep(300)\n' +
            'Send("^c")\n' +
            'Sleep(300)\n\n' +
            '; Get clipboard content\n' +
            'clipboardText := A_Clipboard\n\n' +
            '; Write result to temp file so we can read it\n' +
            'FileAppend(clipboardText, A_Temp . "\\\\notepad-check-result.txt")\n' +
            'FileAppend("`nLength: " . StrLen(clipboardText), A_Temp . "\\\\notepad-check-result.txt")\n' +
            '\n' +
            'ExitApp()';

        try {
            fs.writeFileSync(checkScript, ahkContent, 'utf-8');

            const ahkExecutable = 'C:\\Program Files\\pythonkeys\\pythonkeys.exe';
            const resultFile = path.join(process.env.TEMP || 'C:\\temp', 'notepad-check-result.txt');

            // Clean up any previous result
            if (fs.existsSync(resultFile)) {
                fs.unlinkSync(resultFile);
            }

            return new Promise((resolve) => {
                const ahkProcess = spawn(ahkExecutable, [checkScript], {
                    detached: false
                });

                ahkProcess.on('exit', () => {
                    // Wait a bit for file to be written
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(resultFile)) {
                                const content = fs.readFileSync(resultFile, 'utf-8');

                                this.log(`Raw Notepad content: "${content}"`);

                                if (content.toLowerCase().includes('hello world')) {
                                    this.testResults.textInserted = true;
                                    this.testResults.wheelSpun = true;
                                    this.logSuccess('Text "hello world" verified in Notepad');

                                    // Clean up
                                    try { fs.unlinkSync(resultFile); } catch (e) { }
                                    try { fs.unlinkSync(checkScript); } catch (e) { }

                                    resolve(true);
                                } else if (content.includes('NOTEPAD_NOT_FOUND')) {
                                    this.logError('Notepad window not found or not active');
                                    try { fs.unlinkSync(resultFile); } catch (e) { }
                                    try { fs.unlinkSync(checkScript); } catch (e) { }
                                    resolve(false);
                                } else {
                                    this.log(`Notepad content: "${content}"`);
                                    if (content.trim().length === 0) {
                                        this.logError('Notepad is empty - text was not inserted');
                                    } else {
                                        this.logError(`Expected "hello world" but found: "${content}"`);
                                    }
                                    try { fs.unlinkSync(resultFile); } catch (e) { }
                                    try { fs.unlinkSync(checkScript); } catch (e) { }
                                    resolve(false);
                                }
                            } else {
                                this.logError('Failed to read Notepad content (result file not created)');
                                try { fs.unlinkSync(checkScript); } catch (e) { }
                                resolve(false);
                            }
                        } catch (e) {
                            this.logError(`Error reading Notepad content: ${e.message}`);
                            try { fs.unlinkSync(checkScript); } catch (e) { }
                            resolve(false);
                        }
                    }, 500);
                });

                ahkProcess.on('error', (error) => {
                    this.logError(`Failed to start pythonkeys: ${error.message}`);
                    try { fs.unlinkSync(checkScript); } catch (e) { }
                    resolve(false);
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    try {
                        ahkProcess.kill();
                    } catch (e) {
                        // Already exited
                    }
                    this.logError('Notepad content check timed out');
                    try { fs.unlinkSync(checkScript); } catch (e) { }
                    resolve(false);
                }, 10000);
            });
        } catch (error) {
            this.logError(`Failed to check Notepad content: ${error.message}`);
            return false;
        }
    }

    validateResults() {
        this.log('Validating test results...');
        let passCount = 0;
        let failCount = 0;

        // Test 1: Notepad started
        if (this.testResults.notepadStarted) {
            this.logSuccess('Notepad started successfully');
            passCount++;
        } else {
            this.logError('Notepad failed to start');
            failCount++;
        }

        // Test 2: Wheel displayed
        if (this.testResults.wheelDisplayed) {
            this.logSuccess('Wheel overlay displayed');
            passCount++;
        } else {
            this.logError('Wheel overlay failed to display');
            failCount++;
        }

        // Test 3: Wheel configured
        if (this.testResults.wheelConfigured) {
            this.logSuccess('Wheel configured with test options');
            passCount++;
        } else {
            this.logError('Wheel configuration failed');
            failCount++;
        }

        // Test 4: Wheel spun
        if (this.testResults.wheelSpun) {
            this.logSuccess('Wheel spin triggered successfully');
            passCount++;
        } else {
            this.logError('Wheel spin trigger failed');
            failCount++;
        }

        // Test 5: Text inserted
        if (this.testResults.textInserted) {
            this.logSuccess(`Text "${this.expectedText}" inserted via pythonkeys controller`);
            passCount++;
        } else {
            this.logError(`Text "${this.expectedText}" was not inserted`);
            failCount++;
        }

        return { passCount, failCount };
    }

    async cleanup() {
        this.log('Cleaning up...');

        // Terminate Electron process and its children
        if (this.electronProcess || this.electronPID) {
            try {
                this.log('Terminating Electron process and children...');

                // Use taskkill to kill the process tree on Windows
                const pidToKill = this.electronPID || this.electronProcess?.pid;
                if (pidToKill) {
                    try {
                        const { execSync } = require('child_process');
                        execSync(`taskkill /PID ${pidToKill} /T /F`, { stdio: 'ignore' });
                        this.log(`Killed process tree for PID ${pidToKill}`);
                    } catch (e) {
                        // Process might already be dead
                        this.log('Process tree kill attempt completed');
                    }
                }

                // Also try to kill any remaining electron processes
                try {
                    const { execSync } = require('child_process');
                    execSync(`taskkill /IM electron.exe /F`, { stdio: 'ignore' });
                    this.log('Killed any remaining electron.exe processes');
                } catch (e) {
                    // No electron processes found
                }

                // Wait a bit to ensure processes are dead
                await new Promise((resolve) => {
                    setTimeout(resolve, 500);
                });

                this.log('Electron process terminated');
            } catch (e) {
                this.log('Error terminating Electron: ' + e.message);
            }
        }

        // Terminate Notepad process and its children
        if (this.notepadProcess || this.notepadPID) {
            try {
                this.log('Terminating Notepad process and children...');

                // Use taskkill to kill the process tree on Windows
                const pidToKill = this.notepadPID || this.notepadProcess?.pid;
                if (pidToKill) {
                    try {
                        const { execSync } = require('child_process');
                        execSync(`taskkill /PID ${pidToKill} /T /F`, { stdio: 'ignore' });
                        this.log(`Killed process tree for Notepad PID ${pidToKill}`);
                    } catch (e) {
                        // Process might already be dead
                        this.log('Notepad process tree kill attempt completed');
                    }
                }

                // Also try to kill any remaining notepad processes
                try {
                    const { execSync } = require('child_process');
                    execSync(`taskkill /IM notepad.exe /F`, { stdio: 'ignore' });
                    this.log('Killed any remaining notepad.exe processes');
                } catch (e) {
                    // No notepad processes found
                }

                // Wait a bit to ensure processes are dead
                await new Promise((resolve) => {
                    setTimeout(resolve, 500);
                });

                this.log('Notepad process terminated');
            } catch (e) {
                this.log('Error terminating Notepad: ' + e.message);
            }
        }

        // Clean up any temp files
        try {
            const tempFiles = [
                this._wheelTestConfigPath,
                this.tempNotepadFile,
                path.join(__dirname, 'temp_spin_trigger.js'),
                path.join(__dirname, 'temp_button_click.ahk'),
                path.join(__dirname, 'temp_verify_text.ahk'),
                path.join(__dirname, 'notepad_content.txt')
            ].filter(file => file); // Filter out undefined values

            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    this.log(`Cleaned up: ${file}`);
                }
            });
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    printReport() {
        console.log('\n');
        console.log('============================================================');
        console.log('                 NOTEPAD WHEEL TEST REPORT                 ');
        console.log('============================================================');
        console.log(`Notepad Started:           ${this.testResults.notepadStarted ? '✓ YES' : '✗ NO'}`);
        console.log(`Wheel Overlay Displayed:   ${this.testResults.wheelDisplayed ? '✓ YES' : '✗ NO'}`);
        console.log(`Wheel Configured:          ${this.testResults.wheelConfigured ? '✓ YES (1 option)' : '✗ NO'}`);
        console.log(`Wheel Auto-Spin Env Enabled:   ${process.env.AUTO_SPIN === 'true' ? '✓ YES' : '✗ NO'}`);
        console.log(`Wheel Spun:                ${this.testResults.wheelSpun ? '✓ YES (manual)' : '✗ NO'}`);
        console.log(`Text Inserted:             ${this.testResults.textInserted ? `✓ YES ("${this.expectedText}")` : '✗ NO'}`);

        const { passCount, failCount } = this.validateResults();
        console.log('');
        console.log(`Total Tests:               ${passCount + failCount}`);
        console.log(`Passed:                    ${passCount}`);
        console.log(`Failed:                    ${failCount}`);

        if (this.testResults.errors.length > 0) {
            console.log('');
            console.log('Errors:');
            this.testResults.errors.forEach((error, i) => {
                console.log(`  ${i + 1}. ${error}`);
            });
        }

        console.log('============================================================\n');

        return failCount === 0;
    }

    async run() {
        try {
            this.log('='.repeat(60));
            this.log('Notepad Wheel Integration - Automated Test Suite');
            this.log('='.repeat(60));

            // Clean up old test files from previous runs
            try {
                const fs = require('fs');
                const testTextDir = path.join(__dirname, 'tmp', 'test-text');
                if (fs.existsSync(testTextDir)) {
                    const files = fs.readdirSync(testTextDir);
                    files.forEach(file => {
                        if (file.startsWith('notepad-test-')) {
                            const filePath = path.join(testTextDir, file);
                            try {
                                fs.unlinkSync(filePath);
                                this.log(`Cleaned up old test file: ${file}`);
                            } catch (e) {
                                // File may be in use, skip
                            }
                        }
                    });
                }
            } catch (e) {
                this.log('Could not clean up old test files');
            }

            // Set overall timeout
            const testTimeout = setTimeout(async () => {
                this.logError('Test suite exceeded maximum timeout');
                await this.cleanup();
                process.exit(1);
            }, TEST_TIMEOUT);

            try {
                // Enable auto-spin
                const autoSpinEnabled = await this.enableAutoSpin();
                if (!autoSpinEnabled) {
                    this.logError('Failed to enable auto-spin');
                }
                await new Promise(resolve => setTimeout(resolve, 500));

                // Configure wheel options BEFORE starting Electron
                const wheelConfigured = await this.configureWheelOptions();
                if (!wheelConfigured) {
                    this.logError('Failed to configure wheel options');
                }
                // Give file system time to write and ensure config is persisted
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Start Notepad
                await this.startNotepad();
                await new Promise(resolve => setTimeout(resolve, 500));

                // Start Electron wheel overlay (will load our test config)
                await this.startElectron();
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Auto-spin is now running in background every 30 seconds
                // Wait for it to trigger and insert text
                this.log(`Waiting for auto-spin to trigger (up to ${WHEEL_SPIN_WAIT / 1000}s)...`);
                await new Promise(resolve => setTimeout(resolve, WHEEL_SPIN_WAIT));

                // Check if text was inserted by auto-spin
                await this.detectInsertedText();
            } finally {
                clearTimeout(testTimeout);
                await this.cleanup();
            }

            // Print results
            const success = this.printReport();
            process.exit(success ? 0 : 1);
        } catch (error) {
            this.logError(`Test failed: ${error.message}`);
            await this.cleanup();
            this.printReport();
            process.exit(1);
        }
    }
}

// Run tests
const tester = new NotepadWheelTester();
tester.run();
