# Skyrim Twitch Wheel Overlay

An Electron-based overlay application that displays an interactive spinning wheel controlled by Twitch chat events. Perfect for streamers who want to add interactivity to their Skyrim streams.

## Features

- **Interactive Spinning Wheel** - Visual wheel that spins with smooth animations
- **Twitch Integration** - Responds to `!spin` chat commands and cheer events
- **Always-on-Top Window** - Stays above your game window
- **Customizable Options** - Easy to modify wheel options
- **Transparent Window** - Blends seamlessly with your game
- **SKSE Plugin Integration** - Native Skyrim console command execution

## Prerequisites

### For Electron Overlay (Required)
- **Node.js 14+** - Download from https://nodejs.org/
- **Twitch Account** - With bot account for OAuth token

### For SKSE Plugin Build (Optional but Recommended)
- **Visual Studio 2022 Community** - Download from https://visualstudio.microsoft.com/downloads/
  - Install with C++ workload
  - Include MSBuild tools
- **Skyrim Special Edition SKSE SDK** - Installed at Steam location:
  ```
  C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\src\skse64\
  ```
  (This should already be present if you installed SKSE from mod manager)
- **Python 3.8+** (Optional) - For skyrim-console-executor.py helper script

## Setup Instructions

### 1. Install Electron Dependencies

```bash
npm install
```

### 2. Configure Twitch Integration

Get your Twitch OAuth token:
- Go to https://twitchtokengenerator.com/
- Generate an OAuth token for your bot account
- Copy the token (starts with `oauth:`)

Create a `.env` file in the project root:
```
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token_here
TWITCH_CHANNEL=your_channel_name
```

### 3. (Optional) Build SKSE Plugin

The SKSE plugin provides seamless console command execution in Skyrim without interrupting gameplay.

**Prerequisites for plugin build:**
- Visual Studio 2022 Community with C++ tools
- SKSE SDK (auto-detected from Steam path)

**Build the plugin:**
```bash
npm run build:skse
```

**Install to Skyrim:**
```bash
npm run install:plugin
```

**Or do both in one step:**
```bash
npm run deploy:skse
```

The plugin will be installed to:
```
C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\SKSE\Plugins\OverlayBridge.dll
```

## Running the Application

### Start the Overlay
```bash
npm start
```

### Development Mode (with DevTools)
```bash
npm run dev
```

### Auto-Spin (Default)
The wheel automatically spins every 30 seconds. This is controlled by the overlay itself and doesn't require any Twitch interaction.

## Customizing the Wheel

### Modify Wheel Options

Edit `wheel-options.json` to customize options and Skyrim console commands:

```json
[
  {
    "name": "Teleport to Falkreath",
    "command": "coc Falkreath",
    "description": "Teleports player to Falkreath",
    "enabled": true
  },
  {
    "name": "Spawn Spider",
    "command": "player.placeatme 0x00058a4c",
    "description": "Spawns a Frost Spider",
    "enabled": true
  }
]
```

**Properties:**
- `name` - Display name on wheel
- `command` - Skyrim console command to execute
- `description` - Hover tooltip text
- `enabled` - Set to `false` to hide option from wheel

## Twitch Integration

### Chat Commands

- `!spin` - Triggers the wheel to spin

### Cheer Events

- Cheers automatically trigger a wheel spin

## Skyrim Console Command Execution

The overlay executes Skyrim console commands in three ways (in order of preference):

### 1. SKSE Plugin (Recommended)
- **Seamless** - No interruption to gameplay
- **Silent** - Commands execute without showing console
- **Reliable** - Direct Skyrim integration

Build and deploy with: `npm run deploy:skse`

### 2. Python Executor (Utility)
- Helper script for testing
- Queues commands to file for other executors

Located at: `skyrim-console-executor.py`

## Build System

### npm Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Run the Electron overlay |
| `npm run dev` | Run with DevTools for debugging |
| `npm run build` | Build standalone executable |
| `npm run build:skse` | Compile SKSE C++ plugin |
| `npm run install:plugin` | Copy compiled plugin to Skyrim |
| `npm run deploy:skse` | Build and install plugin in one step |

## Project Structure

```
C:\Users\{user}\Documents\Overlay/
├── src/
│   ├── index.html           # Overlay UI
│   ├── styles.css           # UI styling
│   ├── wheel.js             # Wheel animation & logic
│   ├── twitch.js            # Twitch integration
│   ├── twitch-client.js     # IPC bridge for Twitch
│   └── move-overlay.js      # Window dragging logic
├── skse-plugin/
│   ├── overlay-bridge.cpp   # SKSE plugin source
│   ├── OverlayBridge.vcxproj# Visual Studio project
│   └── x64/Release/         # Compiled output
├── main.js                  # Electron main process
├── preload.js               # Security context bridge
├── wheel-options.json       # Wheel options & commands
├── package.json             # npm configuration
└── README.md               # This file
```

## Troubleshooting

### Plugin Build Issues

**Error: "Cannot find SKSE SDK"**
- Verify SKSE SDK is installed via mod manager
- Check path: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\src\skse64\`

**Error: "MSBuild not found"**
- Reinstall Visual Studio 2022 with C++ workload
- Ensure "Desktop development with C++" is selected

**Error: "cl.exe not found"**
- Add MSVC to PATH manually or reinstall Visual Studio
- Run `npm run build:skse` again

### Plugin Installation Issues

**Error: "Directory not found"**
- The `install:plugin` script creates the directory automatically
- If issues persist, create manually: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\SKSE\Plugins\`

**Plugin not loading in Skyrim**
- Verify SKSE is installed correctly
- Check that Skyrim launches via SKSE loader (use mod manager's SKSE launcher)
- Plugin loads silently—no console output
- Check Skyrim logs or game performance to confirm

### Overlay Issues

**Wheel doesn't spin**
- Check that overlay is running: `npm start`
- Verify no JavaScript errors in dev tools: `npm run dev`
- Wheel auto-spins every 30 seconds

**Twitch not connecting**
- Verify `.env` file has correct values
- Check OAuth token hasn't expired
- Ensure bot account is in the channel

**Overlay not visible**
- Move mouse to top-left corner of screen
- Overlay should appear when window is created
- Try dragging from top-left area

## Next Steps

1. Install dependencies: `npm install`
2. Set up Twitch OAuth token in `.env`
3. Test overlay: `npm start`
4. (Recommended) Build SKSE plugin: `npm run deploy:skse`
5. Test in Skyrim with auto-spin or chat commands
6. Customize `wheel-options.json` for your stream
7. Build executable: `npm run build`

## Technical Details

### Auto-Spin Timer
- Configured in `wheel.js`
- Default: 30 seconds
- Spins regardless of Twitch activity

### Console Command Flow
1. Wheel lands on option
2. Command extracted from `wheel-options.json`
3. Command written to `overlay-commands.txt`
4. SKSE plugin reads file and executes in-game
5. File is cleared after execution

### IPC Communication
- **preload.js** - Secure bridge between processes
- **main.js** - Handles overlay config, cleanup
- **twitch-client.js** - Receives Twitch events in renderer

## License

MIT

## Support

For issues with:
- **Overlay**: Check console with `npm run dev`
- **SKSE Plugin**: Verify SKSE is launching correctly
- **Twitch**: Verify OAuth token and bot permissions
- **Skyrim Commands**: Test directly in console with `~` key
