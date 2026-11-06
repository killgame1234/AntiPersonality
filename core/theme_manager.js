/**
 * ThemeManager v3.0.0: Oversees theme parsing, View Transition switching,
 * scoped clean-slate media teardown, per-theme performance controls, and custom user CSS.
 */

(function () {
  if (typeof window.__agyThemeAtmosCleanup === 'function') {
    try { window.__agyThemeAtmosCleanup(); } catch (_) {}
  }

  // Typography, Shockwave View-Transition & Living Atmosphere guardrails (active strictly when html.better-agy-active is set)
  const BASE_GUARDRAILS = `
    @property --agy-beam-angle {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes agyComposerOrbit {
      to { --agy-beam-angle: 360deg; }
    }
    /* AntiPersonality v3.1 Scoped Theme Surface & Typography Guardrails */
    html.better-agy-active #root,
    html.better-agy-active .bg-background,
    html.better-agy-active .sticky,
    html.better-agy-active .md-sticky-message-bleed {
      background-color: transparent !important;
      box-shadow: none !important;
    }
    html.better-agy-active .settings-modal-container,
    html.better-agy-active .settings-modal-container .bg-background,
    html.better-agy-active [role='dialog'],
    html.better-agy-active [role='menu'],
    html.better-agy-active [role='listbox'] {
      background-color: var(--background, rgba(18, 18, 20, 0.98)) !important;
      backdrop-filter: blur(16px) !important;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.08)) !important;
    }
    /* Zero-Video GPU-Composited Parallax Aura & Circadian Lunar Temperature */
    html.better-agy-active::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background: radial-gradient(
        640px circle at calc(50% + var(--agy-px, 0px)) calc(26% + var(--agy-py, 0px)),
        color-mix(in srgb, var(--theme-aura, transparent) 14%, transparent),
        transparent 72%
      );
      filter: hue-rotate(var(--agy-lunar-shift, 0deg));
      transform: translate3d(0, 0, 0);
    }
    /* Procedural Analog Film Grain (0 opacity on Pure AMOLED to preserve OLED black) */
    html.better-agy-active::after {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 9998;
      pointer-events: none;
      opacity: var(--agy-grain-opacity, 0);
      mix-blend-mode: overlay;
      background-image: var(--agy-atmos-overlay, url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"));
    }
    /* Telemetry-Reactive Composer Conic Rim & Acoustic RMS Glow */
    html.better-agy-active[data-agy-agent-state="streaming"] .surface-composer-card {
      background:
        linear-gradient(var(--card, #121215), var(--card, #121215)) padding-box,
        conic-gradient(
          from var(--agy-beam-angle),
          var(--border, rgba(255,255,255,0.14)) 58%,
          var(--theme-aura, #38bdf8) 88%,
          #ffffff 95%,
          var(--border, rgba(255,255,255,0.14)) 100%
        ) border-box !important;
      border: 1px solid transparent !important;
      box-shadow: 0 0 calc(14px + var(--agy-audio-rms, 0) * 26px) color-mix(in srgb, var(--theme-aura, #38bdf8) 32%, transparent) !important;
      animation: agyComposerOrbit 2.2s linear infinite !important;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: 200ms;
      animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    }
    html.agy-vt-shockwave::view-transition-old(root),
    html.agy-vt-shockwave::view-transition-new(root) {
      animation: none !important;
      mix-blend-mode: normal !important;
    }
    html.agy-vt-shockwave::view-transition-new(root) {
      z-index: 99999 !important;
    }
    /* Strictly enforce Antigravity native font stack across UI chrome while preserving monospace code */
    body,
    button,
    input,
    select,
    textarea:not(#agy-custom-css-editor),
    nav,
    aside,
    [role="dialog"],
    .settings-modal-container,
    [data-agy-section],
    [data-agy-tab],
    #agy-settings-content,
    #agy-command-palette-overlay,
    #agy-radial-wheel-overlay,
    .text-foreground,
    .text-secondary-foreground,
    .text-muted-foreground {
      font-family: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif) !important;
    }
    pre,
    code,
    .monaco-editor,
    .xterm,
    #agy-custom-css-editor {
      font-family: 'Geist Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace !important;
    }
  `;

  const THEME_VIDEO_SELECTORS = [
    'body > video',
    'video[id^="blackshores-"]',
    'video[id^="shorekeeper-"]',
    'video[id^="tethys-"]',
    'video[id^="capri-"]',
    'video[id^="eldritch-"]',
    'video[id^="moonlit-"]',
    'video[id^="prescript-"]',
    '[id^="blackshores-"] video',
    '[id^="shorekeeper-"] video',
    '[id^="tethys-"] video',
    '[id^="capri-"] video',
    '[id^="eldritch-"] video',
    '[id^="moonlit-"] video',
    '[id^="prescript-"] video',
    'video[data-agy-theme-media]'
  ].join(', ');

  const THEME_CANVAS_SELECTORS = [
    'body > canvas',
    'canvas[id^="blackshores-"]',
    'canvas[id^="shorekeeper-"]',
    'canvas[id^="tethys-"]',
    'canvas[id^="capri-"]',
    'canvas[id^="eldritch-"]',
    'canvas[id^="moonlit-"]',
    'canvas[id^="prescript-"]',
    'canvas[id*="blackshores"]',
    'canvas[id*="lightning"]',
    'canvas[id*="rift"]',
    'canvas[id*="particle"]',
    'canvas[id*="fate"]',
    'canvas[data-agy-theme-media]'
  ].join(', ');

  const THEME_COMPANION_SELECTORS = [
    '[id^="blackshores-"][id*="companion"]',
    '[id^="blackshores-"][id*="telemetry"]',
    '[id^="shorekeeper-"]',
    '[id^="tethys-"][id*="telemetry"]',
    '[id^="capri-"][id*="companion"]',
    '[id^="capri-"][id*="popout"]',
    '[id^="capri-"][id*="chibi"]',
    '[id^="eldritch-"][id*="companion"]',
    '[id^="moonlit-"][id*="companion"]',
    '[id^="moonlit-"][id*="poem"]',
    '[id^="prescript-"][id*="decree"]',
    '[id^="prescript-"][id*="quote"]',
    '[id*="chibi"]',
    '[id*="quote-box"]',
    '[id*="poem-box"]',
    '#prescript-decree-card'
  ].join(', ');

  class ThemeManager {
    constructor() {
      this.themes = new Map(); // id -> { id, meta, css }
      this.activeThemeId = null;
      this.customCSS = '';
      this.perfSettings = {
        disableBgVideo: false,
        hideCompanions: false
      };
    }

    registerTheme(id, meta, css, persistCustom = false) {
      this.themes.set(id, { id, meta, css });
      if (persistCustom) {
        const savedCustom = AgyApi.Data.load('ThemeManager', 'customThemes', {});
        savedCustom[id] = { id, meta, css };
        AgyApi.Data.save('ThemeManager', 'customThemes', savedCustom);
      }
      if (this.activeThemeId === id) {
        this._ensureActiveStylesheetMounted();
      }
    }

    _ensureActiveStylesheetMounted() {
      if (!this.activeThemeId) return false;
      const theme = this.themes.get(this.activeThemeId);
      if (!theme) return false;
      const fullCss = `${BASE_GUARDRAILS}\n/* Theme: ${theme.meta.name} */\n${theme.css}\n${BASE_GUARDRAILS}`;
      AgyApi.DOM.addStyle('active-theme', fullCss);
      AgyApi.DOM.addStyle('font-guardrails', BASE_GUARDRAILS);
      document.documentElement.classList.add('better-agy-active');
      return true;
    }

    getAllThemes() {
      return Array.from(this.themes.values());
    }

    getTheme(id) {
      return this.themes.get(id);
    }

    getActiveTheme() {
      return this.activeThemeId ? this.themes.get(this.activeThemeId) : null;
    }

    _hasPlayingBgVideo() {
      if (this.perfSettings.disableBgVideo) return false;
      const vids = document.querySelectorAll(THEME_VIDEO_SELECTORS);
      for (let i = 0; i < vids.length; i++) {
        if (!vids[i].paused && vids[i].readyState >= 2) return true;
      }
      return false;
    }

    _runWithViewTransition(mutateFn, useTransition = true, origin = null) {
      const reducedMotion = typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (
        useTransition &&
        !reducedMotion &&
        typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function' &&
        document.visibilityState === 'visible'
      ) {
        try {
          // shortcut: skip clip-path shockwave while an active <video> wallpaper plays to prevent iGPU frame drops, upgrade if compositor offloads video snapshots
          const canShockwave = !this._hasPlayingBgVideo() && typeof document.documentElement.animate === 'function';
          const ox = (origin && Number.isFinite(origin.x)) ? origin.x : window.innerWidth / 2;
          const oy = (origin && Number.isFinite(origin.y)) ? origin.y : window.innerHeight / 2;

          if (canShockwave) {
            const maxR = Math.hypot(
              Math.max(ox, window.innerWidth - ox),
              Math.max(oy, window.innerHeight - oy)
            );
            document.documentElement.classList.add('agy-vt-shockwave');
            const vt = document.startViewTransition(() => {
              mutateFn();
            });
            vt.ready.then(() => {
              document.documentElement.animate(
                {
                  clipPath: [
                    `circle(0px at ${ox}px ${oy}px)`,
                    `circle(${Math.ceil(maxR)}px at ${ox}px ${oy}px)`
                  ]
                },
                {
                  duration: 420,
                  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  pseudoElement: '::view-transition-new(root)'
                }
              );
            }).catch(() => {});
            vt.finished.finally(() => {
              document.documentElement.classList.remove('agy-vt-shockwave');
            });
            return;
          }

          document.startViewTransition(() => {
            mutateFn();
          });
          return;
        } catch (_) {
          document.documentElement.classList.remove('agy-vt-shockwave');
        }
      }
      mutateFn();
    }

    enableTheme(id, showToastNotification = true, useViewTransition = true, origin = null) {
      const theme = this.themes.get(id);
      if (!theme) {
        console.warn(`[ThemeManager] Theme ${id} not found.`);
        return false;
      }

      this._cleanupInteractiveThemeEngines(false);
      this.activeThemeId = id;
      AgyApi.Data.save('ThemeManager', 'activeTheme', id);

      const applyStyles = () => {
        this._ensureActiveStylesheetMounted();
        this.applyPerfControls();
      };

      this._runWithViewTransition(applyStyles, useViewTransition && showToastNotification, origin);
      document.documentElement.classList.add('better-agy-active');

      if (showToastNotification) {
        window.dispatchEvent(new CustomEvent('agy:sound', { detail: { type: 'theme-compile' } }));
        if (AgyApi.UI && typeof AgyApi.UI.flashCompileBar === 'function') {
          AgyApi.UI.flashCompileBar();
        }
        AgyApi.UI.showToast(`Applied theme: ${theme.meta.name}`, { type: 'success' });
      }

      this._emitChange();
      return true;
    }

    previewTheme(id) {
      if (!id || id === 'stock') {
        AgyApi.DOM.removeStyle('active-theme');
        document.documentElement.classList.remove('better-agy-active');
        return true;
      }
      const theme = this.themes.get(id);
      if (!theme) return false;
      const fullCss = `${BASE_GUARDRAILS}\n/* Theme Preview: ${theme.meta.name} */\n${theme.css}\n${BASE_GUARDRAILS}`;
      AgyApi.DOM.addStyle('active-theme', fullCss);
      AgyApi.DOM.addStyle('font-guardrails', BASE_GUARDRAILS);
      document.documentElement.classList.add('better-agy-active');
      return true;
    }

    restoreActiveThemeStyles() {
      if (this.activeThemeId && this.themes.has(this.activeThemeId)) {
        this._ensureActiveStylesheetMounted();
      } else {
        AgyApi.DOM.removeStyle('active-theme');
        document.documentElement.classList.remove('better-agy-active');
      }
    }

    getPerfSettings() {
      return { ...this.perfSettings };
    }

    setPerfSetting(key, value, showToastNotification = true) {
      if (!Object.prototype.hasOwnProperty.call(this.perfSettings, key)) return false;
      this.perfSettings[key] = Boolean(value);
      AgyApi.Data.save('ThemeManager', 'perfSettings', this.perfSettings);
      this.applyPerfControls();

      if (showToastNotification) {
        const label = key === 'disableBgVideo' ? 'Background Video' : 'Floating Companions';
        const stateText = this.perfSettings[key] ? 'hidden/paused' : 'enabled';
        AgyApi.UI.showToast(`${label}: ${stateText}`, { type: 'info', timeout: 2200 });
      }
      this._emitChange();
      return true;
    }

    applyPerfControls() {
      const rules = [];
      if (this.perfSettings.disableBgVideo) {
        rules.push(`
          ${THEME_VIDEO_SELECTORS} {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `);
        document.querySelectorAll(THEME_VIDEO_SELECTORS).forEach(v => {
          try { v.pause(); } catch (_) {}
        });
      } else {
        document.querySelectorAll(THEME_VIDEO_SELECTORS).forEach(v => {
          try {
            if (v.paused && v.src) v.play().catch(() => {});
          } catch (_) {}
        });
      }

      if (this.perfSettings.hideCompanions) {
        rules.push(`
          ${THEME_COMPANION_SELECTORS} {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `);
      }

      if (rules.length > 0) {
        AgyApi.DOM.addStyle('perf-controls', rules.join('\n'));
      } else {
        AgyApi.DOM.removeStyle('perf-controls');
      }
    }

    _cleanupInteractiveThemeEngines(removeActiveCss = false) {
      // 1. Moonlit Lotus Skiff State & Timers
      if (window.__moonlitState) {
        try { if (window.__moonlitState.watchdog) clearInterval(window.__moonlitState.watchdog); } catch (_) {}
        try { if (window.__moonlitState.rotationInterval) clearInterval(window.__moonlitState.rotationInterval); } catch (_) {}
        try { if (window.__moonlitState.poemInterval) clearInterval(window.__moonlitState.poemInterval); } catch (_) {}
        try { if (window.__moonlitState.poemTimer) clearTimeout(window.__moonlitState.poemTimer); } catch (_) {}
        try { if (window.__moonlitState.animFrame) cancelAnimationFrame(window.__moonlitState.animFrame); } catch (_) {}
        try { if (window.__moonlitState.observer) window.__moonlitState.observer.disconnect(); } catch (_) {}
        try { if (window.__moonlitState.cleanupListeners) window.__moonlitState.cleanupListeners(); } catch (_) {}
        try { if (window.__moonlitState.audioCtx) window.__moonlitState.audioCtx.close(); } catch (_) {}
        window.__moonlitState = null;
      }
      try { if (window.__moonlitAnimFrame) { cancelAnimationFrame(window.__moonlitAnimFrame); window.__moonlitAnimFrame = null; } } catch (_) {}
      try { if (window.__moonlitCleanupListeners) { window.__moonlitCleanupListeners(); window.__moonlitCleanupListeners = null; } } catch (_) {}

      // 2. Black Shores & Shorekeeper State & Timers
      if (window.__blackShoresState) {
        try { if (window.__blackShoresState.sceneryTimer) clearInterval(window.__blackShoresState.sceneryTimer); } catch (_) {}
        try { if (window.__blackShoresState.decreeTimer) clearInterval(window.__blackShoresState.decreeTimer); } catch (_) {}
        try { if (window.__blackShoresState.watchdog) clearInterval(window.__blackShoresState.watchdog); } catch (_) {}
        try { if (window.__blackShoresState.animFrame) cancelAnimationFrame(window.__blackShoresState.animFrame); } catch (_) {}
        try { if (window.__blackShoresState.observer) window.__blackShoresState.observer.disconnect(); } catch (_) {}
        try { if (window.__blackShoresState.cleanupListeners) window.__blackShoresState.cleanupListeners(); } catch (_) {}
        try { if (window.__blackShoresState.audioCtx) window.__blackShoresState.audioCtx.close(); } catch (_) {}
        window.__blackShoresState = null;
      }
      try { if (window.__blackShoresAnimFrame) { cancelAnimationFrame(window.__blackShoresAnimFrame); window.__blackShoresAnimFrame = null; } } catch (_) {}
      try { if (window.__blackShoresCleanupListeners) { window.__blackShoresCleanupListeners(); window.__blackShoresCleanupListeners = null; } } catch (_) {}

      // 3. Prescript State & Timers
      if (window.__prescriptState) {
        try { if (window.__prescriptState.quoteInterval) clearInterval(window.__prescriptState.quoteInterval); } catch (_) {}
        try { if (window.__prescriptState.watchdog) clearInterval(window.__prescriptState.watchdog); } catch (_) {}
        try { if (window.__prescriptState.animFrame) cancelAnimationFrame(window.__prescriptState.animFrame); } catch (_) {}
        try { if (window.__prescriptState.observer) window.__prescriptState.observer.disconnect(); } catch (_) {}
        try { if (window.__prescriptState.cleanupListeners) window.__prescriptState.cleanupListeners(); } catch (_) {}
        try { if (window.__prescriptState.audioCtx) window.__prescriptState.audioCtx.close(); } catch (_) {}
        window.__prescriptState = null;
      }
      try { if (window.__prescriptTypewriterTimer) { clearTimeout(window.__prescriptTypewriterTimer); window.__prescriptTypewriterTimer = null; } } catch (_) {}
      try { if (window.__prescriptQuoteInterval) { clearInterval(window.__prescriptQuoteInterval); window.__prescriptQuoteInterval = null; } } catch (_) {}
      try { if (window.__prescriptAnimFrame) { cancelAnimationFrame(window.__prescriptAnimFrame); window.__prescriptAnimFrame = null; } } catch (_) {}
      try { if (window.__prescriptObserver) { window.__prescriptObserver.disconnect(); window.__prescriptObserver = null; } } catch (_) {}
      try { if (window.__prescriptCleanupListeners) { window.__prescriptCleanupListeners(); window.__prescriptCleanupListeners = null; } } catch (_) {}

      // 4. Capri State & Timers
      if (window.__capriState) {
        try { if (window.__capriState.animFrame) cancelAnimationFrame(window.__capriState.animFrame); } catch (_) {}
        try { if (window.__capriState.observer) window.__capriState.observer.disconnect(); } catch (_) {}
        try { if (window.__capriState.cleanupListeners) window.__capriState.cleanupListeners(); } catch (_) {}
        try { if (window.__capriState.audioCtx) window.__capriState.audioCtx.close(); } catch (_) {}
        window.__capriState = null;
      }
      try { if (window.__capriTopPopoutTimer) { clearTimeout(window.__capriTopPopoutTimer); window.__capriTopPopoutTimer = null; } } catch (_) {}
      try { if (window.__capriAnimFrame) { cancelAnimationFrame(window.__capriAnimFrame); window.__capriAnimFrame = null; } } catch (_) {}
      try { if (window.__capriObserver) { window.__capriObserver.disconnect(); window.__capriObserver = null; } } catch (_) {}
      try { if (window.__capriCleanupListeners) { window.__capriCleanupListeners(); window.__capriCleanupListeners = null; } } catch (_) {}

      // 5. Eldritch State & Timers
      if (window.__eldritchState) {
        try { if (window.__eldritchState.animFrame) cancelAnimationFrame(window.__eldritchState.animFrame); } catch (_) {}
        try { if (window.__eldritchState.observer) window.__eldritchState.observer.disconnect(); } catch (_) {}
        try { if (window.__eldritchState.cleanupListeners) window.__eldritchState.cleanupListeners(); } catch (_) {}
        try { if (window.__eldritchState.audioCtx) window.__eldritchState.audioCtx.close(); } catch (_) {}
        window.__eldritchState = null;
      }
      try { if (window.__eldritchObserver) { window.__eldritchObserver.disconnect(); window.__eldritchObserver = null; } } catch (_) {}
      try { if (window.__halibutEyeAnimFrame) { cancelAnimationFrame(window.__halibutEyeAnimFrame); window.__halibutEyeAnimFrame = null; } } catch (_) {}
      try { if (window.__eldritchHoverEyeAnimFrame) { cancelAnimationFrame(window.__eldritchHoverEyeAnimFrame); window.__eldritchHoverEyeAnimFrame = null; } } catch (_) {}
      try { if (window.__eldritchHoverCleanup) { window.__eldritchHoverCleanup(); window.__eldritchHoverCleanup = null; } } catch (_) {}

      // 6. Clean known external theme style tags (never broad [id*="theme"] which could touch native styles)
      const oldStyleIds = [
        'custom-antigravity-theme',
        'blackshores-theme-css',
        'better-agy-theme'
      ];
      if (removeActiveCss) {
        oldStyleIds.push('agy-style-active-theme');
      }
      oldStyleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      document.querySelectorAll('style[id*="blackshores"], style[id*="custom-antigravity"]').forEach(el => el.remove());

      // 7. Pause, revoke blob URLs, and remove strictly theme-owned video elements
      document.querySelectorAll(THEME_VIDEO_SELECTORS).forEach(v => {
        try {
          v.pause();
          if (v.src && v.src.startsWith('blob:')) URL.revokeObjectURL(v.src);
          v.removeAttribute('src');
          v.load();
          v.remove();
        } catch (_) {}
      });

      // 8. Zero GPU buffers and remove strictly theme-owned canvas elements
      document.querySelectorAll(THEME_CANVAS_SELECTORS).forEach(c => {
        try {
          c.width = 0;
          c.height = 0;
          c.remove();
        } catch (_) {}
      });

      // 9. Clean theme DOM overlays, quick-theme-bar & injected companion nodes
      document.querySelectorAll('#agy-quick-theme-bar').forEach(el => el.remove());
      const themeSelectors = [
        '[id^="blackshores-"]', '[id^="shorekeeper-"]', '[id^="tethys-"]',
        '[id^="eldritch-"]', '[id^="moonlit-"]', '[id^="capri-"]', '[id^="prescript-"]',
        THEME_COMPANION_SELECTORS,
        '.prescript-stop-seal-svg', '.moonlit-top-app-icon', '.prescript-top-app-icon', 'link[rel="icon"][href^="data:"]'
      ];
      document.querySelectorAll(themeSelectors.join(', ')).forEach(el => {
        try {
          if (el.dataset && el.dataset.oldBlobUrl) URL.revokeObjectURL(el.dataset.oldBlobUrl);
          if (el.src && el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
          el.remove();
        } catch (_) {}
      });

      // 10. Reset title bar logo unless CustomLogo plugin is active
      const logoBtn = document.querySelector('[data-testid="app-icon-new-conversation-button"]');
      if (logoBtn) {
        logoBtn.querySelectorAll('.moonlit-top-app-icon, .prescript-top-app-icon, img:not(.better-agy-custom-logo)').forEach(el => el.remove());
        const defaultSvg = logoBtn.querySelector('svg');
        if (defaultSvg && !logoBtn.querySelector('.better-agy-custom-logo')) {
          defaultSvg.style.display = '';
        } else if (!defaultSvg && !logoBtn.querySelector('.better-agy-custom-logo')) {
          logoBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 19.5h20L12 2zm0 3.8L18.5 17.5h-13L12 5.8z"/></svg>';
        }
      }

      // 11. Reset body & HTML classes from all themes
      const themeClasses = [
        'scenery-archipelago', 'scenery-cavern', 'stage-resonance', 'stage-nebula', 'stage-tethys',
        'mode-active-chat', 'mode-new-conv', 'hud-hidden', 'theme-standalone',
        'realm-skiff', 'realm-tree',
        'eldritch-active', 'tethys-active', 'prescript-active', 'capri-active', 'moonlit-active', 'capri-walking'
      ];
      themeClasses.forEach(cls => {
        if (document.body) document.body.classList.remove(cls);
        document.documentElement.classList.remove(cls);
      });
    }

    disableTheme(showToastNotification = true, useViewTransition = true, origin = null) {
      this._cleanupInteractiveThemeEngines(false);
      this.activeThemeId = null;
      AgyApi.Data.save('ThemeManager', 'activeTheme', null);

      const clearStyles = () => {
        AgyApi.DOM.removeStyle('active-theme');
        AgyApi.DOM.addStyle('font-guardrails', BASE_GUARDRAILS);
        document.documentElement.classList.remove('better-agy-active');
      };

      this._runWithViewTransition(clearStyles, useViewTransition && showToastNotification, origin);

      if (showToastNotification) {
        window.dispatchEvent(new CustomEvent('agy:sound', { detail: { type: 'toggle-off' } }));
        AgyApi.UI.showToast('Restored stock Antigravity theme', { type: 'info' });
      }

      this._emitChange();
      return true;
    }

    setCustomCSS(css, showToastNotification = true) {
      this.customCSS = css || '';
      AgyApi.Data.save('ThemeManager', 'customCSS', this.customCSS);
      if (this.customCSS.trim()) {
        AgyApi.DOM.addStyle('custom-css', `/* AntiPersonality User Custom CSS */\n${this.customCSS}`);
      } else {
        AgyApi.DOM.removeStyle('custom-css');
      }
      if (showToastNotification) {
        AgyApi.UI.showToast('Custom CSS saved and applied', { type: 'success' });
      }
    }

    getCustomCSS() {
      return this.customCSS;
    }

    init() {
      // 1. Permanently inject Antigravity font guardrails (surface transparency only activates with html.better-agy-active)
      AgyApi.DOM.addStyle('font-guardrails', BASE_GUARDRAILS);

      // 2. Restore saved custom dynamic themes (if any were generated in-app)
      const savedCustomThemes = AgyApi.Data.load('ThemeManager', 'customThemes', {});
      if (savedCustomThemes && typeof savedCustomThemes === 'object') {
        for (const [id, entry] of Object.entries(savedCustomThemes)) {
          if (!this.themes.has(id) && entry && entry.css) {
            this.themes.set(id, entry);
          }
        }
      }

      // 3. Load performance controls
      const savedPerf = AgyApi.Data.load('ThemeManager', 'perfSettings', null);
      if (savedPerf && typeof savedPerf === 'object') {
        this.perfSettings = Object.assign(this.perfSettings, savedPerf);
      }
      this.applyPerfControls();

      // 4. Load saved custom CSS
      const savedCSS = AgyApi.Data.load('ThemeManager', 'customCSS', '');
      if (savedCSS) this.setCustomCSS(savedCSS, false);

      // 5. Restore active theme CSS without clobbering already-mounted interactive media if hot-reloading
      const savedActive = AgyApi.Data.load('ThemeManager', 'activeTheme', null);
      if (savedActive && this.themes.has(savedActive)) {
        const hasInteractiveMedia = document.querySelectorAll(THEME_VIDEO_SELECTORS + ', ' + THEME_CANVAS_SELECTORS).length > 0;
        if (hasInteractiveMedia && this.activeThemeId === savedActive) {
          this.activeThemeId = savedActive;
          this._ensureActiveStylesheetMounted();
        } else {
          this.enableTheme(savedActive, false, false);
        }
      }
    }

    _emitChange() {
      window.dispatchEvent(new CustomEvent('agy:theme-change', { detail: { activeId: this.activeThemeId } }));
    }
  }

  // Cleanly preserve activeThemeId across hot-reloads if already initialized
  const prevActiveId = window.AgyThemeManager ? window.AgyThemeManager.activeThemeId : null;
  const manager = new ThemeManager();
  if (prevActiveId) manager.activeThemeId = prevActiveId;

  // Lightweight RAF-throttled parallax & circadian lunar shift (active strictly when a theme is enabled)
  let atmosRaf = null;
  const updateLunarShift = () => {
    const h = new Date().getHours();
    const isNight = h >= 22 || h < 5;
    document.documentElement?.style.setProperty('--agy-lunar-shift', isNight ? '-8deg' : '0deg');
  };
  updateLunarShift();
  const lunarTimer = setInterval(updateLunarShift, 600000);

  const onAtmosPointerMove = (e) => {
    if (!manager.activeThemeId || atmosRaf !== null) return;
    const cx = e.clientX;
    const cy = e.clientY;
    atmosRaf = requestAnimationFrame(() => {
      atmosRaf = null;
      const nx = ((cx / Math.max(1, window.innerWidth)) - 0.5) * -32;
      const ny = ((cy / Math.max(1, window.innerHeight)) - 0.5) * -22;
      document.documentElement?.style.setProperty('--agy-px', `${nx.toFixed(1)}px`);
      document.documentElement?.style.setProperty('--agy-py', `${ny.toFixed(1)}px`);
    });
  };
  window.addEventListener('pointermove', onAtmosPointerMove, { passive: true });

  const onCompanionChoreography = (e) => {
    if (!manager.activeThemeId || manager.perfSettings.hideCompanions) return;
    const mood = e.detail?.mood;
    if (!mood) return;
    const nodes = document.querySelectorAll(THEME_COMPANION_SELECTORS);
    nodes.forEach(el => {
      if (typeof el.animate !== 'function') return;
      try {
        if (mood === 'celebrate' || mood === 'wake-startle') {
          el.animate(
            [
              { transform: 'translateY(0) scale(1)' },
              { transform: 'translateY(-14px) scale(1.06)', offset: 0.4 },
              { transform: 'translateY(0) scale(0.97)', offset: 0.75 },
              { transform: 'translateY(0) scale(1)' }
            ],
            { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', composite: 'add' }
          );
        } else if (mood === 'error') {
          el.animate(
            [
              { transform: 'translateX(0)' },
              { transform: 'translateX(-6px) rotate(-3deg)' },
              { transform: 'translateX(6px) rotate(3deg)' },
              { transform: 'translateX(-4px)' },
              { transform: 'translateX(0)' }
            ],
            { duration: 340, easing: 'ease-out', composite: 'add' }
          );
        } else if (mood === 'typing-frenzy') {
          el.animate(
            [
              { transform: 'translateY(0)' },
              { transform: 'translateY(-5px)' },
              { transform: 'translateY(0)' }
            ],
            { duration: 240, iterations: 3, easing: 'ease-in-out', composite: 'add' }
          );
        }
      } catch (_) {}
    });
  };
  window.addEventListener('agy:companion-state', onCompanionChoreography);

  window.__agyThemeAtmosCleanup = () => {
    clearInterval(lunarTimer);
    if (atmosRaf !== null) { cancelAnimationFrame(atmosRaf); atmosRaf = null; }
    window.removeEventListener('pointermove', onAtmosPointerMove);
    window.removeEventListener('agy:companion-state', onCompanionChoreography);
  };

  window.AgyThemeManager = manager;
  if (window.AgyApi) window.AgyApi.Themes = manager;
})();
