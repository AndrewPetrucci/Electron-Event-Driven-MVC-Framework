#Requires AutoHotkey v2.0

; Notepad Command Executor via AutoHotkey v2
; Executes keyboard commands in the Notepad window
;
; USAGE:
; notepad-executor.ahk <config-json>
; Example:
;   notepad-executor.ahk '{"action":"insert_text","value":"hello world"}'
;
; PARAMETERS:
; A_Args[1] = config as JSON string (e.g., {"action":"send_keys","value":"^s"})

A_SendMode := "Input"

; Configuration
notepadWindowTitle := "ahk_class Notepad"
logFile := A_Temp . "\notepad-executor-debug.log"

; Immediately write to log to confirm script is running
try
{
    FileAppend("Script started`n", logFile)
}
catch Error as e
{
    MsgBox("Failed to write debug log: " . e.Message)
    ExitApp(1)
}

; Get config JSON from command line
configJson := A_Args.Length >= 1 ? A_Args[1] : ""

; Write debug info to file
FileAppend("=== Notepad Executor Started ===`n", logFile)
FileAppend("Config JSON: " . configJson . "`n", logFile)
FileAppend("Args Count: " . A_Args.Length . "`n", logFile)

; Extract action and value from JSON using simple string parsing
action := ExtractJsonValue(configJson, "action")
value := ExtractJsonValue(configJson, "value")

FileAppend("Extracted Action: " . action . "`n", logFile)
FileAppend("Extracted Value: " . value . "`n", logFile)

; Execute the action
Execute(action, value)

; Helper function to extract a value from JSON string
; Uses Chr(34) for double quote to avoid escaping issues
ExtractJsonValue(jsonStr, keyName)
{
    quote := Chr(34)  ; Double quote character
    colon := ":"
    
    ; Build search pattern: "keyName":"
    searchKey := quote . keyName . quote . colon . quote
    
    pos := InStr(jsonStr, searchKey)
    if (pos <= 0)
        return ""
    
    ; Move to start of value (after the opening quote of the value)
    startPos := pos + StrLen(searchKey)
    
    ; Find the closing quote
    endPos := InStr(jsonStr, quote, , startPos)
    if (endPos <= 0)
        return ""
    
    ; Extract and return the value
    return SubStr(jsonStr, startPos, endPos - startPos)
}

; Main execution function
Execute(action, value)
{
    global logFile
    
    ; First, focus on Notepad window
    try
    {
        FileAppend("Attempting to activate Notepad window...`n", logFile)
        WinActivate(notepadWindowTitle)
        Sleep(500)
    }
    catch Error as e
    {
        FileAppend("Activate by window title failed: " . e.Message . "`n", logFile)
        ; Try by class name directly
        try
        {
            FileAppend("Trying to activate by class name...`n", logFile)
            WinActivate("ahk_class Notepad")
            Sleep(500)
        }
        catch Error as e2
        {
            FileAppend("Activate by class failed: " . e2.Message . "`n", logFile)
            FileAppend("ExitApp(2)`n", logFile)
            ExitApp(2)
        }
    }
    
    ; Verify Notepad is active
    activeTitle := WinGetTitle("A")
    FileAppend("Active window title: " . activeTitle . "`n", logFile)
    
    if (!InStr(activeTitle, "Notepad") && !InStr(activeTitle, "Untitled"))
    {
        FileAppend("Notepad not active, exiting`n", logFile)
        MsgBox(0x10, "Error", "Failed to activate Notepad window")
        ExitApp(1)
    }
    
    FileAppend("Notepad is active, executing action: " . action . "`n", logFile)
    
    ; Execute based on action type
    if (action = "send_keys")
    {
        FileAppend("Sending keys: " . value . "`n", logFile)
        Send(value)
        Sleep(100)
    }
    else if (action = "insert_text")
    {
        FileAppend("Inserting text: " . value . "`n", logFile)
        A_Clipboard := value
        Sleep(100)
        
        ; Paste with Ctrl+V
        Send("^v")
        Sleep(100)
        FileAppend("Text inserted via clipboard paste`n", logFile)
    }
    else
    {
        FileAppend("Unknown action: " . action . ", defaulting to text insert`n", logFile)
        A_Clipboard := value
        Sleep(100)
        Send("^v")
        Sleep(100)
    }
    
    FileAppend("Execute completed, exiting with code 0`n", logFile)
    ExitApp(0)
}
