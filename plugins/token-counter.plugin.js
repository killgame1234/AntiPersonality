/**
 * @name TokenCounter
 * @author AntiPersonality Team
 * @version 3.1.0
 * @description Real-time prompt, conversation, and project-wide LLM token & cost counter HUD with exact model pricing profiles and interactive breakdown analytics drawer.
 */

class TokenCounterPlugin {
  getName() { return "TokenCounter"; }

  // Official Pricing & Tokenization Profiles ($ / 1M tokens)
  static MODEL_PROFILES = {
    'gemini-3.8-flash': {
      id: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash',
      aliases: ['gemini 3.8 flash', 'gemini 3.8', 'gemini-flash', 'flash'],
      inputCostPerM: 0.075,
      outputCostPerM: 0.30,
      charRatio: 3.9,
      cjkWeight: 1.15,
      contextWindow: 1048576
    },
    'gemini-4-argon': {
      id: 'gemini-4-argon',
      label: 'Gemini 4 Argon',
      aliases: ['gemini 4 argon', 'gemini 4', 'argon'],
      inputCostPerM: 1.25,
      outputCostPerM: 5.00,
      charRatio: 3.8,
      cjkWeight: 1.2,
      contextWindow: 1048576
    },
    'gemini-pro': {
      id: 'gemini-pro',
      label: 'Gemini 3.5 Pro',
      aliases: ['gemini 3.5 pro', 'gemini pro', 'pro'],
      inputCostPerM: 1.25,
      outputCostPerM: 5.00,
      charRatio: 3.8,
      cjkWeight: 1.2,
      contextWindow: 2097152
    },
    'claude-sonnet-5.5': {
      id: 'claude-sonnet-5.5',
      label: 'Claude Sonnet 5.5',
      aliases: ['claude sonnet', 'sonnet 5.5', 'sonnet', 'claude 3.7 sonnet', 'claude 3.5 sonnet'],
      inputCostPerM: 3.00,
      outputCostPerM: 15.00,
      charRatio: 3.7,
      cjkWeight: 1.35,
      contextWindow: 200000
    },
    'claude-opus-5.5': {
      id: 'claude-opus-5.5',
      label: 'Claude Opus 5.5',
      aliases: ['claude opus', 'opus 5.5', 'opus'],
      inputCostPerM: 15.00,
      outputCostPerM: 75.00,
      charRatio: 3.6,
      cjkWeight: 1.4,
      contextWindow: 200000
    },
    'gpt-oss-120b': {
      id: 'gpt-oss-120b',
      label: 'GPT-OSS 120B',
      aliases: ['gpt-oss', 'gpt-oss 120b', 'gpt 120b', 'oss 120b'],
      inputCostPerM: 0.15,
      outputCostPerM: 0.60,
      charRatio: 3.75,
      cjkWeight: 1.25,
      contextWindow: 131072
    },
    'gpt-4o': {
      id: 'gpt-4o',
      label: 'GPT-4o',
      aliases: ['gpt-4o', 'gpt4o', 'chatgpt'],
      inputCostPerM: 2.50,
      outputCostPerM: 10.00,
      charRatio: 3.7,
      cjkWeight: 1.3,
      contextWindow: 128000
    }
  };

  constructor() {
    this._running = false;
    this._observer = null;
    this._rafId = null;
    this._scanTimer = null;
    this._delegatedUpdate = null;
    this._pollInterval = null;
    this._cachedComposer = null;
    this._lastScanAt = 0;
    this._lastScannedText = '';
    this._activeScope = 'prompt'; // 'prompt' | 'conversation' | 'project'
    this._settings = {
      warnThreshold: 2500,
      dangerThreshold: 7000,
      showCost: true,
      defaultScope: 'prompt', // 'prompt' | 'conversation' | 'project'
      activeModelOverride: 'auto' // 'auto' or model key
    };
  }

