/**
 * SettingsTab v3.0.0: Native Antigravity-styled Settings UI & Command Palette.
 * Provides 4 tabs under AntiPersonality: Themes, Plugins, Personas, and Custom CSS,
 * plus Profile Export/Import, Per-Theme Performance Controls, and Ctrl+Shift+M Command Palette.
 */

(function () {
  // Teardown previous listeners/timers if hot-reloading
  if (typeof window.__agySettingsCleanup === 'function') {
    try { window.__agySettingsCleanup(); } catch (_) {}
  }

  const THEME_ACCENTS = {
    'amoled': {
      primary: '#ffffff', gradient: 'linear-gradient(135deg, #27272a, #e4e4e7)',
      bg: '#000000', sidebar: '#030303', card: '#080808', bubble: '#101012', border: 'rgba(255,255,255,0.12)'
    },
    'black-shores': {
      primary: '#00f0ff', gradient: 'linear-gradient(135deg, #00f0ff, #818cf8)',
      bg: '#020611', sidebar: '#04091a', card: '#060d21', bubble: 'rgba(0,240,255,0.12)', border: 'rgba(0,240,255,0.28)'
    },
    'capri': {
      primary: '#ff1e56', gradient: 'linear-gradient(135deg, #ff1e56, #00e64d)',
      bg: '#07030d', sidebar: '#11061c', card: '#160824', bubble: 'rgba(255,30,86,0.18)', border: 'rgba(255,30,86,0.34)'
    },
    'eldritch': {
      primary: '#ff1e38', gradient: 'linear-gradient(135deg, #ff1e38, #880818)',
      bg: '#030004', sidebar: '#0a0208', card: '#12030d', bubble: 'rgba(255,30,56,0.14)', border: 'rgba(255,30,56,0.3)'
    },
    'moonlit': {
      primary: '#38bdf8', gradient: 'linear-gradient(135deg, #0284c7, #f59e0b)',
      bg: '#030712', sidebar: '#0b1329', card: '#0f1b38', bubble: 'rgba(56,189,248,0.13)', border: 'rgba(56,189,248,0.28)'
    },
    'prescript': {
      primary: '#00e5ff', gradient: 'linear-gradient(135deg, #00e5ff, #d4af37)',
      bg: '#020508', sidebar: '#070d14', card: '#0b141f', bubble: 'rgba(0,229,255,0.12)', border: 'rgba(0,229,255,0.28)'
    }
  };

  let suppressPluginRerender = false;
  let suppressThemeRerender = false;

  const SETTINGS_DELIGHT_CSS = `
    .agy-card {
      position: relative;
      background-clip: padding-box;
      transition: transform 200ms var(--agy-ease-out-quint, ease), border-color 180ms ease, box-shadow 180ms ease !important;
    }
    .agy-card:hover {
      transform: translateY(-1.5px);
    }
    .agy-card::before {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      padding: 1px;
      background: radial-gradient(
        240px circle at var(--mx, -999px) var(--my, -999px),
        rgba(255, 255, 255, 0.28),
        transparent 70%
      );
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .agy-plugin-drawer-shell {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      margin-top: 0;
      transition:
        grid-template-rows 260ms var(--agy-ease-out-quint, ease),
        opacity 190ms ease,
        margin-top 260ms var(--agy-ease-out-quint, ease);
    }
    .agy-plugin-drawer-shell.is-open {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 12px;
    }
    .agy-plugin-drawer-inner {
      overflow: hidden;
    }
    #agy-sidebar-active-pill {
      position: absolute;
      left: 8px;
      right: 8px;
      top: 0;
      height: 28px;
      border-radius: 8px;
      background: var(--sidebar-secondary, rgba(255, 255, 255, 0.09));
      pointer-events: none;
      opacity: 0;
      transition:
        transform 340ms var(--agy-spring-snappy, cubic-bezier(0.22, 1, 0.36, 1)),
        opacity 160ms ease;
      z-index: 0;
    }
    @keyframes agyTabStageIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #agy-settings-content > .agy-tab-stage {
      animation: agyTabStageIn 210ms var(--agy-ease-out-quint, ease) both;
    }
  `;
  if (window.AgyApi && window.AgyApi.DOM) {
    window.AgyApi.DOM.addStyle('settings-delight', SETTINGS_DELIGHT_CSS);
  }

  const PERSONA_ARCHETYPES = [
    {
      id: 'tech-lead',
      name: 'The Senior Tech Lead',
      badge: 'Principal Architect',
      description: 'Direct, pragmatic systems engineering. Prioritizes architectural boundaries, strict typing, explicit trade-offs, and long-term maintainability.'
    },
    {
      id: 'mentor',
      name: 'The Patient Mentor',
      badge: 'Technical Educator',
      description: 'Empathetic, pedagogical guidance. Explains underlying principles with clear analogies, anticipates pitfalls, and writes well-commented modular code.'
    },
    {
      id: 'speedrunner',
      name: 'The 10x Speedrunner',
      badge: 'High Velocity',
      description: 'Maximum throughput and telepathic brevity. Jumps straight to diffs, file edits, and commands with zero conversational preamble.'
    },
    {
      id: 'sre-auditor',
      name: 'The Paranoid SRE',
      badge: 'Zero-Trust Security',
      description: 'Methodical defense-in-depth mindset. Hunts race conditions, resource leaks, missing timeouts, and untrusted inputs before shipping.'
    },
    {
      id: 'minimalist',
      name: 'The Zen Minimalist',
      badge: 'Radical Simplicity',
      description: 'Uncluttered precision. Favors standard library primitives, deletes dead code, and avoids premature abstractions or heavy dependencies.'
    }
  ];

  const DEFAULT_PERSONA = {
    enabled: true,
    activeArchetype: 'tech-lead',
    verbosity: 50,
    autonomy: 'autonomous',
    strictTyping: true,
    version: '3.0.0'
  };

  function getPersonaState() {
    const saved = AgyApi.Data.load('PersonaManager', 'config', null);
    const initial = window.__AGY_INITIAL_PERSONA__ || {};
    const savedTs = saved && saved.updatedAt ? Date.parse(saved.updatedAt) : 0;
    const initTs = initial && initial.updatedAt ? Date.parse(initial.updatedAt) : 0;
    const merged = initTs >= savedTs
      ? Object.assign({}, saved || {}, initial)
      : Object.assign({}, initial, saved || {});
    return Object.assign({}, DEFAULT_PERSONA, merged);
  }

  async function syncPersonaFromBridge() {
    try {
      const res = await fetch('http://127.0.0.1:51788/persona', { mode: 'cors' });
      if (res.ok) {
        const diskConfig = await res.json();
        if (diskConfig && diskConfig.activeArchetype) {
          const merged = Object.assign({}, DEFAULT_PERSONA, diskConfig);
          AgyApi.Data.save('PersonaManager', 'config', merged);
          window.__AGY_INITIAL_PERSONA__ = merged;
          return merged;
        }
      }
    } catch (_) {}
    return getPersonaState();
  }

  async function savePersonaState(partialUpdate, showToast = true) {
    const next = Object.assign({}, getPersonaState(), partialUpdate, {
      updatedAt: new Date().toISOString(),
      version: '3.0.0'
    });
    AgyApi.Data.save('PersonaManager', 'config', next);
    window.__AGY_INITIAL_PERSONA__ = next;

    let syncedDisk = false;
    try {
      const res = await fetch('http://127.0.0.1:51788/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
        mode: 'cors'
      });
      syncedDisk = res.ok;
    } catch (_) {}

    if (showToast) {
      const arch = PERSONA_ARCHETYPES.find(a => a.id === next.activeArchetype);
      const label = arch ? arch.name : next.activeArchetype;
      AgyApi.UI.showToast(
        syncedDisk ? `Persona synced: ${label}` : `Persona saved locally: ${label}`,
        { type: 'success', timeout: 2200 }
      );
    }

    window.dispatchEvent(new CustomEvent('agy:persona-change', { detail: next }));
    return next;
  }

  window.AgyPersonaManager = {
    getArchetypes: () => PERSONA_ARCHETYPES.slice(),
    getState: getPersonaState,
    sync: syncPersonaFromBridge,
    update: savePersonaState
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function syncSwitchDom(btn, checked) {
    if (!btn) return;
    btn.setAttribute('aria-checked', checked ? 'true' : 'false');
    btn.style.background = checked ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
    btn.style.borderColor = checked ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
    const thumb = btn.querySelector('.agy-switch-thumb');
    if (thumb) {
      thumb.style.background = checked ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
    }
  }

  function renderNativeSwitch(checked, onClickAttr, title = '') {
    return `
      <button type="button" role="switch" aria-checked="${checked ? 'true' : 'false'}" class="agy-switch-toggle" style="
        width: 38px;
        height: 22px;
        border-radius: 999px;
        background: ${checked ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)'};
        border: 1px solid ${checked ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)'};
        position: relative;
        cursor: pointer;
        padding: 0;
        outline: none;
        flex-shrink: 0;
      " onclick="${onClickAttr}" title="${escapeHtml(title)}">
        <span class="agy-switch-thumb" style="
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${checked ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)'};
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></span>
      </button>
    `;
  }

  window.__agyTogglePluginSwitch = function (btn, id) {
    suppressPluginRerender = true;
    try {
      AgyPluginManager.togglePlugin(id);
      const p = AgyPluginManager.getPlugin(id);
      const next = Boolean(p && p.enabled);
      syncSwitchDom(btn, next);
      if (btn) btn.title = next ? 'Click to disable' : 'Click to enable';
    } finally {
      suppressPluginRerender = false;
    }
  };

  window.__agyTogglePerfSwitch = function (btn, key) {
    suppressThemeRerender = true;
    try {
      const cur = AgyThemeManager.getPerfSettings();
      const next = !cur[key];
      AgyThemeManager.setPerfSetting(key, next);
      syncSwitchDom(btn, next);
    } finally {
      suppressThemeRerender = false;
    }
  };

  function renderProfileBackupActions() {
    return `
      <button type="button" class="agy-btn" style="
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        background: var(--card, rgba(24,24,27,0.7));
        color: var(--secondary-foreground, #a1a1aa);
        transition: all 0.15s ease;
      " onclick="window.__agyExportProfile()" title="Export themes, plugins, snippets, custom CSS, and persona settings as JSON">Export Config</button>

      <button type="button" class="agy-btn" style="
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        background: var(--card, rgba(24,24,27,0.7));
        color: var(--secondary-foreground, #a1a1aa);
        transition: all 0.15s ease;
      " onclick="window.__agyTriggerImportProfile()" title="Import an AntiPersonality JSON backup file">Import Config</button>

      <button type="button" class="agy-btn" style="
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid rgba(239, 68, 68, 0.28);
        background: rgba(239, 68, 68, 0.08);
        color: #fca5a5;
        transition: all 0.15s ease;
      " onclick="window.__agyPurgeLocalData()" title="Delete all AntiPersonality localStorage data, custom CSS, and active themes">Purge Data</button>
    `;
  }

  window.__agyPurgeLocalData = async function () {
    const confirmed = (AgyApi.UI && typeof AgyApi.UI.confirm === 'function')
      ? await AgyApi.UI.confirm(
          'Purge All Local AntiPersonality Data?',
          'This removes every AgyData:* entry from localStorage, clears Custom CSS, disables active client plugins, and restores the stock Antigravity interface.',
          { confirmLabel: 'Purge All Data', cancelLabel: 'Cancel', danger: true }
        )
      : false;
    if (!confirmed) return;

    try {
      for (const p of AgyPluginManager.getAllPlugins()) {
        if (p.enabled) AgyPluginManager.disablePlugin(p.id, false);
      }
      AgyThemeManager.setCustomCSS('', false);
      AgyThemeManager.setPerfSetting('disableBgVideo', false, false);
      AgyThemeManager.setPerfSetting('hideCompanions', false, false);
      await window.__betterAgyApplyThemeWithScript('stock', true);
      const count = AgyApi.Data.purgeAll();
      if (window.__refreshActiveAgyTab) window.__refreshActiveAgyTab();
      AgyApi.UI.showToast(`Purged ${count} local storage record(s) and restored defaults`, { type: 'info', timeout: 3200 });
    } catch (err) {
      AgyApi.UI.showToast(`Purge failed: ${err.message}`, { type: 'error' });
    }
  };

  window.__agyExportProfile = function () {
    try {
      const payload = AgyApi.Data.exportAll({
        persona: getPersonaState()
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `antipersonality-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      AgyApi.UI.showToast('Configuration exported to JSON', { type: 'success' });
    } catch (err) {
      AgyApi.UI.showToast(`Export failed: ${err.message}`, { type: 'error' });
    }
  };

  window.__agyTriggerImportProfile = function () {
    let fileInput = document.getElementById('agy-profile-import-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'agy-profile-import-input';
      fileInput.accept = '.json,application/json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }
    fileInput.value = '';
    fileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        AgyApi.Data.importAll(parsed);

        if (parsed.persona && typeof parsed.persona === 'object') {
          await savePersonaState(parsed.persona, false);
        }

        // Re-apply theme, perf settings, custom CSS, and plugins
        AgyThemeManager.init();
        const activeId = AgyApi.Data.load('ThemeManager', 'activeTheme', null);
        if (activeId) {
          await window.__betterAgyApplyThemeWithScript(activeId, false);
        } else {
          await window.__betterAgyApplyThemeWithScript('stock', true);
        }

        for (const p of AgyPluginManager.getAllPlugins()) {
          const shouldEnable = AgyApi.Data.load('PluginManager', `plugin:${p.id}`, false);
          if (shouldEnable && !p.enabled) AgyPluginManager.enablePlugin(p.id, false);
          else if (!shouldEnable && p.enabled) AgyPluginManager.disablePlugin(p.id, false);
        }

        if (window.__refreshActiveAgyTab) window.__refreshActiveAgyTab();
        AgyApi.UI.showToast('Configuration restored from backup', { type: 'success' });
      } catch (err) {
        AgyApi.UI.showToast(`Import failed: ${err.message}`, { type: 'error' });
      }
    };
    fileInput.click();
  };

  function extractCssToken(css, varName, fallback) {
    if (!css) return fallback;
    const re = new RegExp(`${varName}\\s*:\\s*([^;!\\n}]+)`, 'i');
    const m = css.match(re);
    return m ? m[1].trim() : fallback;
  }

  function resolveThemePreview(theme) {
    if (THEME_ACCENTS[theme.id]) return THEME_ACCENTS[theme.id];
    const css = theme.css || '';
    const bg = extractCssToken(css, '--background', '#09090b');
    const card = extractCssToken(css, '--card', '#18181b');
    const border = extractCssToken(css, '--border', 'rgba(255,255,255,0.14)');
    const primary = extractCssToken(css, '--theme-aura', extractCssToken(css, '--foreground', '#38bdf8'));
    return {
      primary,
      gradient: `linear-gradient(135deg, ${primary}, ${card})`,
      bg,
      sidebar: card,
      card,
      bubble: 'rgba(255,255,255,0.08)',
      border
    };
  }

  function renderThemeCard(theme, isActive) {
    const p = resolveThemePreview(theme);
    return `
      <div class="agy-card" data-theme-card-id="${escapeHtml(theme.id)}" style="
        background: ${isActive ? 'var(--sidebar-secondary, rgba(39, 39, 42, 0.55))' : 'var(--card, rgba(24, 24, 27, 0.65))'};
        border: 1px solid ${isActive ? 'var(--border, rgba(255, 255, 255, 0.24))' : 'var(--border, rgba(255, 255, 255, 0.08))'};
        box-shadow: ${isActive ? '0 0 0 1px var(--border, rgba(255, 255, 255, 0.12)), 0 6px 16px rgba(0, 0, 0, 0.38)' : 'none'};
        border-radius: 8px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 12px;
        backdrop-filter: blur(8px);
      ">
        <div>
          <!-- Miniature UI Chrome Preview Stage -->
          <div style="
            height: 68px; border-radius: 6px; overflow: hidden; position: relative;
            background: ${escapeHtml(p.bg)}; border: 1px solid ${escapeHtml(p.border)};
            display: grid; grid-template-columns: 42px 1fr; margin-bottom: 12px;
            box-shadow: inset 0 0 24px rgba(0,0,0,0.35);
          ">
            <div style="background:${escapeHtml(p.sidebar)}; border-right:1px solid ${escapeHtml(p.border)}; padding:7px 6px; display:flex; flex-direction:column; gap:4px;">
              <span style="width:14px; height:4px; border-radius:2px; background:${escapeHtml(p.primary)}; box-shadow:0 0 6px ${escapeHtml(p.primary)};"></span>
              <span style="width:24px; height:3px; border-radius:2px; background:rgba(255,255,255,0.18);"></span>
              <span style="width:19px; height:3px; border-radius:2px; background:rgba(255,255,255,0.1);"></span>
              <span style="width:22px; height:3px; border-radius:2px; background:rgba(255,255,255,0.08);"></span>
            </div>
            <div style="padding:7px 9px; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="align-self:flex-end; width:56%; height:13px; border-radius:4px; background:${escapeHtml(p.bubble)}; border:1px solid ${escapeHtml(p.border)};"></div>
              <div style="width:72%; height:7px; border-radius:3px; background:rgba(255,255,255,0.09);"></div>
              <div style="height:13px; border-radius:999px; background:${escapeHtml(p.card)}; border:1px solid ${escapeHtml(p.border)}; display:flex; align-items:center; justify-content:space-between; padding:0 5px;">
                <span style="width:32%; height:3px; border-radius:2px; background:rgba(255,255,255,0.14);"></span>
                <span style="width:7px; height:7px; border-radius:50%; background:${escapeHtml(p.gradient)};"></span>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${escapeHtml(p.gradient)};
                box-shadow: 0 0 6px ${escapeHtml(p.primary)};
                flex-shrink: 0;
              "></span>
              <span style="font-size:14px; font-weight:600; color:var(--foreground, #f4f4f5); letter-spacing:-0.01em;">${escapeHtml(theme.meta.name)}</span>
            </div>
            <span style="font-size:10.5px; font-weight:500; padding:1px 6px; border-radius:4px; background:var(--muted, rgba(255,255,255,0.06)); color:var(--muted-foreground, #71717a); border:1px solid var(--border, rgba(255,255,255,0.05));">v${escapeHtml(theme.meta.version)}</span>
          </div>
          <div style="font-size:11px; color:var(--muted-foreground, #71717a); margin-bottom:6px; font-weight:400;">by ${escapeHtml(theme.meta.author)}</div>
          <div style="font-size:12px; color:var(--secondary-foreground, #a1a1aa); line-height:1.45; min-height:36px;">${escapeHtml(theme.meta.description || 'Custom Antigravity theme.')}</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border, rgba(255,255,255,0.06));">
          <span style="font-size:11px; font-weight:500; display:flex; align-items:center; gap:5px; color:${isActive ? '#10b981' : 'var(--muted-foreground, #71717a)'};">
            <span style="width:6px; height:6px; border-radius:50%; background:${isActive ? '#10b981' : 'var(--muted, #52525b)'};"></span>
            ${isActive ? 'Active' : 'Inactive'}
          </span>
          <button type="button" class="agy-btn" style="
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            ${isActive ? `
              background: transparent;
              color: #f87171;
              border: 1px solid rgba(239, 68, 68, 0.3);
            ` : `
              background: var(--muted, #27272a);
              color: var(--foreground, #f4f4f5);
              border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
            `}
          "
          onclick="window.__betterAgyApplyThemeWithScript('${escapeHtml(theme.id)}', ${isActive}, event)">
            ${isActive ? 'Disable' : 'Apply Theme'}
          </button>
        </div>
      </div>
    `;
  }

  function renderPluginRow(plugin) {
    const isEnabled = plugin.enabled;
    const hasSettings = plugin.instance && typeof plugin.instance.getSettingsPanel === 'function';
    return `
      <div class="agy-card" style="
        background: var(--card, rgba(24, 24, 27, 0.65));
        border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 10px;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="flex:1; padding-right:16px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;">
              <span style="font-size:13.5px; font-weight:600; color:var(--foreground, #f4f4f5);">${escapeHtml(plugin.meta.name)}</span>
              <span style="font-size:10.5px; font-weight:500; padding:1px 6px; border-radius:4px; background:var(--muted, rgba(255,255,255,0.06)); color:var(--muted-foreground, #71717a); border:1px solid var(--border, rgba(255,255,255,0.05));">v${escapeHtml(plugin.meta.version)}</span>
            </div>
            <div style="font-size:11px; color:var(--muted-foreground, #71717a); margin-bottom:4px;">by ${escapeHtml(plugin.meta.author)}</div>
            <div style="font-size:12px; color:var(--secondary-foreground, #a1a1aa); line-height:1.4;">${escapeHtml(plugin.meta.description || '')}</div>
          </div>

          <div style="display:flex; align-items:center; gap:10px;">
            ${hasSettings ? `
              <button type="button" class="agy-btn" style="
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 11.5px;
                font-weight: 500;
                cursor: pointer;
                background: var(--muted, #27272a);
                color: var(--secondary-foreground, #a1a1aa);
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                transition: all 0.15s ease;
              " onclick="window.__togglePluginSettings('${escapeHtml(plugin.id)}')" title="Configure Plugin Settings">
                Settings
              </button>
            ` : ''}

            ${renderNativeSwitch(isEnabled, `window.__agyTogglePluginSwitch(this, '${escapeHtml(plugin.id)}')`, isEnabled ? 'Click to disable' : 'Click to enable')}
          </div>
        </div>

        <div id="agy-plugin-shell-${escapeHtml(plugin.id)}" class="agy-plugin-drawer-shell">
          <div class="agy-plugin-drawer-inner">
            <div id="agy-plugin-settings-${escapeHtml(plugin.id)}" style="padding-top:12px; border-top:1px solid var(--border, rgba(255,255,255,0.08));"></div>
          </div>
        </div>
      </div>
    `;
  }

  window.__togglePluginSettings = function (id) {
    const shell = document.getElementById(`agy-plugin-shell-${id}`);
    const drawer = document.getElementById(`agy-plugin-settings-${id}`);
    if (!shell || !drawer) return;
    const isOpen = shell.classList.contains('is-open');
    if (!isOpen) {
      const p = AgyPluginManager.getPlugin(id);
      if (p && p.instance && typeof p.instance.getSettingsPanel === 'function') {
        const panel = p.instance.getSettingsPanel();
        if (typeof panel === 'string') {
          drawer.innerHTML = panel;
        } else if (panel instanceof HTMLElement) {
          drawer.innerHTML = '';
          drawer.appendChild(panel);
        }
      } else {
        drawer.innerHTML = '<div style="font-size:12px; color:var(--muted-foreground);">No settings panel provided.</div>';
      }
      shell.classList.add('is-open');
    } else {
      shell.classList.remove('is-open');
    }
  };

  function getVerbosityLabel(val) {
    const n = Number(val);
    if (n < 30) return 'Terse';
    if (n <= 70) return 'Balanced';
    return 'Detailed';
  }

  function getVerbositySpecimen(val) {
    const n = Number(val);
    if (n < 30) {
      return `- return items.filter(Boolean).length;\n+ return items.reduce((c, x) => c + (x ? 1 : 0), 0);`;
    }
    if (n <= 70) {
      return `Replaced .filter(Boolean).length with a single-pass .reduce() counter to avoid allocating an intermediate array on every tick.\n\nreturn items.reduce((c, x) => c + (x ? 1 : 0), 0);`;
    }
    return `Root cause: .filter(Boolean) allocates an O(N) array per telemetry frame. Switching to a single-pass accumulator keeps heap pressure flat while preserving truthy semantics across sparse inputs.\n\nreturn items.reduce((c, x) => c + (x ? 1 : 0), 0);`;
  }

  window.__agyPreviewVerbosity = function (val) {
    const n = parseInt(val, 10) || 0;
    const readout = document.getElementById('agy-persona-verbosity-readout');
    if (readout) {
      readout.textContent = `${n} / 100 (${getVerbosityLabel(n)})`;
    }
    const spec = document.getElementById('agy-persona-specimen');
    if (spec) {
      spec.textContent = getVerbositySpecimen(n);
    }
  };

  function renderPersonasTab(personaState) {
    const activeArch = personaState.activeArchetype || 'tech-lead';
    const verbosity = Number.isFinite(Number(personaState.verbosity)) ? Number(personaState.verbosity) : 50;
    const autonomy = personaState.autonomy || 'autonomous';
    const strictTyping = personaState.strictTyping !== false;

    const cardsHtml = PERSONA_ARCHETYPES.map(arch => {
      const isSelected = arch.id === activeArch;
      return `
        <div class="agy-card" data-archetype-card="${escapeHtml(arch.id)}" style="
          background: ${isSelected ? 'var(--sidebar-secondary, rgba(39, 39, 42, 0.6))' : 'var(--card, rgba(24, 24, 27, 0.65))'};
          border: 1px solid ${isSelected ? 'var(--foreground, rgba(244, 244, 245, 0.35))' : 'var(--border, rgba(255, 255, 255, 0.08))'};
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
        ">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="font-size:14px; font-weight:600; color:var(--foreground, #f4f4f5); letter-spacing:-0.01em;">${escapeHtml(arch.name)}</span>
              <span style="font-size:10.5px; font-weight:500; padding:2px 7px; border-radius:4px; background:var(--muted, rgba(255,255,255,0.06)); color:var(--muted-foreground, #a1a1aa); border:1px solid var(--border, rgba(255,255,255,0.06)); white-space:nowrap;">${escapeHtml(arch.badge)}</span>
            </div>
            <div style="font-size:12px; color:var(--secondary-foreground, #a1a1aa); line-height:1.48; min-height:48px;">${escapeHtml(arch.description)}</div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px solid var(--border, rgba(255,255,255,0.06));">
            <span data-arch-status style="font-size:11px; font-weight:500; display:flex; align-items:center; gap:5px; color:${isSelected ? '#10b981' : 'var(--muted-foreground, #71717a)'};">
              <span data-arch-dot style="width:6px; height:6px; border-radius:50%; background:${isSelected ? '#10b981' : 'var(--muted, #52525b)'};"></span>
              <span data-arch-status-text>${isSelected ? 'Active Persona' : 'Standby'}</span>
            </span>
            <button type="button" data-arch-btn="${escapeHtml(arch.id)}" class="agy-btn" style="
              padding: 5px 12px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.15s ease;
              background: ${isSelected ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)'};
              color: ${isSelected ? 'var(--background, #09090b)' : 'var(--foreground, #f4f4f5)'};
              border: 1px solid ${isSelected ? 'var(--foreground, #f4f4f5)' : 'var(--border, rgba(255,255,255,0.1))'};
            " onclick="window.__agySelectArchetype('${escapeHtml(arch.id)}')">
              ${isSelected ? 'Selected' : 'Activate'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    const autonomyModes = [
      { id: 'autonomous', label: 'Autonomous', hint: 'Proactive reads, tests, and non-destructive tool calls' },
      { id: 'balanced', label: 'Balanced', hint: 'Standard collaborative execution cadence' },
      { id: 'cautious', label: 'Cautious', hint: 'Explains intended steps before major edits' }
    ];

    return `
      <div style="display:flex; flex-direction:column; gap:20px; padding-bottom:28px;">
        <div class="agy-card" style="
          background: var(--card, rgba(24, 24, 27, 0.65));
          border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          border-radius: 8px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:13.5px; font-weight:600; color:var(--foreground, #f4f4f5);">Behavioral Calibration</div>
              <div style="font-size:12px; color:var(--muted-foreground, #71717a);">Synced to config.json and .agents/personality.json for agent sessions.</div>
            </div>
            <span id="agy-persona-profile-badge" style="font-size:11px; padding:3px 8px; border-radius:4px; background:var(--muted, #27272a); color:var(--secondary-foreground, #a1a1aa); border:1px solid var(--border, rgba(255,255,255,0.08));">Profile: ${escapeHtml(activeArch)}</span>
          </div>

          <!-- Verbosity Slider + Live Response Specimen -->
          <div style="display:flex; flex-direction:column; gap:8px; padding-top:12px; border-top:1px solid var(--border, rgba(255,255,255,0.06));">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label for="agy-persona-verbosity" style="font-size:12.5px; font-weight:500; color:var(--foreground, #f4f4f5);">Response Verbosity</label>
              <span id="agy-persona-verbosity-readout" style="font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:4px; background:var(--muted, #27272a); color:var(--foreground, #f4f4f5); border:1px solid var(--border, rgba(255,255,255,0.08));">${verbosity} / 100 (${getVerbosityLabel(verbosity)})</span>
            </div>
            <input id="agy-persona-verbosity" type="range" min="0" max="100" step="5" list="agy-verbosity-ticks" value="${verbosity}" style="width:100%; accent-color:var(--foreground, #f4f4f5); cursor:pointer;"
              oninput="window.__agyPreviewVerbosity(this.value)"
              onchange="window.__agyUpdatePersonaField('verbosity', parseInt(this.value, 10))" />
            <datalist id="agy-verbosity-ticks">
              <option value="0"></option>
              <option value="50"></option>
              <option value="100"></option>
            </datalist>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted-foreground, #71717a);">
              <span>0: Terse (Code Only)</span>
              <span>50: Balanced</span>
              <span>100: Detailed Architecture</span>
            </div>
            <div style="margin-top:4px; padding:10px 12px; border-radius:6px; background:var(--background, #09090b); border:1px solid var(--border, rgba(255,255,255,0.07));">
              <div style="font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted-foreground, #71717a); margin-bottom:5px;">Live Output Specimen</div>
              <pre id="agy-persona-specimen" style="margin:0; white-space:pre-wrap; font-family:'Geist Mono', Menlo, Consolas, monospace; font-size:11.5px; line-height:1.5; color:var(--secondary-foreground, #d4d4d8);">${escapeHtml(getVerbositySpecimen(verbosity))}</pre>
            </div>
          </div>

          <!-- Autonomy Selector -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding-top:12px; border-top:1px solid var(--border, rgba(255,255,255,0.06));">
            <div>
              <div style="font-size:12.5px; font-weight:500; color:var(--foreground, #f4f4f5);">Execution Autonomy</div>
              <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Controls proactive tool execution vs. pre-edit confirmation</div>
            </div>
            <div style="display:inline-flex; gap:4px; padding:3px; border-radius:7px; background:var(--background, #09090b); border:1px solid var(--border, rgba(255,255,255,0.08));">
              ${autonomyModes.map(m => {
                const active = autonomy === m.id;
                return `
                  <button type="button" data-autonomy-btn="${m.id}" title="${escapeHtml(m.hint)}" style="
                    padding: 5px 11px;
                    border-radius: 5px;
                    font-size: 11.5px;
                    font-weight: ${active ? '600' : '500'};
                    cursor: pointer;
                    border: none;
                    background: ${active ? 'var(--foreground, #f4f4f5)' : 'transparent'};
                    color: ${active ? 'var(--background, #09090b)' : 'var(--secondary-foreground, #a1a1aa)'};
                    transition: all 0.15s ease;
                  " onclick="window.__agyUpdatePersonaField('autonomy', '${m.id}')">${m.label}</button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Strict Typing Toggle -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border, rgba(255,255,255,0.06));">
            <div>
              <div style="font-size:12.5px; font-weight:500; color:var(--foreground, #f4f4f5);">Strict Type Enforcement</div>
              <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Enforce TypeScript strict, Luau --!strict, and Python type annotations</div>
            </div>
            ${renderNativeSwitch(strictTyping, `window.__agyToggleStrictTyping(this)`, 'Toggle strict typing')}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(270px, 1fr)); gap:14px;">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  window.__agySelectArchetype = async function (archetypeId) {
    const badge = document.getElementById('agy-persona-profile-badge');
    if (badge) badge.textContent = `Profile: ${archetypeId}`;
    document.querySelectorAll('[data-archetype-card]').forEach(card => {
      const isSel = card.getAttribute('data-archetype-card') === archetypeId;
      card.style.background = isSel ? 'var(--sidebar-secondary, rgba(39, 39, 42, 0.6))' : 'var(--card, rgba(24, 24, 27, 0.65))';
      card.style.borderColor = isSel ? 'var(--foreground, rgba(244, 244, 245, 0.35))' : 'var(--border, rgba(255, 255, 255, 0.08))';
      const status = card.querySelector('[data-arch-status]');
      const dot = card.querySelector('[data-arch-dot]');
      const statusTxt = card.querySelector('[data-arch-status-text]');
      const btn = card.querySelector('[data-arch-btn]');
      if (status) status.style.color = isSel ? '#10b981' : 'var(--muted-foreground, #71717a)';
      if (dot) dot.style.background = isSel ? '#10b981' : 'var(--muted, #52525b)';
      if (statusTxt) statusTxt.textContent = isSel ? 'Active Persona' : 'Standby';
      if (btn) {
        btn.textContent = isSel ? 'Selected' : 'Activate';
        btn.style.background = isSel ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
        btn.style.color = isSel ? 'var(--background, #09090b)' : 'var(--foreground, #f4f4f5)';
        btn.style.borderColor = isSel ? 'var(--foreground, #f4f4f5)' : 'var(--border, rgba(255,255,255,0.1))';
      }
    });
    await savePersonaState({ activeArchetype: archetypeId }, true);
  };

  window.__agyToggleStrictTyping = async function (btn) {
    const cur = getPersonaState();
    const next = !(cur.strictTyping !== false);
    syncSwitchDom(btn, next);
    await savePersonaState({ strictTyping: next }, true);
  };

  window.__agyUpdatePersonaField = async function (field, value) {
    if (field === 'autonomy') {
      document.querySelectorAll('[data-autonomy-btn]').forEach(btn => {
        const active = btn.getAttribute('data-autonomy-btn') === value;
        btn.style.fontWeight = active ? '600' : '500';
        btn.style.background = active ? 'var(--foreground, #f4f4f5)' : 'transparent';
        btn.style.color = active ? 'var(--background, #09090b)' : 'var(--secondary-foreground, #a1a1aa)';
      });
    }
    await savePersonaState({ [field]: value }, true);
  };

  let cssLivePreviewTimer = null;

  function renderCustomCSSTab() {
    const currentCSS = AgyThemeManager.getCustomCSS();
    const activeTheme = AgyThemeManager.getActiveTheme();
    const themeLabel = activeTheme ? activeTheme.meta.name : 'Stock Antigravity';
    const lineCount = Math.max(1, (currentCSS || '').split('\n').length);
    const gutterLines = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    return `
      <div style="display:flex; flex-direction:column; gap:14px; padding-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div style="font-size:12.5px; color:var(--muted-foreground, #71717a);">
            Live split studio: <code style="font-size:11.5px; padding:1px 5px; border-radius:4px; background:var(--muted, #27272a); color:var(--foreground, #e4e4e7);">Tab</code> indents 2 spaces, <code style="font-size:11.5px; padding:1px 5px; border-radius:4px; background:var(--muted, #27272a); color:var(--foreground, #e4e4e7);">Ctrl+S</code> saves. Preview updates live every 120ms.
          </div>
          <span id="agy-css-live-status" style="font-size:11px; font-weight:500; color:var(--muted-foreground, #71717a);">Saved</span>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:stretch; min-height:320px;">
          <!-- Left: Code Editor with Line Gutter -->
          <div style="
            flex: 1.35 1 300px;
            display: flex;
            background: var(--background, #09090b);
            border: 1px solid var(--border, rgba(255,255,255,0.1));
            border-radius: 8px;
            overflow: hidden;
            min-height: 310px;
          ">
            <pre id="agy-custom-css-gutter" aria-hidden="true" style="
              margin: 0;
              padding: 14px 10px;
              min-width: 36px;
              text-align: right;
              user-select: none;
              color: var(--muted-foreground, #9ca3af);
              background: rgba(255,255,255,0.02);
              border-right: 1px solid var(--border, rgba(255,255,255,0.06));
              font-family: 'Geist Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace !important;
              font-size: 12.5px;
              line-height: 1.6;
              overflow: hidden;
            ">${gutterLines}</pre>
            <textarea id="agy-custom-css-editor" aria-label="Custom CSS Stylesheet Editor" spellcheck="false" style="
              flex: 1;
              min-height: 310px;
              background: transparent;
              border: none;
              color: var(--foreground, #e4e4e7);
              font-family: 'Geist Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace !important;
              font-size: 12.5px;
              line-height: 1.6;
              padding: 14px;
              resize: vertical;
              outline: none;
              white-space: pre;
              overflow: auto;
            " placeholder="/* Enter custom CSS rules here */&#10;.surface-composer-card {&#10;  /* live preview on the right */&#10;}">${escapeHtml(currentCSS)}</textarea>
          </div>

          <!-- Right: Live Specimen Stage -->
          <div class="agy-card" style="
            flex: 1 1 240px;
            background: var(--background, #09090b);
            border: 1px solid var(--border, rgba(255,255,255,0.1));
            border-radius: 8px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 12px;
          ">
            <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
              <span style="font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted-foreground, #71717a);">Live Specimen Stage</span>
              <span style="font-size:10.5px; padding:2px 6px; border-radius:4px; background:var(--muted, rgba(255,255,255,0.06)); color:var(--secondary-foreground, #a1a1aa);">${escapeHtml(themeLabel)}</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; flex:1; justify-content:center;">
              <div class="user-message" style="
                align-self: flex-end;
                max-width: 86%;
                padding: 8px 12px;
                border-radius: 10px;
                background: var(--sidebar-secondary, rgba(255,255,255,0.08));
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                font-size: 12px;
                color: var(--foreground, #f4f4f5);
              ">Verify custom CSS selectors in real time.</div>

              <pre style="
                margin: 0;
                padding: 10px 12px;
                border-radius: 7px;
                background: var(--card, rgba(24,24,27,0.85));
                border: 1px solid var(--border, rgba(255,255,255,0.08));
                font-family: 'Geist Mono', Menlo, Consolas, monospace;
                font-size: 11.5px;
                color: var(--foreground, #e4e4e7);
                overflow-x: auto;
              "><code>const spring = 'cubic-bezier(0.22, 1, 0.36, 1)';</code></pre>

              <div class="surface-composer-card" style="
                padding: 9px 12px;
                border-radius: 10px;
                background: var(--card, rgba(24,24,27,0.9));
                border: 1px solid var(--border, rgba(255,255,255,0.12));
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
              ">
                <span style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Ask anything, @ to mention...</span>
                <span style="width:20px; height:20px; border-radius:999px; background:var(--foreground, #f4f4f5); color:var(--background, #09090b); display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">&rarr;</span>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="agy-btn" style="
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            background: transparent;
            color: var(--muted-foreground, #a1a1aa);
            border: 1px solid var(--border, rgba(255,255,255,0.08));
            transition: all 0.15s ease;
          "
          onclick="window.__agyRevertCustomCSS()">Revert Saved</button>

          <button type="button" class="agy-btn" style="
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            background: var(--muted, #27272a);
            color: var(--foreground, #d4d4d8);
            border: 1px solid var(--border, rgba(255,255,255,0.08));
            transition: all 0.15s ease;
          "
          onclick="window.__agyClearCustomCSS()">Clear</button>

          <button type="button" id="agy-custom-css-save-btn" class="agy-btn" style="
            padding: 6px 18px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            background: var(--foreground, #f4f4f5);
            color: var(--background, #09090b);
            border: none;
            transition: all 0.15s ease;
          "
          onclick="window.__agyCommitCustomCSS(this, event)">
            Save &amp; Apply
          </button>
        </div>
      </div>
    `;
  }

  function syncCssGutter() {
    const editor = document.getElementById('agy-custom-css-editor');
    const gutter = document.getElementById('agy-custom-css-gutter');
    if (!editor || !gutter) return;
    const count = Math.max(1, editor.value.split('\n').length);
    gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    gutter.scrollTop = editor.scrollTop;
  }

  window.__agyCommitCustomCSS = function (btnEl, ev) {
    const editor = document.getElementById('agy-custom-css-editor');
    if (!editor) return;
    if (cssLivePreviewTimer) {
      clearTimeout(cssLivePreviewTimer);
      cssLivePreviewTimer = null;
    }
    AgyThemeManager.setCustomCSS(editor.value, true);
    const status = document.getElementById('agy-css-live-status');
    if (status) {
      status.textContent = 'Saved & Active';
      status.style.color = '#10b981';
    }
    if (AgyApi.UI) {
      if (typeof AgyApi.UI.flashCompileBar === 'function') AgyApi.UI.flashCompileBar();
      if (typeof AgyApi.UI.spawnBurst === 'function') {
        let bx = window.innerWidth / 2;
        let by = window.innerHeight / 2;
        if (ev && Number.isFinite(ev.clientX) && ev.clientX > 0) {
          bx = ev.clientX;
          by = ev.clientY;
        } else if (btnEl && typeof btnEl.getBoundingClientRect === 'function') {
          const r = btnEl.getBoundingClientRect();
          bx = r.left + r.width / 2;
          by = r.top + r.height / 2;
        }
        AgyApi.UI.spawnBurst(bx, by);
      }
    }
    window.dispatchEvent(new CustomEvent('agy:sound', { detail: { type: 'theme-compile' } }));
  };

  window.__agyClearCustomCSS = function () {
    const editor = document.getElementById('agy-custom-css-editor');
    if (editor) editor.value = '';
    syncCssGutter();
    AgyThemeManager.setCustomCSS('', true);
    const status = document.getElementById('agy-css-live-status');
    if (status) {
      status.textContent = 'Cleared';
      status.style.color = 'var(--muted-foreground, #71717a)';
    }
  };

  window.__agyRevertCustomCSS = function () {
    const editor = document.getElementById('agy-custom-css-editor');
    const saved = AgyThemeManager.getCustomCSS();
    if (editor) editor.value = saved;
    syncCssGutter();
    AgyThemeManager.setCustomCSS(saved, false);
    const status = document.getElementById('agy-css-live-status');
    if (status) {
      status.textContent = 'Reverted to saved';
      status.style.color = 'var(--muted-foreground, #71717a)';
    }
  };

  function bindCustomCssEditor() {
    const editor = document.getElementById('agy-custom-css-editor');
    const gutter = document.getElementById('agy-custom-css-gutter');
    if (!editor || editor.dataset.agyBound === 'true') return;
    editor.dataset.agyBound = 'true';

    editor.addEventListener('scroll', () => {
      if (gutter) gutter.scrollTop = editor.scrollTop;
    }, { passive: true });

    editor.addEventListener('input', () => {
      syncCssGutter();
      const status = document.getElementById('agy-css-live-status');
      if (status) {
        status.textContent = 'Live preview (Ctrl+S to save)';
        status.style.color = '#38bdf8';
      }
      if (cssLivePreviewTimer) clearTimeout(cssLivePreviewTimer);
      cssLivePreviewTimer = setTimeout(() => {
        const val = editor.value || '';
        if (val.trim()) {
          AgyApi.DOM.addStyle('custom-css', `/* AntiPersonality Live Preview */\n${val}`);
        } else {
          AgyApi.DOM.removeStyle('custom-css');
        }
      }, 120);
    });

    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        window.__agyCommitCustomCSS(document.getElementById('agy-custom-css-save-btn'), null);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const val = editor.value;
        if (e.shiftKey) {
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          if (val.slice(lineStart, lineStart + 2) === '  ') {
            editor.value = val.slice(0, lineStart) + val.slice(lineStart + 2);
            editor.selectionStart = Math.max(lineStart, start - 2);
            editor.selectionEnd = Math.max(lineStart, end - 2);
          }
        } else {
          editor.value = val.slice(0, start) + '  ' + val.slice(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
        }
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      if (e.key === '{' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        if (start === end) {
          const nextChar = editor.value[start] || '';
          if (!/[a-zA-Z0-9_]/.test(nextChar)) {
            e.preventDefault();
            editor.value = editor.value.slice(0, start) + '{}' + editor.value.slice(end);
            editor.selectionStart = editor.selectionEnd = start + 1;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    });
  }

  function injectSettingsTab(dialog) {
    // Fast-path: if AntiPersonality v3.1 tabs + sliding pill are already mounted in this dialog, exit immediately
    if (dialog.querySelector('button[data-tab-id="personas"]') && dialog.querySelector('#agy-sidebar-active-pill')) {
      return;
    }

    // 0. Ensure any legacy quick-theme-bar is completely purged
    document.querySelectorAll('#agy-quick-theme-bar').forEach(el => el.remove());
    dialog.querySelectorAll('[data-agy-tab-header]').forEach(el => el.remove());

    const generalBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.trim() === 'General');
    if (!generalBtn) return;

    if (generalBtn.parentElement) {
      generalBtn.parentElement.querySelectorAll('[data-agy-tab], [data-agy-tab-header]').forEach(el => el.remove());
    }

    const sidebarContainer = generalBtn.closest('.overflow-y-auto') || generalBtn.closest('.flex-1.flex.flex-col') || generalBtn.closest('nav, aside');
    if (!sidebarContainer) return;

    const spacer = Array.from(sidebarContainer.children).find(c => c.tagName === 'DIV' && c.classList.contains('flex-1'));

    // Verify all 4 tabs + sliding pill exist in the AntiPersonality section
    const existingSection = sidebarContainer.querySelector(':scope > [data-agy-section="true"] h2');
    const existingPersonasBtn = sidebarContainer.querySelector('button[data-tab-id="personas"]');
    if (existingSection && existingSection.textContent.trim() === 'AntiPersonality' && existingPersonasBtn && sidebarContainer.querySelector('#agy-sidebar-active-pill')) {
      return;
    }

    dialog.querySelectorAll('[data-agy-section]').forEach(el => el.remove());

    // 1. Section Header (positioned cleanly above bottom spacer, after Conversations and before Give Feedback)
    const headerWrapper = document.createElement('div');
    headerWrapper.setAttribute('data-agy-section', 'true');
    headerWrapper.className = 'px-4 mt-2';
    headerWrapper.innerHTML = `
      <h2 class="m-0 text-xs font-medium text-muted-foreground select-none" style="letter-spacing: normal !important; margin: 0 !important;">AntiPersonality</h2>
    `;

    // 2. Items Container (4 tabs: Themes, Plugins, Personas, Custom CSS) + Sliding Active Pill
    const itemsContainer = document.createElement('div');
    itemsContainer.setAttribute('data-agy-section', 'true');
    itemsContainer.className = 'relative flex flex-col gap-0.5';

    const activePill = document.createElement('div');
    activePill.id = 'agy-sidebar-active-pill';
    itemsContainer.appendChild(activePill);

    const tabs = [
      { id: 'themes', label: 'Themes' },
      { id: 'plugins', label: 'Plugins' },
      { id: 'personas', label: 'Personas' },
      { id: 'custom-css', label: 'Custom CSS' }
    ];

    tabs.forEach(t => {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'relative z-10 group/nav-item mx-2';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-agy-tab', 'true');
      btn.setAttribute('data-tab-id', t.id);
      btn.className = 'flex items-center gap-1.5 w-full px-2 py-1 rounded-lg cursor-pointer border-none text-left transition-all outline-none hover:bg-sidebar-muted';
      btn.style.cssText = 'background: transparent !important;';
      btn.innerHTML = `<span class="text-sm transition-colors select-none truncate flex-1 text-secondary-foreground group-hover/nav-item:text-foreground">${t.label}</span>`;

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        activateAgySettingsTab(dialog, t.id, btn);
      };

      itemWrapper.appendChild(btn);
      itemsContainer.appendChild(itemWrapper);
    });

    if (spacer && spacer.parentElement === sidebarContainer) {
      sidebarContainer.insertBefore(headerWrapper, spacer);
      sidebarContainer.insertBefore(itemsContainer, spacer);
    } else {
      sidebarContainer.appendChild(headerWrapper);
      sidebarContainer.appendChild(itemsContainer);
    }
  }

  function getContentArea(dialog) {
    const growContainer = dialog.querySelector('.grow.w-full');
    if (growContainer) return growContainer;
    return dialog.querySelector('main, .flex-1') || dialog;
  }

  function bindCardSpotlight(container) {
    if (!container || container.dataset.agySpotlightBound === 'true') return;
    container.dataset.agySpotlightBound = 'true';
    let spotRaf = 0;
    let lastEv = null;
    container.addEventListener('pointermove', (e) => {
      lastEv = e;
      if (spotRaf) return;
      spotRaf = requestAnimationFrame(() => {
        spotRaf = 0;
        if (!lastEv) return;
        const cx = lastEv.clientX;
        const cy = lastEv.clientY;
        const cards = container.querySelectorAll('.agy-card');
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          if (cx >= r.left - 120 && cx <= r.right + 120 && cy >= r.top - 120 && cy <= r.bottom + 120) {
            cards[i].style.setProperty('--mx', `${Math.round(cx - r.left)}px`);
            cards[i].style.setProperty('--my', `${Math.round(cy - r.top)}px`);
          }
        }
      });
    }, { passive: true });

    container.addEventListener('pointerleave', () => {
      container.querySelectorAll('.agy-card').forEach(c => {
        c.style.setProperty('--mx', '-999px');
        c.style.setProperty('--my', '-999px');
      });
    }, { passive: true });
  }

  function activateAgySettingsTab(dialog, tabId, clickedBtn) {
    // Un-highlight all sidebar buttons in dialog
    dialog.querySelectorAll('button').forEach(b => {
      b.classList.remove('active-agy-tab', 'bg-sidebar-secondary');
      const span = b.querySelector('span');
      if (span) {
        span.classList.remove('text-foreground', 'font-medium');
        span.classList.add('text-secondary-foreground');
      }
    });

    if (!clickedBtn) {
      clickedBtn = dialog.querySelector(`button[data-tab-id="${tabId}"]`);
    }

    const activePill = dialog.querySelector('#agy-sidebar-active-pill');
    if (clickedBtn) {
      clickedBtn.classList.add('active-agy-tab');
      const clickedSpan = clickedBtn.querySelector('span');
      if (clickedSpan) {
        clickedSpan.classList.remove('text-secondary-foreground');
        clickedSpan.classList.add('text-foreground', 'font-medium');
      }
      if (activePill && clickedBtn.parentElement) {
        const row = clickedBtn.parentElement;
        activePill.style.height = `${row.offsetHeight || 28}px`;
        activePill.style.transform = `translateY(${row.offsetTop}px)`;
        activePill.style.opacity = '1';
      }
    }

    const mainArea = getContentArea(dialog);

    dialog.querySelectorAll('#agy-settings-content').forEach(el => {
      if (el.parentElement !== mainArea) el.remove();
    });

    let agyContainer = mainArea.querySelector(':scope > #agy-settings-content');
    if (!agyContainer) {
      agyContainer = document.createElement('div');
      agyContainer.id = 'agy-settings-content';
      agyContainer.className = 'w-full h-full overflow-y-auto';
      agyContainer.style.cssText = `
        padding: 32px 40px;
        height: 100%;
        color: var(--foreground, #f8fafc);
        box-sizing: border-box;
      `;
      mainArea.appendChild(agyContainer);
    }
    bindCardSpotlight(agyContainer);

    Array.from(mainArea.children).forEach(ch => {
      if (ch.id === 'agy-settings-content') {
        ch.style.display = 'block';
      } else {
        if (ch.dataset.agyPrevDisplay === undefined) {
          ch.dataset.agyPrevDisplay = ch.style.display || '';
        }
        ch.style.display = 'none';
      }
    });

    // Restore native view cleanly ONLY when clicking a native sidebar navigation button
    const sidebarNav = dialog.querySelector('[data-agy-section]')?.parentElement;
    if (sidebarNav) {
      sidebarNav.querySelectorAll('button:not([data-agy-tab])').forEach(sb => {
        if (sb.dataset.agyRestoreBound === 'true') return;
        sb.dataset.agyRestoreBound = 'true';
        sb.addEventListener('click', () => {
          const pill = dialog.querySelector('#agy-sidebar-active-pill');
          if (pill) pill.style.opacity = '0';
          sidebarNav.querySelectorAll('button[data-agy-tab]').forEach(b => {
            b.classList.remove('active-agy-tab', 'bg-sidebar-secondary');
            const span = b.querySelector('span');
            if (span) {
              span.classList.remove('text-foreground', 'font-medium');
              span.classList.add('text-secondary-foreground');
            }
          });
          const container = mainArea.querySelector(':scope > #agy-settings-content');
          if (container) container.style.display = 'none';
          Array.from(mainArea.children).forEach(ch => {
            if (ch.id !== 'agy-settings-content') {
              ch.style.display = ch.dataset.agyPrevDisplay !== undefined ? ch.dataset.agyPrevDisplay : '';
              delete ch.dataset.agyPrevDisplay;
            }
          });
        });
      });
    }

    window.__refreshActiveAgyTab = () => activateAgySettingsTab(dialog, tabId, clickedBtn);

    if (tabId === 'themes') {
      const all = AgyThemeManager.getAllThemes();
      const active = AgyThemeManager.getActiveTheme();
      const perf = AgyThemeManager.getPerfSettings();

      agyContainer.innerHTML = `
        <div class="agy-tab-stage">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
            <div>
              <h2 style="font-size:18px; font-weight:600; color:var(--foreground, #f4f4f5); margin:0 0 4px 0; letter-spacing:-0.02em;">Theme Library</h2>
              <p style="font-size:13px; color:var(--muted-foreground, #71717a); margin:0;">Customize AntiPersonality appearance and layout with View Transition hot-reload.</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              ${renderProfileBackupActions()}
              <button type="button" class="agy-btn" style="
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid var(--border, rgba(255,255,255,0.1));
                background: var(--muted, #27272a);
                color: var(--foreground, #d4d4d8);
                transition: all 0.15s ease;
              "
              onclick="window.__betterAgyApplyThemeWithScript('stock', true, event);">Reset to Stock</button>
            </div>
          </div>

          <!-- Per-Theme Performance Controls -->
          <div class="agy-card" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 18px;
            flex-wrap: wrap;
            padding: 12px 16px;
            margin-bottom: 18px;
            border-radius: 8px;
            background: var(--card, rgba(24, 24, 27, 0.55));
            border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          ">
            <div style="display:flex; align-items:center; gap:12px;">
              ${renderNativeSwitch(perf.disableBgVideo, `window.__agyTogglePerfSwitch(this, 'disableBgVideo')`, 'Pause and hide background video layers')}
              <div>
                <div style="font-size:12.5px; font-weight:600; color:var(--foreground, #f4f4f5);">Disable Background Video</div>
                <div style="font-size:11px; color:var(--muted-foreground, #71717a);">Pauses video layers to save GPU and battery while preserving theme colors</div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              ${renderNativeSwitch(perf.hideCompanions, `window.__agyTogglePerfSwitch(this, 'hideCompanions')`, 'Hide floating chibi and telemetry overlays')}
              <div>
                <div style="font-size:12.5px; font-weight:600; color:var(--foreground, #f4f4f5);">Hide Floating Companions</div>
                <div style="font-size:11px; color:var(--muted-foreground, #71717a);">Hides chibi sprites and telemetry cards while keeping theme stylesheets</div>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; padding-bottom: 24px;">
            ${all.map(th => renderThemeCard(th, active && active.id === th.id)).join('')}
          </div>
        </div>
      `;
      window.__renderAgyThemes = () => {
        if (agyContainer.style.display !== 'none' && tabId === 'themes') {
          activateAgySettingsTab(dialog, 'themes', clickedBtn);
        }
      };
    } else if (tabId === 'plugins') {
      const allPlugins = AgyPluginManager.getAllPlugins();
      agyContainer.innerHTML = `
        <div class="agy-tab-stage">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
            <div>
              <h2 style="font-size:18px; font-weight:600; color:var(--foreground, #f4f4f5); margin:0 0 4px 0; letter-spacing:-0.02em;">Client Plugins</h2>
              <p style="font-size:13px; color:var(--muted-foreground, #71717a); margin:0;">Modular extensions running inside error boundaries with automatic Patcher teardown.</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${renderProfileBackupActions()}
            </div>
          </div>
          <div style="padding-bottom: 24px;">
            ${allPlugins.map(renderPluginRow).join('')}
          </div>
        </div>
      `;
      window.__renderAgyPlugins = () => {
        if (agyContainer.style.display !== 'none' && tabId === 'plugins') {
          activateAgySettingsTab(dialog, 'plugins', clickedBtn);
        }
      };
    } else if (tabId === 'personas') {
      const renderWithState = (pState, animateStage = true) => {
        agyContainer.innerHTML = `
          <div class="${animateStage ? 'agy-tab-stage' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
              <div>
                <h2 style="font-size:18px; font-weight:600; color:var(--foreground, #f4f4f5); margin:0 0 4px 0; letter-spacing:-0.02em;">AI Personas</h2>
                <p style="font-size:13px; color:var(--muted-foreground, #71717a); margin:0;">Select your active pair-programming archetype and calibrate verbosity, autonomy, and strictness.</p>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${renderProfileBackupActions()}
              </div>
            </div>
            ${renderPersonasTab(pState)}
          </div>
        `;
      };

      const initialState = getPersonaState();
      renderWithState(initialState, true);
      syncPersonaFromBridge().then(fresh => {
        if (
          agyContainer.style.display !== 'none' &&
          fresh &&
          (fresh.activeArchetype !== initialState.activeArchetype ||
            fresh.verbosity !== initialState.verbosity ||
            fresh.autonomy !== initialState.autonomy ||
            fresh.strictTyping !== initialState.strictTyping)
        ) {
          renderWithState(fresh, false);
        }
      });

      window.__renderAgyPersonas = () => {
        if (agyContainer.style.display !== 'none') {
          renderWithState(getPersonaState(), false);
        }
      };
    } else if (tabId === 'custom-css') {
      agyContainer.innerHTML = `
        <div class="agy-tab-stage">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:20px; padding-bottom:18px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
            <div>
              <h2 style="font-size:18px; font-weight:600; color:var(--foreground, #f4f4f5); margin:0 0 4px 0; letter-spacing:-0.02em;">Custom CSS</h2>
              <p style="font-size:13px; color:var(--muted-foreground, #71717a); margin:0;">Inject custom CSS rules that persist across sessions and layer over active themes.</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${renderProfileBackupActions()}
            </div>
          </div>
          ${renderCustomCSSTab()}
        </div>
      `;
      bindCustomCssEditor();
    }
  }

  // Bridge invocation with Cursor Shockwave View Transition + Perf Control enforcement
  window.__betterAgyApplyThemeWithScript = async function (themeId, isActive, ev) {
    let origin = null;
    let triggerBtn = null;
    if (ev && typeof ev === 'object') {
      if (Number.isFinite(ev.clientX) && (ev.clientX > 0 || ev.clientY > 0)) {
        origin = { x: ev.clientX, y: ev.clientY };
      }
      if (ev.currentTarget instanceof HTMLElement) triggerBtn = ev.currentTarget;
      else if (ev.target instanceof HTMLElement) triggerBtn = ev.target.closest('button');
    }

    if (isActive || themeId === 'stock') {
      AgyThemeManager.disableTheme(true, true, origin);
      try {
        await fetch('http://127.0.0.1:51788/reset', { mode: 'cors' });
      } catch (_) {}
      const fontGuard = document.getElementById('agy-style-font-guardrails');
      if (fontGuard && document.head) document.head.appendChild(fontGuard);
      if (window.__renderAgyThemes) window.__renderAgyThemes();
      return;
    }

    if (triggerBtn) {
      triggerBtn.textContent = 'Applying...';
      triggerBtn.style.opacity = '0.75';
    }

    // 1. Immediately apply client CSS (with Cursor-Origin View Transition)
    suppressThemeRerender = true;
    try {
      AgyThemeManager.enableTheme(themeId, true, true, origin);
    } finally {
      suppressThemeRerender = false;
    }

    // 2. Call local bridge server to purge prior media & launch external theme script
    try {
      const res = await fetch('http://127.0.0.1:51788/apply?theme=' + encodeURIComponent(themeId), { mode: 'cors' });
      if (res.ok) {
        AgyThemeManager._ensureActiveStylesheetMounted();
        AgyThemeManager.applyPerfControls();
      }
    } catch (_) {}

    if (window.__renderAgyThemes) window.__renderAgyThemes();

    // 3. Re-assert active stylesheet, font guardrails & perf controls after external script finishes mounting
    setTimeout(() => {
      AgyThemeManager._ensureActiveStylesheetMounted();
      const fontGuard = document.getElementById('agy-style-font-guardrails');
      if (fontGuard && document.head) {
        document.head.appendChild(fontGuard);
      }
      AgyThemeManager.applyPerfControls();
    }, 180);
  };

  // =========================================================================
  // COMMAND PALETTE MODAL (Ctrl + Shift + M, Modal Ctrl + Shift + P, or /ap)
  // =========================================================================
  const CommandPalette = {
    _selectedIndex: 0,
    _filteredItems: [],
    _committed: false,
    _previewed: false,
    _previewTimer: null,

    isOpen() {
      return Boolean(document.getElementById('agy-command-palette-overlay'));
    },

    _schedulePreview() {
      if (this._previewTimer) {
        clearTimeout(this._previewTimer);
        this._previewTimer = null;
      }
      const item = this._filteredItems[this._selectedIndex];
      if (item && item.id && item.id.startsWith('theme:')) {
        const tid = item.id.slice(6);
        this._previewTimer = setTimeout(() => {
          this._previewTimer = null;
          if (!this.isOpen()) return;
          if (typeof AgyThemeManager.previewTheme === 'function') {
            AgyThemeManager.previewTheme(tid);
            this._previewed = true;
          }
        }, 130);
      } else if (this._previewed) {
        this._previewTimer = setTimeout(() => {
          this._previewTimer = null;
          if (!this.isOpen()) return;
          if (typeof AgyThemeManager.restoreActiveThemeStyles === 'function') {
            AgyThemeManager.restoreActiveThemeStyles();
          }
          this._previewed = false;
        }, 130);
      }
    },

    _buildCommands() {
      const cmds = [];
      const activeTheme = AgyThemeManager.getActiveTheme();
      const perf = AgyThemeManager.getPerfSettings();
      const persona = getPersonaState();

      // Navigation commands
      cmds.push(
        { id: 'nav:themes', category: 'Settings', label: 'Open AntiPersonality: Theme Library', meta: 'Tab', run: () => window.AgyOpenAntiPersonality('themes') },
        { id: 'nav:plugins', category: 'Settings', label: 'Open AntiPersonality: Client Plugins', meta: 'Tab', run: () => window.AgyOpenAntiPersonality('plugins') },
        { id: 'nav:personas', category: 'Settings', label: 'Open AntiPersonality: AI Personas', meta: 'Tab', run: () => window.AgyOpenAntiPersonality('personas') },
        { id: 'nav:css', category: 'Settings', label: 'Open AntiPersonality: Custom CSS Editor', meta: 'Tab', run: () => window.AgyOpenAntiPersonality('custom-css') }
      );

      // Theme commands
      cmds.push({
        id: 'theme:stock',
        category: 'Theme',
        label: 'Theme: Reset to Stock Antigravity',
        meta: !activeTheme ? 'Active' : 'Preview / Apply',
        run: () => window.__betterAgyApplyThemeWithScript('stock', true)
      });

      for (const th of AgyThemeManager.getAllThemes()) {
        const isCurrent = activeTheme && activeTheme.id === th.id;
        cmds.push({
          id: `theme:${th.id}`,
          category: 'Theme',
          label: `Theme: ${th.meta.name}`,
          meta: isCurrent ? 'Active' : 'Preview / Apply',
          run: () => window.__betterAgyApplyThemeWithScript(th.id, false)
        });
      }

      // Performance toggles
      cmds.push(
        {
          id: 'perf:video',
          category: 'Performance',
          label: `${perf.disableBgVideo ? 'Enable' : 'Disable'} Background Video Layers`,
          meta: perf.disableBgVideo ? 'Disabled' : 'Enabled',
          run: () => AgyThemeManager.setPerfSetting('disableBgVideo', !perf.disableBgVideo)
        },
        {
          id: 'perf:companions',
          category: 'Performance',
          label: `${perf.hideCompanions ? 'Show' : 'Hide'} Floating Companions & Telemetry`,
          meta: perf.hideCompanions ? 'Hidden' : 'Visible',
          run: () => AgyThemeManager.setPerfSetting('hideCompanions', !perf.hideCompanions)
        }
      );

      // Plugin toggles
      for (const p of AgyPluginManager.getAllPlugins()) {
        cmds.push({
          id: `plugin:${p.id}`,
          category: 'Plugin',
          label: `Plugin: Toggle ${p.meta.name}`,
          meta: p.enabled ? 'ON' : 'OFF',
          run: () => AgyPluginManager.togglePlugin(p.id)
        });
      }

      // Persona switches
      for (const arch of PERSONA_ARCHETYPES) {
        const isCurrent = persona.activeArchetype === arch.id;
        cmds.push({
          id: `persona:${arch.id}`,
          category: 'Persona',
          label: `Persona: ${arch.name} (${arch.badge})`,
          meta: isCurrent ? 'Active' : 'Switch',
          run: () => savePersonaState({ activeArchetype: arch.id }, true)
        });
      }

      // Backup & Erasure
      cmds.push(
        { id: 'profile:export', category: 'Profile', label: 'Export AntiPersonality Configuration (JSON)', meta: 'Backup', run: () => window.__agyExportProfile() },
        { id: 'profile:import', category: 'Profile', label: 'Import AntiPersonality Configuration (JSON)', meta: 'Restore', run: () => window.__agyTriggerImportProfile() },
        { id: 'profile:purge', category: 'Profile', label: 'Purge All Local AntiPersonality Data', meta: 'Erase', run: () => window.__agyPurgeLocalData() }
      );

      return cmds;
    },

    _fuzzyScore(query, text) {
      if (!query) return 1;
      const q = query.toLowerCase();
      const t = text.toLowerCase();
      if (t.includes(q)) return 100 - t.indexOf(q);
      let qi = 0;
      let score = 0;
      for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
          score += 5;
          qi++;
        }
      }
      return qi === q.length ? score : 0;
    },

    _renderList(triggerPreview = false) {
      const listEl = document.getElementById('agy-command-palette-list');
      if (!listEl) return;

      if (this._filteredItems.length === 0) {
        listEl.innerHTML = `<div style="padding:20px; text-align:center; font-size:12.5px; color:var(--muted-foreground, #71717a);">No matching commands found.</div>`;
        if (triggerPreview) this._schedulePreview();
        return;
      }

      listEl.innerHTML = this._filteredItems.map((item, idx) => {
        const selected = idx === this._selectedIndex;
        const isActiveBadge = item.meta === 'Active' || item.meta === 'ON';
        return `
          <div role="option" aria-selected="${selected ? 'true' : 'false'}" data-palette-idx="${idx}" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            background: ${selected ? 'var(--sidebar-secondary, rgba(255,255,255,0.1))' : 'transparent'};
            color: var(--foreground, #f4f4f5);
            transition: background 0.1s ease;
          ">
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              <span style="font-size:10px; font-weight:600; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:var(--muted, #27272a); color:var(--muted-foreground, #a1a1aa); border:1px solid var(--border, rgba(255,255,255,0.06)); flex-shrink:0;">${escapeHtml(item.category)}</span>
              <span style="font-size:13px; font-weight:${selected ? '600' : '400'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.label)}</span>
            </div>
            <span style="font-size:11px; font-weight:500; color:${isActiveBadge ? '#10b981' : 'var(--muted-foreground, #71717a)'}; flex-shrink:0;">${escapeHtml(item.meta)}</span>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('[data-palette-idx]').forEach(row => {
        row.onmouseenter = () => {
          const nextIdx = parseInt(row.getAttribute('data-palette-idx'), 10);
          if (nextIdx === this._selectedIndex) return;
          this._selectedIndex = nextIdx;
          Array.from(listEl.children).forEach((ch, i) => {
            ch.style.background = i === this._selectedIndex ? 'var(--sidebar-secondary, rgba(255,255,255,0.1))' : 'transparent';
          });
          this._schedulePreview();
        };
        row.onclick = () => {
          const idx = parseInt(row.getAttribute('data-palette-idx'), 10);
          this._executeIndex(idx);
        };
      });

      const activeRow = listEl.querySelector(`[data-palette-idx="${this._selectedIndex}"]`);
      if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
      if (triggerPreview) this._schedulePreview();
    },

    _filter(query, triggerPreview = false) {
      const all = this._buildCommands();
      if (!query || !query.trim()) {
        this._filteredItems = all;
      } else {
        this._filteredItems = all
          .map(item => ({ item, score: this._fuzzyScore(query.trim(), `${item.category} ${item.label}`) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(x => x.item);
      }
      this._selectedIndex = 0;
      this._renderList(triggerPreview);
    },

    _executeIndex(idx) {
      const item = this._filteredItems[idx];
      if (!item) return;
      this._committed = true;
      this.close();
      try {
        item.run();
      } catch (err) {
        console.error('[AntiPersonality] Command palette action error:', err);
      }
    },

    open(initialQuery = '') {
      this.close();
      this._committed = false;
      this._previewed = false;

      const overlay = document.createElement('div');
      overlay.id = 'agy-command-palette-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 1000000;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 12vh;
        box-sizing: border-box;
      `;

      overlay.innerHTML = `
        <div id="agy-command-palette-modal" role="dialog" aria-modal="true" aria-label="AntiPersonality Command Palette" style="
          width: 560px;
          max-width: calc(100vw - 32px);
          background: var(--card, #18181b);
          border: 1px solid var(--border, rgba(255,255,255,0.14));
          border-radius: 10px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        ">
          <div style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
            <span style="font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; background:var(--muted, #27272a); color:var(--foreground, #f4f4f5); border:1px solid var(--border, rgba(255,255,255,0.1));">AP</span>
            <input id="agy-command-palette-input" aria-label="Search commands" type="text" placeholder="Search themes (live preview), plugins, personas..." value="${escapeHtml(initialQuery)}" style="
              flex: 1;
              background: transparent;
              border: none;
              outline: none;
              color: var(--foreground, #f4f4f5);
              font-size: 13.5px;
            " />
            <span style="font-size:10.5px; color:var(--muted-foreground, #a1a1aa); padding:2px 6px; border-radius:4px; border:1px solid var(--border, rgba(255,255,255,0.08));">ESC</span>
          </div>
          <div id="agy-command-palette-list" role="listbox" aria-label="Command results" style="max-height:340px; overflow-y:auto; padding:6px;"></div>
          <div style="display:flex; justify-content:space-between; padding:7px 14px; border-top:1px solid var(--border, rgba(255,255,255,0.06)); font-size:11px; color:var(--muted-foreground, #a1a1aa); background:var(--background, #09090b);">
            <span>Up/Down live-previews themes, Enter commits, Alt+\` radial wheel</span>
            <span>AntiPersonality v3.1</span>
          </div>
        </div>
      `;

      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) this.close();
      });

      document.body.appendChild(overlay);

      const input = document.getElementById('agy-command-palette-input');
      this._filter(initialQuery, false);

      if (input) {
        input.focus();
        input.select();
        input.addEventListener('input', () => this._filter(input.value, Boolean(input.value.trim())));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this._filteredItems.length > 0) {
              this._selectedIndex = (this._selectedIndex + 1) % this._filteredItems.length;
              this._renderList(true);
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this._filteredItems.length > 0) {
              this._selectedIndex = (this._selectedIndex - 1 + this._filteredItems.length) % this._filteredItems.length;
              this._renderList(true);
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this._executeIndex(this._selectedIndex);
          }
        });
      }
      return true;
    },

    close() {
      if (this._previewTimer) {
        clearTimeout(this._previewTimer);
        this._previewTimer = null;
      }
      if (this._previewed && !this._committed && typeof AgyThemeManager.restoreActiveThemeStyles === 'function') {
        AgyThemeManager.restoreActiveThemeStyles();
      }
      this._previewed = false;
      this._committed = false;
      const el = document.getElementById('agy-command-palette-overlay');
      if (el) el.remove();
    },

    toggle() {
      if (this.isOpen()) {
        this.close();
        return false;
      }
      return this.open();
    }
  };

  window.AgyCommandPalette = CommandPalette;

  // =========================================================================
  // RADIAL QUICK-SWITCH WHEEL (Alt + Backquote Hold-to-Flick / Tap-to-Pick)
  // =========================================================================
  const RadialQuickWheel = {
    _cx: 0,
    _cy: 0,
    _lastPtrX: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    _lastPtrY: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
    _activeIndex: -1,
    _openedAt: 0,
    _stickyMode: false,

    _getSlices() {
      return [
        { label: 'Stock', sub: 'Reset', accent: '#a1a1aa', run: (origin) => window.__betterAgyApplyThemeWithScript('stock', true, { clientX: origin.x, clientY: origin.y }) },
        { label: 'Moonlit', sub: 'Theme', accent: '#38bdf8', run: (origin) => window.__betterAgyApplyThemeWithScript('moonlit', false, { clientX: origin.x, clientY: origin.y }) },
        { label: 'Capri', sub: 'Theme', accent: '#ff1e56', run: (origin) => window.__betterAgyApplyThemeWithScript('capri', false, { clientX: origin.x, clientY: origin.y }) },
        { label: 'Zen Mode', sub: 'Plugin', accent: '#10b981', run: () => AgyPluginManager.togglePlugin('zen-mode') },
        { label: 'Speedrunner', sub: 'Persona', accent: '#f59e0b', run: () => savePersonaState({ activeArchetype: 'speedrunner' }, true) },
        { label: 'Paranoid SRE', sub: 'Persona', accent: '#818cf8', run: () => savePersonaState({ activeArchetype: 'sre-auditor' }, true) }
      ];
    },

    isOpen() {
      return Boolean(document.getElementById('agy-radial-wheel-overlay'));
    },

    _polarToXY(cx, cy, r, deg) {
      const rad = (deg * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    },

    _wedgePath(cx, cy, rIn, rOut, startDeg, endDeg) {
      const p1 = this._polarToXY(cx, cy, rOut, startDeg);
      const p2 = this._polarToXY(cx, cy, rOut, endDeg);
      const p3 = this._polarToXY(cx, cy, rIn, endDeg);
      const p4 = this._polarToXY(cx, cy, rIn, startDeg);
      return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${rOut} ${rOut} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${rIn} ${rIn} 0 0 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
    },

    open(x, y) {
      this.close();
      const pad = 132;
      this._cx = Math.max(pad, Math.min(window.innerWidth - pad, Number.isFinite(x) ? x : this._lastPtrX));
      this._cy = Math.max(pad, Math.min(window.innerHeight - pad, Number.isFinite(y) ? y : this._lastPtrY));
      this._activeIndex = -1;
      this._openedAt = performance.now();
      this._stickyMode = false;

      const slices = this._getSlices();
      const size = 256;
      const half = size / 2;

      const svgWedges = slices.map((s, i) => {
        const centerDeg = -90 + i * 60;
        const path = this._wedgePath(half, half, 36, 114, centerDeg - 28.5, centerDeg + 28.5);
        const lp = this._polarToXY(half, half, 77, centerDeg);
        return `
          <g data-radial-idx="${i}" style="cursor:pointer;">
            <path data-radial-wedge="${i}" d="${path}" fill="rgba(24, 24, 27, 0.86)" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" style="transition: fill 120ms ease, stroke 120ms ease, transform 160ms var(--agy-ease-out-quint, ease); transform-origin: ${half}px ${half}px;" />
            <text x="${lp.x.toFixed(1)}" y="${(lp.y - 4).toFixed(1)}" text-anchor="middle" fill="#f4f4f5" font-size="11" font-weight="600" style="pointer-events:none; user-select:none;">${escapeHtml(s.label)}</text>
            <text x="${lp.x.toFixed(1)}" y="${(lp.y + 10).toFixed(1)}" text-anchor="middle" fill="${escapeHtml(s.accent)}" font-size="9.5" font-weight="500" style="pointer-events:none; user-select:none;">${escapeHtml(s.sub)}</text>
          </g>
        `;
      }).join('');

      const overlay = document.createElement('div');
      overlay.id = 'agy-radial-wheel-overlay';
      overlay.style.cssText = 'position:fixed; inset:0; z-index:1000002; background:rgba(0,0,0,0.18); backdrop-filter:blur(2px);';
      overlay.innerHTML = `
        <div id="agy-radial-wheel-ring" style="
          position: fixed;
          left: ${this._cx - half}px;
          top: ${this._cy - half}px;
          width: ${size}px;
          height: ${size}px;
          filter: drop-shadow(0 18px 38px rgba(0,0,0,0.62));
          transform: scale(0.86);
          opacity: 0;
          transition: transform 220ms var(--agy-spring-snappy, cubic-bezier(0.22, 1, 0.36, 1)), opacity 130ms ease;
        ">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${svgWedges}
            <circle cx="${half}" cy="${half}" r="30" fill="rgba(9, 9, 11, 0.94)" stroke="rgba(255,255,255,0.16)" stroke-width="1.2" />
          </svg>
          <div id="agy-radial-center-label" style="
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 10px;
            font-weight: 600;
            color: #a1a1aa;
            text-align: center;
            pointer-events: none;
            user-select: none;
            width: 54px;
            line-height: 1.2;
          ">Flick</div>
        </div>
      `;

      overlay.addEventListener('mousedown', (e) => {
        const g = e.target.closest && e.target.closest('[data-radial-idx]');
        if (g) {
          e.preventDefault();
          e.stopPropagation();
          this._activeIndex = parseInt(g.getAttribute('data-radial-idx'), 10);
          this.commit();
        } else {
          this.close();
        }
      });

      document.body.appendChild(overlay);
      requestAnimationFrame(() => {
        const ring = document.getElementById('agy-radial-wheel-ring');
        if (ring) {
          ring.style.transform = 'scale(1)';
          ring.style.opacity = '1';
        }
      });
      window.dispatchEvent(new CustomEvent('agy:sound', { detail: { type: 'toggle-on' } }));
    },

    _updateAim(px, py) {
      if (!this.isOpen()) return;
      const dx = px - this._cx;
      const dy = py - this._cy;
      const dist = Math.hypot(dx, dy);
      let nextIdx = -1;
      if (dist >= 28) {
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const norm = (deg + 90 + 30 + 360) % 360;
        nextIdx = Math.floor(norm / 60) % 6;
      }
      if (nextIdx === this._activeIndex) return;
      this._activeIndex = nextIdx;

      const slices = this._getSlices();
      document.querySelectorAll('[data-radial-wedge]').forEach(w => {
        const idx = parseInt(w.getAttribute('data-radial-wedge'), 10);
        const active = idx === nextIdx;
        w.setAttribute('fill', active ? 'rgba(63, 63, 70, 0.95)' : 'rgba(24, 24, 27, 0.86)');
        w.setAttribute('stroke', active ? slices[idx].accent : 'rgba(255,255,255,0.12)');
        w.setAttribute('stroke-width', active ? '2' : '1.2');
        w.style.transform = active ? 'scale(1.045)' : 'scale(1)';
      });

      const centerLbl = document.getElementById('agy-radial-center-label');
      if (centerLbl) {
        if (nextIdx >= 0) {
          centerLbl.textContent = slices[nextIdx].label;
          centerLbl.style.color = slices[nextIdx].accent;
        } else {
          centerLbl.textContent = this._stickyMode ? 'Pick' : 'Cancel';
          centerLbl.style.color = '#a1a1aa';
        }
      }
      if (nextIdx >= 0) {
        window.dispatchEvent(new CustomEvent('agy:sound', { detail: { type: 'toggle-on' } }));
      }
    },

    commit() {
      const idx = this._activeIndex;
      const slices = this._getSlices();
      const origin = { x: this._lastPtrX, y: this._lastPtrY };
      this.close();
      if (idx >= 0 && slices[idx]) {
        if (AgyApi.UI && typeof AgyApi.UI.spawnBurst === 'function') {
          AgyApi.UI.spawnBurst(origin.x, origin.y, slices[idx].accent);
        }
        try {
          slices[idx].run(origin);
        } catch (err) {
          console.error('[AntiPersonality] Radial action error:', err);
        }
      }
    },

    close() {
      this._activeIndex = -1;
      this._stickyMode = false;
      const el = document.getElementById('agy-radial-wheel-overlay');
      if (el) el.remove();
    }
  };

  window.AgyRadialWheel = RadialQuickWheel;

  const onRadialPointerMove = (e) => {
    RadialQuickWheel._lastPtrX = e.clientX;
    RadialQuickWheel._lastPtrY = e.clientY;
    if (RadialQuickWheel.isOpen()) {
      RadialQuickWheel._updateAim(e.clientX, e.clientY);
    }
  };

  const onRadialKeyUp = (e) => {
    if (!RadialQuickWheel.isOpen()) return;
    if (e.code === 'Backquote' || e.key === 'Alt') {
      if (RadialQuickWheel._activeIndex >= 0) {
        RadialQuickWheel.commit();
      } else if (performance.now() - RadialQuickWheel._openedAt <= 220) {
        RadialQuickWheel._stickyMode = true;
        const centerLbl = document.getElementById('agy-radial-center-label');
        if (centerLbl) centerLbl.textContent = 'Pick';
      } else if (!RadialQuickWheel._stickyMode) {
        RadialQuickWheel.close();
      }
    }
  };

  window.addEventListener('pointermove', onRadialPointerMove, { passive: true });
  window.addEventListener('keyup', onRadialKeyUp, true);

  function hasGeneralBtn(dlg) {
    return Boolean(
      dlg && Array.from(dlg.querySelectorAll('button')).some(b => b.textContent.trim() === 'General')
    );
  }

  function findSettingsDialog() {
    const byClass = document.querySelector('.settings-modal-container');
    if (byClass) return byClass;
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (let i = 0; i < dialogs.length; i++) {
      if (dialogs[i].querySelector('button[data-tab-id="personas"]') || hasGeneralBtn(dialogs[i])) {
        return dialogs[i];
      }
    }
    return null;
  }

  // Hook into dialog opening with immediate run and lightweight observer
  function checkAndInjectSettings() {
    try {
      if (!document.querySelector('.settings-modal-container, [role="dialog"]')) return;
      const dialog = findSettingsDialog();
      if (dialog) {
        injectSettingsTab(dialog);
      }
    } catch (err) {
      console.warn('[AntiPersonality] Settings hook error:', err);
    }
  }

  checkAndInjectSettings();

  let settingsRafId = null;
  const observer = new MutationObserver(() => {
    if (settingsRafId) return;
    if (!document.querySelector('.settings-modal-container, [role="dialog"]')) return;
    settingsRafId = requestAnimationFrame(() => {
      settingsRafId = null;
      checkAndInjectSettings();
    });
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const checkInterval = setInterval(checkAndInjectSettings, 2500);

  window.AgySettings = {
    open: function (tabId = 'themes') {
      if (tabId === 'palette') {
        return CommandPalette.open();
      }

      let dialog = findSettingsDialog();
      if (dialog && hasGeneralBtn(dialog)) {
        injectSettingsTab(dialog);
        const tabBtn = dialog.querySelector(`button[data-tab-id="${tabId}"]`);
        if (tabBtn) {
          activateAgySettingsTab(dialog, tabId, tabBtn);
        }
        return true;
      }

      const settingsBtn = document.querySelector('[data-testid="settings-button"]') ||
                          Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Settings');
      if (settingsBtn && !dialog) {
        settingsBtn.click();
      }

      if (settingsBtn || dialog) {
        let tries = 0;
        const check = setInterval(() => {
          tries++;
          dialog = findSettingsDialog();
          if (dialog && hasGeneralBtn(dialog)) {
            clearInterval(check);
            injectSettingsTab(dialog);
            const tabBtn = dialog.querySelector(`button[data-tab-id="${tabId}"]`);
            if (tabBtn) {
              activateAgySettingsTab(dialog, tabId, tabBtn);
            }
          } else if (tries > 40) {
            clearInterval(check);
          }
        }, 40);
        return true;
      }
      return false;
    }
  };

  window.AgyOpenAntiPersonality = window.AgySettings.open;

  // Global Hotkeys (Ctrl+Shift+M, Modal Ctrl+Shift+P, Alt+Backquote Radial) + Slash Interceptor (/ap, /antipersonality)
  const globalKeydownHandler = (e) => {
    if (e.key === 'Escape' && RadialQuickWheel.isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      RadialQuickWheel.close();
      return;
    }

    // 1. Alt + Backquote -> Hold-to-Flick / Tap-to-Pick Radial Wheel
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'Backquote') {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (RadialQuickWheel.isOpen()) {
        RadialQuickWheel.close();
      } else {
        RadialQuickWheel.open(RadialQuickWheel._lastPtrX, RadialQuickWheel._lastPtrY);
      }
      return;
    }

    // 2. Ctrl + Shift + M -> Toggle AntiPersonality Command Palette everywhere
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.code === 'KeyM' || e.key === 'M' || e.key === 'm')) {
      e.preventDefault();
      e.stopPropagation();
      CommandPalette.toggle();
      return;
    }

    // 3. Modal-scoped Ctrl + Shift + P -> Toggle Command Palette strictly inside Settings or Palette
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      !e.altKey &&
      (e.code === 'KeyP' || e.key === 'P' || e.key === 'p') &&
      (CommandPalette.isOpen() || Boolean(findSettingsDialog()))
    ) {
      e.preventDefault();
      e.stopPropagation();
      CommandPalette.toggle();
      return;
    }

    // 4. Chat input slash commands (/ap -> Command Palette, /antipersonality -> Settings Modal)
    if (e.key !== 'Enter' || e.shiftKey) return;
    const target = e.target;
    if (!target || target.id === 'agy-command-palette-input') return;
    if (!target.matches('textarea') && !target.isContentEditable) return;

    const rawVal = target.tagName === 'TEXTAREA' ? target.value : target.textContent;
    const trimmed = (rawVal || '').trim().toLowerCase();

    if (trimmed === '/antipersonality' || trimmed === '/ap' || trimmed.startsWith('/antipersonality ') || trimmed.startsWith('/ap ')) {
      e.preventDefault();
      e.stopPropagation();

      // Clear input safely without desyncing React or Lexical/ProseMirror controlled state
      if (target.tagName === 'TEXTAREA') {
        const proto = HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(target, '');
        else target.value = '';
        target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      } else {
        try {
          target.focus();
          const sel = window.getSelection();
          if (sel) {
            sel.selectAllChildren(target);
            document.execCommand('delete', false);
          }
        } catch (_) {
          target.textContent = '';
          target.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
        }
      }

      if (trimmed === '/ap') {
        CommandPalette.open();
        return;
      }

      let tab = 'themes';
      if (trimmed.includes('plugin')) tab = 'plugins';
      else if (trimmed.includes('persona') || trimmed.includes('archetype')) tab = 'personas';
      else if (trimmed.includes('css')) tab = 'custom-css';
      else if (trimmed.includes('palette')) {
        CommandPalette.open();
        return;
      }

      window.AgyOpenAntiPersonality(tab);
      if (window.AgyApi && window.AgyApi.UI) {
        window.AgyApi.UI.showToast('Opened AntiPersonality', { type: 'info', timeout: 2000 });
      }
    }
  };

  document.addEventListener('keydown', globalKeydownHandler, true);

  const onThemeChange = () => {
    if (suppressThemeRerender) return;
    if (window.__renderAgyThemes) window.__renderAgyThemes();
  };
  const onPluginChange = () => {
    if (suppressPluginRerender) return;
    if (window.__renderAgyPlugins) window.__renderAgyPlugins();
  };

  window.addEventListener('agy:theme-change', onThemeChange);
  window.addEventListener('agy:plugin-change', onPluginChange);

  // Sync initial persona state from bridge asynchronously
  syncPersonaFromBridge().catch(() => {});

  window.__agySettingsCleanup = () => {
    if (settingsRafId) {
      cancelAnimationFrame(settingsRafId);
      settingsRafId = null;
    }
    if (cssLivePreviewTimer) {
      clearTimeout(cssLivePreviewTimer);
      cssLivePreviewTimer = null;
    }
    CommandPalette.close();
    RadialQuickWheel.close();
    observer.disconnect();
    clearInterval(checkInterval);
    window.removeEventListener('pointermove', onRadialPointerMove);
    window.removeEventListener('keyup', onRadialKeyUp, true);
    document.removeEventListener('keydown', globalKeydownHandler, true);
    window.removeEventListener('agy:theme-change', onThemeChange);
    window.removeEventListener('agy:plugin-change', onPluginChange);
  };
})();
