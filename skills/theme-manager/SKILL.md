---
name: theme-manager
description: Manage, apply, and toggle AntiPersonality v3.0 client themes, interactive theme scripts, AI personas, and client mod plugins in Google Antigravity Desktop. Activate when the user asks to "apply <theme> theme", "reset theme", "turn off custom theme", "open theme dashboard", or "change theme in settings".
---

# AntiPersonality v3.0 Theme & Suite Manager Skill

Provides CLI and HTTP bridge commands (`http://127.0.0.1:51788`) to switch themes, toggle the 8 modular plugins, calibrate AI Personas, and manage custom CSS in Google Antigravity Desktop.

## Available Preset Themes & Interactive Engines
- `capri`: Cyberpunk Capri (Crimson-magenta, emerald accents, Capri sprite companion & popout video)
- `prescript`: The Prescripts (Obsidian OLED void, cyan threads, Index gold, typewriter decree engine)
- `eldritch`: Eldritch Void (Pitch-black OLED, cosmic ocular rifts, crimson aura glow)
- `moonlit`: Moonlit Lotus (Celestial lunar HUD, ancient tree realm, floating lantern gold)
- `black-shores`: The Black Shores (Tethys cyan, iris violet, scenery video loop & Shorekeeper companion)
- `amoled`: Pure AMOLED Minimal (True `#000000` OLED surface with crisp glass borders)

## In-App Controls (`AntiPersonality` Settings Section & Command Palette)
1. Press **`Ctrl + Shift + M`** or type `/ap` in chat to launch the **Command Palette** for fuzzy-search theme, plugin, and persona switching.
2. Or open Antigravity **Settings** (`Ctrl + ,`) and navigate to **AntiPersonality** at the bottom of the left sidebar:
   - **Themes**: View Transition card gallery, **Reset to Stock**, **Export/Import Config**, and per-theme performance toggles (**Disable Background Video**, **Hide Floating Companions**).
   - **Plugins**: Manage all 8 modular plugins (`BetterCodeblocks`, `ImageUtilities & Zoom`, `TokenCounter`, `PromptSnippets`, `ZenMode` via `Alt + Shift + Z`, `AudioFX`, `CompactMode`, `CustomLogo`).
   - **Personas**: Switch between the 5 AI archetypes (`tech-lead`, `mentor`, `speedrunner`, `sre-auditor`, `minimalist`) and adjust Verbosity, Autonomy, and Strict Typing.
   - **Custom CSS**: Live persistent stylesheet editor with instant Save & Apply.

## CLI & Bridge Commands

### 1. Apply a Theme Live
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:51788/apply?theme=<capri|prescript|eldritch|moonlit|black-shores|amoled|stock>"
```
Or via CLI:
```powershell
cmd.exe /c "set ELECTRON_RUN_AS_NODE=1 && `"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe`" `"%USERPROFILE%\.gemini\antigravity\AntiPersonality\injector.js`" apply <themeKey>"
```

### 2. Reset Back to Stock Default
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:51788/reset"
```
Or via CLI:
```powershell
cmd.exe /c "set ELECTRON_RUN_AS_NODE=1 && `"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe`" `"%USERPROFILE%\.gemini\antigravity\AntiPersonality\injector.js`" reset"
```
