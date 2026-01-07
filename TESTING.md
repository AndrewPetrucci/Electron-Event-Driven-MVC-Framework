# Automated Testing

The project includes an automated test suite that spawns an Electron instance and runs end-to-end tests.

## Running Tests

```bash
npm test
```

This runs `test-wheel.js` which:

1. **Starts Electron Application** (`electron-test-main.js`)
   - Initializes Electron window in hidden mode
   - Loads game configuration
   - Simulates wheel spins automatically
   - Reports spin events to test harness

2. **Starts Python Executor**
   - Monitors overlay data for wheel spins
   - Detects simulated spins from Electron
   - Queues console commands

3. **Monitors Both Processes**
   - Captures stdout from both Electron and executor
   - Counts wheel spins detected
   - Counts commands successfully queued
   - Validates results match expectations

4. **Generates Test Report**
   - Shows which components initialized successfully
   - Reports spins and commands processed
   - Lists any errors encountered
   - Returns pass/fail status

## Test Flow

```
Test Harness (test-wheel.js)
    ↓
Electron App (electron-test-main.js)  +  Python Executor
    ↓                                      ↓
Simulate Wheel Spins             Monitor overlay-data.json
    ↓                                      ↓
Write test data to file          Detect spins
    ↓                                      ↓
Report to stdout                 Queue commands to overlay-commands.txt
    ↓                                      ↓
Harness parses output                Harness parses output
    ↓                                      ↓
Aggregates results and creates report
```

## What's Being Tested

✓ **Electron starts successfully**
- Application initializes without errors
- Window is created and ready
- Configuration loads properly

✓ **Automated wheel spins work**
- Simulated spins are generated every 12 seconds
- Spins are detected by the Python executor
- Commands are properly mapped and queued

✓ **Command queuing works**
- Executor detects wheel results
- Commands are written to overlay-commands.txt
- Number of queued commands matches number of detected spins

## Test Files

- **test-wheel.js** - Main test harness
- **electron-test-main.js** - Electron app in test mode
- Uses existing files:
  - game-config-loader.js for configuration
  - applications/skyrim/executors/console-executor.py for command execution

## Troubleshooting

**Test timeout occurs**
- Increase `TEST_TIMEOUT` in test-wheel.js
- Check that Electron and Python can be spawned in your environment

**Spins not detected**
- Verify electron-test-main.js is writing to the correct overlay-data.json location
- Check that console-executor.py is monitoring the correct file

**Commands not queued**
- Verify wheel-options.json has valid entries
- Check that command queue file can be written to SKSE Plugins folder

## Manual Testing

For interactive testing without automation:

```bash
# Terminal 1: Start overlay
npm start

# Terminal 2: Start executor
python applications/skyrim/executors/console-executor.py

# Terminal 3: Manual wheel spinning
# Interact with overlay in window to spin wheel
```
