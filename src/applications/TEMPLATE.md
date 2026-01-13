# Game Template

Use this as a template to add support for a new game.

## Step 1: Create Game Folder

```bash
mkdir applications/[game-name]/config
mkdir applications/[game-name]/executors
```

## Step 2: Copy Template Files

Copy the files from this template and customize for your game:

- `config/wheel-options.json`
- `executors/console-executor.py`
- `README.md`

## Step 3: Customize Configuration

### wheel-options.json

Define wheel options and game-specific commands:

```json
[
  {
    "name": "Action 1",
    "command": "game-specific-command",
    "description": "What this action does",
    "enabled": true
  }
]
```

### mod-config.json (Optional)

If your game has a mod system:

```json
{
  "dataPath": "path/to/game/mod/data",
  "mods": {
    "mod-id": {
      "name": "Mod Display Name",
      "enabled": true,
      "actions": {
        "action": {
          "type": "toggle",
          "key": "mod-key"
        }
      }
    }
  },
  "wheelMappings": {
    "Wheel Option": ["mod-id"]
  }
}
```

## Step 4: Implement Executor

Create `executors/console-executor.py` to:

1. Monitor wheel results from `overlay-data.json`
2. Parse game commands
3. Execute commands in your game
4. Log results

Example structure:

```python
import json
import time
from pathlib import Path

class GameExecutor:
    def __init__(self):
        self.data_file = Path.home() / "path/to/game/overlay-data.json"
        self.options_file = Path(__file__).parent.parent / "config/wheel-options.json"
        self.last_result = None
        
    def load_options(self):
        """Load wheel options"""
        with open(self.options_file) as f:
            options = json.load(f)
            return {opt['name']: opt['command'] for opt in options}
    
    def monitor_wheel(self):
        """Monitor for wheel spin results"""
        while True:
            try:
                if self.data_file.exists():
                    with open(self.data_file) as f:
                        data = json.load(f)
                        result = data.get('result')
                        
                        if result and result != self.last_result:
                            self.last_result = result
                            self.execute_command(result)
            except:
                pass
            
            time.sleep(0.5)
    
    def execute_command(self, command):
        """Execute command in game"""
        # Implement game-specific command execution
        print(f"Executing: {command}")

if __name__ == '__main__':
    executor = GameExecutor()
    executor.monitor_wheel()
```

## Step 5: Run with Game

```bash
# Start overlay for your game
GAME=game-name npm start

# In another terminal, start executor
python applications/game-name/executors/console-executor.py
```

## Step 6: Create README

Document game-specific setup in `applications/[game-name]/README.md`

## Common Patterns

### Command Execution Methods

- **Console/Terminal**: Send text commands (like Skyrim)
- **API/HTTP**: Call game REST API
- **File I/O**: Write commands to monitored file
- **Memory**: Direct memory manipulation (advanced)
- **Mod System**: Trigger mod features via integration

### Game Examples

**Fallout 4/76**: Similar to Skyrim, use console commands via pythonkeys

**Minecraft**: Send commands via RCON (remote console)

**StarCitizen**: Use SceneNodeRenderer or API if available

**Cyberpunk 2077**: Use REDmod or scripting system

**Elden Ring**: Direct mod communication or overlays

## Testing Your Game

1. Verify wheel-options.json is valid JSON
2. Test one command manually first
3. Run executor and watch for detection
4. Verify commands execute in game
5. Iterate on timing/command format

## Troubleshooting

- **Config not loading**: Check JSON syntax
- **Commands not detected**: Verify overlay is writing data
- **Commands not executing**: Test command manually first
- **Timing issues**: Adjust executor delays

## Documentation

See [applications/README.md](../README.md) for framework overview.
