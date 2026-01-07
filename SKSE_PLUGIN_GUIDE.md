# SKSE Plugin Implementation Guide

This guide explains how to implement direct console command execution using a SKSE plugin.

## Option A: File-Based Command Queue (Easier - Recommended)

Use the `skyrim-console-executor.py` script which queues commands to a file that a SKSE plugin reads.

### Steps:

1. **Run the Python script:**
   ```powershell
   python C:\Users\andre\Documents\Overlay\skyrim-console-executor.py
   ```

2. **Create a SKSE plugin to read the queue:**
   - The plugin will read `overlay-commands.txt` 
   - Execute each command via console
   - Clear the file when done

3. **Plugin code is in:** `skse-plugin/overlay-bridge.cpp`

## Option B: Direct Console Execution via SKSE (More Complex)

Build and compile the C++ SKSE plugin for direct command execution.

### Requirements:

- **Visual Studio 2019 or later** (C++)
- **SKSE SDK** from [skse.silverlock.org](https://skse.silverlock.org)
- **CMake** (optional, for easier building)

### Steps:

1. **Download SKSE SDK:**
   - Go to [https://skse.silverlock.org](https://skse.silverlock.org)
   - Download the source code archive
   - Extract it

2. **Set up project:**
   - Copy `skse-plugin/overlay-bridge.cpp` into SKSE source directory
   - Create `CMakeLists.txt` or use Visual Studio project

3. **Compile:**
   ```bash
   cmake -B build
   cmake --build build --config Release
   ```

4. **Install DLL:**
   - Copy compiled `.dll` to: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\SKSE\Plugins\`

5. **Run Python executor:**
   ```powershell
   python skyrim-console-executor.py
   ```

## Option C: Using AutoHotkey (Simple - No Plugin Needed)

The Python script includes AutoHotkey support. If you have AutoHotkey installed:

```powershell
# Install AutoHotkey v1.1 from https://www.autohotkey.com
# Then run the executor
python skyrim-console-executor.py
```

The script will automatically use AutoHotkey to inject commands into Skyrim's console.

## How It Works

### File-Based Queue Flow:
```
Wheel Spins
    ↓
Overlay writes result to overlay-data.json
    ↓
Python script detects result
    ↓
Python writes command to overlay-commands.txt
    ↓
SKSE plugin reads overlay-commands.txt
    ↓
SKSE plugin executes command in console
    ↓
Result happens in-game!
```

### AutoHotkey Flow:
```
Wheel Spins
    ↓
Overlay writes result
    ↓
Python detects result
    ↓
Python runs AutoHotkey script
    ↓
AutoHotkey opens Skyrim console
    ↓
AutoHotkey types and executes command
    ↓
Result happens in-game!
```

## Testing

1. Start the Python executor:
   ```powershell
   python C:\Users\andre\Documents\Overlay\skyrim-console-executor.py
   ```

2. Launch Skyrim

3. Spin the wheel in the overlay

4. Check the console output - you should see commands being queued

5. If using file-based approach, check `overlay-commands.txt` for the queued command

## Troubleshooting

- **Commands not executing?** Make sure SKSE plugin is in the correct folder
- **File not being read?** Check file permissions on `overlay-commands.txt`
- **AutoHotkey errors?** Install AutoHotkey v1.1 from [autohotkey.com](https://www.autohotkey.com)

## Next Steps

1. **Recommended:** Use AutoHotkey for immediate testing (no compilation needed)
2. **Production:** Build the SKSE plugin for most reliable execution
3. **Custom commands:** Edit `wheel-options.json` to add new console commands
