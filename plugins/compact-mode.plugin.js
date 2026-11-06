/**
 * @name CompactMode
 * @author AntiPersonality Team
 * @version 3.0.0
 * @description Eliminates wasted vertical whitespace in chat logs and maximizes visible code real estate across 3 customizable density levels.
 */

class CompactModePlugin {
  getName() { return "CompactMode"; }

  constructor() {
    this._running = false;
    this._settings = {
      density: 'compact', // 'comfortable', 'compact', 'ultra'
      compactToolBlocks: true,
      hideAvatarsInUltra: true
    };
  }

  start() {
    this._running = true;
    this._loadSettings();

    const css = `
      /* Level: Compact */
      html.better-agy-compact[data-agy-density="compact"] #root .scroll-mt-4,
      html.better-agy-compact[data-agy-density="compact"] #root [data-testid="conversation-turn"] {
        padding-top: 6px !important;
        padding-bottom: 6px !important;
      }
      html.better-agy-compact[data-agy-density="compact"] #root .message-content,
      html.better-agy-compact[data-agy-density="compact"] #root [data-testid="user-message"],
      html.better-agy-compact[data-agy-density="compact"] #root [data-testid="user-message-bubble"],
      html.better-agy-compact[data-agy-density="compact"] #root [data-testid="assistant-message"],
      html.better-agy-compact[data-agy-density="compact"] main .prose,
      html.better-agy-compact[data-agy-density="compact"] main .markdown {
        padding-top: 6px !important;
        padding-bottom: 6px !important;
        line-height: 1.45 !important;
      }
      html.better-agy-compact[data-agy-density="compact"] main pre {
        margin-top: 6px !important;
        margin-bottom: 6px !important;
        max-width: 100% !important;
      }

      /* Level: Ultra-Dense */
      html.better-agy-compact[data-agy-density="ultra"] #root .scroll-mt-4,
      html.better-agy-compact[data-agy-density="ultra"] #root [data-testid="conversation-turn"] {
        padding-top: 2px !important;
        padding-bottom: 2px !important;
      }
      html.better-agy-compact[data-agy-density="ultra"] #root .message-content,
      html.better-agy-compact[data-agy-density="ultra"] #root [data-testid="user-message"],
      html.better-agy-compact[data-agy-density="ultra"] #root [data-testid="user-message-bubble"],
      html.better-agy-compact[data-agy-density="ultra"] #root [data-testid="assistant-message"],
      html.better-agy-compact[data-agy-density="ultra"] main .prose,
      html.better-agy-compact[data-agy-density="ultra"] main .markdown {
        padding-top: 3px !important;
        padding-bottom: 3px !important;
        line-height: 1.35 !important;
        font-size: 12.5px !important;
      }
      html.better-agy-compact[data-agy-density="ultra"] main pre {
        margin-top: 4px !important;
        margin-bottom: 4px !important;
        max-width: 100% !important;
      }
      html.better-agy-compact[data-agy-density="ultra"].agy-hide-avatars #root [data-testid="avatar"],
      html.better-agy-compact[data-agy-density="ultra"].agy-hide-avatars #root [data-testid="conversation-turn"] img.rounded-full {
        display: none !important;
      }

      /* Compact Tool Calls */
      html.better-agy-compact.agy-compact-tools #root [data-testid="tool-execution"],
      html.better-agy-compact.agy-compact-tools #root .tool-call-block {
        padding: 4px 8px !important;
        margin: 3px 0 !important;
        font-size: 11px !important;
      }
    `;
    AgyApi.DOM.addStyle('plugin-compact-mode', css);

    this.applyDensity();
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('CompactMode', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('CompactMode', 'settings', this._settings);
    } catch (_) {}
  }

  applyDensity() {
    if (!this._running) return;
    const el = document.documentElement;
    el.classList.add('better-agy-compact');
    el.setAttribute('data-agy-density', this._settings.density || 'compact');

    if (this._settings.hideAvatarsInUltra && this._settings.density === 'ultra') {
      el.classList.add('agy-hide-avatars');
    } else {
      el.classList.remove('agy-hide-avatars');
    }

    if (this._settings.compactToolBlocks) {
      el.classList.add('agy-compact-tools');
    } else {
      el.classList.remove('agy-compact-tools');
    }
  }

