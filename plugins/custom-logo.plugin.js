/**
 * @name CustomLogo
 * @author AntiPersonality Team
 * @version 3.1.0
 * @description Customizes top-left app emblem with telemetry-reactive presets (Cyber Delta, Minimalist Monogram, Pulse Orb, Custom Text), orbital streaming animations, and Alt+Click Prism Overdrive.
 */

class CustomLogoPlugin {
  getName() { return "CustomLogo"; }

  constructor() {
    this._observer = null;
    this._rafId = null;
    this._running = false;
    this._hiddenSvg = null;
    this._customEl = null;
    this._settings = {
      preset: 'cyber-delta', // 'cyber-delta', 'monogram', 'pulse-orb', 'custom'
      customText: 'AP',
      glowIntensity: 4
    };
  }

  _escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  start() {
    this._running = true;
    this._loadSettings();

    const css = `
      @keyframes agyOrbSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes agyCoreBreathe {
        0%, 100% { transform: scale(0.92); opacity: 0.82; }
        50%      { transform: scale(1.08); opacity: 1; }
      }
      @keyframes agyPrismCycle {
        0%   { filter: drop-shadow(0 0 8px #38bdf8) hue-rotate(0deg); }
        50%  { filter: drop-shadow(0 0 12px #ff1e56) hue-rotate(180deg); }
        100% { filter: drop-shadow(0 0 8px #38bdf8) hue-rotate(360deg); }
      }
      @keyframes agyLogoGlitch {
        0%, 100% { transform: translate(0); }
        25% { transform: translate(-2px, 1px) skewX(8deg); filter: drop-shadow(2px 0 #ff1e56) drop-shadow(-2px 0 #06b6d4); }
        65% { transform: translate(2px, -1px) skewX(-6deg); }
      }
      .better-agy-custom-logo {
        transition: transform 220ms var(--agy-spring-snappy, ease);
      }
      .better-agy-custom-logo:hover {
        transform: scale(1.1);
      }
      .agy-logo-svg .agy-orb-halo {
        transform-origin: 12px 12px;
        animation: agyOrbSpin 14s linear infinite;
      }
      .agy-logo-svg .agy-orb-core,
      .agy-logo-svg .agy-delta-core {
        transform-origin: 12px 12px;
        animation: agyCoreBreathe 3.6s ease-in-out infinite;
      }
      html[data-agy-agent-state="streaming"] .agy-logo-svg .agy-orb-halo,
      html[data-agy-agent-state="typing-frenzy"] .agy-logo-svg .agy-orb-halo {
        animation-duration: 1.15s;
      }
      html[data-agy-agent-state="streaming"] .agy-logo-svg .agy-orb-core,
      html[data-agy-agent-state="streaming"] .agy-logo-svg .agy-delta-core {
        animation-duration: 0.9s;
      }
      html[data-agy-agent-state="error"] .better-agy-custom-logo {
        animation: agyLogoGlitch 260ms steps(2, end) 2;
      }
      html[data-agy-overdrive] .better-agy-custom-logo {
        color: var(--theme-aura, #38bdf8) !important;
        animation: agyPrismCycle 3.2s linear infinite !important;
      }
    `;
    AgyApi.DOM.addStyle('plugin-custom-logo', css);

    this._applyLogo();

    this._observer = new MutationObserver(() => {
      if (!this._running || this._rafId !== null) return;
      if (this._customEl && this._customEl.isConnected && this._hiddenSvg && this._hiddenSvg.style.display === 'none') {
        return;
      }
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        if (!this._running) return;
        try { this._applyLogo(); } catch (_) {}
      });
    });

    if (document.body) {
      this._observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('CustomLogo', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('CustomLogo', 'settings', this._settings);
    } catch (_) {}
  }

  _getGlowValue() {
    const raw = Number(this._settings.glowIntensity ?? 4);
    return Number.isFinite(raw) ? Math.max(0, Math.min(14, raw)) : 4;
  }

  _getLogoHTML() {
    const glow = this._getGlowValue();
    const filterStyle = glow > 0 ? `filter: drop-shadow(0 0 ${glow}px currentColor);` : '';

    switch (this._settings.preset) {
      case 'monogram':
        return `<span style="font-weight:900; font-size:13.5px; letter-spacing:-0.05em; color:currentColor; line-height:1; ${filterStyle}">AP</span>`;
      case 'pulse-orb':
        return `<svg class="agy-logo-svg" data-agy-logo-svg="true" viewBox="0 0 24 24" width="20" height="20" fill="none" style="color:currentColor; vertical-align:middle; ${filterStyle}"><circle class="agy-orb-core" cx="12" cy="12" r="4.5" fill="currentColor" /><circle class="agy-orb-halo" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3.2 2.8" opacity="0.88" /></svg>`;
      case 'custom': {
        const safeText = this._escapeHtml((this._settings.customText || 'AP').slice(0, 4)) || 'AP';
        return `<span style="font-size:14px; font-weight:700; color:currentColor; line-height:1; ${filterStyle}">${safeText}</span>`;
      }
      case 'cyber-delta':
      default:
        return `<svg class="agy-logo-svg" data-agy-logo-svg="true" viewBox="0 0 24 24" width="20" height="20" fill="none" style="color:currentColor; vertical-align:middle; ${filterStyle}"><path d="M12 3 L2 21 L22 21 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><path class="agy-delta-core" d="M12 9 L7 18 L17 18 Z" fill="currentColor" opacity="0.42" /></svg>`;
    }
  }

  _findLogoButton() {
    return document.querySelector('[data-testid="app-icon-new-conversation-button"]') ||
           document.querySelector('button[aria-label="New conversation"]') ||
           document.querySelector('[aria-label="New conversation"] svg:not([data-agy-logo-svg])')?.parentElement ||
           null;
  }

  _toggleOverdrive(e) {
    e.preventDefault();
    e.stopPropagation();
    const active = document.documentElement.toggleAttribute('data-agy-overdrive');
    window.dispatchEvent(new CustomEvent('agy:sound', { detail: { type: active ? 'overdrive' : 'toggle-off' } }));
    if (active && AgyApi.UI && typeof AgyApi.UI.spawnBurst === 'function') {
      AgyApi.UI.spawnBurst(e.clientX || 28, e.clientY || 24, 'var(--theme-aura, #38bdf8)');
    }
    AgyApi.UI.showToast(active ? 'Prism Overdrive: Engaged' : 'Prism Overdrive: Standby', {
      type: active ? 'success' : 'info',
      timeout: 1800
    });
  }

  _applyLogo() {
    if (!this._running) return;
    const btn = this._findLogoButton();
    if (!btn) return;

    const originalSvg = btn.querySelector(':scope > svg:not([data-agy-logo-svg])') ||
                        btn.querySelector('svg:not([data-agy-logo-svg])');
    if (originalSvg) {
      if (this._hiddenSvg && this._hiddenSvg !== originalSvg && this._hiddenSvg.isConnected) {
        this._hiddenSvg.style.display = '';
      }
      if (originalSvg.style.display !== 'none') {
        originalSvg.style.display = 'none';
      }
      this._hiddenSvg = originalSvg;
    }

    const nextHtml = this._getLogoHTML().trim();
    let custom = btn.querySelector('.better-agy-custom-logo');
    if (!custom) {
      custom = document.createElement('span');
      custom.className = 'better-agy-custom-logo';
      custom.setAttribute('data-agy-managed', 'true');
      custom.title = 'New conversation (Alt+Click or Right-Click for Prism Overdrive)';
      custom.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; cursor:pointer; color:var(--foreground, #f4f4f5);';
      custom.addEventListener('click', (e) => {
        if (e.altKey) this._toggleOverdrive(e);
      }, true);
      custom.addEventListener('contextmenu', (e) => this._toggleOverdrive(e));
      btn.appendChild(custom);
    }

    if (custom.dataset.agyRendered !== nextHtml) {
      custom.dataset.agyRendered = nextHtml;
      custom.innerHTML = nextHtml;
    }
    this._customEl = custom;
  }

  stop() {
    this._running = false;
    this._customEl = null;
    document.documentElement?.removeAttribute('data-agy-overdrive');
    AgyApi.DOM.removeStyle('plugin-custom-logo');
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    document.querySelectorAll('.better-agy-custom-logo').forEach(el => {
      const parent = el.parentElement;
      el.remove();
      const svg = parent?.querySelector('svg:not([data-agy-logo-svg])');
      if (svg && svg.style.display === 'none') {
        svg.style.display = '';
      }
    });
    if (this._hiddenSvg) {
      if (this._hiddenSvg.isConnected) {
        this._hiddenSvg.style.display = '';
      }
      this._hiddenSvg = null;
    }
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-cl-set-';
    const glowValNum = this._getGlowValue();
    const safeCustomVal = this._escapeHtml((this._settings.customText || 'AP').slice(0, 4));

    const presets = [
      { id: 'cyber-delta', label: 'Cyber Delta', desc: 'Breathing geometric delta prism' },
      { id: 'monogram', label: 'Minimal Monogram', desc: 'Monochromatic AP modern typography' },
      { id: 'pulse-orb', label: 'Pulse Orb', desc: 'Streaming-reactive orbital halo & core' },
      { id: 'custom', label: 'Custom Text', desc: 'Custom initials, monograph, or symbols' }
    ];

    setTimeout(() => {
      const updatePreview = () => {
        const prevBox = document.getElementById(idPrefix + 'prev-box');
        if (prevBox) {
          prevBox.innerHTML = this._getLogoHTML();
        }
      };

      presets.forEach(p => {
        const el = document.getElementById(idPrefix + 'preset-' + p.id);
        if (el) {
          el.onclick = () => {
            this._settings.preset = p.id;
            this._saveSettings();
            if (this._running) this._applyLogo();
            updatePreview();

            presets.forEach(other => {
              const b = document.getElementById(idPrefix + 'preset-' + other.id);
              if (b) {
                const isSel = other.id === p.id;
                b.style.borderColor = isSel ? 'var(--foreground, #f4f4f5)' : 'var(--border, rgba(255,255,255,0.08))';
                b.style.background = isSel ? 'var(--sidebar-secondary, rgba(255,255,255,0.1))' : 'var(--background, #09090b)';
              }
            });

            const custWrap = document.getElementById(idPrefix + 'custom-wrap');
            if (custWrap) {
              custWrap.style.display = p.id === 'custom' ? 'flex' : 'none';
            }
          };
        }
      });

      const custInp = document.getElementById(idPrefix + 'custom-inp');
      if (custInp) {
        custInp.oninput = (e) => {
          this._settings.customText = String(e.target.value || '').slice(0, 4);
          this._saveSettings();
          if (this._running) this._applyLogo();
          updatePreview();
        };
      }

      const glowInp = document.getElementById(idPrefix + 'glow');
      const glowVal = document.getElementById(idPrefix + 'glow-val');
      if (glowInp && glowVal) {
        glowInp.oninput = (e) => {
          const val = parseInt(e.target.value, 10);
          this._settings.glowIntensity = Number.isFinite(val) ? val : 0;
          glowVal.textContent = `${this._settings.glowIntensity}px`;
          this._saveSettings();
          if (this._running) this._applyLogo();
          updatePreview();
        };
      }

      updatePreview();
    }, 50);

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:8px; background:var(--background, #09090b); border:1px solid var(--border, rgba(255,255,255,0.1));">
          <div>
            <div style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5);">Live Icon Preview</div>
            <div style="font-size:11px; color:var(--muted-foreground, #71717a);">Accelerates during streaming; Alt+Click emblem for Prism Overdrive</div>
          </div>
          <div id="${idPrefix}prev-box" style="
            width: 40px; height: 40px; border-radius: 8px; color: var(--foreground, #f4f4f5);
            background: var(--card, #18181b); border: 1px solid var(--border, rgba(255,255,255,0.12));
            display: flex; align-items: center; justify-content: center;
          "></div>
        </div>

        <div>
          <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5); margin-bottom:8px;">Emblem Preset</div>
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
            ${presets.map(p => {
              const isSel = this._settings.preset === p.id;
              return `
                <div id="${idPrefix}preset-${p.id}" style="
                  padding: 10px; border-radius: 6px; cursor: pointer;
                  background: ${isSel ? 'var(--sidebar-secondary, rgba(255,255,255,0.1))' : 'var(--background, #09090b)'};
                  border: 1px solid ${isSel ? 'var(--foreground, #f4f4f5)' : 'var(--border, rgba(255,255,255,0.08))'};
                  transition: all 0.15s ease;
                ">
                  <div style="font-size:12.5px; font-weight:600; color:var(--foreground, #f4f4f5); margin-bottom:3px;">${p.label}</div>
                  <div style="font-size:11px; color:var(--muted-foreground, #71717a);">${p.desc}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div id="${idPrefix}custom-wrap" style="
          display: ${this._settings.preset === 'custom' ? 'flex' : 'none'};
          justify-content: space-between; align-items: center; padding: 10px 0;
          border-top: 1px solid var(--border, rgba(255,255,255,0.06));
        ">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Custom Emblem Content</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Enter 1-4 characters or initials</div>
          </div>
          <input type="text" id="${idPrefix}custom-inp" value="${safeCustomVal}" maxlength="4" style="
            width: 70px; padding: 4px 8px; text-align: center; border-radius: 6px; font-size: 13px; font-weight: 700;
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15));
          " />
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-top:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Glow Intensity</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Ambient drop shadow radius</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="range" id="${idPrefix}glow" min="0" max="14" value="${glowValNum}" style="width:100px; accent-color:var(--foreground, #f4f4f5); cursor:pointer;" />
            <span id="${idPrefix}glow-val" style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5); min-width:32px;">${glowValNum}px</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomLogoPlugin;
}
