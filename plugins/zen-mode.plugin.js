/**
 * @name ZenMode
 * @author AntiPersonality Team
 * @version 3.0.0
 * @description Distraction-free full-width pair-programming environment with multi-tier focus modes, non-draggable title bar pill, and Alt+Shift+Z hotkey support.
 */

class ZenModePlugin {
  getName() { return "ZenMode"; }

  constructor() {
    this._running = false;
    this._keyHandler = null;
    this._currentMode = 0; // 0: Off, 1: Sidebars, 2: Full Studio
    this._settings = {
      defaultMode: 1, // 1: Sidebars, 2: Full
      hideSidebars: true,
      hideHeaders: true,
      hideStatusRibbons: true
    };
  }

  start() {
    this._running = true;
    this._loadSettings();

    const css = `
      /* Level 1: Sidebars Hidden (strictly top-level layout sidebars, never internal cards) */
      html.better-agy-zen-sidebars #root aside,
      html.better-agy-zen-sidebars #root nav,
      html.better-agy-zen-sidebars #root [data-testid="sidebar"],
      html.better-agy-zen-sidebars #root [data-testid="activity-bar"] {
        display: none !important;
      }
      html.better-agy-zen-sidebars main {
        max-width: 100% !important;
        width: 100% !important;
      }

      /* Level 2: Full Studio (Sidebars + Dimmed Headers + Status Ribbons) */
      html.better-agy-zen-full #root aside,
      html.better-agy-zen-full #root nav,
      html.better-agy-zen-full #root [data-testid="sidebar"],
      html.better-agy-zen-full #root [data-testid="activity-bar"] {
        display: none !important;
      }
      html.better-agy-zen-full #root header,
      html.better-agy-zen-full #root [data-testid="header"] {
        opacity: 0.15 !important;
        transition: opacity 0.2s ease !important;
      }
      html.better-agy-zen-full #root header:hover,
      html.better-agy-zen-full #root [data-testid="header"]:hover {
        opacity: 1 !important;
      }
      html.better-agy-zen-full #root [data-testid="statusbar"],
      html.better-agy-zen-full #root footer {
        display: none !important;
      }
      html.better-agy-zen-full main {
        max-width: 100% !important;
        width: 100% !important;
      }

      #agy-zen-toggle-btn {
        position: fixed !important;
        top: 10px !important;
        right: 90px !important;
        z-index: 9999 !important;
        -webkit-app-region: no-drag !important;
        app-region: no-drag !important;
        background: var(--card, rgba(24, 24, 27, 0.85)) !important;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.15)) !important;
        border-radius: 6px !important;
        color: var(--secondary-foreground, #a1a1aa) !important;
        font-family: inherit !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        padding: 4px 10px !important;
        cursor: pointer !important;
        backdrop-filter: blur(10px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        transition: all 0.2s ease !important;
        user-select: none !important;
        outline: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
      }
      #agy-zen-toggle-btn:hover {
        background: var(--sidebar-secondary, rgba(255, 255, 255, 0.15)) !important;
        color: var(--foreground, #f4f4f5) !important;
      }
      #agy-zen-toggle-btn.zen-active-1 {
        background: var(--foreground, #f4f4f5) !important;
        color: var(--background, #09090b) !important;
        border-color: transparent !important;
      }
      #agy-zen-toggle-btn.zen-active-2 {
        background: var(--foreground, #f4f4f5) !important;
        color: var(--background, #09090b) !important;
        border-color: var(--border, rgba(255, 255, 255, 0.4)) !important;
        box-shadow: 0 0 0 2px var(--border, rgba(255, 255, 255, 0.25)) !important;
      }
    `;
    AgyApi.DOM.addStyle('plugin-zen-mode', css);

    this._mountButton();

    // Alt+Shift+Z avoids colliding with VS Code / Antigravity native Alt+Z Word Wrap
    this._keyHandler = (e) => {
      if (!this._running) return;
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyZ' || e.key === 'Z' || e.key === 'z')) {
        if (document.getElementById('agy-command-palette-overlay')) return;
        e.preventDefault();
        e.stopPropagation();
        this.cycleMode();
      }
    };
    window.addEventListener('keydown', this._keyHandler, true);
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('ZenMode', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('ZenMode', 'settings', this._settings);
    } catch (_) {}
  }

  _mountButton() {
    if (document.getElementById('agy-zen-toggle-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'agy-zen-toggle-btn';
    btn.title = 'Toggle Zen Mode (Alt+Shift+Z)';
    btn.textContent = 'Zen: Off';
    btn.onclick = () => this.cycleMode();
    document.body.appendChild(btn);
  }

  setMode(mode, silent = false) {
    this._currentMode = mode;
    document.documentElement.classList.remove('better-agy-zen-sidebars', 'better-agy-zen-full');

    const btn = document.getElementById('agy-zen-toggle-btn');
    if (btn) {
      btn.classList.remove('zen-active-1', 'zen-active-2');
    }

    if (mode === 1) {
      document.documentElement.classList.add('better-agy-zen-sidebars');
      if (btn) {
        btn.textContent = 'Zen: Sidebars';
        btn.classList.add('zen-active-1');
      }
      if (!silent) {
        AgyApi.UI.showToast('Zen Mode: Sidebars Hidden (Alt+Shift+Z)', { type: 'info', timeout: 2000 });
      }
    } else if (mode === 2) {
      document.documentElement.classList.add('better-agy-zen-full');
      if (btn) {
        btn.textContent = 'Zen: Full Studio';
        btn.classList.add('zen-active-2');
      }
      if (!silent) {
        AgyApi.UI.showToast('Zen Mode: Full Studio Maximize (Alt+Shift+Z)', { type: 'success', timeout: 2000 });
      }
    } else {
      if (btn) {
        btn.textContent = 'Zen: Off';
      }
      if (!silent) {
        AgyApi.UI.showToast('Zen Mode: Normal View', { type: 'info', timeout: 2000 });
      }
    }
  }

  cycleMode() {
    const preferredFirst = Number(this._settings.defaultMode) === 2 ? 2 : 1;
    let nextMode = 0;
    if (this._currentMode === 0) {
      nextMode = preferredFirst;
    } else if (preferredFirst === 2) {
      nextMode = this._currentMode === 2 ? 1 : 0;
    } else {
      nextMode = this._currentMode === 1 ? 2 : 0;
    }
    this.setMode(nextMode);
  }

  stop() {
    this._running = false;
    this.setMode(0, true);
    const btn = document.getElementById('agy-zen-toggle-btn');
    if (btn) btn.remove();
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    AgyApi.DOM.removeStyle('plugin-zen-mode');
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-zen-set-';

    setTimeout(() => {
      const modeSel = document.getElementById(idPrefix + 'def-mode');
      if (modeSel) {
        modeSel.onchange = (e) => {
          this._settings.defaultMode = parseInt(e.target.value, 10) === 2 ? 2 : 1;
          this._saveSettings();
        };
      }
    }, 50);

    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Default Focus Mode</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Initial focus tier entered on Alt+Shift+Z</div>
          </div>
          <select id="${idPrefix}def-mode" style="
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15)); border-radius: 6px;
            padding: 4px 8px; font-size: 12px; outline: none;
          ">
            <option value="1" ${Number(this._settings.defaultMode) !== 2 ? 'selected' : ''}>Sidebars Hidden</option>
            <option value="2" ${Number(this._settings.defaultMode) === 2 ? 'selected' : ''}>Full Studio</option>
          </select>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Keyboard Shortcut</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Cycle Zen modes without overriding Alt+Z Word Wrap</div>
          </div>
          <span style="
            font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:4px;
            background:var(--muted, #27272a); color:var(--foreground, #f4f4f5);
            border:1px solid var(--border, rgba(255,255,255,0.1));
          ">Alt + Shift + Z</span>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZenModePlugin;
}
