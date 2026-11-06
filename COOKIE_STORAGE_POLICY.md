# Cookie & Local Storage Policy

**Effective Date:** November 6, 2026

This document is provided separately from [PRIVACY.md](./PRIVACY.md) to transparently document all browser/client storage mechanisms used by **AntiPersonality**.

## 1. Zero HTTP Cookies & Zero Tracking Storage

- **HTTP Cookies:** AntiPersonality sets **zero** first-party or third-party cookies (`document.cookie` and `Set-Cookie` are never read or written).
- **Tracking / Fingerprinting:** AntiPersonality uses **zero** advertising identifiers, cross-site tracking tokens, or browser fingerprinting scripts. Because no non-essential or tracking cookies exist, no tracking script ever runs prior to user action.

## 2. Strictly Functional Local Storage Inventory

When you explicitly interact with AntiPersonality controls (applying a theme, toggling a plugin, saving Custom CSS, or calibrating an AI persona), settings are persisted locally on your device using Chromium's `window.localStorage` and two local JSON files:

| Storage Key / File | Location | Purpose | Retention |
| :--- | :--- | :--- | :--- |
| `AgyData:ThemeManager` | `window.localStorage` | Stores active theme ID, user-entered Custom CSS, dynamic custom themes, and video/companion performance toggles. | Until cleared via **Purge Data** |
| `AgyData:PluginManager` | `window.localStorage` | Stores `true`/`false` enabled states for the 8 client plugins. | Until cleared via **Purge Data** |
| `AgyData:PersonaManager` | `window.localStorage` | Caches active AI persona archetype, verbosity, autonomy, and strict-typing preferences. | Until cleared via **Purge Data** |
| `AgyData:<PluginName>` | `window.localStorage` | Stores per-plugin preferences (e.g., `AudioFX` volume, `CustomLogo` preset, `PromptSnippets` macros, `TokenCounter` ledger). | Until cleared via **Purge Data** |
| `config.json` & `.agents/personality.json` | Local filesystem | Syncs your selected AI Persona calibration for local Antigravity agent sessions. | Until deleted from disk |

## 3. How to Clear All Stored Data

You can erase all `window.localStorage` entries listed above in one click at any time:

1. Open **Settings -> AntiPersonality** (or press `Ctrl + Shift + M` to open the Command Palette).
2. Select **Purge Data** (`Profile: Purge All Local AntiPersonality Data`) and confirm.
