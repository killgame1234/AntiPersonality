/**
 * Bundle Runtime v3.0.0: Bundles core runtime, themes, plugins, and initial persona state
 * into a single self-contained payload for Runtime.evaluate and Page.addScriptToEvaluateOnNewDocument.
 */

const fs = require('fs');
const path = require('path');
const { parseMetadata } = require('./addon_manager');

function readInitialPersona(rootDir) {
  const workspacePersonaPath = path.join(rootDir, '.agents', 'personality.json');
  const defaultConfigPath = path.join(rootDir, 'config.json');
  let base = {
    enabled: true,
    activeArchetype: 'tech-lead',
    verbosity: 50,
    autonomy: 'autonomous',
    strictTyping: true,
    version: '3.0.0'
  };
  let cfgObj = null;
  let wsObj = null;
  try {
    if (fs.existsSync(defaultConfigPath)) {
      cfgObj = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
    }
  } catch (_) {}
  try {
    if (fs.existsSync(workspacePersonaPath)) {
      wsObj = JSON.parse(fs.readFileSync(workspacePersonaPath, 'utf8'));
    }
  } catch (_) {}

  // Normalize legacy 'synthesizedAt' -> 'updatedAt' and 'step-by-step' -> 'cautious'
  const normalize = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const copy = { ...obj };
    if (!copy.updatedAt && copy.synthesizedAt) copy.updatedAt = copy.synthesizedAt;
    if (copy.autonomy === 'step-by-step') copy.autonomy = 'cautious';
    return copy;
  };
  cfgObj = normalize(cfgObj);
  wsObj = normalize(wsObj);

  if (cfgObj && wsObj) {
    const cfgTs = cfgObj.updatedAt ? Date.parse(cfgObj.updatedAt) : 0;
    const wsTs = wsObj.updatedAt ? Date.parse(wsObj.updatedAt) : 0;
    base = cfgTs > wsTs
      ? Object.assign(base, wsObj, cfgObj)
      : Object.assign(base, cfgObj, wsObj);
  } else if (wsObj) {
    base = Object.assign(base, wsObj);
  } else if (cfgObj) {
    base = Object.assign(base, cfgObj);
  }
  return base;
}

