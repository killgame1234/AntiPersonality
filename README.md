# AntiPersonality v3.1

> Unofficial local client customization, View Transition theming, modular pair-programming plugins, and AI Persona calibration suite for **Google Antigravity Desktop**.

---

## Architecture Overview

Built around a local Chrome DevTools Protocol (CDP) preload engine and modular Vencord/BetterDiscord lifecycle patterns, **AntiPersonality v3.1** unifies client theming, 8 modular extensions, and live AI Persona calibration inside Antigravity's Settings interface.

```text
AntiPersonality/
├── core/
│   ├── agy_api.js              # window.AgyApi v3.1 (DOM, UI Modals/Toasts, Data Export/Import/Purge, Patcher, Telemetry)
│   ├── addon_manager.js        # Standardized @metadata docblock parser
│   ├── theme_manager.js        # Shockwave View Transitions, atmospheric shaders & media teardown
│   ├── plugin_manager.js       # Hot-swap plugin lifecycle, rollback & auto-unpatch
│   ├── settings_tab.js         # Native 4-tab Settings UI, Command Palette & Alt+Backquote Radial Wheel
│   └── bundle_runtime.js       # Top-frame-isolated, CSP-safe runtime bundler
├── plugins/                    # 8 modular client-side JavaScript plugins
│   ├── better-codeblocks.plugin.js
│   ├── image-zoom.plugin.js
│   ├── token-counter.plugin.js
│   ├── prompt-snippets.plugin.js
│   ├── zen-mode.plugin.js
│   ├── audio-fx.plugin.js
│   ├── compact-mode.plugin.js
│   └── custom-logo.plugin.js
├── themes/                     # Canonical .theme.css stylesheets (original CSS tokens & procedural SVG grain)
│   ├── amoled.theme.css        # Pure AMOLED Minimal (#000000)
│   ├── black-shores.theme.css  # The Black Shores (Unofficial fan-inspired cyan & iris palette)
│   ├── capri.theme.css         # Cyberpunk Capri (Crimson & Emerald)
│   ├── eldritch.theme.css      # Eldritch Void (OLED Crimson Ocular Glow)
│   ├── moonlit.theme.css       # Moonlit Lotus (Celestial Ice Blue & Gold)
│   └── prescript.theme.css     # The Prescripts (Unofficial fan-inspired obsidian & cyan-gold palette)
├── templates/                  # AI Persona archetype definitions
│   ├── tech-lead.md
│   ├── mentor.md
│   ├── speedrunner.md
│   ├── sre-auditor.md
│   └── minimalist.md
├── rules/
│   └── AGENTS.md               # Runtime persona enforcement rules
├── scripts/
│   └── verify_smoke.js         # Pre-release smoke, idempotency, privacy & legal compliance suite
├── injector.js                 # Local CDP bootstrapper, loopback HTTP bridge (:51788) & fs.watch daemon
├── config.json                 # Active persona & suite configuration
├── plugin.json                 # Antigravity plugin manifest
├── LICENSE                     # MIT License
├── PRIVACY.md                  # Privacy Policy (Vietnam Decree 13, GDPR, CCPA)
├── COOKIE_STORAGE_POLICY.md    # Separate Cookie & Local Storage inventory
├── TERMS.md                    # Terms of Use, Assumption of Risk & Trademark Disclaimer
└── SECURITY.md                 # Security architecture & reporting policy
```

---

## Core v3.0 Features

### 1. Immortal CDP Persistence & Live Hot-Reload
- **Zero-Amnesia Reloads**: Registers the runtime bundle via CDP `Page.addScriptToEvaluateOnNewDocument` (strictly isolated to the top-level window frame) and runs a serialized 3-second health guardian so AntiPersonality persists across `Ctrl + R` window reloads and automatically re-hydrates active interactive themes.
- **150ms Debounced Hot-Swap**: Watches `core/`, `plugins/`, `themes/*.theme.css`, and `.agents/personality.json` via serialized `fs.watch`, hot-reloading edits live without losing UI state.

### 2. `window.AgyApi` v3.0 Developer API
- **`AgyApi.DOM.addStyle(id, css)` / `removeStyle(id)`**: Scoped `<style>` management.
- **`AgyApi.Patcher`**: Safe method hooking (`before`, `instead`, `after`, `unpatchAll`) with Promise-aware async `after` hooks and preserved function arity/name, automatically cleaned up when a plugin stops.
- **`AgyApi.UI.showToast(message, { type, timeout })`**: Theme-agnostic notifications using native Antigravity CSS variables.
- **`AgyApi.Data`**: Prototype-safe persistent `localStorage` namespace plus 1-click JSON `exportAll()` and `importAll()` profile backup and restore.

