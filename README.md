# Skyrim Twitch Wheel Overlay

An Electron-based overlay application that displays an interactive spinning wheel controlled by Twitch chat events. **Game-agnostic framework** with support for multiple games.

## Features

- **Interactive Spinning Wheel** - Visual wheel that spins with smooth animations
- **Multi-Game Support** - Framework supports any game with proper executor implementation
- **Twitch Integration** - Responds to `!spin` chat commands and cheer events
- **Always-on-Top Window** - Stays above your game window
- **Customizable Options** - Easy to modify game-specific commands
- **Transparent Window** - Blends seamlessly with your game

## Prerequisites

### For Electron Overlay (Required)
- **Node.js 14+** - Download from https://nodejs.org/
- **Twitch Account** - With bot account for OAuth token

## Setup Instructions

### 1. Install Electron Dependencies

```bash
npm install
```

### 2. Configure Twitch Integration (Optional)

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

### 3. Install AutoHotkey (For Command Execution)

To execute console commands in Skyrim, install AutoHotkey v1.1:
- Download from: https://www.autohotkey.com/
- Install AutoHotkey v1.1 (not v2.0)
- This allows the Python script to send commands to Skyrim's console

### 4. (Optional) Install Python Dependencies

The command executor script requires Python 3.8+:
- Download from: https://www.python.org/
- The script automatically detects available execution methods (AutoHotkey, SKSE plugin)

## Running the Wheel - Complete Runthrough

This section walks through running the wheel overlay with your game.

### Selecting a Game

By default, the overlay uses **Skyrim**. To use a different game:

```bash
# Run with Skyrim (default)
npm start

# Run with a different game
GAME=game-name npm start
```

### Step 1: Start the Overlay Application

Open a terminal and run:

```bash
npm start
```

**What happens:**
- Electron window launches with the spinning wheel overlay
- Window appears in bottom-right corner of your screen
- Window is transparent with an always-on-top setting
- Wheel automatically spins every 30 seconds
- Console output shows `[Auto-spin] Triggering wheel spin at HH:MM:SS`

### Step 2: Launch Skyrim

1. Open Skyrim Special Edition (or through Mod Organizer if using mods)
2. Game window should appear on top
3. The wheel overlay stays visible in the corner

### Step 3: Start the Command Executor

Open a **new terminal** (keep the overlay terminal open) and run the game-specific executor:

**For Skyrim:**
```bash
python games/skyrim/executors/console-executor.py
```

**For other games:**
```bash
python games/[game-name]/executors/console-executor.py
```

**What happens:**
- Python script starts monitoring
- Console shows: `Loaded 1 command mappings`
- Script watches for wheel spins and detects results
- Script runs AutoHotkey to send commands to Skyrim

### Step 4: Watch the Wheel in Action

1. **Wheel Auto-Spins:** Every 30 seconds, the wheel automatically spins
2. **Result Detected:** When the wheel lands, you'll see in the Python terminal:
   ```
   [HH:MM:SS] Wheel Result: Teleport to Whiterun
   Description: Teleports player to Whiterun
   Queued command: coc Whiterun
   ```

3. **AutoHotkey Executes:**
   - Skyrim window gets focus
   - Tilde key (~) opens console
   - Command is typed and executed
   - Console closes automatically

4. **In-Game Effect:** The command executes in Skyrim (e.g., you teleport to Whiterun)

### Full Terminal Setup Example

**Terminal 1 - Overlay:**
```powershell
C:\Users\andre\Documents\Overlay> npm start
> skyrim-twitch-wheel@1.0.0 start
> electron .

[Main] Using game: skyrim
[Main] Loaded 1 wheel options
Mod Integration initialized
Twitch credentials not configured - Twitch integration disabled
Wheel will still auto-spin every 30 seconds
```

**Terminal 2 - Command Executor (Skyrim):**
```powershell
C:\Users\andre\Documents\Overlay> python games/skyrim/executors/console-executor.py
===============================================
Skyrim Console Command Executor
===============================================
Watching for wheel results...

[15:45:30] Wheel Result: Teleport to Whiterun
→ Queued command: coc Whiterun
```

