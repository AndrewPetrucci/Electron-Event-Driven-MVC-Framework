#include "skse64/PluginAPI.h"
#include <shlobj.h>

// Minimal plugin that just responds to SKSE
extern "C" {
    bool SKSEPlugin_Query(const SKSEInterface* skse, PluginInfo* info) {
        info->infoVersion = PluginInfo::kInfoVersion;
        info->name = "Overlay Bridge";
        info->version = 1;
        
        if (skse->isEditor) {
            return false;
        }
        
        return true;
    }
    
    bool SKSEPlugin_Load(const SKSEInterface* skse) {
        // Plugin loaded successfully
        return true;
    }
}