  start() {
    this._running = true;
    this._loadSettings();
    this._activeScope = this._settings.defaultScope || 'prompt';

    const css = `
      #agy-token-counter-hud {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        font-family: inherit !important;
        font-size: 11px !important;
        padding: 4px 10px !important;
        border-radius: 6px !important;
        background: var(--card, rgba(24, 24, 27, 0.85)) !important;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.1)) !important;
        color: var(--muted-foreground, #a1a1aa) !important;
        user-select: none !important;
        width: fit-content !important;
        transition: all 0.2s ease !important;
        backdrop-filter: blur(8px) !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
      }
      .agy-tc-tabs {
        display: inline-flex !important;
        align-items: center !important;
        gap: 2px !important;
        background: var(--muted, rgba(255, 255, 255, 0.05)) !important;
        border-radius: 4px !important;
        padding: 1px !important;
        margin-right: 2px !important;
      }
      .agy-tc-tab-btn {
        background: transparent !important;
        border: none !important;
        border-radius: 3px !important;
        color: var(--muted-foreground, #a1a1aa) !important;
        padding: 2px 6px !important;
        font-size: 10px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
        line-height: 1.2 !important;
        outline: none !important;
      }
      .agy-tc-tab-btn:hover {
        color: var(--foreground, #f4f4f5) !important;
      }
      .agy-tc-tab-btn.active {
        background: var(--card, #18181b) !important;
        color: var(--foreground, #f4f4f5) !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
        font-weight: 600 !important;
      }
      .agy-tc-metric {
        display: inline-flex !important;
        align-items: center !important;
        gap: 3px !important;
      }
      .agy-tc-metric b {
        font-weight: 600 !important;
        color: var(--foreground, #f4f4f5) !important;
      }
      .agy-tc-model-badge {
        font-size: 9.5px !important;
        font-weight: 600 !important;
        padding: 1px 6px !important;
        border-radius: 999px !important;
        background: var(--sidebar-secondary, rgba(255, 255, 255, 0.1)) !important;
        color: var(--secondary-foreground, #e4e4e7) !important;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.1)) !important;
        max-width: 130px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .agy-tc-gauge-track {
        width: 44px !important;
        height: 4px !important;
        background: var(--muted, rgba(255, 255, 255, 0.1)) !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        margin-left: 2px !important;
      }
      .agy-tc-gauge-fill {
        height: 100% !important;
        width: 0%;
        background: var(--foreground, #f4f4f5) !important;
        transition: width 0.2s ease, opacity 0.2s ease !important;
      }
      .agy-tc-gauge-fill.warn {
        opacity: 0.78 !important;
      }
      .agy-tc-gauge-fill.danger {
        opacity: 1 !important;
      }
      .agy-tc-tooltip-wrap {
        position: relative !important;
        cursor: help !important;
      }
      .agy-tc-tooltip {
        visibility: hidden;
        opacity: 0;
        position: absolute;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        background: var(--card, #18181b);
        color: var(--foreground, #f4f4f5);
        border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 10.5px;
        line-height: 1.4;
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        pointer-events: none;
        transition: opacity 0.15s ease, visibility 0.15s ease;
        z-index: 999;
      }
      .agy-tc-tooltip-wrap:hover .agy-tc-tooltip {
        visibility: visible;
        opacity: 1;
      }
    `;
    AgyApi.DOM.addStyle('plugin-token-counter', css);

    this._delegatedUpdate = (e) => {
      if (!this._running) return;
      const composer = this._findChatComposer();
      if (composer && e && e.target && (e.target === composer || composer.contains(e.target))) {
        this._updateCounts();
      }
    };
    document.addEventListener('input', this._delegatedUpdate, true);
    document.addEventListener('keyup', this._delegatedUpdate, true);

    this._mountHUD();

    this._observer = new MutationObserver((mutations) => {
      if (!this._running) return;
      // Ignore mutations entirely inside our own HUD / addons wrapper to prevent feedback loops
      let hasExternalMutation = false;
      for (let i = 0; i < mutations.length; i++) {
        const t = mutations[i].target;
        if (!t || !t.closest || !t.closest('#agy-input-addons-wrapper, #agy-toast-container')) {
          hasExternalMutation = true;
          break;
        }
      }
      if (!hasExternalMutation) return;

      if (this._rafId === null) {
        this._rafId = requestAnimationFrame(() => {
          this._rafId = null;
          if (!this._running) return;
          const existingHud = document.getElementById('agy-token-counter-hud');
          if (!existingHud || !existingHud.isConnected) {
            try { this._mountHUD(); } catch (_) {}
          }
        });
      }

      this._scheduleScan();
    });

    if (document.body) {
      this._observer.observe(document.body, { childList: true, subtree: true });
    }

    // Periodic poll checks for conversation turn completion and project switches
    this._pollInterval = setInterval(() => {
      if (this._running) {
        this._scanLiveConversation();
      }
    }, 3500);
  }