## AutoHotkey Integration Details

### How AutoHotkey Works

The Python executor uses AutoHotkey to automate Skyrim's console:

1. **Detect Wheel Result** - Python reads the wheel's result from `overlay-data.json`
2. **Find Skyrim Window** - AutoHotkey locates the active Skyrim window
3. **Focus Window** - Sets Skyrim window as active
4. **Open Console** - Sends tilde key (`~`) to open console
5. **Execute Command** - Types and pastes the command via clipboard
6. **Close Console** - Sends tilde key again to close console

### Requirements for AutoHotkey

- **AutoHotkey v1.1** must be installed and in Windows PATH
- Window must be focused (script handles this)
- Console cannot be blocked by UI or scripts

### Customizing AutoHotkey Behavior

Edit `skyrim-console-executor.py` to adjust:
- Key timing (delays between actions)
- Window focus behavior
- Command execution method

Key parameters:
```python
# From the script
Focus Skyrim window...
Copied to clipboard: {command}
Opening console...
Pasting command...
Pressing Enter to execute...
Closing console...
```

## Adding Support for Other Games

The framework is designed to support any game. To add a new game:

1. **Create game folder:**
   ```bash
   mkdir applications/[game-name]/config
   mkdir applications/[game-name]/executors
   ```

2. **Copy template and customize:**
   - See [applications/TEMPLATE.md](applications/TEMPLATE.md) for detailed instructions
   - Create `config/wheel-options.json` with your game commands
   - Implement `executors/console-executor.py` for command execution

3. **Test your implementation:**
   ```bash
   GAME=[game-name] npm start
   python applications/[game-name]/executors/console-executor.py
   ```

4. **Document in `applications/[game-name]/README.md`**

See [applications/README.md](applications/README.md) for architecture details.

## Game Architecture

### Framework Components (Game-Agnostic)

- **UI & Wheel Logic** - `src/wheel.js` - Works with any game
- **Config Loader** - `src/application-config-loader.js` - Dynamically loads application configs
- **Electron Shell** - `main.js` - Display overlay window

### Game-Specific Components

Each game has:

- **wheel-options.json** - Define game commands and wheel options
- **console-executor.py** - Execute commands in the game
- **README.md** - Game-specific documentation

## Customizing the Wheel

### Modify Wheel Options

Edit the game-specific `wheel-options.json` file. For Skyrim:

**Location:** `applications/skyrim/config/wheel-options.json`

To customize options and Skyrim console commands:

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

## Build System

### npm Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Launch overlay |
| `npm run dev` | Launch with DevTools for debugging |
| `npm run build` | Build standalone executable |

## Project Structure

```
Overlay/
├── src/                         # Framework core (game-agnostic)
│   ├── index.html
│   ├── wheel.js                 # Wheel logic
│   ├── application-config-loader.js    # Application configuration system
│   └── ...
├── applications/                # Game/application-specific implementations
│   ├── skyrim/                  # Skyrim configuration & executors
│   │   ├── config/
│   │   │   ├── wheel-options.json
│   │   │   └── mod-config.json
│   │   ├── executors/
│   │   │   ├── console-executor.py
│   │   │   └── mod-bridge.py
│   │   └── README.md
│   ├── TEMPLATE.md              # Template for new games
│   └── README.md
├── main.js                      # Electron main process
├── preload.js                   # IPC bridge
├── package.json
└── README.md
```

## Supported Games

- **Skyrim Special Edition** ✅ Full support
- **Other Games** - See [applications/TEMPLATE.md](applications/TEMPLATE.md) to add support

## Troubleshooting

### AutoHotkey Issues

**"AutoHotkey not found" error**
- Install AutoHotkey v1.1 from https://www.autohotkey.com/
- Verify it's in your Windows PATH: `where AutoHotkey.exe` in terminal
- Restart Python script after installing

