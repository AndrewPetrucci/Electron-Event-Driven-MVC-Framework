#Requires AutoHotkey v2.0

; Notepad Command Executor via AutoHotkey v2
; Executes keyboard commands in the Notepad window
;
; USAGE:
; executor.ahk <config-json> [additional-json]
; Example:
;   executor.ahk '{"action":"insert_text","value":"hello world"}'
;   executor.ahk '{"action":"insert_text","value":"hello world"}' '{"extra":"data"}'
;
; PARAMETERS:
; A_Args[1] = config as JSON string (e.g., {"action":"send_keys","value":"^s"})
; A_Args[2] = optional application config JSON (e.g., {"applicationName":"Notepad"})

A_SendMode := "Input"

; Get config JSON from command line
configJson := A_Args.Length >= 1 ? A_Args[1] : ""
additionalJson := A_Args.Length >= 2 ? A_Args[2] : ""

; Extract applicationName from additional JSON
applicationName := "Notepad"
if (additionalJson != "")
{
    extractedName := ExtractJsonValue(additionalJson, "applicationName")
    if (extractedName != "")
    {
        applicationName := extractedName
    }
}

; Configuration
applicatioWindowTitle := "ahk_class " . applicationName
logFile := A_Temp . "\" . applicationName . "-executor-debug.log"

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

; Write debug info to file
FileAppend("=== " . applicationName . " Executor Started ===`n", logFile)
FileAppend("Config JSON: " . configJson . "`n", logFile)
FileAppend("Additional JSON: " . additionalJson . "`n", logFile)
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
; Handles JSON with or without spaces around colons
ExtractJsonValue(jsonStr, keyName)
{
    quote := Chr(34)  ; Double quote character
    
    ; Try format without spaces first: "keyName":"
    searchKey := quote . keyName . quote . ":" . quote
    pos := InStr(jsonStr, searchKey)
    
    ; If not found, try format with spaces: "keyName" : "
    if (pos <= 0)
    {
        searchKey := quote . keyName . quote . " : " . quote
        pos := InStr(jsonStr, searchKey)
    }
    
    ; If still not found, try with just spaces before colon: "keyName" :"
    if (pos <= 0)
    {
        searchKey := quote . keyName . quote . " :" . quote
        pos := InStr(jsonStr, searchKey)
    }
    
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
    
    ; First, focus on Application window
    try
    {
        WinActivate(applicatioWindowTitle)
        Sleep(500)
    }
    catch Error as e
    {
        ; Window not found, exit silently
        ExitApp(0)
    }
    
    ; Verify Application is active
    activeTitle := WinGetTitle("A")
    
    if (!InStr(activeTitle, "Notepad") && !InStr(activeTitle, "Untitled"))
    {
        ; Window not found, exit silently
        ExitApp(0)
    }
    
    FileAppend("Application is active, executing action: " . action . "`n", logFile)
    
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
