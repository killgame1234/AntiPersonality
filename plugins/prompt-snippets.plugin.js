/**
 * @name PromptSnippets
 * @author AntiPersonality Team
 * @version 3.0.0
 * @description Fast 1-click pair-programming shortcut chips above the prompt box with dynamic macro interpolation ({{clipboard}}, {{file}}, {{selection}}) and full CRUD snippet manager.
 */

class PromptSnippetsPlugin {
  getName() { return "PromptSnippets"; }

  constructor() {
    this._running = false;
    this._observer = null;
    this._rafId = null;
    this._defaultSnippets = [
      { id: 'ap', label: '/antipersonality', template: '/antipersonality' },
      { id: 'plan', label: '/plan', template: 'Create a structured step-by-step implementation plan for: ' },
      { id: 'test', label: '/test', template: 'Run comprehensive test verification for recent changes and check edge cases.' },
      { id: 'fix', label: '/fix', template: 'Diagnose the error logs, identify root cause, and implement a targeted fix.' },
      { id: 'refactor', label: '/refactor', template: 'Refactor this code for readability, clean architecture, performance, and modern idioms.' },
      { id: 'compact', label: '/compact', template: '/compact' },
      { id: 'boost', label: '/boost', template: '/boost Analyze this architecture with deep multi-perspective reasoning: ' }
    ];
    this._snippets = [...this._defaultSnippets];
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
    this._loadSnippets();

    const css = `
      #agy-prompt-snippets-bar {
        display: flex !important;
        gap: 6px !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        margin-bottom: 4px !important;
        user-select: none !important;
        z-index: 10 !important;
      }
      .agy-snippet-chip {
        background: var(--muted, rgba(255, 255, 255, 0.06)) !important;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12)) !important;
        border-radius: 999px !important;
        padding: 3px 10px !important;
        font-family: inherit !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        color: var(--secondary-foreground, #cbd5e1) !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
        outline: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .agy-snippet-chip:hover {
        background: var(--sidebar-secondary, rgba(255, 255, 255, 0.18)) !important;
        border-color: var(--border, rgba(255, 255, 255, 0.3)) !important;
        color: var(--foreground, #f4f4f5) !important;
        transform: translateY(-1px) !important;
      }
      .agy-snippet-chip:active {
        transform: translateY(0px) !important;
      }
    `;
    AgyApi.DOM.addStyle('plugin-prompt-snippets', css);

    this._mountSnippets();

    this._observer = new MutationObserver(() => {
      if (!this._running || this._rafId !== null) return;
      const existingBar = document.getElementById('agy-prompt-snippets-bar');
      if (existingBar && existingBar.isConnected) return;
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        if (!this._running) return;
        try { this._mountSnippets(); } catch (_) {}
      });
    });

    if (document.body) {
      this._observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  _loadSnippets() {
    try {
      const saved = AgyApi.Data.load('PromptSnippets', 'snippets', null);
      if (Array.isArray(saved) && saved.length > 0) {
        this._snippets = saved
          .filter(s => s && typeof s === 'object' && typeof s.label === 'string' && typeof s.template === 'string')
          .map((s, i) => ({
            id: String(s.id || `custom-${i}`),
            label: s.label,
            template: s.template
          }));
        if (this._snippets.length === 0) {
          this._snippets = [...this._defaultSnippets];
        }
      } else {
        this._snippets = [...this._defaultSnippets];
      }
    } catch (_) {
      this._snippets = [...this._defaultSnippets];
    }
  }

  _saveSnippets() {
    try {
      AgyApi.Data.save('PromptSnippets', 'snippets', this._snippets);
    } catch (_) {}
  }

  _findChatComposer() {
    if (this._cachedComposer && this._cachedComposer.isConnected) {
      return this._cachedComposer;
    }
    const candidates = document.querySelectorAll(
      'textarea:not(#agy-custom-css-editor):not(.inputarea):not(.xterm-helper-textarea), [contenteditable="true"], [contenteditable="plaintext-only"]'
    );
    for (const el of candidates) {
      if (el.closest('[role="dialog"], #agy-settings-content, #agy-command-palette-overlay, .monaco-editor, .xterm')) {
        continue;
      }
      if (el.offsetParent === null && el.getClientRects().length === 0) {
        continue;
      }
      this._cachedComposer = el;
      return el;
    }
    return null;
  }

  _getOrCreateAddonsWrapper(targetParent) {
    if (!targetParent || !targetParent.parentElement) return null;
    let wrapper = document.getElementById('agy-input-addons-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'agy-input-addons-wrapper';
      wrapper.style.cssText = 'width: 100%; display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px;';
      targetParent.parentElement.insertBefore(wrapper, targetParent);
    } else if (wrapper.nextElementSibling !== targetParent) {
      targetParent.parentElement.insertBefore(wrapper, targetParent);
    }
    return wrapper;
  }

  _detectActiveFile() {
    const tabEl = document.querySelector(
      '.tab.active .label-name, [role="tab"][aria-selected="true"] .label-name, [data-testid="active-file-name"]'
    );
    const fromTab = tabEl?.textContent?.trim();
    if (fromTab) return fromTab;

    const title = (document.title || '').trim();
    if (title) {
      const part = title.split(/\s+[-—|]\s+/)[0]?.trim();
      if (part && /\.[a-z0-9]{1,8}$/i.test(part)) return part;
    }
    return '[active_file]';
  }

  async _interpolateMacros(template) {
    let result = String(template || '');

    if (result.includes('{{clipboard}}')) {
      try {
        const text = await navigator.clipboard.readText();
        result = result.replace(/\{\{clipboard\}\}/g, text || '');
      } catch (_) {
        result = result.replace(/\{\{clipboard\}\}/g, '');
      }
    }

    if (result.includes('{{selection}}')) {
      const sel = window.getSelection ? window.getSelection().toString() : '';
      result = result.replace(/\{\{selection\}\}/g, sel || '');
    }

    if (result.includes('{{file}}')) {
      result = result.replace(/\{\{file\}\}/g, this._detectActiveFile());
    }

    return result;
  }

  _dispatchText(textToInsert) {
    const activeInput = this._findChatComposer();
    if (!activeInput) return;

    activeInput.focus();

    if (activeInput.tagName.toLowerCase() === 'textarea') {
      const current = activeInput.value || '';
      const start = typeof activeInput.selectionStart === 'number' ? activeInput.selectionStart : current.length;
      const end = typeof activeInput.selectionEnd === 'number' ? activeInput.selectionEnd : current.length;
      const needsSpace = start > 0 && !/\s/.test(current[start - 1]) && !/^\s/.test(textToInsert);
      const inserted = (needsSpace ? ' ' : '') + textToInsert;
      const newText = current.substring(0, start) + inserted + current.substring(end);

      const proto = HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(activeInput, newText);
      } else {
        activeInput.value = newText;
      }
      activeInput.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: inserted
      }));
      const nextCaret = start + inserted.length;
      activeInput.selectionStart = activeInput.selectionEnd = nextCaret;
    } else {
      const currentText = activeInput.textContent || '';
      const needsSpace = currentText.length > 0 && !/\s$/.test(currentText) && !/^\s/.test(textToInsert);
      const inserted = (needsSpace ? ' ' : '') + textToInsert;
      let ok = false;
      try {
        ok = document.execCommand('insertText', false, inserted);
      } catch (_) {
        ok = false;
      }
      if (!ok) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && activeInput.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(inserted);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          activeInput.textContent = currentText + inserted;
        }
        activeInput.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: inserted
        }));
      }
    }
  }

  _mountSnippets() {
    if (!this._running) return;
    const existingBar = document.getElementById('agy-prompt-snippets-bar');
    if (existingBar && existingBar.isConnected) {
      return;
    }

    const inputEl = this._findChatComposer();
    if (!inputEl) return;

    const parent = inputEl.closest('.relative.w-full') || inputEl.closest('form') || inputEl.parentElement;
    const wrapper = this._getOrCreateAddonsWrapper(parent);
    if (!wrapper) return;

    if (existingBar) {
      wrapper.appendChild(existingBar);
      return;
    }

    const bar = document.createElement('div');
    bar.id = 'agy-prompt-snippets-bar';

    this._snippets.forEach(s => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'agy-snippet-chip';
      chip.textContent = s.label || '';
      chip.title = `Insert: "${s.template || ''}"`;

      chip.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tmpl = String(s.template || '');
        if (s.id === 'ap' || tmpl.trim().toLowerCase() === '/antipersonality') {
          if (window.AgyOpenAntiPersonality) {
            window.AgyOpenAntiPersonality('themes');
            return;
          }
        }
        const expanded = await this._interpolateMacros(tmpl);
        this._dispatchText(expanded);
      };

      bar.appendChild(chip);
    });

    wrapper.appendChild(bar);
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
    const bar = document.getElementById('agy-prompt-snippets-bar');
    if (bar) bar.remove();

    const wrapper = document.getElementById('agy-input-addons-wrapper');
    if (wrapper && wrapper.children.length === 0) {
      wrapper.remove();
    }
    AgyApi.DOM.removeStyle('plugin-prompt-snippets');
  }

  getSettingsPanel() {
    this._loadSnippets();
    const idPrefix = 'agy-ps-set-';

    setTimeout(() => {
      const renderList = () => {
        const listEl = document.getElementById(idPrefix + 'list');
        if (!listEl) return;

        listEl.innerHTML = this._snippets.map((s, idx) => `
          <div style="
            display:flex; justify-content:space-between; align-items:center;
            padding:8px 10px; border-radius:6px;
            background:var(--background, #09090b); border:1px solid var(--border, rgba(255,255,255,0.08));
            margin-bottom:6px;
          ">
            <div style="flex:1; overflow:hidden; padding-right:10px;">
              <div style="font-size:12.5px; font-weight:600; color:var(--foreground, #f4f4f5);">${this._escapeHtml(s.label)}</div>
              <div style="font-size:11px; color:var(--muted-foreground, #71717a); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${this._escapeHtml(s.template)}</div>
            </div>
            <button class="agy-snippet-del" data-idx="${idx}" style="
              background:transparent; border:1px solid var(--border, rgba(255,255,255,0.1)); color:var(--muted-foreground, #a1a1aa); cursor:pointer; font-size:11px; padding:3px 8px; border-radius:4px;
            " title="Delete Snippet">Remove</button>
          </div>
        `).join('');

        listEl.querySelectorAll('.agy-snippet-del').forEach(btn => {
          btn.onclick = (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
            if (!Number.isNaN(idx)) {
              this._snippets.splice(idx, 1);
              this._saveSnippets();
              renderList();
              this._refreshBar();
            }
          };
        });
      };

      renderList();

      const addBtn = document.getElementById(idPrefix + 'add-btn');
      const labelInp = document.getElementById(idPrefix + 'new-label');
      const tmplInp = document.getElementById(idPrefix + 'new-tmpl');

      if (addBtn && labelInp && tmplInp) {
        addBtn.onclick = () => {
          const label = labelInp.value.trim();
          const template = tmplInp.value.trim();
          if (!label || !template) {
            AgyApi.UI.showToast('Please provide both label and prompt template', { type: 'warning' });
            return;
          }
          this._snippets.push({ id: 'custom-' + Date.now(), label, template });
          this._saveSnippets();
          labelInp.value = '';
          tmplInp.value = '';
          renderList();
          this._refreshBar();
          AgyApi.UI.showToast(`Snippet "${label}" added`, { type: 'success' });
        };
      }

      const resetBtn = document.getElementById(idPrefix + 'reset-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          this._snippets = [...this._defaultSnippets];
          this._saveSnippets();
          renderList();
          this._refreshBar();
          AgyApi.UI.showToast('Reset snippets to default set', { type: 'info' });
        };
      }
    }, 50);

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Active Snippets</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Supports {{clipboard}}, {{selection}}, and {{file}} macros</div>
          </div>
          <button id="${idPrefix}reset-btn" class="agy-btn" style="
            padding: 4px 10px; font-size: 11px; border-radius: 6px;
            background: var(--muted, #27272a); color: var(--muted-foreground, #a1a1aa);
            border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;
          ">Reset Defaults</button>
        </div>

        <div id="${idPrefix}list" style="max-height: 180px; overflow-y: auto; padding-right: 4px;"></div>

        <div style="
          padding: 10px; border-radius: 6px;
          background: var(--muted, rgba(255,255,255,0.03));
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          display: flex; flex-direction: column; gap: 8px;
        ">
          <div style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5);">Add Custom Snippet</div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="${idPrefix}new-label" placeholder="Label (e.g. /review)" style="
              width: 130px; padding: 5px 8px; border-radius: 6px; font-size: 12px;
              background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
              border: 1px solid var(--border, rgba(255,255,255,0.15));
            " />
            <input type="text" id="${idPrefix}new-tmpl" placeholder="Prompt (e.g. Review this code: {{clipboard}})" style="
              flex: 1; padding: 5px 8px; border-radius: 6px; font-size: 12px;
              background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
              border: 1px solid var(--border, rgba(255,255,255,0.15));
            " />
            <button id="${idPrefix}add-btn" class="agy-btn" style="
              padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
              background: var(--foreground, #f4f4f5); color: var(--background, #09090b);
              border: none; cursor: pointer;
            ">+ Add</button>
          </div>
        </div>
      </div>
    `;
  }

  _refreshBar() {
    const bar = document.getElementById('agy-prompt-snippets-bar');
    if (bar) bar.remove();
    if (this._running) {
      this._mountSnippets();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptSnippetsPlugin;
}
