/**
 * AgyApi v3.0.0: The core global developer API for AntiPersonality.
 * Exposed in the renderer window as window.AgyApi (mirroring Vencord / BetterDiscord's BdApi).
 */

(function () {
  if (window.AgyApi && window.AgyApi.Telemetry && typeof window.AgyApi.Telemetry.cleanup === 'function') {
    try { window.AgyApi.Telemetry.cleanup(); } catch (_) {}
  }
  const existingThemes = window.AgyApi ? window.AgyApi.Themes : null;
  const existingPlugins = window.AgyApi ? window.AgyApi.Plugins : null;
  const existingPatchMap = (window.AgyApi && window.AgyApi.Patcher && window.AgyApi.Patcher._patches)
    ? window.AgyApi.Patcher._patches
    : new Map();

  const CORE_MOTION_CSS = `
    :root {
      --agy-spring-snappy: linear(
        0, 0.402 7.4%, 0.711 15.3%, 0.929 23.7%, 1.008 28.2%,
        1.067 33%, 1.099 36.9%, 1.12 41%, 1.13 45.4%, 1.13 50.1%,
        1.111 58.5%, 1.019 83.2%, 1.004 91.3%, 1
      );
      --agy-ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
    }
    .agy-switch-toggle {
      transition: background-color 160ms ease, border-color 160ms ease, transform 120ms ease !important;
    }
    .agy-switch-toggle:active {
      transform: scale(0.95);
    }
    .agy-switch-toggle > .agy-switch-thumb {
      transition:
        transform 400ms var(--agy-spring-snappy),
        width 130ms var(--agy-ease-out-quint),
        background-color 160ms ease !important;
      will-change: transform, width;
    }
    .agy-switch-toggle:active > .agy-switch-thumb {
      width: 20px !important;
    }
    .agy-switch-toggle[aria-checked="true"] > .agy-switch-thumb {
      transform: translateX(16px);
    }
    .agy-switch-toggle[aria-checked="false"] > .agy-switch-thumb {
      transform: translateX(0px);
    }
    .agy-switch-toggle[aria-checked="true"]:active > .agy-switch-thumb {
      transform: translateX(12px);
    }
    .agy-btn:focus-visible,
    .agy-switch-toggle:focus-visible,
    button[data-agy-tab]:focus-visible,
    #agy-settings-content button:focus-visible,
    #agy-settings-content input:focus-visible,
    #agy-settings-content select:focus-visible,
    #agy-settings-content textarea:focus-visible,
    #agy-alert-overlay button:focus-visible {
      outline: 2px solid var(--foreground, #f4f4f5) !important;
      outline-offset: 2px !important;
    }
  `;

  // Method Monkey-Patching Engine (before / instead / after / unpatchAll)
  const Patcher = {
    _patches: existingPatchMap, // key -> { obj, method, original, wrapper, records: Set<{ callerId, type, fn }> }

    _getHookEntry(obj, method) {
      if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
        throw new Error('AgyApi.Patcher: target object must be an object or function.');
      }
      if (typeof obj[method] !== 'function') {
        throw new Error(`AgyApi.Patcher: "${String(method)}" is not a function on target.`);
      }

      for (const entry of this._patches.values()) {
        if (entry.obj === obj && entry.method === method) {
          return entry;
        }
      }

      const original = obj[method];
      const records = new Set();
      const entry = { obj, method, original, records };

      const wrapper = function (...args) {
        let currentArgs = args;

        // 1. Run 'before' patches
        for (const rec of Array.from(records)) {
          if (rec.type === 'before') {
            try {
              const maybeArgs = rec.fn(this, currentArgs);
              if (Array.isArray(maybeArgs)) currentArgs = maybeArgs;
            } catch (err) {
              console.error(`[AgyApi.Patcher] Error in before patch (${rec.callerId}):`, err);
            }
          }
        }

        // 2. Run 'instead' chain or original function
        let callFn = (...callArgs) => original.apply(this, callArgs);
        for (const rec of Array.from(records)) {
          if (rec.type === 'instead') {
            const prevFn = callFn;
            callFn = (...callArgs) => {
              try {
                return rec.fn(this, callArgs, prevFn);
              } catch (err) {
                console.error(`[AgyApi.Patcher] Error in instead patch (${rec.callerId}):`, err);
                return prevFn(...callArgs);
              }
            };
          }
        }

        const retVal = callFn(...currentArgs);

        // 3. Run 'after' patches (supports both synchronous values and Promises)
        const runAfter = (resolvedVal) => {
          let val = resolvedVal;
          for (const rec of Array.from(records)) {
            if (rec.type === 'after') {
              try {
                const maybeRet = rec.fn(this, currentArgs, val);
                if (maybeRet !== undefined) val = maybeRet;
              } catch (err) {
                console.error(`[AgyApi.Patcher] Error in after patch (${rec.callerId}):`, err);
              }
            }
          }
          return val;
        };

        if (retVal && (typeof retVal === 'object' || typeof retVal === 'function') && typeof retVal.then === 'function') {
          return retVal.then(runAfter);
        }
        return runAfter(retVal);
      };

      try {
        Object.defineProperties(wrapper, {
          length: { value: original.length, configurable: true },
          name: { value: original.name, configurable: true }
        });
        Object.assign(wrapper, original);
      } catch (_) {}

      obj[method] = wrapper;
      entry.wrapper = wrapper;
      this._patches.set(Symbol(`patch:${String(method)}`), entry);
      return entry;
    },

    _cleanupEntry(entry) {
      if (entry.records.size === 0) {
        try {
          if (entry.obj[entry.method] === entry.wrapper) {
            entry.obj[entry.method] = entry.original;
          }
        } catch (_) {}
        for (const [k, v] of this._patches.entries()) {
          if (v === entry) this._patches.delete(k);
        }
      }
    },

    _addPatch(type, callerId, obj, method, fn) {
      if (!callerId || typeof callerId !== 'string') {
        throw new Error('AgyApi.Patcher: callerId string is required.');
      }
      if (typeof fn !== 'function') {
        throw new Error('AgyApi.Patcher: patch callback must be a function.');
      }
      const entry = this._getHookEntry(obj, method);
      const record = { callerId, type, fn };
      entry.records.add(record);

      return () => {
        entry.records.delete(record);
        this._cleanupEntry(entry);
      };
    },

    before(callerId, obj, method, fn) {
      return this._addPatch('before', callerId, obj, method, fn);
    },

    instead(callerId, obj, method, fn) {
      return this._addPatch('instead', callerId, obj, method, fn);
    },

    after(callerId, obj, method, fn) {
      return this._addPatch('after', callerId, obj, method, fn);
    },

    getPatchesByCaller(callerId) {
      const list = [];
      for (const entry of this._patches.values()) {
        for (const rec of entry.records) {
          if (rec.callerId === callerId) {
            list.push({ method: entry.method, type: rec.type });
          }
        }
      }
      return list;
    },

    unpatchAll(callerId) {
      let count = 0;
      for (const entry of Array.from(this._patches.values())) {
        for (const rec of Array.from(entry.records)) {
          if (!callerId || rec.callerId === callerId) {
            entry.records.delete(rec);
            count++;
          }
        }
        this._cleanupEntry(entry);
      }
      return count;
    }
  };

  const AgyApi = {
    version: '3.1.0',

    // DOM Management Sub-API
    DOM: {
      addStyle(id, cssString) {
        let style = document.getElementById(`agy-style-${id}`);
        if (!style) {
          style = document.createElement('style');
          style.id = `agy-style-${id}`;
          style.setAttribute('data-agy-managed', 'true');
          (document.head || document.documentElement).appendChild(style);
        }
        if (style.textContent !== cssString) {
          style.textContent = cssString;
        }
        return style;
      },

      removeStyle(id) {
        const style = document.getElementById(`agy-style-${id}`);
        if (style) {
          style.remove();
          return true;
        }
        return false;
      },

      createElement(tag, attributes = {}, innerHtml = '') {
        const el = document.createElement(tag);
        for (const [key, val] of Object.entries(attributes)) {
          if (key === 'className') el.className = val;
          else if (key === 'textContent') el.textContent = val;
          else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
          else el.setAttribute(key, val);
        }
        if (innerHtml) el.innerHTML = innerHtml;
        return el;
      }
    },

    // UI & Notification Sub-API
    UI: {
      _ensureToastContainer() {
        let container = document.getElementById('agy-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'agy-toast-container';
          container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
          `;
          document.body.appendChild(container);
        }
        return container;
      },

      _dismissToastFlip(toast, container) {
        if (!toast || !toast.isConnected) return;
        const siblings = Array.from(container.children).filter(el => el !== toast);
        const beforeTop = new Map();
        siblings.forEach(el => beforeTop.set(el, el.getBoundingClientRect().top));

        toast.remove();

        siblings.forEach(el => {
          const prev = beforeTop.get(el);
          const next = el.getBoundingClientRect().top;
          const delta = prev - next;
          if (Math.abs(delta) > 0.5 && typeof el.animate === 'function') {
            el.animate(
              [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
              { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
          }
        });
      },

      showToast(message, options = {}) {
        if (!document.body) return;
        const { type = 'info', timeout = 3000 } = options;
        const container = this._ensureToastContainer();

        // Cap visible stack at 4 toasts so rapid actions never flood the viewport
        while (container.children.length >= 4) {
          this._dismissToastFlip(container.firstElementChild, container);
        }

        const toast = document.createElement('div');
        toast.className = `agy-toast agy-toast-${type}`;

        const indicators = {
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b',
          info: 'var(--foreground, #f4f4f5)'
        };
        const dotColor = indicators[type] || indicators.info;

        toast.style.cssText = `
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 240px;
          max-width: 400px;
          padding: 10px 14px;
          border-radius: 8px;
          background: var(--card, #18181b);
          border: 1px solid var(--border, rgba(255,255,255,0.14));
          color: var(--foreground, #f4f4f5);
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 500;
          box-shadow: 0 10px 28px rgba(0,0,0,0.45);
          backdrop-filter: blur(12px);
          transform: translateY(14px) scale(0.97);
          opacity: 0;
          transition: transform 0.28s var(--agy-spring-snappy, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.2s ease;
        `;

        const dot = document.createElement('span');
        dot.style.cssText = `width: 7px; height: 7px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 8px ${dotColor}; flex-shrink: 0; display: inline-block;`;

        const textSpan = document.createElement('span');
        textSpan.style.cssText = 'flex: 1; line-height: 1.4;';
        textSpan.textContent = String(message);

        toast.appendChild(dot);
        toast.appendChild(textSpan);
        container.appendChild(toast);

        if (type === 'error' && window.AgyApi && window.AgyApi.Telemetry) {
          window.AgyApi.Telemetry.pulseError();
        }

        requestAnimationFrame(() => {
          toast.style.transform = 'translateY(0) scale(1)';
          toast.style.opacity = '1';
        });

        setTimeout(() => {
          toast.style.transform = 'translateY(10px) scale(0.97)';
          toast.style.opacity = '0';
          setTimeout(() => this._dismissToastFlip(toast, container), 220);
        }, timeout);
      },

      alert(title, content) {
        if (!document.body) return;
        const prev = document.getElementById('agy-alert-overlay');
        if (prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.id = 'agy-alert-overlay';
        overlay.style.cssText = `
          position: fixed; inset: 0; z-index: 1000002;
          background: rgba(0, 0, 0, 0.58); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
          width: 400px; max-width: calc(100vw - 32px);
          background: var(--card, #18181b); color: var(--foreground, #f4f4f5);
          border: 1px solid var(--border, rgba(255,255,255,0.16));
          border-radius: 10px; padding: 18px 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          display: flex; flex-direction: column; gap: 12px;
        `;

        const h = document.createElement('div');
        h.style.cssText = 'font-size: 14px; font-weight: 600; letter-spacing: -0.01em;';
        h.textContent = String(title || 'AntiPersonality');

        const body = document.createElement('div');
        body.style.cssText = 'font-size: 12.5px; color: var(--secondary-foreground, #a1a1aa); line-height: 1.5; white-space: pre-wrap;';
        body.textContent = String(content || '');

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; justify-content: flex-end; padding-top: 4px;';

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.textContent = 'Dismiss';
        okBtn.style.cssText = `
          padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;
          background: var(--foreground, #f4f4f5); color: var(--background, #09090b);
          border: none; cursor: pointer;
        `;

        const close = () => {
          document.removeEventListener('keydown', onEsc, true);
          overlay.remove();
        };
        const onEsc = (e) => {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            close();
          }
        };
        okBtn.onclick = close;
        overlay.onmousedown = (e) => { if (e.target === overlay) close(); };
        document.addEventListener('keydown', onEsc, true);

        actions.appendChild(okBtn);
        card.appendChild(h);
        card.appendChild(body);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        okBtn.focus();
      },

      confirm(title, content, options = {}) {
        return new Promise((resolve) => {
          if (!document.body) return resolve(false);
          const { confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = options;
          const prev = document.getElementById('agy-alert-overlay');
          if (prev) prev.remove();

          const overlay = document.createElement('div');
          overlay.id = 'agy-alert-overlay';
          overlay.setAttribute('role', 'dialog');
          overlay.setAttribute('aria-modal', 'true');
          overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 1000002;
            background: rgba(0, 0, 0, 0.58); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center;
          `;

          const card = document.createElement('div');
          card.style.cssText = `
            width: 420px; max-width: calc(100vw - 32px);
            background: var(--card, #18181b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.16));
            border-radius: 10px; padding: 18px 20px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            display: flex; flex-direction: column; gap: 12px;
          `;

          const h = document.createElement('div');
          h.style.cssText = 'font-size: 14px; font-weight: 600; letter-spacing: -0.01em;';
          h.textContent = String(title || 'Confirm Action');

          const body = document.createElement('div');
          body.style.cssText = 'font-size: 12.5px; color: var(--secondary-foreground, #d4d4d8); line-height: 1.5; white-space: pre-wrap;';
          body.textContent = String(content || '');

          const actions = document.createElement('div');
          actions.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px;';

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'agy-btn';
          cancelBtn.textContent = String(cancelLabel);
          cancelBtn.style.cssText = `
            padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;
            background: var(--muted, #27272a); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.12)); cursor: pointer;
          `;

          const okBtn = document.createElement('button');
          okBtn.type = 'button';
          okBtn.className = 'agy-btn';
          okBtn.textContent = String(confirmLabel);
          okBtn.style.cssText = danger
            ? 'padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #ef4444; color: #ffffff; border: none; cursor: pointer;'
            : 'padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; background: var(--foreground, #f4f4f5); color: var(--background, #09090b); border: none; cursor: pointer;';

          const finish = (val) => {
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            resolve(val);
          };
          const onKey = (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              finish(false);
            }
          };
          cancelBtn.onclick = () => finish(false);
          okBtn.onclick = () => finish(true);
          overlay.onmousedown = (e) => { if (e.target === overlay) finish(false); };
          document.addEventListener('keydown', onKey, true);

          actions.appendChild(cancelBtn);
          actions.appendChild(okBtn);
          card.appendChild(h);
          card.appendChild(body);
          card.appendChild(actions);
          overlay.appendChild(card);
          document.body.appendChild(overlay);
          cancelBtn.focus();
        });
      },

      flashCompileBar() {
        if (!document.body || typeof document.body.animate !== 'function') return;
        let bar = document.getElementById('agy-hotreload-bar');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'agy-hotreload-bar';
          bar.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; height: 2px;
            z-index: 1000005; pointer-events: none; transform-origin: left center;
            background: linear-gradient(90deg, transparent, var(--theme-aura, #38bdf8), var(--foreground, #ffffff));
            box-shadow: 0 0 10px var(--theme-aura, #38bdf8);
            opacity: 0;
          `;
          document.body.appendChild(bar);
        }
        bar.animate(
          [
            { transform: 'scaleX(0)', opacity: 1 },
            { transform: 'scaleX(0.85)', opacity: 1, offset: 0.55 },
            { transform: 'scaleX(1)', opacity: 0 }
          ],
          { duration: 540, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
      },

      spawnBurst(originX, originY, color = 'var(--foreground, #f4f4f5)') {
        if (!document.body || typeof document.body.animate !== 'function') return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const count = 14;
        for (let i = 0; i < count; i++) {
          const p = document.createElement('span');
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.32;
          const dist = 26 + Math.random() * 38;
          const size = 3.5 + Math.random() * 2.5;
          p.style.cssText = `
            position: fixed; left: ${originX}px; top: ${originY}px;
            width: ${size}px; height: ${size}px; border-radius: 50%;
            background: ${i % 3 === 0 ? 'var(--theme-aura, #38bdf8)' : color};
            box-shadow: 0 0 6px currentColor;
            pointer-events: none; z-index: 1000003;
          `;
          document.body.appendChild(p);
          p.animate(
            [
              { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
              { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 10}px) scale(0)`, opacity: 0 }
            ],
            { duration: 460 + Math.random() * 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
          ).onfinish = () => p.remove();
        }
      }
    },

    // Persistent Storage & Profile Backup Sub-API
    Data: {
      save(addonName, key, value) {
        try {
          const storeKey = `AgyData:${addonName}`;
          let data = Object.create(null);
          const existing = localStorage.getItem(storeKey);
          if (existing) Object.assign(data, JSON.parse(existing));
          data[key] = value;
          localStorage.setItem(storeKey, JSON.stringify(data));
          return true;
        } catch (e) {
          console.error(`[AgyApi.Data] Failed to save ${addonName}.${key}:`, e);
          return false;
        }
      },

      load(addonName, key, defaultValue = null) {
        try {
          const storeKey = `AgyData:${addonName}`;
          const existing = localStorage.getItem(storeKey);
          if (!existing) return defaultValue;
          const data = JSON.parse(existing);
          return (data && Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined)
            ? data[key]
            : defaultValue;
        } catch (e) {
          console.error(`[AgyApi.Data] Failed to load ${addonName}.${key}:`, e);
          return defaultValue;
        }
      },

      delete(addonName, key) {
        try {
          const storeKey = `AgyData:${addonName}`;
          const existing = localStorage.getItem(storeKey);
          if (!existing) return true;
          const data = JSON.parse(existing);
          if (data && typeof data === 'object') {
            delete data[key];
            localStorage.setItem(storeKey, JSON.stringify(data));
          }
          return true;
        } catch (_) {
          return false;
        }
      },

      exportAll(extra = {}) {
        const storage = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('AgyData:')) {
              try {
                storage[k] = JSON.parse(localStorage.getItem(k));
              } catch (_) {
                storage[k] = localStorage.getItem(k);
              }
            }
          }
        } catch (err) {
          console.error('[AgyApi.Data] Export error:', err);
        }
        return {
          schema: 'antipersonality-profile',
          version: '3.0.0',
          exportedAt: new Date().toISOString(),
          storage,
          ...extra
        };
      },

      importAll(payload) {
        if (!payload || typeof payload !== 'object' || !payload.storage || typeof payload.storage !== 'object') {
          throw new Error('Invalid AntiPersonality configuration backup file.');
        }
        const stripProto = (val) => {
          if (!val || typeof val !== 'object') return val;
          if (Array.isArray(val)) return val.map(stripProto);
          const clean = Object.create(null);
          for (const [k, v] of Object.entries(val)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            clean[k] = stripProto(v);
          }
          return clean;
        };

        for (const [k, val] of Object.entries(payload.storage)) {
          if (typeof k === 'string' && k.startsWith('AgyData:') && k.length < 120) {
            localStorage.setItem(k, JSON.stringify(stripProto(val)));
          }
        }
        return payload;
      },

      purgeAll() {
        const toRemove = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('AgyData:') || k.startsWith('agy_'))) {
              toRemove.push(k);
            }
          }
          toRemove.forEach((k) => localStorage.removeItem(k));
        } catch (err) {
          console.error('[AgyApi.Data] Purge error:', err);
        }
        return toRemove.length;
      }
    },

    Patcher,
    Themes: existingThemes,
    Plugins: existingPlugins
  };

  // Single Unified Developer & Agent Telemetry Bus (replaces duplicate per-plugin DOM scanners)
  const Telemetry = (() => {
    const keyTimes = [];
    let mood = 'idle';
    let wpm = 0;
    let wasGenerating = false;
    let lastActivityAt = Date.now();
    let typingCooldownTimer = null;
    let transientMoodTimer = null;
    let scanTimer = null;
    let idleInterval = null;
    let observer = null;

    function detectGenerating() {
      return Boolean(
        document.querySelector(
          'button[aria-label*="Stop" i], button[aria-label*="Cancel generation" i], [data-testid*="stop-generating" i], [data-testid*="cancel-turn" i]'
        )
      );
    }

    function setMood(nextMood, extra = {}) {
      if (mood === nextMood && nextMood !== 'error' && nextMood !== 'celebrate' && nextMood !== 'wake-startle') return;
      mood = nextMood;
      if (document.documentElement) {
        document.documentElement.dataset.agyAgentState = nextMood;
      }
      window.dispatchEvent(new CustomEvent('agy:companion-state', {
        detail: { mood: nextMood, wpm, ...extra }
      }));
    }

    function pulseTransientMood(targetMood, durationMs = 1600) {
      if (transientMoodTimer) clearTimeout(transientMoodTimer);
      setMood(targetMood);
      transientMoodTimer = setTimeout(() => {
        transientMoodTimer = null;
        setMood(wasGenerating ? 'streaming' : 'idle');
      }, durationMs);
    }

    function scanDomSignals() {
      const isGen = detectGenerating();
      if (isGen && !wasGenerating) {
        wasGenerating = true;
        setMood('streaming');
      } else if (!isGen && wasGenerating) {
        wasGenerating = false;
        window.dispatchEvent(new CustomEvent('agy:auto-sfx', { detail: { type: 'finish' } }));
        pulseTransientMood('celebrate', 2200);
      }

      const errNode = document.querySelector(
        '[data-sonner-toast][data-type="error"]:not([data-agy-sfx-seen])'
      );
      if (errNode) {
        errNode.setAttribute('data-agy-sfx-seen', '1');
        window.dispatchEvent(new CustomEvent('agy:auto-sfx', { detail: { type: 'error' } }));
        pulseTransientMood('error', 1600);
      }

      const apprNode = document.querySelector(
        'button[data-testid*="approve" i]:not([data-agy-sfx-seen]), button[aria-label*="Approve" i]:not([data-agy-sfx-seen]), button[aria-label*="Proceed" i]:not([data-agy-sfx-seen])'
      );
      if (apprNode) {
        apprNode.setAttribute('data-agy-sfx-seen', '1');
        window.dispatchEvent(new CustomEvent('agy:auto-sfx', { detail: { type: 'approval' } }));
      }
    }

    const onKeyDown = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = Date.now();
      lastActivityAt = now;

      if (mood === 'sleep') {
        pulseTransientMood('wake-startle', 1200);
        return;
      }

      if (e.key && e.key.length === 1) {
        keyTimes.push(now);
        while (keyTimes.length > 0 && now - keyTimes[0] > 5000) keyTimes.shift();
        wpm = Math.round((keyTimes.length / 5) * 12);

        if (wpm >= 75 && !wasGenerating && mood !== 'error') {
          setMood('typing-frenzy');
        }
        if (typingCooldownTimer) clearTimeout(typingCooldownTimer);
        typingCooldownTimer = setTimeout(() => {
          typingCooldownTimer = null;
          const cutoff = Date.now() - 5000;
          while (keyTimes.length > 0 && keyTimes[0] < cutoff) keyTimes.shift();
          wpm = Math.round((keyTimes.length / 5) * 12);
          if (mood === 'typing-frenzy') {
            setMood(wasGenerating ? 'streaming' : 'idle');
          }
        }, 1800);
      }
    };

    const onPointerDown = () => {
      lastActivityAt = Date.now();
      if (mood === 'sleep') {
        pulseTransientMood('wake-startle', 1200);
      }
    };

    function init() {
      wasGenerating = detectGenerating();
      if (document.documentElement) {
        document.documentElement.dataset.agyAgentState = wasGenerating ? 'streaming' : 'idle';
      }
      mood = wasGenerating ? 'streaming' : 'idle';

      document.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
      document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });

      observer = new MutationObserver((mutations) => {
        if (scanTimer !== null) return;
        let relevant = false;
        for (let i = 0; i < mutations.length; i++) {
          const t = mutations[i].target;
          if (t && t.nodeType === 1 && !t.closest('#agy-toast-container, #agy-input-addons-wrapper, [data-agy-managed]')) {
            relevant = true;
            break;
          }
        }
        if (!relevant) return;
        scanTimer = setTimeout(() => {
          scanTimer = null;
          try { scanDomSignals(); } catch (_) {}
        }, 380);
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }

      idleInterval = setInterval(() => {
        if (!wasGenerating && mood === 'idle' && Date.now() - lastActivityAt >= 600000) {
          setMood('sleep');
        }
      }, 15000);
    }

    function cleanup() {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      if (observer) { observer.disconnect(); observer = null; }
      if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
      if (typingCooldownTimer) { clearTimeout(typingCooldownTimer); typingCooldownTimer = null; }
      if (transientMoodTimer) { clearTimeout(transientMoodTimer); transientMoodTimer = null; }
      if (idleInterval) { clearInterval(idleInterval); idleInterval = null; }
    }

    init();

    return {
      getState: () => ({ mood, wpm, isGenerating: wasGenerating }),
      pulseError: () => {
        window.dispatchEvent(new CustomEvent('agy:auto-sfx', { detail: { type: 'error' } }));
        pulseTransientMood('error', 1600);
      },
      cleanup
    };
  })();

  AgyApi.Telemetry = Telemetry;
  AgyApi.DOM.addStyle('core-motion', CORE_MOTION_CSS);

  // Global Error Boundary & Crash Protection (catches both file-backed and new Function plugin stacks)
  if (!window.__agyErrorBoundaryBound) {
    window.__agyErrorBoundaryBound = true;
    window.addEventListener('error', (event) => {
      const stack = (event.error && typeof event.error.stack === 'string') ? event.error.stack : '';
      const fromAgyFile = event.filename && (event.filename.includes('plugin') || event.filename.includes('agy'));
      const fromAgyStack = stack.includes('AgyApi') || stack.includes('AgyPluginManager') || stack.includes('AgyThemeManager');
      if (fromAgyFile || fromAgyStack) {
        console.warn('[AntiPersonality] Intercepted runtime addon error:', event.message);
        event.preventDefault();
      }
    });
  }

  window.AgyApi = AgyApi;
})();
