# Python Setup for PythonKeys Controller

To use the PythonKeys controller, you must have Python 3.12 or later installed and available in your system PATH.

## Installation (Windows)

1. Install Python using winget:
	```powershell
	winget install -e --id Python.Python.3.12
	```

2. Verify Python is in your PATH:
	```powershell
	python --version
	```
	You should see a version number (e.g., Python 3.12.x).

3. If `python` is not recognized, add Python to your PATH:
	- Open System Properties > Advanced > Environment Variables
	- Edit the `Path` variable in your user or system environment
	- Add the path to your Python installation (e.g., `C:\Users\<your-user>\AppData\Local\Programs\Python\Python312`)
	- Restart your terminal

## Additional Requirements

Install required Python packages:
```powershell
pip install pywinauto
```

This enables the PythonKeys controller to send keys to application windows.

# Electron Event-Driven MVC Framework

An event-driven, modular Electron framework for building highly customizable overlays, automation tools, and integrations for local enviornments. Implements a Model-View-Controller (MVC) architecture with a focus on extensibility and real-time event handling. 

It is inteded that each piece of the mvc architecture is plug and play with the event framework orchistrating everything else.

The twitch integration needs to be handled more elegantly.

---

## Features

- **Event-Driven Architecture:** Decoupled communication between UI, controllers, and executors using events and IPC.
- **MVC Pattern:** Clear separation of Model (config/data), View (windows/overlays), and Controller (executors, automation logic).
- **Twitch Integration:** Built-in Twitch chat client for real-time audience interaction and control.
- **Game & App Overlays:** Easily create overlays for games or desktop apps (e.g., Skyrim, Notepad) with custom actions.
- **Plug-and-Play Controllers:** Support for AutoHotkey, Python, and file-based controllers for automation and modding.
- **Configurable UI:** Wheel overlays and other windows are fully customizable via JSON config files.
- **Automated Testing:** End-to-end test suite for validating overlay and controller behavior.

---

## Architecture Overview

```
User Action / Twitch Command
		  ↓
	[View: Overlay Window]
		  ↓
	[Model: Config Loader]
		  ↓
	[Controller: Executor]
		  ↓
	[Target App/Game]
```

- **Views:** Electron windows (e.g., spinning wheel) with HTML/CSS/JS UI, Twitch chat integration, and window controls.
- **Models:** JSON config files and loaders for wheel options, controller mappings, and mod settings.
- **Controllers:** Executors (AutoHotkey, Python, file-writer) that perform actions in games/apps based on events.

---

## Example Flow

1. **User or Twitch chat triggers an event** (e.g., spins the wheel overlay)
2. **Wheel overlay** determines the result and emits an event
3. **Electron main process** receives the event and dispatches it to the appropriate controller
4. **Controller** (e.g., AutoHotkey script) executes the action in the target application
5. **Result** is visible in the game/app (e.g., text inserted, command executed)

---

## Getting Started

1. **Install dependencies:**
	```bash
	npm install
	```
2. **Start the app:**
	```bash
	npm start
	```
3. **Configure overlays and controllers:**
	- Edit JSON files in `src/applications/[game]/config/`
	- Add/modify controllers in `src/controllers/`

---

## Project Structure

- `main.js` – Electron main process, event routing, window management
- `src/` – Source code
  - `views/` – Overlay and window implementations (wheel, boilerplate, sticky, etc.)
  - `controllers/` – Action executors (autohotkey, file-writer, etc.)
  - `applications/` – Game/app-specific configs and executors
  - `shared/` – Shared UI and logic
- `test/` – Automated test scripts and output

---

## Extending the Framework

- **Add a new overlay:** Copy a folder in `src/views/` and customize the UI/logic
- **Add a new controller:** Implement a new executor in `src/controllers/`
- **Add a new game/app:** Create a folder in `src/applications/` with configs and executors

---

## License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0).

- You may copy, modify, and distribute this software under the terms of the GPL v3 or (at your option) any later version.
- This software is provided WITHOUT WARRANTY; see the license for details.
- For the full license text, see: https://www.gnu.org/licenses/gpl-3.0.txt
