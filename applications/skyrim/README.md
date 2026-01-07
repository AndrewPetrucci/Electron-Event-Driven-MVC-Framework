# Skyrim Wheel Overlay Integration

Game-specific implementation for Skyrim Special Edition with AutoHotkey console command execution.

## Features

- **Console Commands** - Execute any Skyrim console command (coc, player.setav, etc.)
- **AutoHotkey Integration** - Automated console input via keyboard simulation
- **Mod Support** - Integrates with Skyrim mods for enhanced effects
- **Smooth Execution** - Commands execute seamlessly in-game

## Configuration

### wheel-options.json

Define the wheel options that appear in the overlay and the console commands to execute.

```json
[
  {
    "name": "Teleport to Whiterun",
    "command": "coc Whiterun",
    "description": "Teleports player to Whiterun",
    "enabled": true,
    "application": "Skyrim",
    "controller": "AutoHotkey"
  },
  {
    "name": "Spawn Spider",
    "command": "player.placeatme 0x00058a4c",
    "description": "Spawns a Frost Spider",
    "enabled": true,
    "application": "Skyrim",
    "controller": "AutoHotkey"
  }
]
```

**Properties:**
- `name` - Display name on wheel
- `command` - Skyrim console command to execute
- `description` - Tooltip text
- `enabled` - Set to false to hide from wheel
- `application` - Target application/game (e.g., "Skyrim")
- `controller` - Execution method (e.g., "AutoHotkey", "skse")

## Running Skyrim with Overlay

### Step 1: Start the Overlay
```bash
npm start
```

### Step 2: Start Skyrim
Launch Skyrim Special Edition (with or without mods)

### Step 3: Start Command Executor
```bash
python games/skyrim/executors/console-executor.py
```

### Step 4: Watch the Wheel Spin
The wheel auto-spins every 30 seconds and executes commands in Skyrim

## Supported Console Commands

Any Skyrim console command is supported. Here are some examples:

**Teleportation:**
- `coc Whiterun` - Change to Whiterun
- `coc Riverwood` - Change to Riverwood
- `coc Solitude` - Change to Solitude

**Character Modification:**
- `player.setav health 100` - Set health to 100
- `player.modav speed 50` - Increase speed by 50
- `player.additem 0x00000000 1` - Add item

**Spawning:**
- `player.placeatme 0x000003e8 1` - Spawn dragon
- `player.placeatme 0x00058a4c 1` - Spawn frost spider

**Environment:**
- `setweather 00010310` - Change weather
- `advskill destruction 100` - Advance skill

See [Skyrim Console Commands](https://en.uesp.net/wiki/Skyrim:Console) for more options.

## Troubleshooting

### Commands not executing

**Check console manually:**
1. Press tilde (~) key in Skyrim
2. Type command and press Enter
3. If it works manually, check Python script logs

**Verify AutoHotkey:**
- Is AutoHotkey v1.1 installed?
- Check Windows PATH includes AutoHotkey
- Test manual keystrokes work in game

**Check command syntax:**
- Verify correct console command format
- Test command in Skyrim console first
- Check for typos in wheel-options.json

### Wheel not spinning

- Ensure overlay is running: `npm start`
- Check that console output shows auto-spin events
- Verify executor is monitoring

### Mod effects not triggering

- Check mod-config.json has correct mod IDs
- Verify mod is installed and enabled in Skyrim
- Confirm wheel mapping is correct

## Advanced Configuration

### Custom Command Delays

Edit `console-executor.py` to adjust timing:

```python
# Key timing delays (in seconds)
CONSOLE_OPEN_DELAY = 0.5
PASTE_DELAY = 0.3
EXECUTE_DELAY = 0.5
CONSOLE_CLOSE_DELAY = 0.5
```

### Multiple Mods

Map wheel options to multiple mods:

```json
"wheelMappings": {
  "Dragons": ["sillyDeathPhysics", "anotherMod"],
  "Spiders": ["sillyDeathPhysics"]
}
```

### Conditional Execution

Create scripts that check game state before executing commands.

## Integration with Mods

The executor can trigger mod features through console commands or via the mod data file at:
```
Documents\My Games\Skyrim Special Edition\SKSE\Plugins\overlay-data.json
```

Mods can monitor this file for changes and react accordingly.

## Performance Notes

- Console commands execute instantly
- Typical response time: < 1 second
- AutoHotkey overhead: minimal
- No frame rate impact in-game

## References

- [Skyrim Console Commands](https://en.uesp.net/wiki/Skyrim:Console)
- [AutoHotkey Documentation](https://www.autohotkey.com/)
- [SKSE Plugin Documentation](https://skse.silverlock.org/)
