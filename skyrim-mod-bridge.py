#!/usr/bin/env python3
"""
Skyrim Mod Bridge - Monitors overlay-data.json and executes Skyrim console commands
"""

import json
import time
import os
import subprocess
from pathlib import Path
from datetime import datetime

# Configuration
DATA_FILE = Path.home() / "Documents/My Games/Skyrim Special Edition/SKSE/Plugins/overlay-data.json"
OPTIONS_FILE = Path(__file__).parent / "wheel-options.json"
SKYRIM_CONSOLE_SEND = False  # Set to True if you have a console injection method

# Load action mappings from JSON
ACTION_MAPPINGS = {}

def load_action_mappings():
    """Load action mappings from wheel-options.json"""
    global ACTION_MAPPINGS
    try:
        with open(OPTIONS_FILE, 'r') as f:
            data = json.load(f)
            for option in data.get('options', []):
                ACTION_MAPPINGS[option['name']] = {
                    'command': option['command'],
                    'description': option['description']
                }
    except Exception as e:
        print(f"Error loading options file: {e}")
        return False
    return True

class SkyrimModBridge:
    def __init__(self):
        self.last_result = None
        self.last_timestamp = None
        self.processed_results = set()
        
    def read_data_file(self):
        """Read the overlay data JSON file"""
        try:
            if not DATA_FILE.exists():
                return None
                
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Could not parse JSON file")
            return None
        except Exception as e:
            print(f"Error reading file: {e}")
            return None
    
    def execute_console_command(self, command):
        """Execute a Skyrim console command via SKSE plugin"""
        print(f"  → Command queued for SKSE plugin: {command}")
        
        # The SKSE plugin (OverlayBridge.dll) monitors overlay-data.json
        # and executes commands automatically when wheel lands
        
        return True
    
    def process_result(self, data):
        """Process a wheel result and execute corresponding actions"""
        result = data.get("result", "").strip()
        timestamp = data.get("timestamp")
        mods = data.get("mods", [])
        
        # Skip if we've already processed this result
        result_key = f"{result}_{timestamp}"
        if result_key in self.processed_results:
            return False
        
        if not result:
            return False
        
        # Check if this result has a mapped action
        if result in ACTION_MAPPINGS:
            action = ACTION_MAPPINGS[result]
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Wheel Result: {result}")
            print(f"  Description: {action['description']}")
            print(f"  Mapped Mods: {mods if mods else 'None'}")
            
            # Execute the command
            self.execute_console_command(action['command'])
            
            # Mark as processed
            self.processed_results.add(result_key)
            
            # Keep only recent results in memory (last 100)
            if len(self.processed_results) > 100:
                self.processed_results = set(list(self.processed_results)[-100:])
            
            return True
        else:
            if result != self.last_result:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] No action mapped for: {result}")
                print(f"  Available actions: {', '.join(ACTION_MAPPINGS.keys())}")
            return False
    
    def run(self):
        """Main loop - monitor the data file"""
        print("=" * 60)
        print("Skyrim Mod Bridge")
        print("=" * 60)
        
        # Load action mappings
        if not load_action_mappings():
            print(f"ERROR: Could not load wheel options from {OPTIONS_FILE}")
            return
        
        print(f"Monitoring: {DATA_FILE}")
        print(f"Options from: {OPTIONS_FILE}")
        print(f"Watching for wheel results...\n")
        
        if not DATA_FILE.parent.exists():
            print(f"ERROR: Data file directory does not exist!")
            print(f"Expected: {DATA_FILE.parent}")
            return
        
        print("Available actions:")
        for result, action in ACTION_MAPPINGS.items():
            print(f"  • {result}: {action['description']}")
        print()
        
        try:
            while True:
                data = self.read_data_file()
                
                if data:
                    self.process_result(data)
                
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            print("\n\nBridge stopped.")
        except Exception as e:
            print(f"Error in main loop: {e}")

if __name__ == "__main__":
    bridge = SkyrimModBridge()
    bridge.run()