  _scheduleScan() {
    if (this._scanTimer !== null) return;
    const elapsed = Date.now() - this._lastScanAt;
    const delay = elapsed >= 1500 ? 120 : 1500 - elapsed;
    this._scanTimer = setTimeout(() => {
      this._scanTimer = null;
      this._lastScanAt = Date.now();
      if (this._running) {
        try { this._scanLiveConversation(); } catch (_) {}
      }
    }, delay);
  }

  _setText(el, val) {
    if (el && el.textContent !== val) {
      el.textContent = val;
    }
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('TokenCounter', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('TokenCounter', 'settings', this._settings);
    } catch (_) {}
  }

  _detectActiveModel() {
    if (this._settings.activeModelOverride && this._settings.activeModelOverride !== 'auto') {
      const override = TokenCounterPlugin.MODEL_PROFILES[this._settings.activeModelOverride];
      if (override) return override;
    }

    const trigger = document.querySelector('[data-testid="model-selector-trigger"]');
    const text = (trigger ? (trigger.getAttribute('aria-label') || trigger.textContent) : '') || '';
    const lower = text.toLowerCase();

    for (const profile of Object.values(TokenCounterPlugin.MODEL_PROFILES)) {
      if (profile.aliases.some(alias => lower.includes(alias))) {
        return profile;
      }
    }

    // Default to Gemini 3.8 Flash
    return TokenCounterPlugin.MODEL_PROFILES['gemini-3.8-flash'];
  }

  _detectConversationContext() {
    const url = window.location.href;
    const match = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
    const convId = match ? match[1] : 'current-conversation';

    const titleParts = document.title.split(' - ');
    const projectName = (titleParts.length >= 2 ? titleParts[titleParts.length - 2].trim() : '') || 'Default Project';

    return { convId, projectName };
  }

