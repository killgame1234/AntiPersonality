/**
 * @name BetterCodeblocks
 * @author AntiPersonality Team
 * @version 3.0.0
 * @description Elevates code blocks with dynamic action headers, syntax badges, live line numbers, word-wrap toggling, code folding, font size scaling, and instant clipboard copy.
 */

class BetterCodeblocksPlugin {
  getName() { return "BetterCodeblocks"; }

  constructor() {
    this._running = false;
    this._observer = null;
    this._rafId = null;
    this._lastGutterAt = 0;
    this._settings = {
      defaultWrapped: false,
      defaultCollapsed: false,
      defaultLineNumbers: false,
      defaultFontSize: 13
    };
  }

  start() {
    this._running = true;
    this._loadSettings();

    const css = `
      pre[data-agy-enhanced] {
        position: relative !important;
        padding-top: 38px !important;
        transition: max-height 0.25s ease, padding 0.2s ease !important;
      }
      .agy-codeblock-action-bar {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 0 10px !important;
        background: var(--card, #18181b) !important;
        border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1)) !important;
        border-top-left-radius: inherit !important;
        border-top-right-radius: inherit !important;
        z-index: 10 !important;
        user-select: none !important;
        box-sizing: border-box !important;
        font-family: var(--font-sans, system-ui, sans-serif) !important;
      }
      .agy-code-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        color: var(--foreground, #f4f4f5) !important;
        opacity: 0.9 !important;
      }
      .agy-code-badge-dot {
        width: 6px !important;
        height: 6px !important;
        border-radius: 50% !important;
        background: var(--foreground, #f4f4f5) !important;
        box-shadow: 0 0 6px currentColor !important;
      }
      .agy-code-controls {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .agy-code-btn {
        background: var(--muted, rgba(255, 255, 255, 0.06)) !important;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.1)) !important;
        border-radius: 4px !important;
        color: var(--secondary-foreground, #cbd5e1) !important;
        padding: 2px 7px !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
        outline: none !important;
        line-height: 1.4 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .agy-code-btn:hover {
        background: var(--sidebar-secondary, rgba(255, 255, 255, 0.15)) !important;
        border-color: var(--border, rgba(255, 255, 255, 0.25)) !important;
        color: var(--foreground, #f4f4f5) !important;
      }
      .agy-code-btn.active {
        background: var(--foreground, #f4f4f5) !important;
        color: var(--background, #09090b) !important;
        border-color: transparent !important;
      }
      pre.agy-code-collapsed {
        max-height: 52px !important;
        overflow: hidden !important;
        mask-image: linear-gradient(180deg, #000 36px, transparent) !important;
        -webkit-mask-image: linear-gradient(180deg, #000 36px, transparent) !important;
      }
      pre.agy-code-wrapped, pre.agy-code-wrapped code {
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }
      pre.agy-has-line-numbers {
        padding-left: 54px !important;
      }
      .agy-code-gutter {
        position: absolute !important;
        top: 38px !important;
        bottom: 0 !important;
        left: 0 !important;
        width: 44px !important;
        padding-right: 8px !important;
        text-align: right !important;
        user-select: none !important;
        pointer-events: none !important;
        border-right: 1px solid var(--border, rgba(255, 255, 255, 0.08)) !important;
        color: var(--muted-foreground, #71717a) !important;
        opacity: 0.65 !important;
        font-family: inherit !important;
        font-size: inherit !important;
        line-height: inherit !important;
        overflow: hidden !important;
        white-space: pre !important;
        box-sizing: border-box !important;
      }
    `;
    AgyApi.DOM.addStyle('plugin-better-codeblocks', css);

    this._enhanceExisting();

    this._observer = new MutationObserver((mutations) => {
      if (!this._running || this._rafId !== null) return;
      let shouldRun = false;
      for (let i = 0; i < mutations.length; i++) {
        const t = mutations[i].target;
        if (!t || !t.closest || !t.closest('.agy-codeblock-action-bar, .agy-code-gutter, #agy-input-addons-wrapper, #agy-toast-container')) {
          shouldRun = true;
          break;
        }
      }
      if (!shouldRun) return;
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        if (!this._running) return;
        try { this._enhanceExisting(); } catch (_) {}
      });
    });

    if (document.body) {
      this._observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('BetterCodeblocks', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('BetterCodeblocks', 'settings', this._settings);
    } catch (_) {}
  }

  _extractCleanCodeText(pre, code) {
    if (code) return code.textContent || '';
    const clone = pre.cloneNode(true);
    clone.querySelectorAll('[data-agy-managed]').forEach(el => el.remove());
    return clone.textContent || '';
  }

  _inferLanguage(pre, code) {
    if (code && code.className) {
      const match = String(code.className).match(/(?:language|lang)-([a-zA-Z0-9_+#.-]+)/i);
      if (match) return match[1].slice(0, 24).toUpperCase();
    }
    const dataLang = pre.getAttribute('data-language') || pre.getAttribute('data-lang');
    if (dataLang) return String(dataLang).slice(0, 24).toUpperCase();

    const text = this._extractCleanCodeText(pre, code).trim();
    if (!text) return 'CODE';
    if (text.startsWith('#!/bin/bash') || text.startsWith('#!/bin/sh') || text.startsWith('$ ') || text.startsWith('npm ') || text.startsWith('git ')) return 'SHELL';
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return 'HTML';
    if (text.startsWith('{') && text.endsWith('}')) return 'JSON';
    if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(text)) return 'SQL';
    if (/^(local|function|--|print\()/m.test(text)) return 'LUAU';
    if (/^(import |def |class |from |print\()/m.test(text)) return 'PYTHON';
    if (/^(import |const |let |var |export |function\b)/m.test(text)) return 'TYPESCRIPT';
    return 'CODE';
  }

  _renderLineGutter(pre, code) {
    let gutter = pre.querySelector('.agy-code-gutter');
    if (!pre.classList.contains('agy-has-line-numbers')) {
      if (gutter) gutter.remove();
      return;
    }
    const raw = this._extractCleanCodeText(pre, code).replace(/\n$/, '');
    const lineCount = Math.max(1, raw ? raw.split('\n').length : 1);
    if (gutter && gutter.dataset.agyLines === String(lineCount)) {
      return;
    }
    let nums = '';
    for (let i = 1; i <= lineCount; i++) {
      nums += i + '\n';
    }
    if (!gutter) {
      gutter = document.createElement('div');
      gutter.className = 'agy-code-gutter';
      gutter.setAttribute('data-agy-managed', 'true');
      pre.insertBefore(gutter, pre.firstChild);
    }
    gutter.dataset.agyLines = String(lineCount);
    gutter.textContent = nums;
  }

  _applyCustomFontSize(pre, code, px) {
    pre.style.fontSize = `${px}px`;
    pre.dataset.agyCustomFs = 'true';
    if (code) {
      code.style.fontSize = `${px}px`;
      code.dataset.agyCustomFs = 'true';
    }
  }

  _enhanceExisting() {
    if (!this._running) return;

    // 1. Update line numbers on the actively streaming codeblock (throttled to 200ms)
    const now = Date.now();
    if (now - this._lastGutterAt >= 200) {
      const numberedPres = document.querySelectorAll('pre.agy-has-line-numbers');
      if (numberedPres.length > 0) {
        const lastPre = numberedPres[numberedPres.length - 1];
        this._renderLineGutter(lastPre, lastPre.querySelector('code'));
        this._lastGutterAt = now;
      }
    }

    // 2. Only inspect unenhanced <pre> blocks (skips all previously processed blocks in C++)
    const pres = document.querySelectorAll('pre:not([data-agy-enhanced]):not([data-agy-skip])');
    if (pres.length === 0) return;

    pres.forEach(pre => {
      try {
        if (!pre.isConnected) return;
        if (pre.closest('#agy-settings-content, [role="dialog"], .monaco-editor, .xterm')) {
          pre.setAttribute('data-agy-skip', 'true');
          return;
        }

        const code = pre.querySelector('code');
        if (pre.querySelector('.agy-codeblock-action-bar')) {
          pre.setAttribute('data-agy-enhanced', 'true');
          return;
        }

        pre.setAttribute('data-agy-enhanced', 'true');
        const lang = this._inferLanguage(pre, code);

        if (this._settings.defaultWrapped) pre.classList.add('agy-code-wrapped');
        if (this._settings.defaultCollapsed) pre.classList.add('agy-code-collapsed');
        if (this._settings.defaultLineNumbers) {
          pre.classList.add('agy-has-line-numbers');
          this._renderLineGutter(pre, code);
        }

        const defFs = Number(this._settings.defaultFontSize);
        if (Number.isFinite(defFs) && defFs !== 13) {
          this._applyCustomFontSize(pre, code, defFs);
        }

        const bar = document.createElement('div');
        bar.className = 'agy-codeblock-action-bar';
        bar.setAttribute('data-agy-managed', 'true');

        const isWrapped = pre.classList.contains('agy-code-wrapped');
        const isCollapsed = pre.classList.contains('agy-code-collapsed');
        const hasLineNums = pre.classList.contains('agy-has-line-numbers');

        bar.innerHTML = `
          <div class="agy-code-badge">
            <span class="agy-code-badge-dot"></span>
            <span class="agy-code-lang-label"></span>
          </div>
          <div class="agy-code-controls">
            <button type="button" class="agy-code-btn agy-btn-lines ${hasLineNums ? 'active' : ''}" title="Toggle live line numbers">#</button>
            <button type="button" class="agy-code-btn agy-btn-wrap ${isWrapped ? 'active' : ''}" title="Toggle word wrap">${isWrapped ? 'Unwrap' : 'Wrap'}</button>
            <button type="button" class="agy-code-btn agy-btn-collapse ${isCollapsed ? 'active' : ''}" title="Fold code block">${isCollapsed ? 'Expand' : 'Collapse'}</button>
            <button type="button" class="agy-code-btn agy-btn-font-dec" title="Decrease font size">A-</button>
            <button type="button" class="agy-code-btn agy-btn-font-inc" title="Increase font size">A+</button>
            <button type="button" class="agy-code-btn agy-btn-copy" title="Copy raw code to clipboard">Copy</button>
          </div>
        `;
        // Safe text assignment prevents XSS via malicious data-language attributes
        bar.querySelector('.agy-code-lang-label').textContent = lang;

        const btnLines = bar.querySelector('.agy-btn-lines');
        btnLines.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          pre.classList.toggle('agy-has-line-numbers');
          const active = pre.classList.contains('agy-has-line-numbers');
          btnLines.classList.toggle('active', active);
          this._renderLineGutter(pre, code);
        };

        const btnWrap = bar.querySelector('.agy-btn-wrap');
        btnWrap.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          pre.classList.toggle('agy-code-wrapped');
          const active = pre.classList.contains('agy-code-wrapped');
          btnWrap.classList.toggle('active', active);
          btnWrap.textContent = active ? 'Unwrap' : 'Wrap';
        };

        const btnCollapse = bar.querySelector('.agy-btn-collapse');
        btnCollapse.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          pre.classList.toggle('agy-code-collapsed');
          const active = pre.classList.contains('agy-code-collapsed');
          btnCollapse.classList.toggle('active', active);
          btnCollapse.textContent = active ? 'Expand' : 'Collapse';
        };

        const getFontSize = () => {
          const target = code || pre;
          const current = window.getComputedStyle(target).fontSize;
          return parseInt(current, 10) || 13;
        };

        bar.querySelector('.agy-btn-font-dec').onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = Math.max(11, getFontSize() - 1);
          this._applyCustomFontSize(pre, code, next);
        };

        bar.querySelector('.agy-btn-font-inc').onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = Math.min(18, getFontSize() + 1);
          this._applyCustomFontSize(pre, code, next);
        };

        const btnCopy = bar.querySelector('.agy-btn-copy');
        btnCopy.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const rawCode = this._extractCleanCodeText(pre, code);
          try {
            await navigator.clipboard.writeText(rawCode);
            btnCopy.textContent = 'Copied';
            btnCopy.classList.add('active');
            setTimeout(() => {
              btnCopy.textContent = 'Copy';
              btnCopy.classList.remove('active');
            }, 1800);
          } catch (_) {
            btnCopy.textContent = 'Failed';
            setTimeout(() => {
              btnCopy.textContent = 'Copy';
            }, 1800);
          }
        };

        pre.insertBefore(bar, pre.firstChild);
      } catch (_) {}
    });
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    document.querySelectorAll('.agy-codeblock-action-bar').forEach(b => b.remove());
    document.querySelectorAll('.agy-code-gutter').forEach(g => g.remove());
    document.querySelectorAll('pre[data-agy-enhanced], pre[data-agy-skip]').forEach(p => {
      p.classList.remove('agy-code-collapsed', 'agy-code-wrapped', 'agy-has-line-numbers');
      p.removeAttribute('data-agy-enhanced');
      p.removeAttribute('data-agy-skip');
    });
    document.querySelectorAll('[data-agy-custom-fs]').forEach(el => {
      el.style.fontSize = '';
      el.removeAttribute('data-agy-custom-fs');
    });
    AgyApi.DOM.removeStyle('plugin-better-codeblocks');
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-bcb-set-';
    const defFs = Number(this._settings.defaultFontSize) || 13;

    const renderToggle = (id, label, desc, checked) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">${label}</div>
          <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">${desc}</div>
        </div>
        <button id="${idPrefix}${id}" class="agy-switch-toggle" style="
          width: 36px; height: 20px; border-radius: 999px;
          background: ${checked ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)'};
          border: 1px solid ${checked ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)'};
          position: relative; cursor: pointer; padding: 0; outline: none; transition: all 0.2s ease;
        ">
          <span style="
            position: absolute; top: 1px; left: ${checked ? '17px' : '1px'};
            width: 16px; height: 16px; border-radius: 50%;
            background: ${checked ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)'};
            transition: all 0.2s ease;
          "></span>
        </button>
      </div>
    `;

    setTimeout(() => {
      const bindToggle = (key, elId) => {
        const btn = document.getElementById(idPrefix + elId);
        if (!btn) return;
        btn.onclick = () => {
          this._settings[key] = !this._settings[key];
          this._saveSettings();
          const ch = this._settings[key];
          btn.style.background = ch ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
          btn.style.borderColor = ch ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
          const dot = btn.querySelector('span');
          if (dot) {
            dot.style.left = ch ? '17px' : '1px';
            dot.style.background = ch ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
          }
          AgyApi.UI.showToast(`Codeblocks: ${key} set to ${ch}`, { type: 'info' });
        };
      };

      bindToggle('defaultWrapped', 'wrap');
      bindToggle('defaultCollapsed', 'collapse');
      bindToggle('defaultLineNumbers', 'lines');

      const fontSlider = document.getElementById(idPrefix + 'font');
      const fontVal = document.getElementById(idPrefix + 'font-val');
      if (fontSlider && fontVal) {
        fontSlider.oninput = (e) => {
          const val = parseInt(e.target.value, 10) || 13;
          this._settings.defaultFontSize = val;
          fontVal.textContent = `${val}px`;
          this._saveSettings();
        };
      }
    }, 50);

    return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${renderToggle('wrap', 'Default Wrapped', 'Wrap long code lines by default instead of horizontal scroll', this._settings.defaultWrapped)}
        ${renderToggle('collapse', 'Default Collapsed', 'Keep long codeblocks folded to 48px until expanded', this._settings.defaultCollapsed)}
        ${renderToggle('lines', 'Default Line Numbers', 'Show live line number gutters on all code blocks', this._settings.defaultLineNumbers)}
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Default Font Size</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Codeblock syntax font scale (11px to 16px)</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="range" id="${idPrefix}font" min="11" max="16" value="${defFs}" style="width:100px; accent-color:var(--foreground, #f4f4f5); cursor:pointer;" />
            <span id="${idPrefix}font-val" style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5); min-width:32px;">${defFs}px</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BetterCodeblocksPlugin;
}