### 3. Native Settings Section (`AntiPersonality`) & Command Palette
Open Antigravity **Settings** (positioned cleanly at the bottom of the sidebar) or press **`Ctrl + Shift + M`** (or type `/ap` in chat) to access:
- **Themes**: 1-click View Transition hot-reload, **Reset to Stock**, and per-theme performance switches (**Disable Background Video** and **Hide Floating Companions**).
- **Plugins**: Toggle and configure all 8 modular pair-programming extensions:
  - `BetterCodeblocks`: Action header, inferred language badge, live line numbers gutter, word-wrap, collapse, font scaling, raw copy.
  - `ImageUtilities & Zoom`: Lightbox overlay with focal mouse-wheel zoom (0.3x–8.0x), pan, rotate, flip, PNG clipboard copy, and Blob download.
  - `TokenCounter`: Multi-scope token and expenditure tracker (`Prompt`, `Chat`, `Project`) with live model auto-detection (Gemini 3.8 Flash, Gemini 4 Argon, Claude Sonnet/Opus 5.5, GPT-OSS 120B), CJK-weighted BPE estimations, exact turn parsing, and USD cost ledgers.
  - `PromptSnippets`: 1-click workflow pills (`/plan`, `/test`, `/fix`, `/refactor`, `/compact`, `/boost`, `/antipersonality`) with `{{clipboard}}`, `{{selection}}`, and `{{file}}` macros.
  - `ZenMode`: Multi-tier distraction-free studio focus (`Alt + Shift + Z`, leaving native `Alt + Z` Word Wrap untouched).
  - `AudioFX`: Synthesized WebAudio chimes for task completion, errors, and permission prompts.
  - `CompactMode`: Three vertical density tiers (Comfortable, Compact, Ultra-Dense).
  - `CustomLogo`: Theme-reactive top-left AntiPersonality emblem presets.
- **Personas**: Switch between the 5 AI pair-programming archetypes (`The Senior Tech Lead`, `The Patient Mentor`, `The 10x Speedrunner`, `The Paranoid SRE`, `The Zen Minimalist`) and calibrate **Verbosity (0-100)**, **Autonomy**, and **Strict Typing**, synced atomically (`fsync` + NTFS retry) to `config.json` and `.agents/personality.json`.
- **Custom CSS**: Persistent live stylesheet editor layered cleanly above any active theme.

---

## CLI & Bridge Commands

Run via Antigravity's built-in Electron Node runtime (`ELECTRON_RUN_AS_NODE=1`):

```powershell
$env:ELECTRON_RUN_AS_NODE="1"
$app = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe"
$script = "$env:USERPROFILE\.gemini\antigravity\AntiPersonality\injector.js"

# 1. Start persistent bridge daemon (:51788), reload guardian & fs.watch hot-reload:
& $app $script server

# 2. One-shot install / re-inject runtime:
& $app $script install

# 3. Open Settings modal (themes | plugins | personas | custom-css | palette):
& $app $script open personas

# 4. Inject and save a custom or AI-generated theme live:
& $app $script inject-theme ":root { --background: #090d16; }" "Deep Space Nebula"

# 5. Query runtime, theme, plugin, and persona status:
& $app $script status

# 6. Restore Antigravity to clean stock slate:
& $app $script reset

# 7. Run automated smoke, accessibility & pre-publish compliance checks:
& $app "$env:USERPROFILE\.gemini\antigravity\AntiPersonality\scripts\verify_smoke.js"
```

---

## Legal, Privacy & Non-Affiliation

- **Open-Source License:** Released under the [MIT License](./LICENSE). Provided `"AS IS"`, without warranty of any kind.
- **100% Local & Zero Tracking:** AntiPersonality operates strictly over `127.0.0.1` loopback, sets zero cookies, embeds zero third-party analytics/pixels, and never transmits code, prompts, or personal data externally. Users can export (`Export Config`) or erase (`Purge Data`) all `localStorage` keys in 1 click. See [PRIVACY.md](./PRIVACY.md) and [COOKIE_STORAGE_POLICY.md](./COOKIE_STORAGE_POLICY.md).
- **Non-Affiliation & Trademarks:** AntiPersonality is an independent, unofficial community project and is **not affiliated with, endorsed by, or sponsored by Google LLC** (Google Antigravity), **Kuro Games**, or **Project Moon**. Bundled `.theme.css` files contain original CSS color tokens only (zero third-party media assets). See [TERMS.md](./TERMS.md) and [SECURITY.md](./SECURITY.md).