  _estimateTokensForModel(text, modelProfile, isOutput = false) {
    if (!text) return 0;
    const profile = modelProfile || TokenCounterPlugin.MODEL_PROFILES['gemini-3.8-flash'];
    const cjkMatches = text.match(/[\u3000-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/g);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;
    const nonCjkCount = Math.max(0, text.length - cjkCount);

    const cjkWeight = profile.cjkWeight || 1.2;
    const charRatio = profile.charRatio || 3.8;

    return Math.ceil(cjkCount * cjkWeight + nonCjkCount / charRatio);
  }

  _estimateTokensFromCharCount(charCount, modelProfile) {
    if (!charCount || charCount <= 0) return 0;
    const profile = modelProfile || TokenCounterPlugin.MODEL_PROFILES['gemini-3.8-flash'];
    const charRatio = profile.charRatio || 3.8;
    return Math.ceil(charCount / charRatio);
  }

  _calculateCost(inputTokens, outputTokens, modelProfile) {
    const profile = modelProfile || TokenCounterPlugin.MODEL_PROFILES['gemini-3.8-flash'];
    const inCost = (inputTokens / 1000000) * profile.inputCostPerM;
    const outCost = (outputTokens / 1000000) * profile.outputCostPerM;
    return inCost + outCost;
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

  _scanLiveConversation() {
    const { convId, projectName } = this._detectConversationContext();
    const modelProfile = this._detectActiveModel();

    // Find all rendered conversation turns without cloning DOM nodes
    const turnElements = document.querySelectorAll('.scroll-mt-4, [data-testid="conversation-turn"]');
    if (turnElements.length === 0) return;

    let convInputChars = 0;
    let convOutputChars = 0;
    let turnCount = 0;

    for (let i = 0; i < turnElements.length; i++) {
      const turn = turnElements[i];
      const userBubble = turn.querySelector('[data-testid="user-message-bubble"], [data-testid="user-message"]');
      const userLen = userBubble ? (userBubble.textContent || '').trim().length : 0;
      const totalTurnLen = (turn.textContent || '').trim().length;
      convInputChars += userLen;
      convOutputChars += Math.max(0, totalTurnLen - userLen);
      turnCount++;
    }

    const signature = `${convId}:${turnCount}:${convInputChars}:${convOutputChars}:${modelProfile.id}`;
    if (signature === this._lastScannedText) return;
    this._lastScannedText = signature;

    const inputTokens = this._estimateTokensFromCharCount(convInputChars, modelProfile);
    const outputTokens = this._estimateTokensFromCharCount(convOutputChars, modelProfile);
    const totalTokens = inputTokens + outputTokens;
    const estCost = this._calculateCost(inputTokens, outputTokens, modelProfile);

    // Save conversation snapshot
    const convStats = {
      convId,
      projectName,
      turnCount,
      inputTokens,
      outputTokens,
      totalTokens,
      estCost,
      modelId: modelProfile.id,
      updatedAt: new Date().toISOString()
    };
    AgyApi.Data.save('TokenCounter', `conv:${convId}`, convStats);

    // Update Project-wide cumulative ledger
    const projectLedger = AgyApi.Data.load('TokenCounter', `project:${projectName}`, {
      projectName,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      conversations: {}
    });

    projectLedger.conversations[convId] = {
      turnCount,
      totalTokens,
      inputTokens,
      outputTokens,
      estCost,
      modelId: modelProfile.id,
      updatedAt: convStats.updatedAt
    };

    let projTotalTokens = 0;
    let projInputTokens = 0;
    let projOutputTokens = 0;
    let projTotalCost = 0;

    for (const c of Object.values(projectLedger.conversations)) {
      projTotalTokens += c.totalTokens || 0;
      projInputTokens += c.inputTokens || 0;
      projOutputTokens += c.outputTokens || 0;
      projTotalCost += c.estCost || 0;
    }

    projectLedger.totalTokens = projTotalTokens;
    projectLedger.totalInputTokens = projInputTokens;
    projectLedger.totalOutputTokens = projOutputTokens;
    projectLedger.totalCost = projTotalCost;
    AgyApi.Data.save('TokenCounter', `project:${projectName}`, projectLedger);

    if (this._activeScope !== 'prompt') {
      this._updateCounts();
    }
  }

  _updateCounts() {
    const activeInput = this._findChatComposer();
    const modelProfile = this._detectActiveModel();
    const { convId, projectName } = this._detectConversationContext();

    const rawPrompt = activeInput ? (typeof activeInput.value === 'string' ? activeInput.value : (activeInput.textContent || '')) : '';
    const promptText = rawPrompt.trim();
    const promptChars = promptText.length;
    const promptWords = promptChars === 0 ? 0 : promptText.split(/\s+/).filter(Boolean).length;
    const promptTokens = this._estimateTokensForModel(promptText, modelProfile, false);

    // Metric DOM hooks (updated via textContent diffing only — zero innerHTML replacements)
    const labelEl = document.getElementById('agy-tc-label');
    const m1LblEl = document.getElementById('agy-tc-m1-lbl');
    const m1ValEl = document.getElementById('agy-tc-m1-val');
    const m2LblEl = document.getElementById('agy-tc-m2-lbl');
    const m2ValEl = document.getElementById('agy-tc-m2-val');
    const tokensEl = document.getElementById('agy-tc-tokens');
    const gaugeEl = document.getElementById('agy-tc-gauge');
    const costTip = document.getElementById('agy-tc-cost-tip');
    const modelBadge = document.getElementById('agy-tc-model-badge');

    if (modelBadge) {
      this._setText(modelBadge, modelProfile.label);
      const nextTitle = `Active Model: ${modelProfile.label} ($${modelProfile.inputCostPerM}/1M in, $${modelProfile.outputCostPerM}/1M out)`;
      if (modelBadge.title !== nextTitle) modelBadge.title = nextTitle;
    }

    let displayTokens = 0;
    let displayCost = 0;
    let costDetailString = '';

    if (this._activeScope === 'conversation') {
      const convStats = AgyApi.Data.load('TokenCounter', `conv:${convId}`, {
        turnCount: 0,
        totalTokens: promptTokens,
        inputTokens: promptTokens,
        outputTokens: 0,
        estCost: 0
      });

      displayTokens = (convStats.totalTokens || 0) + promptTokens;
      displayCost = (convStats.estCost || 0) + this._calculateCost(promptTokens, 0, modelProfile);

      this._setText(labelEl, 'Conv:');
      this._setText(m1LblEl, 'Turns:');
      this._setText(m1ValEl, String(convStats.turnCount || 1));
      this._setText(m2LblEl, 'In/Out:');
      this._setText(m2ValEl, `~${(convStats.inputTokens || 0).toLocaleString()}/${(convStats.outputTokens || 0).toLocaleString()}`);
      costDetailString = `Conversation Total: ~$${displayCost.toFixed(5)} (${modelProfile.label})`;
    } else if (this._activeScope === 'project') {
      const projectLedger = AgyApi.Data.load('TokenCounter', `project:${projectName}`, {
        projectName,
        totalTokens: 0,
        totalCost: 0,
        conversations: {}
      });

      const convCount = Object.keys(projectLedger.conversations || {}).length || 1;
      displayTokens = (projectLedger.totalTokens || 0) + promptTokens;
      displayCost = (projectLedger.totalCost || 0) + this._calculateCost(promptTokens, 0, modelProfile);

      this._setText(labelEl, 'Project:');
      this._setText(m1LblEl, 'Chats:');
      this._setText(m1ValEl, String(convCount));
      this._setText(m2LblEl, 'Proj:');
      this._setText(m2ValEl, projectName.slice(0, 14));
      costDetailString = `Project Total (${projectName}): ~$${displayCost.toFixed(4)} USD`;
    } else {
      // Prompt Scope
      displayTokens = promptTokens;
      displayCost = this._calculateCost(promptTokens, 0, modelProfile);

      this._setText(labelEl, 'Prompt:');
      this._setText(m1LblEl, 'Chars:');
      this._setText(m1ValEl, promptChars.toLocaleString());
      this._setText(m2LblEl, 'Words:');
      this._setText(m2ValEl, promptWords.toLocaleString());
      const formattedCost = displayCost < 0.00001 ? '< $0.00001' : `$${displayCost.toFixed(5)}`;
      costDetailString = `Est. Prompt: ${formattedCost} USD (@ $${modelProfile.inputCostPerM}/1M with ${modelProfile.label})`;
    }

    const warn = Math.max(100, Number(this._settings.warnThreshold ?? 2500) || 2500);
    const danger = Math.max(warn + 100, Number(this._settings.dangerThreshold ?? 7000) || 7000);

    if (tokensEl) {
      const nextTokenText = displayTokens >= danger
        ? `~${displayTokens.toLocaleString()} [HIGH]`
        : displayTokens >= warn
          ? `~${displayTokens.toLocaleString()} [WARN]`
          : `~${displayTokens.toLocaleString()}`;
      this._setText(tokensEl, nextTokenText);
    }

    if (gaugeEl) {
      const pct = Math.min(100, Math.round((displayTokens / danger) * 100));
      const nextWidth = `${displayTokens === 0 ? 0 : Math.max(4, pct)}%`;
      if (gaugeEl.style.width !== nextWidth) gaugeEl.style.width = nextWidth;
      const shouldDanger = displayTokens >= danger;
      const shouldWarn = !shouldDanger && displayTokens >= warn;
      if (gaugeEl.classList.contains('danger') !== shouldDanger) gaugeEl.classList.toggle('danger', shouldDanger);
      if (gaugeEl.classList.contains('warn') !== shouldWarn) gaugeEl.classList.toggle('warn', shouldWarn);
    }

    if (costTip) {
      if (this._settings.showCost) {
        this._setText(costTip, costDetailString);
        if (costTip.style.display !== 'block') costTip.style.display = 'block';
      } else if (costTip.style.display !== 'none') {
        costTip.style.display = 'none';
      }
    }
  }

  _setScope(newScope) {
    this._activeScope = newScope;
    document.querySelectorAll('.agy-tc-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-scope') === newScope);
    });
    this._updateCounts();
  }

  _mountHUD() {
    if (!this._running) return;
    const existingHud = document.getElementById('agy-token-counter-hud');
    if (existingHud && existingHud.isConnected) {
      return;
    }

    const inputEl = this._findChatComposer();
    if (!inputEl) return;

    const parent = inputEl.closest('.relative.w-full') || inputEl.closest('form') || inputEl.parentElement;
    const wrapper = this._getOrCreateAddonsWrapper(parent);
    if (!wrapper) return;

    if (existingHud) {
      wrapper.prepend(existingHud);
      this._updateCounts();
      return;
    }

    const hud = document.createElement('div');
    hud.id = 'agy-token-counter-hud';
    hud.innerHTML = `
      <div class="agy-tc-tabs">
        <button type="button" class="agy-tc-tab-btn ${this._activeScope === 'prompt' ? 'active' : ''}" data-scope="prompt" title="Count current prompt draft">Prompt</button>
        <button type="button" class="agy-tc-tab-btn ${this._activeScope === 'conversation' ? 'active' : ''}" data-scope="conversation" title="Count cumulative conversation tokens">Chat</button>
        <button type="button" class="agy-tc-tab-btn ${this._activeScope === 'project' ? 'active' : ''}" data-scope="project" title="Count total project tokens across all chats">Project</button>
      </div>
      <span class="agy-tc-model-badge" id="agy-tc-model-badge">Detecting...</span>
      <span style="opacity:0.25;">|</span>
      <div class="agy-tc-metric" id="agy-tc-m1">
        <span id="agy-tc-m1-lbl">Chars:</span>
        <b id="agy-tc-m1-val">0</b>
      </div>
      <span style="opacity:0.25;">|</span>
      <div class="agy-tc-metric" id="agy-tc-m2">
        <span id="agy-tc-m2-lbl">Words:</span>
        <b id="agy-tc-m2-val">0</b>
      </div>
      <span style="opacity:0.25;">|</span>
      <div class="agy-tc-metric agy-tc-tooltip-wrap" id="agy-tc-token-wrap">
        <span id="agy-tc-label">Prompt:</span>
        <b id="agy-tc-tokens">~0</b>
        <div class="agy-tc-gauge-track">
          <div class="agy-tc-gauge-fill" id="agy-tc-gauge"></div>
        </div>
        <div class="agy-tc-tooltip" id="agy-tc-cost-tip">Calculating cost...</div>
      </div>
    `;

    hud.querySelectorAll('.agy-tc-tab-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._setScope(btn.getAttribute('data-scope'));
      };
    });

    wrapper.prepend(hud);
    this._scanLiveConversation();
    this._updateCounts();
  }

  stop() {
    this._running = false;
    this._cachedComposer = null;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._scanTimer !== null) {
      clearTimeout(this._scanTimer);
      this._scanTimer = null;
    }
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._delegatedUpdate) {
      document.removeEventListener('input', this._delegatedUpdate, true);
      document.removeEventListener('keyup', this._delegatedUpdate, true);
      this._delegatedUpdate = null;
    }

    const hud = document.getElementById('agy-token-counter-hud');
    if (hud) hud.remove();

    const wrapper = document.getElementById('agy-input-addons-wrapper');
    if (wrapper && wrapper.children.length === 0) {
      wrapper.remove();
    }
    AgyApi.DOM.removeStyle('plugin-token-counter');
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-tc-set-';
    const warnVal = Math.max(100, Number(this._settings.warnThreshold ?? 2500) || 2500);
    const dangerVal = Math.max(warnVal + 100, Number(this._settings.dangerThreshold ?? 7000) || 7000);
    const activeModelKey = this._settings.activeModelOverride || 'auto';

    setTimeout(() => {
      const warnInp = document.getElementById(idPrefix + 'warn');
      const dangerInp = document.getElementById(idPrefix + 'danger');

      const syncThresholds = () => {
        const w = Math.max(100, parseInt(warnInp?.value, 10) || 2500);
        const d = Math.max(w + 100, parseInt(dangerInp?.value, 10) || 7000);
        this._settings.warnThreshold = w;
        this._settings.dangerThreshold = d;
        if (warnInp) warnInp.value = String(w);
        if (dangerInp) dangerInp.value = String(d);
        this._saveSettings();
        if (this._running) this._updateCounts();
      };

      if (warnInp) warnInp.onchange = syncThresholds;
      if (dangerInp) dangerInp.onchange = syncThresholds;

      const modelSel = document.getElementById(idPrefix + 'model-override');
      if (modelSel) {
        modelSel.onchange = (e) => {
          this._settings.activeModelOverride = e.target.value;
          this._saveSettings();
          if (this._running) {
            this._lastScannedText = '';
            this._scanLiveConversation();
            this._updateCounts();
          }
        };
      }

      const scopeSel = document.getElementById(idPrefix + 'def-scope');
      if (scopeSel) {
        scopeSel.onchange = (e) => {
          this._settings.defaultScope = e.target.value;
          this._saveSettings();
          this._setScope(e.target.value);
        };
      }

      const costBtn = document.getElementById(idPrefix + 'cost');
      if (costBtn) {
        costBtn.onclick = () => {
          this._settings.showCost = !this._settings.showCost;
          this._saveSettings();
          if (this._running) this._updateCounts();
          const ch = this._settings.showCost;
          costBtn.style.background = ch ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
          costBtn.style.borderColor = ch ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
          const dot = costBtn.querySelector('span');
          if (dot) {
            dot.style.left = ch ? '17px' : '1px';
            dot.style.background = ch ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
          }
        };
      }

      const resetBtn = document.getElementById(idPrefix + 'reset-stats-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          const { convId, projectName } = this._detectConversationContext();
          AgyApi.Data.delete('TokenCounter', `conv:${convId}`);
          AgyApi.Data.delete('TokenCounter', `project:${projectName}`);
          this._lastScannedText = '';
          this._scanLiveConversation();
          this._updateCounts();
          AgyApi.UI.showToast(`Reset token stats for conversation and ${projectName}`, { type: 'info' });
        };
      }
    }, 50);

    const checked = this._settings.showCost;

    return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Model Pricing Profile</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Auto-detects from active model selector or force specific profile</div>
          </div>
          <select id="${idPrefix}model-override" style="
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15)); border-radius: 6px;
            padding: 4px 8px; font-size: 12px; outline: none;
          ">
            <option value="auto" ${activeModelKey === 'auto' ? 'selected' : ''}>Auto-Detect Live Model</option>
            ${Object.values(TokenCounterPlugin.MODEL_PROFILES).map(p => `
              <option value="${p.id}" ${activeModelKey === p.id ? 'selected' : ''}>${p.label} ($${p.inputCostPerM}/1M in)</option>
            `).join('')}
          </select>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Default HUD Scope</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Primary view shown on prompt bar</div>
          </div>
          <select id="${idPrefix}def-scope" style="
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15)); border-radius: 6px;
            padding: 4px 8px; font-size: 12px; outline: none;
          ">
            <option value="prompt" ${this._settings.defaultScope === 'prompt' ? 'selected' : ''}>Prompt (Current Draft)</option>
            <option value="conversation" ${this._settings.defaultScope === 'conversation' ? 'selected' : ''}>Conversation (Total Chat)</option>
            <option value="project" ${this._settings.defaultScope === 'project' ? 'selected' : ''}>Project (All Chats in Project)</option>
          </select>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Warning Token Threshold</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Token count where warning state triggers</div>
          </div>
          <input type="number" id="${idPrefix}warn" min="100" value="${warnVal}" style="
            width: 80px; padding: 4px 8px; border-radius: 6px;
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15)); font-size: 12px;
          " />
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Danger Token Threshold</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Token count where high-usage state triggers</div>
          </div>
          <input type="number" id="${idPrefix}danger" min="200" value="${dangerVal}" style="
            width: 80px; padding: 4px 8px; border-radius: 6px;
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15)); font-size: 12px;
          " />
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Cost Estimation Tooltip</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Show exact model-specific cost estimate on hover</div>
          </div>
          <button id="${idPrefix}cost" class="agy-switch-toggle" style="
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

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Reset Usage Counters</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Clear cumulative history for current conversation & project</div>
          </div>
          <button type="button" id="${idPrefix}reset-stats-btn" class="agy-btn" style="
            padding: 4px 10px; font-size: 11px; border-radius: 6px;
            background: var(--muted, #27272a); color: var(--muted-foreground, #a1a1aa);
            border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;
          ">Reset Stats</button>
        </div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.TokenCounterPlugin = TokenCounterPlugin;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TokenCounterPlugin;
}
