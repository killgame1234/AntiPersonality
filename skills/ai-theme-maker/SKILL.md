---
name: ai-theme-maker
description: Generates custom CSS themes from natural language prompts, saves canonical .theme.css files, and injects them live into Google Antigravity Desktop via AntiPersonality v3.0. Activate when the user asks to "make Antigravity look like...", "create a theme for...", "generate a theme...", or customize UI colors and visual styles with AI.
---

# AI Theme Maker Skill (AntiPersonality v3.0 Prompt-to-Theme)

Designs, saves, and hot-swaps custom `.theme.css` themes directly into the running Google Antigravity Desktop application.

## Workflow

### 1. Interpret User Aesthetic
Extract the core visual direction:
- **Palette**: Background, card/surface, text foreground, muted foreground, borders, and accents.
- **Atmosphere**: Glassmorphism blur, contrast level, subtle shadows, border radii.

### 2. Compose Canonical Theme CSS
Author clean CSS rules respecting Antigravity's layout and dynamic CSS custom properties:

```css
/**
 * @name Deep Space Nebula
 * @author AntiPersonality AI Theme Maker
 * @version 1.0.0
 * @description Deep cosmic indigo glassmorphism with starlight silver contrast.
 */

html.better-agy-active {
  --background: #070b14 !important;
  --card: rgba(13, 19, 34, 0.78) !important;
  --muted: rgba(30, 41, 59, 0.65) !important;
  --sidebar-secondary: rgba(30, 41, 59, 0.8) !important;
  --border: rgba(148, 163, 184, 0.16) !important;
  --foreground: #f1f5f9 !important;
  --secondary-foreground: #cbd5e1 !important;
  --muted-foreground: #94a3b8 !important;
}

html.better-agy-active,
html.better-agy-active body {
  background: radial-gradient(circle at 50% 20%, #111a2e 0%, #070b14 75%) !important;
  color: var(--foreground) !important;
}

html.better-agy-active aside:not([role="dialog"] *),
html.better-agy-active nav:not([role="dialog"] *),
html.better-agy-active [data-testid="sidebar"] {
  background: var(--card) !important;
  backdrop-filter: blur(16px) !important;
  border-right: 1px solid var(--border) !important;
}
```

### 3. Save & Inject Live into Antigravity
Prefer calling the persistent HTTP bridge (`POST http://127.0.0.1:51788/inject-theme`):

```powershell
$body = @{
  name = "Deep Space Nebula"
  css  = $themeCss
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:51788/inject-theme" -Method Post -ContentType "application/json" -Body $body
```

Or run the CLI `inject-theme` command directly via Antigravity's built-in Node runtime:

```powershell
cmd.exe /c "set ELECTRON_RUN_AS_NODE=1 && `"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe`" `"%USERPROFILE%\.gemini\antigravity\AntiPersonality\injector.js`" inject-theme `"<css-or-filepath>`" `"<ThemeName>`""
```

### 4. Confirm to User
Confirm that the new theme has been saved to `themes/<slug>.theme.css`, registered in the **Theme Library**, and applied live with View Transitions.
