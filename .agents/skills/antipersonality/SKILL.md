---
name: antipersonality
description: Open and configure the AntiPersonality v3.0 client customization suite (Themes, Plugins, Personas, Custom CSS, Command Palette) in Google Antigravity Desktop.
---

# /antipersonality Slash Command (v3.0)

Use this skill whenever the user triggers `/antipersonality`, `/ap`, or requests to open the AntiPersonality configuration interface.

## Execution Procedure

1. Call the local AntiPersonality HTTP bridge (`:51788`) or CLI injector to open the requested tab (`themes`, `plugins`, `personas`, `custom-css`, or `palette`):
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:51788/open?tab=themes" -Method Get
   ```
   Or via CLI if the bridge server is not yet running:
   ```powershell
   cmd.exe /c "set ELECTRON_RUN_AS_NODE=1 && `\"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe`\" `\"%CD%\injector.js`\" open themes"
   ```

2. Confirm to the user that AntiPersonality v3.0 is open, and highlight available sections:
   - **Themes**: View Transition switching across Pure AMOLED, Cyberpunk Capri, Eldritch Void, Moonlit Lotus, The Prescripts, and The Black Shores, plus background video/companion performance toggles.
   - **Plugins**: Manage all 8 modular pair-programming plugins (`BetterCodeblocks`, `ImageUtilities & Zoom`, `TokenCounter`, `PromptSnippets`, `ZenMode` via `Alt + Shift + Z`, `AudioFX`, `CompactMode`, `CustomLogo`).
   - **Personas**: Calibrate the 5 AI archetypes (`Tech Lead`, `Mentor`, `Speedrunner`, `Paranoid SRE`, `Minimalist`) with Verbosity, Autonomy, and Strict Typing controls.
   - **Custom CSS**: Persistent live stylesheet editor, plus JSON **Export/Import Config** and the **`Ctrl + Shift + M`** Command Palette.
