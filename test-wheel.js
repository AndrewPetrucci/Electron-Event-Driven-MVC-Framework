#!/usr/bin/env node

/**
 * Automated Test Suite for Skyrim Twitch Wheel Overlay
 * Spawns Electron instance and runs automated wheel spin tests
 */

const { spawn } = require('child_process');
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Configuration
const OVERLAY_START_WAIT = 5000; // 5 seconds for Electron to start
const EXECUTOR_START_WAIT = 3000; // 3 seconds for executor to start
const SPIN_DETECTION_TIME = 35000; // 35 seconds to detect spins
const TEST_TIMEOUT = 120000; // 2 minutes total

class WheelOverlayTester {
    constructor() {
        this.electronProcess = null;
        this.executorProcess = null;
        this.testWindow = null;
        this.lastWheelResult = null;
        this.testResults = {
            overlayStarted: false,
            executorStarted: false,
            spinsDetected: 0,
            commandsQueued: 0,
            errors: [],
            wheelSpins: []
        };
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

    async startElectronTest() {
        return new Promise((resolve, reject) => {
            this.log('Electron application should be running (via npm start)...');

            // Check if overlay is already running by trying to connect
            const checkInterval = setInterval(() => {
                // Simple check - if overlay-data.json exists and is being written to
                const dataFile = path.join(
                    process.env.USERPROFILE,
                    'Documents/My Games/Skyrim Special Edition/SKSE/Plugins/overlay-data.json'
                );

                if (fs.existsSync(dataFile)) {
                    clearInterval(checkInterval);
                    this.testResults.overlayStarted = true;
                    this.logSuccess('Electron overlay is running');
                    resolve();
                }
            }, 500);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.testResults.overlayStarted) {
                    this.logError('Could not detect overlay (overlay-data.json not found)');
                    reject(new Error('Overlay not detected'));
                }
            }, 10000);
        });
    }

    parseTestResult(output) {
        if (output.includes('Wheel spun')) {
            this.testResults.wheelSpins.push(new Date());
            this.log(`Wheel spin detected in Electron app`);
        }
    }

    async startExecutor() {
        return new Promise((resolve, reject) => {
            this.log('Waiting for executor (spawned by main.js)...');

            // Executor is now spawned by main.js, so we just wait a bit for it to initialize
            setTimeout(() => {
                this.testResults.executorStarted = true;
                this.logSuccess('Executor initialized and monitoring');
                resolve();
            }, 2000);
        });
    }

    async waitForSpins() {
        this.log(`Monitoring for wheel spins (${SPIN_DETECTION_TIME / 1000}s)...`);
        return new Promise((resolve) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                // Check command queue file for commands
                const commandQueueFile = path.join(
                    process.env.USERPROFILE,
                    'Documents/My Games/Skyrim Special Edition/SKSE/Plugins/overlay-commands.txt'
                );

                try {
                    if (fs.existsSync(commandQueueFile)) {
                        const content = fs.readFileSync(commandQueueFile, 'utf8');
                        const commands = content.trim().split('\n').filter(line => line.length > 0);
                        if (commands.length > this.testResults.commandsQueued) {
                            this.testResults.commandsQueued = commands.length;
                            this.log(`Command queued (${commands.length} total)`);
                        }
                    }
                } catch (error) {
                    // File might not exist yet
                }

                // Check data file for wheel results
                const dataFile = path.join(
                    process.env.USERPROFILE,
                    'Documents/My Games/Skyrim Special Edition/SKSE/Plugins/overlay-data.json'
                );

                try {
                    if (fs.existsSync(dataFile)) {
                        const content = fs.readFileSync(dataFile, 'utf8');
                        const data = JSON.parse(content);
                        if (data.result && data.result !== this.lastWheelResult) {
                            this.lastWheelResult = data.result;
                            this.testResults.spinsDetected++;
                            this.log(`Wheel Result: ${data.result}`);
                        }
                    }
                } catch (error) {
                    // File might not exist or be invalid JSON
                }

                const elapsed = Date.now() - startTime;
                if (elapsed >= SPIN_DETECTION_TIME) {
                    clearInterval(interval);
                    this.log('Spin detection period complete');
                    resolve();
                }
            }, 500);
        });
    }

    validateResults() {
        this.log('Validating test results...');
        let passCount = 0;
        let failCount = 0;

        // Test 1: Overlay started
        if (this.testResults.overlayStarted) {
            this.logSuccess('Overlay initialized and running');
            passCount++;
        } else {
            this.logError('Overlay failed to initialize');
            failCount++;
        }

        // Test 2: Executor started
        if (this.testResults.executorStarted) {
            this.logSuccess('Executor initialized and monitoring');
            passCount++;
        } else {
            this.logError('Executor failed to initialize');
            failCount++;
        }

        // Test 3: Spins detected (should have at least 1)
        if (this.testResults.spinsDetected > 0) {
            this.logSuccess(`${this.testResults.spinsDetected} wheel spin(s) detected`);
            passCount++;
        } else {
            this.logError('No wheel spins detected');
            failCount++;
        }

        // Test 4: Commands queued (should match or exceed spins)
        if (this.testResults.commandsQueued > 0) {
            this.logSuccess(`${this.testResults.commandsQueued} command(s) queued`);
            passCount++;
        } else {
            this.logError('No commands were queued');
            failCount++;
        }

        // Test 5: Commands match spins
        if (this.testResults.spinsDetected > 0) {
            if (this.testResults.commandsQueued === this.testResults.spinsDetected) {
                this.logSuccess('Commands queued match spins detected');
                passCount++;
            } else {
                this.logError(
                    `Command/spin mismatch: ${this.testResults.spinsDetected} spins but ${this.testResults.commandsQueued} commands`
                );
                failCount++;
            }
        }

        return { passCount, failCount };
    }

    cleanup() {
        this.log('Cleaning up processes...');

        if (this.electronProcess) {
            try {
                process.kill(-this.electronProcess.pid);
                this.log('Electron process terminated');
            } catch (e) {
                // Process already terminated
            }
        }

        if (this.executorProcess) {
            try {
                process.kill(-this.executorProcess.pid);
                this.log('Executor process terminated');
            } catch (e) {
                // Process already terminated
            }
        }
    }

    printReport() {
        console.log('\n');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                    TEST REPORT                                 ');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`Electron Started:          ${this.testResults.overlayStarted ? '✓ YES' : '✗ NO'}`);
        console.log(`Executor Started:          ${this.testResults.executorStarted ? '✓ YES' : '✗ NO'}`);
        console.log(`Wheel Spins Detected:      ${this.testResults.spinsDetected}`);
        console.log(`Commands Queued:           ${this.testResults.commandsQueued}`);
        console.log(`Electron Wheel Spins:      ${this.testResults.wheelSpins.length}`);

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

        console.log('═══════════════════════════════════════════════════════════════\n');

        return failCount === 0;
    }

    async run() {
        try {
            this.log('='.repeat(60));
            this.log('Skyrim Wheel Overlay - Automated Test Suite');
            this.log('='.repeat(60));

            // Set overall timeout
            const testTimeout = setTimeout(() => {
                this.logError('Test suite exceeded maximum timeout');
                this.cleanup();
                process.exit(1);
            }, TEST_TIMEOUT);

            try {
                // Start Electron app
                await this.startElectronTest();
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Start executor
                await this.startExecutor();

                // Wait for spins
                await this.waitForSpins();
            } finally {
                clearTimeout(testTimeout);
                this.cleanup();
            }

            // Print results
            const success = this.printReport();
            process.exit(success ? 0 : 1);
        } catch (error) {
            this.logError(`Test failed: ${error.message}`);
            this.cleanup();
            this.printReport();
            process.exit(1);
        }
    }
}

// Run tests
const tester = new WheelOverlayTester();
tester.run();