function generateRuntimeBundle(options = {}) {
  const { silent = false, toastMessage = null } = options;
  const rootDir = path.resolve(__dirname, '..');

  // 1. Core runtime scripts
  const agyApiCode = fs.readFileSync(path.join(rootDir, 'core', 'agy_api.js'), 'utf8');
  const themeManagerCode = fs.readFileSync(path.join(rootDir, 'core', 'theme_manager.js'), 'utf8');
  const pluginManagerCode = fs.readFileSync(path.join(rootDir, 'core', 'plugin_manager.js'), 'utf8');
  const settingsTabCode = fs.readFileSync(path.join(rootDir, 'core', 'settings_tab.js'), 'utf8');

  // 2. Load canonical .theme.css themes with metadata
  const themesDir = path.join(rootDir, 'themes');
  const themeFiles = fs.existsSync(themesDir)
    ? fs.readdirSync(themesDir).filter(f => f.endsWith('.theme.css')).sort()
    : [];
  const loadedThemes = [];

  for (const f of themeFiles) {
    const filePath = path.join(themesDir, f);
    const content = fs.readFileSync(filePath, 'utf8');
    const id = f.replace(/\.theme\.css$/, '');
    const meta = parseMetadata(content);
    if (!meta.name || meta.name === 'Unnamed Addon') {
      meta.name = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    loadedThemes.push({ id, meta, css: content });
  }

  // 3. Load .plugin.js plugins with metadata
  const pluginsDir = path.join(rootDir, 'plugins');
  const pluginFiles = fs.existsSync(pluginsDir)
    ? fs.readdirSync(pluginsDir).filter(f => f.endsWith('.plugin.js')).sort()
    : [];
  const loadedPlugins = [];

  for (const f of pluginFiles) {
    const filePath = path.join(pluginsDir, f);
    const content = fs.readFileSync(filePath, 'utf8');
    const id = f.replace(/\.plugin\.js$/, '');
    const meta = parseMetadata(content);
    if (!meta.name || meta.name === 'Unnamed Addon') {
      meta.name = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    loadedPlugins.push({ id, meta, code: content });
  }

  const pluginRegistrationCode = loadedPlugins.map(p => `
        try {
          const PluginClass = (() => {
            const module = { exports: {} };
            const exports = module.exports;
${p.code}
            return typeof module.exports === 'function' ? module.exports : null;
          })();
          if (PluginClass) {
            window.AgyPluginManager.registerPlugin(${JSON.stringify(p.id)}, ${JSON.stringify(p.meta)}, PluginClass);
          }
        } catch (err) {
          console.error('[AntiPersonality] Failed to register plugin ' + ${JSON.stringify(p.id)} + ':', err);
        }`).join('\n');

  // 4. Load initial persona configuration
  const initialPersona = readInitialPersona(rootDir);

  // 5. Construct complete bundle payload (100% CSP-safe: zero eval / zero new Function)
  const bundle = `(() => {
    // Isolate strictly to top-level window so generative UI / preview iframes are never polluted
    if (typeof window !== 'undefined' && window.top && window !== window.top) {
      return 'AntiPersonality skipped in child iframe.';
    }

    const bootAntiPersonality = () => {
      try {
        window.__AGY_INITIAL_PERSONA__ = ${JSON.stringify(initialPersona)};
        console.log('[AntiPersonality] Initializing runtime bundle v3.0.0...');

        // 1. Load Core APIs & Managers
        ${agyApiCode}
        ${themeManagerCode}
        ${pluginManagerCode}
        ${settingsTabCode}

        // 2. Register Built-in Themes
        const themes = ${JSON.stringify(loadedThemes)};
        themes.forEach(th => {
          window.AgyThemeManager.registerTheme(th.id, th.meta, th.css);
        });

        // 3. Register Built-in Plugins (CSP-safe build-time IIFE scopes; zero unsafe-eval)
        ${pluginRegistrationCode}

        // 4. Initialize Managers
        window.AgyThemeManager.init();
        window.AgyPluginManager.init();

        // 5. Refresh open Settings tab if user currently has the modal open
        if (typeof window.__refreshActiveAgyTab === 'function') {
          try { window.__refreshActiveAgyTab(); } catch (_) {}
        }

        const customToast = ${JSON.stringify(toastMessage)};
        const isSilent = ${JSON.stringify(Boolean(silent))};
        if (window.AgyApi && window.AgyApi.UI) {
          if (customToast) {
            if (typeof window.AgyApi.UI.flashCompileBar === 'function') {
              window.AgyApi.UI.flashCompileBar();
            }
            window.AgyApi.UI.showToast(customToast, { type: 'info', timeout: 2400 });
          } else if (!isSilent) {
            window.AgyApi.UI.showToast('AntiPersonality v3.1 active. Open Settings, press Ctrl+Shift+M, or hold Alt+Backquote.', { type: 'info', timeout: 3600 });
          }
        }

        return 'AntiPersonality v3.1 successfully bundled and initialized!';
      } catch (err) {
        console.error('[AntiPersonality] Bootstrap error:', err);
        return 'Error: ' + err.message;
      }
    };

    if (!document.head || !document.body) {
      if (!window.__agyDomReadyHooked) {
        window.__agyDomReadyHooked = true;
        window.addEventListener('DOMContentLoaded', () => {
          window.__agyDomReadyHooked = false;
          bootAntiPersonality();
        }, { once: true });
      }
      return 'AntiPersonality v3.0 scheduled for DOMContentLoaded.';
    }

    return bootAntiPersonality();
  })()`;

  return bundle;
}

module.exports = { generateRuntimeBundle, readInitialPersona };
