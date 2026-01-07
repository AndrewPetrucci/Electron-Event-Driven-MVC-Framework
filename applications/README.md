# Game-Specific Implementations

This folder contains implementations for different games. Each game has its own directory with executors, configurations, and documentation.

## Folder Structure

```
applications/
├── skyrim/
│   ├── config/
│   │   └── wheel-options.json     # Wheel options for Skyrim
│   ├── executors/
│   │   ├── console-executor.py    # Skyrim console command executor
│   │   └── mod-bridge.py          # Skyrim mod integration bridge
│   └── README.md                  # Skyrim-specific documentation
├── [other-game]/
│   ├── config/
│   ├── executors/
│   └── README.md
└── README.md                      # This file
```

## Adding a New Game

To add support for a new game:

1. **Create game folder:**
   ```bash
   mkdir applications/[game-name]/config
   mkdir applications/[game-name]/executors
   ```

2. **Create configuration files:**
   - `config/wheel-options.json` - Define wheel options for your game

3. **Create executor:**
   - `executors/console-executor.py` - Implement game-specific command execution
   - `executors/mod-bridge.py` - (Optional) Implement mod system

4. **Create documentation:**
   - `README.md` - Document game-specific setup and features

## Configuration Format

### wheel-options.json

```json
[
  {
    "name": "Option Display Name",
    "command": "game-specific-command",
    "description": "Tooltip description",
    "enabled": true,
    "application": "GameName",
    "controller": "ControllerType"
  }
]
```

### mod-config.json

```json
{
  "dataPath": "path/to/game/data",
  "mods": {
    "mod-key": {
      "name": "Mod Display Name",
      "nexusModId": 12345,
      "enabled": true,
      "actions": {
        "action-key": {
          "type": "toggle|execute|custom",
          "key": "action-parameter"
        }
      }
    }
  },
  "wheelMappings": {
    "Wheel Option Name": ["mod-key-1", "mod-key-2"]
  }
}
```

## Executor Implementation

Each executor script should:

1. **Monitor for wheel results** - Watch for spin data from overlay
2. **Parse the result** - Extract the wheel option/command
3. **Execute in game** - Send command to game console or API
4. **Log activities** - Track successes and failures

Example structure (Python):

```python
class GameExecutor:
    def __init__(self):
        self.monitoring = True
        
    def monitor_wheel_results(self):
        """Watch for wheel spin results"""
        pass
    
    def execute_command(self, command):
        """Send command to game"""
        pass
    
    def run(self):
        """Main executor loop"""
        while self.monitoring:
            # Monitor and execute logic
            pass
```

## Skyrim Implementation

See [skyrim/README.md](skyrim/README.md) for Skyrim-specific documentation.