  stop() {
    this._running = false;
    const el = document.documentElement;
    el.classList.remove('better-agy-compact', 'agy-hide-avatars', 'agy-compact-tools');
    el.removeAttribute('data-agy-density');
    el.removeAttribute('data-density');
    AgyApi.DOM.removeStyle('plugin-compact-mode');
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-cm-set-';

    const densities = [
      { id: 'comfortable', label: 'Comfortable', desc: 'Stock Antigravity density with standard margins' },
      { id: 'compact', label: 'Compact', desc: 'Balanced padding reduction; ideal for pair-programming' },
      { id: 'ultra', label: 'Ultra-Dense', desc: 'Maximum code visibility and tightened conversation turns' }
    ];

    setTimeout(() => {
      densities.forEach(d => {
        const btn = document.getElementById(idPrefix + 'density-' + d.id);
        if (btn) {
          btn.onclick = () => {
            this._settings.density = d.id;
            this._saveSettings();
            if (this._running) this.applyDensity();
            densities.forEach(other => {
              const b = document.getElementById(idPrefix + 'density-' + other.id);
              if (b) {
                const isSel = other.id === d.id;
                b.style.borderColor = isSel ? 'var(--foreground, #f4f4f5)' : 'var(--border, rgba(255,255,255,0.08))';
                b.style.background = isSel ? 'var(--sidebar-secondary, rgba(255,255,255,0.1))' : 'var(--background, #09090b)';
              }
            });
            AgyApi.UI.showToast(`Density set to: ${d.label}`, { type: 'info' });
          };
        }
      });

      const toolBtn = document.getElementById(idPrefix + 'tools');
      if (toolBtn) {
        toolBtn.onclick = () => {
          this._settings.compactToolBlocks = !this._settings.compactToolBlocks;
          this._saveSettings();
          if (this._running) this.applyDensity();
          const ch = this._settings.compactToolBlocks;
          toolBtn.style.background = ch ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
          toolBtn.style.borderColor = ch ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
          const dot = toolBtn.querySelector('span');
          if (dot) {
            dot.style.left = ch ? '17px' : '1px';
            dot.style.background = ch ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
          }
        };
      }

      const avatarBtn = document.getElementById(idPrefix + 'avatars');
      if (avatarBtn) {
        avatarBtn.onclick = () => {
          this._settings.hideAvatarsInUltra = !this._settings.hideAvatarsInUltra;
          this._saveSettings();
          if (this._running) this.applyDensity();
          const ch = this._settings.hideAvatarsInUltra;
          avatarBtn.style.background = ch ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
          avatarBtn.style.borderColor = ch ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
          const dot = avatarBtn.querySelector('span');
          if (dot) {
            dot.style.left = ch ? '17px' : '1px';
            dot.style.background = ch ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
          }
        };
      }
    }, 50);

    const isToolsChecked = this._settings.compactToolBlocks;
    const isAvatarsChecked = this._settings.hideAvatarsInUltra;

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5); margin-bottom:8px;">Density Profile</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
            ${densities.map(d => {
              const isSel = this._settings.density === d.id;
              return `
                <div id="${idPrefix}density-${d.id}" style="
                  padding: 10px; border-radius: 6px; cursor: pointer;
                  background: ${isSel ? 'var(--sidebar-secondary, rgba(255,255,255,0.1))' : 'var(--background, #09090b)'};
                  border: 1px solid ${isSel ? 'var(--foreground, #f4f4f5)' : 'var(--border, rgba(255,255,255,0.08))'};
                  transition: all 0.15s ease;
                ">
                  <div style="font-size:12.5px; font-weight:600; color:var(--foreground, #f4f4f5); margin-bottom:3px;">${d.label}</div>
                  <div style="font-size:11px; color:var(--muted-foreground, #71717a); line-height:1.3;">${d.desc}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-top:1px solid var(--border, rgba(255,255,255,0.06)); border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Compact Tool Execution Blocks</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Slims down tool calls and output cards in conversation turns</div>
          </div>
          <button id="${idPrefix}tools" class="agy-switch-toggle" style="
            width: 36px; height: 20px; border-radius: 999px;
            background: ${isToolsChecked ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)'};
            border: 1px solid ${isToolsChecked ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)'};
            position: relative; cursor: pointer; padding: 0; outline: none; transition: all 0.2s ease;
          ">
            <span style="
              position: absolute; top: 1px; left: ${isToolsChecked ? '17px' : '1px'};
              width: 16px; height: 16px; border-radius: 50%;
              background: ${isToolsChecked ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)'};
              transition: all 0.2s ease;
            "></span>
          </button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Hide Avatars in Ultra-Dense</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Hides profile avatars to align chat text flush with code margin</div>
          </div>
          <button id="${idPrefix}avatars" class="agy-switch-toggle" style="
            width: 36px; height: 20px; border-radius: 999px;
            background: ${isAvatarsChecked ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)'};
            border: 1px solid ${isAvatarsChecked ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)'};
            position: relative; cursor: pointer; padding: 0; outline: none; transition: all 0.2s ease;
          ">
            <span style="
              position: absolute; top: 1px; left: ${isAvatarsChecked ? '17px' : '1px'};
              width: 16px; height: 16px; border-radius: 50%;
              background: ${isAvatarsChecked ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)'};
              transition: all 0.2s ease;
            "></span>
          </button>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CompactModePlugin;
}
