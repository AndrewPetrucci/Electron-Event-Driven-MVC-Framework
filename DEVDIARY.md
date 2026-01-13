# Development Diary

## Overview
I wanted an informal space to chronical my thoughts and how the project is progressing. Oldest -> Newest.

## Diary

### 1/9/2026
Diary - Now you may be asking; What is this project???
In simple terms, that depends on what type of person you are.
1. The streamer! - a highly customizable twitch integration that hands you the keys to the kingdom.
2. The gamer! - Custom ui overlays for your favorite games! Want to make a game in a game? Here is a tool to do it!
3. The technologist! - All of your tools have interfaces and it would be sick if your tools talked to each other.
4. The stranger! - If not the above reason please email me why you are here!

My goal is to make this relatively lightweight framework with plug and play functionality for a variety of integrations and ui elements.

The current implementation has been tested from the ui, to pythonkeys, to a target application (notepad/skyrim).

#### Step-by-Step Flow

1. **Wheel Spin Triggered** (`src/wheel.js`)
   - renders wheel options based off the root wheel-options.json. This is effectively the api you as the human care about.
   - User clicks SPIN button or auto-spin activates

2. **Spin Complete** (`src/wheel.js` - `onSpinComplete()`)
   - Calculates winning option based on final rotation
   - Passes the selected option object to the rest of the system (includes config with action, value, etc.)

3. **Electron Main Process**
   - Receives option object via IPC
   - Sends the event to wherever it needs to go. (currently it just spawns the pythonkeys process directly)
   - Spawns pythonkeys executor process with config as JSON argument

4. **pythonkeys Executor** (`controllers/pythonkeys/executor.py`)
   - Recieves and parses json configurations
   - auto focuses the target applicaiton
   - Does an operation based off said json congigs that either sends keys or inserts text.

5. **Notepad Receives Text**
   - This is the target application where the text gets written or commands getsent! Enjoy your ascii art hud!

#### Development Planning
Ok so what's next? Well I'm happy with this as an initial implementation but I have some things I want to change. I want to be able to run hultiple different uis at the same time that all write to the same set of queues instead of a file (currently the spinner writes to a file AND spins a process up)
The goal is to be able to plug and play any leg of the ecosystem.
Here is the layout
1. the main process. This is a process that you start from the command line w/ npm start. This process is responsible for setting everything up. It consumes a set of configs and creates all the queues and files required to opperate. this shoud be the most lightweight webserver possible that you can also ssh into to control.
2. Resources/dependancies! I want the model (static data) to be distributed across a variety of plug and play data stores. Currently only file is supported but this should be extensible to other resource types. I want to get queues working next.
3. the overlayS pulral! These electron applications are intended to be quick and snappy ui elements that run independently of each other. How you sequence monitor processes to grab items from queues and process them is up to the plugin creator. (terms are still in motion. Will do more research)

now thats a lot of words. I'm going to be reskinning the wheel in the short term to something I'm more proud of. After that I'll work on splitting the electron app into a server and implementing different queue logic. Some schemas will have to change but so is life. I want to wrap up the next section of development by creating a second electron app that sits over notepad and provides a list of math operations and custom functions. The test bench for this project will be both the old electron app and the new one running at the same time and sending commands to notepad.


### 1/11/2026
I've spent that last 2 days pushing the project to be more framework like. I think there is potential to forge the project into the scalable open source workstation I dream it can be. To prove that this project has legs I'm going to build a scalable ui around ms paint. it seems to be a good baseline considering everyone has it installed on windows by default. Youtube channel got axed and I'm going through the appeal process.

#### Development Planning
To prove that the project has legs I am going to start running at two different implementations.
1. skyrim wheel example - this is just a lot of manual testing against skyrim and working on the wheel ui
2. I need to add a bunch of utility around target applications changing state. (minimize, maximize, close, resize,move) Maybe have one applicationMetadataUpdate method.