# SKSE Plugin Implementation Guide

This guide explains how the SKSE plugin directly executes console commands for the Twitch Wheel Overlay.

## How It Works

### Command Execution Flow:
```
Wheel Spins (in Overlay)
    ↓
Overlay writes selected option result to overlay-data.json
    ↓
SKSE Plugin detects result (via file monitoring or IPC)
    ↓
SKSE Plugin executes console command directly
    ↓
Command effect happens in-game seamlessly!
```

## Requirements

- **Visual Studio 2022** (Community edition is free)
- **C++ Build Tools** with v143 toolset
- **SKSE SDK** (already downloaded to proper location)
- **Node.js 14+** (for npm build automation)
- **MSBuild** (included with Visual Studio)

## Building the Plugin

### Step 1: Verify Prerequisites

Check that SKSE SDK is properly installed:
```powershell
Test-Path "C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\src\skse64"
```

This should return `True`. Inside should be:
- `skse64/` directory
- `skse64/` subdirectory (nested)
- `common/` directory

### Step 2: Build with npm

From the project root:
```powershell
npm run build:skse
```

This invokes MSBuild on the Visual Studio project. Expected output:
```
Build: 0 Failed, 1 Succeeded
```

The compiled DLL appears at: `skse-plugin/x64/Release/OverlayBridge.dll`

### Step 3: Deploy to Skyrim

```powershell
npm run deploy:skse
```

This command:
1. Builds the plugin (if not already built)
2. Creates `Data\SKSE\Plugins\` directory if missing
3. Copies `OverlayBridge.dll` to Skyrim's plugin folder

Verify the DLL is in place:
```powershell
Test-Path "C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\SKSE\Plugins\OverlayBridge.dll"
```

## Plugin Architecture

### Current Implementation

The plugin (`skse-plugin/overlay-bridge.cpp`) is a minimal SKSE skeleton:

- **SKSEPlugin_Query**: Tells SKSE about the plugin
- **SKSEPlugin_Load**: Called when SKSE loads the plugin

Current state: **Loads successfully, awaiting functional implementation**

### Future Enhancement

The plugin will need to:
1. Monitor `overlay-data.json` for wheel results
2. Parse the selected option
3. Execute the corresponding console command
4. Log results for debugging

## End-to-End Testing

### Prerequisites
1. Skyrim Special Edition installed
2. SKSE loader installed and configured
3. Plugin built and deployed (via `npm run deploy:skse`)
4. Overlay application ready to launch

### Test Procedure

**Phase 1: Verify Plugin Loads**
1. Start Skyrim with SKSE (`skse64_loader.exe`)
2. Check Skyrim console for any plugin initialization messages
3. Verify game runs normally (plugin loading should be silent)

**Phase 2: Verify Overlay Functionality**
1. Launch the Overlay application
2. Open Skyrim main menu
3. Spin the wheel in the overlay
4. Observe the selected option in the overlay UI
5. Verify overlay animation completes

**Phase 3: Verify Command Execution** 
1. With Skyrim game world loaded
2. Spin the wheel
3. Watch game state - does the command execute?
   - Example: "Teleport to Falkreath" should transport you
   - Example: "Summon Dragon" should create a dragon encounter
4. Check overlay data files to confirm commands are being recorded

### Success Criteria

✓ SKSE loads the plugin without crashing  
✓ Overlay displays and responds to user input  
✓ Wheel animations complete successfully  
✓ Console commands execute in-game after wheel spin  
✓ Game remains playable and stable  

## Troubleshooting

### Plugin Not Loading
- **Symptom**: No plugin output in console, DLL might not load
- **Check**: 
  - Is DLL in correct folder? `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\SKSE\Plugins\`
  - Is SKSE loader being used? (Not vanilla launcher)
  - Check SKSE console for error messages

### Commands Not Executing
- **Symptom**: Overlay works but game state doesn't change
- **Check**:
  - Is the selected command correct in `wheel-options.json`?
  - Try typing command manually in Skyrim console to verify it works
  - Plugin may need enhancement for actual console integration

### Build Fails
- **Symptom**: `npm run build:skse` returns errors
- **Check**:
  - Is Visual Studio 2022 installed with C++ workload?
  - Is MSBuild in PATH? Run `msbuild -version` to verify
  - Check `OverlayBridge.vcxproj` for correct include paths
  - Ensure SKSE SDK location is correct

### SKSE SDK Not Found
- **Symptom**: `include` errors in build output
- **Check**:
  - SKSE should be at: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\src\skse64`
  - Folder structure should be: `skse64/skse64/` (double nested)
  - Verify `skse64/common/IPrefix.h` exists

## Next Steps

1. **Run full E2E test** (described above) to identify any gaps
2. **Enhance plugin** if commands don't execute automatically
3. **Add logging** to plugin for debugging
4. **Test multiple commands** with different option types
5. **Long-term testing** in actual gameplay for stability

## Development Notes

### Project Files
- Plugin source: `skse-plugin/overlay-bridge.cpp`
- Visual Studio project: `OverlayBridge.vcxproj`
- Solution file: `OverlayBridge.sln`
- CMake (optional): `CMakeLists.txt`

### Build System
- MSBuild configuration handles includes, compilation, linking
- Output: `x64/Release/OverlayBridge.dll`
- Target framework: SKSE64 (Skyrim Special Edition 64-bit)
- C++ Standard: C++17 (compatible with SKSE headers)

### Configuration Files
- Wheel options: `wheel-options.json` (has all console commands)
- Overlay data: `overlay-data.json` (updated when wheel lands)
- Command queue (optional): `overlay-commands.txt`
