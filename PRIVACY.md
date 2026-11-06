# Privacy Policy

**Effective Date:** November 6, 2026  
**Compliance Scope:** Vietnam Decree 13/2023/ND-CP on Personal Data Protection, EU GDPR, and US CCPA/CPRA.

## 1. Summary: Zero Remote Data Collection

**AntiPersonality** is a 100% local, offline-first client customization suite for Google Antigravity Desktop.

- **No External Servers:** AntiPersonality does not operate any cloud backend, database, or remote API. Every HTTP request made by the runtime or local UI panels targets strictly `http://127.0.0.1:51788` (your own machine's loopback interface) or the local Chrome DevTools Protocol port bound to `127.0.0.1`.
- **No Analytics or Third-Party Trackers:** AntiPersonality embeds zero Google Analytics, Meta Pixels, crash reporters, telemetry uploaders, or advertising SDKs.
- **No Personal Data Collection:** We do not collect, transmit, store remotely, sell, or share your name, email address, IP address, chat prompts, source code, API keys, or usage history.

## 2. Clarification of Local In-Memory Features

To avoid ambiguity when auditing the source code:

- **`AgyApi.Telemetry` (`core/agy_api.js`):** Despite its developer-facing module name, `AgyApi.Telemetry` is an **in-memory local UI event bus** used strictly to drive visual animations and optional sound effects inside your window. It stores timestamps (not character values) of the last 5 seconds of keypresses in RAM to calculate live typing cadence (WPM) and inspects local button states (e.g., streaming vs. idle). Zero keystrokes or text contents are recorded, persisted to disk, or transmitted anywhere.
- **`TokenCounter` (`plugins/token-counter.plugin.js`):** Estimates token counts and cost figures locally from visible DOM text lengths. Prompt text is never stored or sent over any network.

## 3. Data Minimization & Local Storage Purpose

AntiPersonality stores only the minimum local configuration required to remember settings you explicitly choose (such as your active theme ID, enabled plugins, custom CSS rules, and selected AI persona). For the complete technical inventory of local storage keys and files, see [COOKIE_STORAGE_POLICY.md](./COOKIE_STORAGE_POLICY.md).

## 4. Your Rights (Access, Portability, and Erasure)

Under Vietnam Decree 13/2023/ND-CP, GDPR, and CCPA, you retain full control over your local configuration data at all times:

1. **Right to Access & Portability:** Click **Export Config** inside `Settings -> AntiPersonality` (or run `Profile: Export AntiPersonality Configuration (JSON)` in the `Ctrl+Shift+M` Command Palette) to inspect and download every stored preference as plain JSON.
2. **Right to Erasure (Delete All Data):**
   - Click **Purge Data** inside `Settings -> AntiPersonality` (or run `Profile: Purge All Local AntiPersonality Data` in `Ctrl+Shift+M`) to immediately delete all `AgyData:*` keys from `localStorage`, clear Custom CSS, disable all plugins, and revert to the stock Antigravity interface.
   - To remove file-based configuration completely, delete `config.json` and `.agents/personality.json` (or delete the `AntiPersonality` folder).

## 5. Contact

For privacy questions regarding this open-source repository, open an issue on the official GitHub repository's **Issues** tab.
