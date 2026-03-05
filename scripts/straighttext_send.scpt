-- StraightText Automation Script
-- Run with: osascript straighttext_send.scpt

on run argv
    set csvPath to item 1 of argv
    
    -- Activate StraightText
    tell application "StraightText"
        activate
        delay 1
    end tell
    
    -- Create new broadcast (Cmd+N)
    tell application "System Events"
        tell process "StraightText"
            set frontmost to true
            delay 0.5
            keystroke "n" using command down
            delay 2
        end tell
    end tell
    
    return "Opened new broadcast. Now import CSV: " & csvPath
end run
