; Skyrim Console Command Executor via AutoHotkey
; Reads commands from overlay-commands.txt and executes them in Skyrim console
; 
; REQUIREMENTS:
; - AutoHotkey v1.1 installed (https://www.autohotkey.com/)
; - Skyrim running and active window
; - overlay-commands.txt file in Skyrim SKSE Plugins folder
;
; WORKFLOW:
; 1. Python executor writes commands to overlay-commands.txt
; 2. This script monitors the file for new commands
; 3. When a command is found, it focuses Skyrim window
; 4. Opens console with ` key (tilde/backtick)
; 5. Types the command and presses Enter
; 6. Closes console
; 7. Marks command as processed

#NoEnv
SendMode Input
SetWorkingDir %A_ScriptDir%

; Configuration
commandQueueFile := A_AppData . "\Local\Skyrim Special Edition\SKSE\Plugins\overlay-commands.txt"
processedCommandsFile := A_AppData . "\Local\Skyrim Special Edition\SKSE\Plugins\overlay-commands-processed.txt"
checkIntervalMs := 500  ; Check for new commands every 500ms
skyrimWindowTitle := "Skyrim"

; State tracking
processedCommands := {}
lastFileSize := 0

; Load previously processed commands
LoadProcessedCommands()

; Main loop
Loop
{
    Sleep, %checkIntervalMs%
    CheckForNewCommands()
}

CheckForNewCommands()
{
    ; Check if command queue file exists
    if (!FileExist(commandQueueFile))
        return
    
    ; Read all commands from file
    FileRead, fileContent, %commandQueueFile%
    if (ErrorLevel)
        return
    
    ; Process each line
    Loop, Parse, fileContent, `n, `r
    {
        command := Trim(A_LoopField)
        
        ; Skip empty lines
        if (command = "")
            continue
        
        ; Skip if already processed
        if (processedCommands[command])
            continue
        
        ; Execute the command
        if (ExecuteConsoleCommand(command))
        {
            ; Mark as processed
            processedCommands[command] := true
            SaveProcessedCommand(command)
        }
    }
}

ExecuteConsoleCommand(command)
{
    ; Focus Skyrim window
    if (!WinExist("Skyrim"))
    {
        ToolTip, Skyrim window not found
        SetTimer, RemoveToolTip, 3000
        return false
    }
    
    WinActivate
    WinWaitActive, Skyrim, , 2
    if (ErrorLevel)
    {
        ToolTip, Failed to activate Skyrim window
        SetTimer, RemoveToolTip, 3000
        return false
    }
    
    ; Small delay to ensure window is ready
    Sleep, 200
    
    ; Open console with tilde/backtick key
    Send, {`}
    Sleep, 100
    
    ; Type the command
    Send, %command%
    Sleep, 50
    
    ; Execute command with Enter
    Send, {Enter}
    Sleep, 100
    
    ; Close console with Escape
    Send, {Escape}
    Sleep, 100
    
    return true
}

LoadProcessedCommands()
{
    if (!FileExist(processedCommandsFile))
        return
    
    FileRead, fileContent, %processedCommandsFile%
    Loop, Parse, fileContent, `n, `r
    {
        command := Trim(A_LoopField)
        if (command != "")
            processedCommands[command] := true
    }
}

SaveProcessedCommand(command)
{
    FileAppend, %command%`n, %processedCommandsFile%
}

RemoveToolTip:
ToolTip
return

; Exit handler - optional cleanup
^Esc::ExitApp  ; Ctrl+Esc to exit script
