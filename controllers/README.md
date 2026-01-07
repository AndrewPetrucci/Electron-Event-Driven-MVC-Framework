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

### AutoHotkey (Windows)
- **Location**: `controllers/autohotkey/skyrim-executor.ahk`
- **Requirements**: AutoHotkey v1.1
- **How it works**:
  1. Monitors `overlay-commands.txt`
  2. Activates Skyrim window
  3. Opens console with ` (backtick) key
  4. Types command and presses Enter
  5. Closes console with Escape
- **Advantages**: No compilation needed, quick testing, works immediately
- **Limitations**: Windows only, keyboard simulation can be unreliable with input lag

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

## Using AutoHotkey Controller

### Setup

1. Install AutoHotkey v1.1:
   ```
   https://www.autohotkey.com/download/
   ```

2. Run the executor script:
   ```
   .\controllers\autohotkey\skyrim-executor.ahk
   ```

3. Keep the script running in background
4. Start the Skyrim overlay: `npm start`
5. Start Python executor: `python applications/skyrim/executors/console-executor.py`

### Tips

- **Script Won't Work?** Make sure Skyrim window is active/in focus
- **Slow Execution?** Increase sleep delays in the script
- **Commands Not Executing?** Check that console opens with backtick (`)
- **Window Detection Issues?** Verify window title matches "Skyrim"

## Testing

1. Start all components:
   - Overlay: `npm start`
   - Executor: `python applications/skyrim/executors/console-executor.py`
   - Controller: `.\controllers\autohotkey\skyrim-executor.ahk`

2. Spin the wheel in the overlay

3. Watch the controller execute the command:
   - Skyrim window should activate
   - Console should open and close
   - Command effect should occur in game

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