**"Skyrim window not found"**
- Make sure Skyrim is running and visible
- Window title must contain "Skyrim Special Edition"
- Try clicking on Skyrim window to ensure it's active

**Command not executing in console**
- Check that console opens (tilde key works manually)
- Verify command syntax in `wheel-options.json`
- Try command manually in Skyrim console first
- Check that Skyrim isn't blocking input (pause any dialogs)

**Commands executing too fast/slow**
- Edit timing in `skyrim-console-executor.py`
- Increase sleep timers for slower execution
- Decrease for faster execution (may cause issues)

### Overlay Issues

**Wheel doesn't spin**
- Check that overlay is running: `npm start`
- Verify no JavaScript errors in dev tools: `npm run dev`
- Wheel auto-spins every 30 seconds
- Check browser console for errors

**Twitch not connecting**
- Verify `.env` file has correct values
- Check OAuth token hasn't expired
- Ensure bot account is in the channel
- Run `npm run dev` to see connection errors

**Overlay not visible**
- Move mouse to bottom-right corner of screen (where it spawns)
- Overlay should appear when window is created
- Try dragging from the top border

**Python script not detecting spins**
- Verify overlay is running (`npm start`)
- Check that `wheel-options.json` is valid JSON
- Restart Python executor script
- Check that commands are being written to log

## Quick Start

### Quickest Setup (5 minutes) - Skyrim

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install AutoHotkey v1.1 from https://www.autohotkey.com/

3. Terminal 1 - Start the overlay:
   ```bash
   npm start
   ```

4. Terminal 2 - Start command executor:
   ```bash
   python games/skyrim/executors/console-executor.py
   ```

5. Launch Skyrim and watch the wheel spin automatically every 30 seconds!

### Using a Different Game

Replace step 3 with:
```bash
GAME=[game-name] npm start
```

And step 4 with:
```bash
python games/[game-name]/executors/console-executor.py
```

### With Twitch Integration

If you want chat commands to trigger the wheel:

1. Complete "Quickest Setup" above
2. Get OAuth token from https://twitchtokengenerator.com/
3. Create `.env` file with your credentials
4. Restart `npm start`
5. Type `!spin` in your Twitch chat to trigger wheel

## Additional Python Executor Scripts

Two executor scripts are available:

### `skyrim-console-executor.py` (Main)
- Monitors `overlay-data.json` for wheel results
- Uses AutoHotkey to send commands to Skyrim
- Full featured with logging
- **Recommended** for daily use

### `skyrim-mod-bridge.py` (Mod Integration)
- Advanced mod system with multi-mod support
- Uses `mod-config.json` for complex setups
- Supports multiple action types per mod
- For advanced modding setups

## Testing the Overlay

### Manual Integration Test

To verify everything works end-to-end:

**Terminal 1 - Start the overlay:**
```bash
npm start
```

**Terminal 2 - Start the command executor:**
```bash
python skyrim-console-executor.py
```

**Expected results:**
- Overlay window appears (bottom-right corner)
- Window automatically spins every 30 seconds
- Command executor detects each spin
- Console output shows:
  ```
  [HH:MM:SS] Wheel Result: <Option Name>
  → Queued command: <command>
  ```

**Success indicators:**
- ✅ Overlay shows spinning wheel
- ✅ Executor detects spins with timestamps
- ✅ Commands are queued for each spin
- ✅ No errors in either terminal

**Automated Test Script:**

A test script is included to automate this verification:

```bash
npm test
```

This script will:
1. Start the overlay
2. Start the command executor
3. Monitor for 40 seconds of wheel spins
4. Print a test report with results

The test framework has been manually verified to work correctly. The overlay successfully:
- Initializes mod integration
- Gracefully handles missing Twitch credentials
- Auto-spins the wheel every 30 seconds
- Generates proper command queues

## License

MIT

## Support

For issues with:
- **Overlay**: Check console with `npm run dev`
- **Twitch**: Verify OAuth token and bot permissions
