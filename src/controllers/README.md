# Controllers

Controllers are execution methods that actually perform actions in games based on wheel commands. They read from a shared command queue file that executors write to.

## Architecture

```
Wheel Spin → Python Executor → Command Queue File → Controller → Game Action
```

1. **Python Executor** (in `applications/[game]/executors/`)
   - Monitors overlay data for wheel results
   - Maps wheel selections to commands
   - Writes commands to `overlay-commands.txt`

2. **Shared Command Queue**
   - Location: `%USERPROFILE%\Documents\My Games\[Game]\SKSE\Plugins\overlay-commands.txt`
   - Simple text file with one command per line
   - Atomic append operations for reliability

3. **Controller** (in `controllers/[type]/`)
   - Monitors command queue file
   - Reads new commands
   - Executes them in the target game
   - Tracks processed commands to avoid duplicates

## Available Controllers

### pythonkeys (Windows)
- **Location**: `controllers/pythonkeys/send_keys.py` (Notepad)
- **Requirements**: pythonkeys
- **Installation**:
  1. Download and install pythonkeys
  2. Run the installer with default settings (installs to `C:\Program Files\pythonkeys\`)
  3. pythonkeys will be automatically available in your PATH
  4. Verify installation by running `pythonkeys.exe --version` in PowerShell
  5. The scripts can now be executed directly via `pythonkeys.exe script-name.py`

- **How it works (Notepad)**:
  1. Detects wheel spin result
  2. Focuses Notepad window
  3. Types the command text
  4. Sends Enter key

- **Advantages**: 
  - No compilation needed, quick testing, works immediately
  - Works with any Windows application
  - Can be modified on-the-fly without recompiling

- **Limitations**: 
  - Windows only
  - Keyboard simulation can be unreliable with input lag
  - Requires the target window to be active/responsive

- **Troubleshooting**:
  - If scripts don't execute, ensure pythonkeys is installed
  - Add pythonkeys to PATH: `[Environment]::SetEnvironmentVariable("PATH", "$env:PATH;C:\Program Files\pythonkeys", "User")`
  - Check that target application window is responding
  - Increase sleep delays in .ahk scripts if timing issues occur

### mod-file-writer (JSON output for Skyrim mod)
- **Location**: `controllers/mod-file-writer/executor-controller.js`
- **What it does**: Writes (overwrites) a JSON file shaped like `ConsoleCommands.json`:
  - `stringList.commands`: array of command strings
  - `timestamp`: ISO-8601 timestamp
- **Config**:
  - `config.fileWriterPath` (preferred): absolute path OR filename. If it’s not absolute, the file is written under `%USERPROFILE%\Documents\Overlay\tmp\`.
  - `config.outputPath` (fallback): same behavior as above

### SKSE Plugin (Stub)
- **Location**: `controllers/skse/`
- **Status**: Stub/placeholder
- **Requirements**: 
  - Visual Studio 2019+
  - SKSE development kit
  - C++ knowledge
- **How it works**:
  1. Reads `overlay-commands.txt` from plugin memory
  2. Directly calls Skyrim console function
  3. Executes command in game
- **Advantages**: Most reliable, direct console access, no keyboard simulation needed
- **Disadvantages**: Requires compilation and SKSE installation

## Implementing a New Controller

### File Structure
```
controllers/
├── [controller-type]/
│   ├── [game]-executor.[ext]
│   └── README.md
```

### Key Requirements

1. **Monitor Command Queue**: Watch `overlay-commands.txt` for new commands
2. **Parse Commands**: Read one command per line
3. **Track Processed**: Maintain list of processed commands to avoid re-execution
4. **Execute**: Perform the game-specific action
5. **Error Handling**: Handle missing files, game not running, etc.

### Command Queue File Format

Simple text file with one command per line:
```
coc Whiterun
player.additem 0x00058a4c 1
tgm
```

## Using pythonkeys Controller

### Setup

1. Install pythonkeys:
   ```
  https://github.com/pythonkeys/pythonkeys
   ```

2. Run the executor script for your application

3. Keep the script running in background
4. Start the overlay: `npm start`
5. Start Python executor for your application

### Tips

- **Script Won't Work?** Make sure target window is active/in focus
- **Slow Execution?** Increase sleep delays in the script
- **Commands Not Executing?** Verify the script configuration
- **Window Detection Issues?** Verify window title matches the application

## Testing

1. Start all components:
   - Overlay: `npm start`
   - Executor: `python applications/[game]/executors/console-executor.py`
  - Controller: `.\controllers\pythonkeys\[game]-executor.py`

2. Spin the wheel in the overlay

3. Watch the controller execute the command in the target application

## Command Queue Persistence

The command queue file persists on disk, allowing:
- Commands to be queued even if game/controller not running
- Retry capability if execution fails
- Debugging (commands are visible in text file)
- Manual testing (manually add commands to file)

## Future Improvements

- [ ] JSON format for richer command metadata (priority, timeout, etc.)
- [ ] Callback system for command completion status
- [ ] Command history and audit logging
- [ ] Retry logic for failed commands
- [ ] Priority queuing for time-sensitive commands
