const fs = require('fs');
const path = require('path');

/**
 * Execute a mod file writer controller that writes a JSON payload shaped like
 * StorageUtilData/ConsoleCommands.json (used by the Skyrim mod).
 *
 * Output shape:
 * {
 *   "stringList": { "commands": ["..."] },
 *   "timestamp": "ISO-8601"
 * }
 *
 * @param {object} eventData - The wheel result object with config
 * @param {object} applicationConfigs - Map of all application configurations (unused)
 * @returns {Promise<void>}
 */
function executeController(eventData, applicationConfigs) {
  void applicationConfigs;

  return new Promise((resolve, reject) => {
    try {
      const tmpDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'Overlay', 'tmp');

      // Ensure tmp directory exists (used when output path is not absolute)
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      // Prefer an absolute output path if provided; otherwise write into tmp with the provided filename.
      const configuredPath =
        eventData.config?.fileWriterPath ||
        eventData.config?.outputPath ||
        'ConsoleCommands.json';

      const filepath = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.join(tmpDir, path.basename(configuredPath));

      // Ensure target directory exists (for absolute paths)
      const targetDir = path.dirname(filepath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Extract command(s) from common wheel-result shapes
      let commands = [];
      const v = eventData?.config?.value;
      if (Array.isArray(v)) {
        commands = v.map(String).filter(Boolean);
      } else if (typeof v === 'string') {
        commands = [v].filter(Boolean);
      } else if (Array.isArray(eventData?.commands)) {
        commands = eventData.commands.map(String).filter(Boolean);
      } else if (typeof eventData?.command === 'string') {
        commands = [eventData.command].filter(Boolean);
      } else if (typeof eventData?.text === 'string') {
        commands = [eventData.text].filter(Boolean);
      }

      // Last-resort: serialize something meaningful so the file isn't empty
      if (commands.length === 0) {
        commands = [String(v ?? '')].filter(Boolean);
      }

      const output = {
        stringList: {
          commands
        },
        timestamp: new Date().toISOString()
      };

      fs.writeFile(filepath, JSON.stringify(output, null, 2), (err) => {
        if (err) {
          console.error(`[ModFileWriter] Error writing to file: ${err.message}`);
          reject(err);
          return;
        }

        console.log(`[ModFileWriter] Successfully wrote: ${filepath}`);

        // Notify parent process (queue manager) to support fileWatcher UX
        if (process.send) {
          try {
            process.send({
              type: 'file-writer-event',
              controller: 'mod-file-writer',
              filePath: filepath,
              filename: path.basename(filepath),
              timestamp: Date.now(),
              entry: output
            });
          } catch (sendErr) {
            console.warn(`[ModFileWriter] Could not send event to parent: ${sendErr.message}`);
          }
        }

        resolve();
      });
    } catch (error) {
      console.error(`[ModFileWriter] Error: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Initialize the Mod File Writer controller (empty placeholder)
 */
function initializeController() {
  // TODO: Add initialization logic if needed
}

module.exports = {
  executeController,
  initializeController
};

