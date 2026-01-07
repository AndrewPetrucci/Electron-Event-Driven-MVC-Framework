#include "skse64/PluginAPI.h"
#include "skse64/GameAPI.h"
#include "skse64/GameForms.h"
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

IDebugLog gLog;

class ConsoleExecutor {
public:
    static void ExecuteCommand(const std::string& command) {
        if (command.empty()) return;
        
        // Cast to console command
        (*g_console)->Print(command.c_str());
        (*g_console)->ExecuteCommand(command.c_str());
    }
    
    static void ProcessCommandFile(const std::string& filePath) {
        std::ifstream file(filePath);
        if (!file.is_open()) return;
        
        std::string line;
        std::vector<std::string> commands;
        
        // Read all commands from file
        while (std::getline(file, line)) {
            if (!line.empty() && line[0] != '#') {  // Skip empty lines and comments
                commands.push_back(line);
            }
        }
        file.close();
        
        // Execute each command
        for (const auto& cmd : commands) {
            ExecuteCommand(cmd);
            gLog.Message("Executed: %s\n", cmd.c_str());
        }
        
        // Clear the file after execution
        std::ofstream clear(filePath);
        clear.close();
    }
};

// Plugin interface
extern "C" {
    bool SKSEPlugin_Query(const SKSE::QueryInterface* a_skse, SKSE::PluginInfo* a_info) {
        gLog.OpenRelative(CSIDL_MYDOCUMENTS, "\\My Games\\Skyrim Special Edition\\SKSE\\Plugins\\overlay-bridge.log");
        gLog.SetPrintLevel(IDebugLog::kLevel_Error);
        gLog.SetLogLevel(IDebugLog::kLevel_DebugMessage);
        
        gLog.Message("Overlay Bridge SKSE Plugin loaded\n");
        
        a_info->infoVersion = SKSE::PluginInfo::kVersion;
        a_info->name = "Overlay Bridge";
        a_info->version = 1;
        
        return true;
    }
    
    bool SKSEPlugin_Load(const SKSE::LoadInterface* a_skse) {
        gLog.Message("Loading Overlay Bridge SKSE Plugin...\n");
        
        // Main loop check - this runs during game updates
        // Monitor the command queue file
        class CommandChecker {
        public:
            static void Check() {
                std::string commandFile = "Data\\SKSE\\Plugins\\overlay-commands.txt";
                std::ifstream file(commandFile);
                
                if (file.is_open()) {
                    file.close();
                    ConsoleExecutor::ProcessCommandFile(commandFile);
                }
            }
        };
        
        // Note: In a real implementation, you'd use RegisterEventSink
        // to hook into the game's update loop
        
        gLog.Message("Overlay Bridge SKSE Plugin initialized\n");
        return true;
    }
};
