/**
 * AntiPersonality v3.0 Universal Injector, Persistent CDP Daemon & Live Hot-Reload Engine (injector.js)
 * - Registers Page.addScriptToEvaluateOnNewDocument for zero-amnesia persistence across Ctrl+R reloads
 * - Runs a mutex-guarded 3-second health monitor to auto-heal runtime and active interactive theme scripts
 * - Provides serialized, debounced (150ms) fs.watch hot-swapping over core/, plugins/, themes/, and persona JSON
 * - Exposes origin-hardened HTTP Bridge (:51788) for /apply, /reset, /open, /persona, /inject-theme, /themes, /status
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { parseMetadata } = require('./core/addon_manager');
const { generateRuntimeBundle, readInitialPersona } = require('./core/bundle_runtime');

const ROOT_DIR = __dirname;
const EXTERNAL_THEMES_ROOT = path.join(os.homedir(), '.gemini', 'antigravity', 'themes');
const EXTERNAL_THEME_SCRIPTS = Object.freeze(Object.assign(Object.create(null), {
  'capri': path.join(EXTERNAL_THEMES_ROOT, 'Capri', 'apply_capri_theme.js'),
  'prescript': path.join(EXTERNAL_THEMES_ROOT, 'Prescript', 'apply_prescript_theme.js'),
  'eldritch': path.join(EXTERNAL_THEMES_ROOT, 'Eldritch_theme', 'apply_eldritch_theme.js'),
  'moonlit': path.join(EXTERNAL_THEMES_ROOT, 'Moonlit_Lotus_Skiff', 'apply_moonlit_lotus_skiff_theme.js'),
  'black-shores': path.join(EXTERNAL_THEMES_ROOT, 'Black_Shores_Shorekeeper', 'apply_black_shores_theme.js')
}));

const PROTECTED_THEME_IDS = new Set([
  'amoled', 'black-shores', 'capri', 'eldritch', 'moonlit', 'prescript', 'stock', 'default'
]);

const BRIDGE_PORT = 51788;
const VALID_ARCHETYPES = new Set(['tech-lead', 'mentor', 'speedrunner', 'sre-auditor', 'minimalist']);
const VALID_AUTONOMY = new Set(['autonomous', 'balanced', 'cautious']);

function hasExternalTheme(key) {
  if (!key || typeof key !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(EXTERNAL_THEME_SCRIPTS, key.toLowerCase());
}

function getDevToolsPort() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const portFile = path.join(appData, 'Antigravity', 'DevToolsActivePort');
  if (!fs.existsSync(portFile)) {
    throw new Error(`DevToolsActivePort not found at ${portFile}. Is Antigravity running?`);
  }
  const lines = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  const port = parseInt(lines[0], 10);
  if (isNaN(port)) throw new Error(`Invalid port parsed from ${portFile}: ${lines[0]}`);
  return port;
}

async function getTargetPageWsUrl(port) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!listRes.ok) throw new Error(`Failed to fetch /json/list: ${listRes.statusText}`);
  const targets = await listRes.json();
  const page = targets.find(t => t.type === 'page' && !t.url.startsWith('devtools://')) || targets.find(t => t.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) {
    throw new Error('No active Antigravity page window found in DevTools target list.');
  }
  return page.webSocketDebuggerUrl;
}

/**
 * Sends one or more CDP commands sequentially over a short-lived WebSocket connection.
 */
function sendCdpCommands(wsUrl, commands) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let idx = 0;
    const results = [];

    const timer = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error('CDP WebSocket command timed out after 8000ms'));
    }, 8000);

    const sendNext = () => {
      if (idx >= commands.length) {
        clearTimeout(timer);
        try { ws.close(); } catch (_) {}
        resolve(results);
        return;
      }
      const cmd = commands[idx];
      ws.send(JSON.stringify({
        id: idx + 1,
        method: cmd.method,
        params: cmd.params || {}
      }));
    };

    ws.onopen = () => sendNext();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.id) return;
        if (data.id === idx + 1) {
          if (data.error) {
            clearTimeout(timer);
            try { ws.close(); } catch (_) {}
            reject(new Error(data.error.message || JSON.stringify(data.error)));
            return;
          }
          if (data.result && data.result.exceptionDetails) {
            clearTimeout(timer);
            try { ws.close(); } catch (_) {}
            reject(new Error(data.result.exceptionDetails.text || JSON.stringify(data.result.exceptionDetails)));
            return;
          }
          results.push(data.result);
          idx++;
          sendNext();
        }
      } catch (err) {
        clearTimeout(timer);
        try { ws.close(); } catch (_) {}
        reject(err);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(err);
    };
  });
}

async function evaluateInBrowser(wsUrl, code) {
  const [res] = await sendCdpCommands(wsUrl, [
    {
      method: 'Runtime.evaluate',
      params: { expression: code, returnByValue: true, awaitPromise: true }
    }
  ]);
  return res && res.result ? res.result.value : (res ? res.value : null);
}

/**
 * Purges interactive background engines, theme-owned blob URLs, videos, and canvas layers.
 * Preserves #agy-style-active-theme unless removeActiveCss === true (e.g. full Stock reset).
 */
async function purgeActiveThemes(removeActiveCss = false) {
  try {
    const port = getDevToolsPort();
    const wsUrl = await getTargetPageWsUrl(port);
    const purgeScript = `(() => {
      if (window.AgyThemeManager && typeof window.AgyThemeManager._cleanupInteractiveThemeEngines === 'function') {
        window.AgyThemeManager._cleanupInteractiveThemeEngines(${JSON.stringify(Boolean(removeActiveCss))});
        return true;
      }

      const selectors = [
        '[id^="blackshores-"]', '[id^="shorekeeper-"]', '[id^="tethys-"]',
        '[id^="eldritch-"]', '[id^="moonlit-"]', '[id^="capri-"]', '[id^="prescript-"]',
        'body > video', 'body > canvas',
        'canvas[id*="blackshores"]', 'canvas[id*="lightning"]', 'canvas[id*="rift"]', 'canvas[id*="particle"]', 'canvas[id*="fate"]',
        '.prescript-stop-seal-svg', '.moonlit-top-app-icon', '.prescript-top-app-icon',
        'style[id="custom-antigravity-theme"]', 'style[id="blackshores-theme-css"]', 'style[id="better-agy-theme"]'
      ];
      if (${JSON.stringify(Boolean(removeActiveCss))}) {
        selectors.push('style[id="agy-style-active-theme"]');
      }

      document.querySelectorAll(selectors.join(', ')).forEach(el => {
        try {
          if (el.tagName === 'VIDEO') {
            el.pause();
            if (el.src && el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
            el.removeAttribute('src');
            el.load();
          } else if (el.tagName === 'CANVAS') {
            el.width = 0;
            el.height = 0;
          }
          el.remove();
        } catch (_) {}
      });

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

      return true;
    })()`;
    return await evaluateInBrowser(wsUrl, purgeScript);
  } catch (err) {
    console.warn('[AntiPersonality] purgeActiveThemes warning:', err.message);
    return false;
  }
}

let themeTransitionInFlight = false;

/**
 * Executes a pre-made interactive theme script from ~/.gemini/antigravity/themes
 */
async function runExternalThemeScript(themeKey) {
  const normalizedKey = String(themeKey || '').toLowerCase();
  if (!hasExternalTheme(normalizedKey)) {
    throw new Error(`Unknown external theme key: "${themeKey}"`);
  }

  themeTransitionInFlight = true;
  try {
    await purgeActiveThemes(false);

    return await new Promise((resolve, reject) => {
      const scriptPath = EXTERNAL_THEME_SCRIPTS[normalizedKey];
      if (!scriptPath || !fs.existsSync(scriptPath)) {
        return reject(new Error(`Theme script for "${normalizedKey}" not found at ${scriptPath}`));
      }

      const appPath = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'antigravity', 'Antigravity.exe');
      const cmd = `"${appPath}" "${scriptPath}"`;
      console.log(`[AntiPersonality] Executing interactive theme script: ${scriptPath}`);

      exec(cmd, { cwd: path.dirname(scriptPath), env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }, async (err, stdout) => {
        if (err) {
          console.error(`[AntiPersonality] Theme script error:`, err);
          return reject(err);
        }
        // Re-assert active .theme.css tokens, font guardrails, and performance controls after external script completes
        try {
          const port = getDevToolsPort();
          const wsUrl = await getTargetPageWsUrl(port);
          await evaluateInBrowser(wsUrl, `(() => {
            if (window.AgyThemeManager) {
              window.AgyThemeManager._ensureActiveStylesheetMounted();
              window.AgyThemeManager.applyPerfControls();
            }
            const fg = document.getElementById('agy-style-font-guardrails');
            if (fg && document.head) document.head.appendChild(fg);
          })()`);
        } catch (_) {}
        resolve(stdout);
      });
    });
  } finally {
    themeTransitionInFlight = false;
  }
}

/**
 * Durable atomic file writer (fsync + Windows NTFS EPERM/EBUSY lock retry + tmp cleanup).
 */
function writeTextAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeSync(fd, content, 0, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        if ((err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EBUSY') && attempt < 3) {
          const waitUntil = Date.now() + 25 * (attempt + 1);
          while (Date.now() < waitUntil) {
            // Brief synchronous backoff for transient Windows Defender / indexer handles
          }
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
    throw err;
  }
}

function writeJsonAtomic(filePath, dataObj) {
  writeTextAtomic(filePath, JSON.stringify(dataObj, null, 2) + '\n');
}

/**
 * Reads and persists AI Persona configuration atomically across config.json and .agents/personality.json.
 */
function savePersonaToDisk(incoming = {}) {
  const current = readInitialPersona(ROOT_DIR);
  const archetype = VALID_ARCHETYPES.has(incoming.activeArchetype)
    ? incoming.activeArchetype
    : current.activeArchetype || 'tech-lead';

  let verbosity = Number(incoming.verbosity);
  if (!Number.isFinite(verbosity)) verbosity = Number(current.verbosity ?? 50);
  verbosity = Math.max(0, Math.min(100, Math.round(verbosity)));

  const normalizedIncomingAutonomy = incoming.autonomy === 'step-by-step' ? 'cautious' : incoming.autonomy;
  const autonomy = VALID_AUTONOMY.has(normalizedIncomingAutonomy)
    ? normalizedIncomingAutonomy
    : current.autonomy || 'autonomous';

  const strictTyping = incoming.strictTyping !== undefined
    ? Boolean(incoming.strictTyping)
    : (current.strictTyping !== false);

  const enabled = incoming.enabled !== undefined ? Boolean(incoming.enabled) : true;
  const updatedAt = new Date().toISOString();

  const configData = {
    enabled,
    activeArchetype: archetype,
    verbosity,
    autonomy,
    strictTyping,
    version: '3.0.0',
    updatedAt
  };

  writeJsonAtomic(path.join(ROOT_DIR, 'config.json'), configData);
  writeJsonAtomic(path.join(ROOT_DIR, '.agents', 'personality.json'), configData);

  return configData;
}

/**
 * Saves a generated or custom theme to themes/<slug>.theme.css and injects it live into Antigravity.
 * Note: allowFilePath is strictly false for HTTP requests to prevent arbitrary local file reads.
 */
async function injectCustomTheme(cssOrFilePath, themeName = 'Custom AI Theme', options = {}) {
  const { allowFilePath = false } = options;
  if (!cssOrFilePath || typeof cssOrFilePath !== 'string') {
    throw new Error('CSS content is required for inject-theme.');
  }

  let rawCss = cssOrFilePath;
  if (allowFilePath && !rawCss.includes('{') && fs.existsSync(cssOrFilePath)) {
    rawCss = fs.readFileSync(cssOrFilePath, 'utf8');
  }

  if (!rawCss.includes('{') || !rawCss.includes('}')) {
    throw new Error('Valid CSS rules containing "{" and "}" are required.');
  }

  const parsedMeta = parseMetadata(rawCss);
  const finalName = (themeName && themeName.trim())
    ? themeName.trim()
    : (parsedMeta.name !== 'Unnamed Addon' ? parsedMeta.name : 'Custom AI Theme');

  let slug = finalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-ai-theme';

  if (PROTECTED_THEME_IDS.has(slug)) {
    slug = `custom-${slug}`;
  }

  let finalCss = rawCss.trim();
  if (!/^\/\*\*[\s\S]*?@name\s+/m.test(finalCss)) {
    finalCss = [
      '/**',
      ` * @name ${finalName}`,
      ' * @author AntiPersonality AI Theme Maker',
      ' * @version 1.0.0',
      ` * @description Generated custom theme (${finalName}) for Google Antigravity Desktop.`,
      ' */',
      '',
      finalCss
    ].join('\n');
  }

  const meta = parseMetadata(finalCss);
  if (!meta.name || meta.name === 'Unnamed Addon') meta.name = finalName;

  const themesDir = path.join(ROOT_DIR, 'themes');
  const targetFile = path.join(themesDir, `${slug}.theme.css`);
  writeTextAtomic(targetFile, finalCss + '\n');

  await purgeActiveThemes(false);

  try {
    const port = getDevToolsPort();
    const wsUrl = await getTargetPageWsUrl(port);
    await evaluateInBrowser(wsUrl, `(() => {
      if (!window.AgyThemeManager) return false;
      window.AgyThemeManager.registerTheme(${JSON.stringify(slug)}, ${JSON.stringify(meta)}, ${JSON.stringify(finalCss)}, true);
      window.AgyThemeManager.enableTheme(${JSON.stringify(slug)}, true, true);
      if (typeof window.__renderAgyThemes === 'function') window.__renderAgyThemes();
      return true;
    })()`);
  } catch (err) {
    console.warn('[AntiPersonality] Saved theme to disk, live browser eval warning:', err.message);
  }

  return { id: slug, name: finalName, filePath: targetFile };
}

/**
 * Installs runtime bundle via Runtime.evaluate (and Page.addScriptToEvaluateOnNewDocument when standalone).
 */
async function install(options = {}) {
  const { silent = false, toastMessage = null, skipPreload = false } = options;
  const port = getDevToolsPort();
  const wsUrl = await getTargetPageWsUrl(port);

  const liveBundle = generateRuntimeBundle({ silent, toastMessage });
  const commands = [];

  if (!skipPreload) {
    const preloadBundle = generateRuntimeBundle({ silent: true });
    commands.push(
      { method: 'Page.enable' },
      { method: 'Page.addScriptToEvaluateOnNewDocument', params: { source: preloadBundle } }
    );
  }
  commands.push({ method: 'Runtime.evaluate', params: { expression: liveBundle, returnByValue: true } });

  const results = await sendCdpCommands(wsUrl, commands);
  const lastIdx = results.length - 1;
  const evalRes = results[lastIdx] && results[lastIdx].result ? results[lastIdx].result.value : null;
  if (!silent) {
    console.log(`[AntiPersonality] Install Result:`, evalRes);
  }
  return evalRes;
}

/**
 * Persistent CDP Preload & Auto-Heal Engine:
 * Keeps a dedicated CDP WebSocket attached so Page.addScriptToEvaluateOnNewDocument
 * persists across every Ctrl+R page reload, plus runs a mutex-guarded 3-second health monitor.
 */
function startPersistentCdpGuardian() {
  let ws = null;
  let currentWsUrl = null;
  let scriptIdentifier = null;
  let msgCounter = 1;
  let reconnecting = false;
  let healthTickRunning = false;

  const sendOnPersistent = (method, params = {}) => {
    return new Promise((resolve) => {
      if (!ws || ws.readyState !== 1) return resolve(null);
      const id = msgCounter++;
      const timeout = setTimeout(() => {
        if (ws) ws.removeEventListener('message', onMsg);
        resolve(null);
      }, 5000);

      const onMsg = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.id === id) {
            clearTimeout(timeout);
            if (ws) ws.removeEventListener('message', onMsg);
            resolve(data.result || null);
          }
        } catch (_) {}
      };
      ws.addEventListener('message', onMsg);
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (_) {
        clearTimeout(timeout);
        ws.removeEventListener('message', onMsg);
        resolve(null);
      }
    });
  };

  const refreshPreloadScript = async () => {
    if (!ws || ws.readyState !== 1) return;
    const preloadBundle = generateRuntimeBundle({ silent: true });
    if (scriptIdentifier) {
      await sendOnPersistent('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptIdentifier });
      scriptIdentifier = null;
    }
    const res = await sendOnPersistent('Page.addScriptToEvaluateOnNewDocument', { source: preloadBundle });
    if (res && res.identifier) {
      scriptIdentifier = res.identifier;
    }
  };

  const checkAndRehydrateExternalTheme = async () => {
    if (healthTickRunning) return;
    healthTickRunning = true;
    try {
      const checkRes = await sendOnPersistent('Runtime.evaluate', {
        expression: `(() => {
          const hasRuntime = Boolean(window.AgyApi && typeof window.AgyApi.version === 'string' && window.AgyApi.version.startsWith('3.') && window.AgyThemeManager && window.AgyPluginManager);
          const activeId = window.AgyThemeManager
            ? (window.AgyThemeManager.getActiveTheme()?.id || null)
            : (() => {
                try {
                  const raw = localStorage.getItem('AgyData:ThemeManager');
                  return raw ? JSON.parse(raw).activeTheme : null;
                } catch (_) { return null; }
              })();
          const hasMedia = activeId ? Boolean(document.querySelector(
            'body > video, video[id^="blackshores-"], video[id^="capri-"], video[id^="eldritch-"], video[id^="moonlit-"], video[id^="prescript-"], canvas[id*="blackshores"], canvas[id*="capri"], canvas[id*="eldritch"], canvas[id*="moonlit"], canvas[id*="prescript"], #prescript-decree-card'
          )) : true;
          return { hasRuntime, activeId, hasMedia };
        })()`,
        returnByValue: true
      });

      const state = checkRes && checkRes.result ? checkRes.result.value : null;
      if (!state) return;

      if (!state.hasRuntime) {
        console.log('[AntiPersonality] Health check detected missing runtime — auto-rehydrating...');
        const bundle = generateRuntimeBundle({ silent: true });
        await sendOnPersistent('Runtime.evaluate', { expression: bundle, returnByValue: true });
      }

      if (state.activeId && hasExternalTheme(state.activeId) && !state.hasMedia && !themeTransitionInFlight) {
        console.log(`[AntiPersonality] Re-hydrating external interactive theme "${state.activeId}" after reload...`);
        await runExternalThemeScript(state.activeId).catch(() => {});
      }
    } catch (_) {
    } finally {
      healthTickRunning = false;
    }
  };

  const connectGuardian = async () => {
    if (reconnecting) return;
    reconnecting = true;
    try {
      const port = getDevToolsPort();
      const targetUrl = await getTargetPageWsUrl(port);

      if (ws && ws.readyState === 1 && currentWsUrl === targetUrl) {
        reconnecting = false;
        return;
      }

      if (ws) {
        try { ws.close(); } catch (_) {}
      }

      currentWsUrl = targetUrl;
      scriptIdentifier = null;
      ws = new WebSocket(targetUrl);

      ws.onopen = async () => {
        reconnecting = false;
        await sendOnPersistent('Page.enable');
        await refreshPreloadScript();
        await checkAndRehydrateExternalTheme();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Page.loadEventFired') {
            setTimeout(() => {
              checkAndRehydrateExternalTheme();
            }, 250);
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        ws = null;
        scriptIdentifier = null;
        reconnecting = false;
      };

      ws.onerror = () => {
        reconnecting = false;
      };
    } catch (_) {
      reconnecting = false;
    }
  };

  connectGuardian();

  const healthTimer = setInterval(async () => {
    if (!ws || ws.readyState !== 1) {
      await connectGuardian();
    } else {
      await checkAndRehydrateExternalTheme();
    }
  }, 3000);

  return {
    refreshPreloadScript,
    stop: () => {
      clearInterval(healthTimer);
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
    }
  };
}

/**
 * Serialized, debounced (150ms) fs.watch live hot-reload over core/, plugins/, themes/*.theme.css, and persona JSON.
 */
function startHotReloadWatcher(guardian = null) {
  let debounceTimer = null;
  let reloadInFlight = false;
  let pendingFile = null;

  const watchedDirs = [
    path.join(ROOT_DIR, 'core'),
    path.join(ROOT_DIR, 'plugins'),
    path.join(ROOT_DIR, 'themes'),
    path.join(ROOT_DIR, '.agents')
  ];

  const executeReload = async (changedFile) => {
    if (reloadInFlight) {
      pendingFile = changedFile;
      return;
    }
    reloadInFlight = true;
    try {
      if (changedFile === 'personality.json' || changedFile === 'config.json') {
        const freshPersona = readInitialPersona(ROOT_DIR);
        if (guardian && typeof guardian.refreshPreloadScript === 'function') {
          await guardian.refreshPreloadScript();
        }
        const port = getDevToolsPort();
        const wsUrl = await getTargetPageWsUrl(port);
        await evaluateInBrowser(wsUrl, `(() => {
          const disk = ${JSON.stringify(freshPersona)};
          window.__AGY_INITIAL_PERSONA__ = disk;
          if (window.AgyApi && window.AgyApi.Data) {
            window.AgyApi.Data.save('PersonaManager', 'config', disk);
          }
          if (typeof window.__renderAgyPersonas === 'function') window.__renderAgyPersonas();
          return true;
        })()`);
      } else {
        console.log(`[AntiPersonality] Detected change in ${changedFile} — hot-swapping bundle...`);
        if (guardian && typeof guardian.refreshPreloadScript === 'function') {
          await guardian.refreshPreloadScript();
        }
        await install({ silent: true, toastMessage: `Hot-reloaded: ${changedFile}`, skipPreload: Boolean(guardian) });
      }
    } catch (err) {
      console.warn(`[AntiPersonality] Hot-reload warning:`, err.message);
    } finally {
      reloadInFlight = false;
      if (pendingFile) {
        const next = pendingFile;
        pendingFile = null;
        executeReload(next);
      }
    }
  };

  const triggerReload = (changedFile) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeReload(changedFile);
    }, 150);
  };

  const watchers = [];
  for (const dir of watchedDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const watcher = fs.watch(dir, { persistent: true }, (_eventType, filename) => {
        if (!filename || filename.endsWith('.tmp')) return;
        const isRelevant =
          filename.endsWith('.js') ||
          filename.endsWith('.theme.css') ||
          filename === 'personality.json';
        if (isRelevant) {
          triggerReload(filename);
        }
      });
      watchers.push(watcher);
    } catch (err) {
      console.warn(`[AntiPersonality] Failed to watch ${dir}:`, err.message);
    }
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watchers.forEach(w => {
      try { w.close(); } catch (_) {}
    });
  };
}

async function status() {
  const port = getDevToolsPort();
  const wsUrl = await getTargetPageWsUrl(port);

  const queryScript = `(() => {
    if (!window.AgyApi) return { installed: false, port: ${port} };
    return {
      installed: true,
      version: window.AgyApi.version,
      port: ${port},
      activeTheme: window.AgyThemeManager ? (window.AgyThemeManager.getActiveTheme()?.meta?.name || 'Stock Default') : 'Unknown',
      perfSettings: window.AgyThemeManager ? window.AgyThemeManager.getPerfSettings() : {},
      persona: window.AgyPersonaManager ? window.AgyPersonaManager.getState() : null,
      themesCount: window.AgyThemeManager ? window.AgyThemeManager.getAllThemes().length : 0,
      pluginsCount: window.AgyPluginManager ? window.AgyPluginManager.getAllPlugins().length : 0,
      enabledPlugins: window.AgyPluginManager ? window.AgyPluginManager.getAllPlugins().filter(p => p.enabled).map(p => p.meta.name) : []
    };
  })()`;

  const res = await evaluateInBrowser(wsUrl, queryScript);
  console.log(`[AntiPersonality] Status:`, JSON.stringify(res, null, 2));
  return res;
}

async function reset() {
  await purgeActiveThemes(true);
  const port = getDevToolsPort();
  const wsUrl = await getTargetPageWsUrl(port);

  const resetScript = `(() => {
    if (window.AgyThemeManager && typeof window.AgyThemeManager._cleanupInteractiveThemeEngines === 'function') {
      window.AgyThemeManager._cleanupInteractiveThemeEngines(true);
    }
    if (window.AgyThemeManager) {
      window.AgyThemeManager.activeThemeId = null;
      if (window.AgyApi && window.AgyApi.Data) {
        window.AgyApi.Data.save('ThemeManager', 'activeTheme', null);
      }
      window.AgyApi?.DOM?.removeStyle('active-theme');
    }
    document.querySelectorAll('#better-agy-theme, #agy-quick-theme-bar').forEach(el => el.remove());
    document.documentElement.classList.remove('better-agy-active');
    if (document.body) {
      document.body.classList.remove('realm-skiff', 'realm-tree', 'tethys-active', 'eldritch-active', 'prescript-active', 'capri-active');
    }
    return 'Antigravity restored to stock theme clean slate.';
  })()`;

  const res = await evaluateInBrowser(wsUrl, resetScript);
  console.log(`[AntiPersonality] Reset:`, res);
  return res;
}

function readRequestBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;

    req.on('data', chunk => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        aborted = true;
        req.destroy();
        reject(new Error(`Payload exceeds maximum size of ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', err => {
      if (!aborted) reject(err);
    });
  });
}

function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return true; // Local Electron file:// or non-browser CLI/Node fetch
  return (
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin) ||
    origin.startsWith('vscode-webview://') ||
    origin.startsWith('app://') ||
    origin.startsWith('file://')
  );
}

async function startBridgeServer(port = BRIDGE_PORT) {
  let guardian = null;

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Forbidden cross-origin request' }));
      return;
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (url.pathname === '/apply') {
      const rawKey = url.searchParams.get('theme') || '';
      const themeKey = rawKey.toLowerCase();
      console.log(`[BridgeServer] Applying theme: ${themeKey}`);
      try {
        if (themeKey === 'stock' || themeKey === 'default' || !themeKey) {
          await purgeActiveThemes(true);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, theme: 'stock', mode: 'stock-default' }));
          return;
        }

        // Purge only prior interactive media overlays; keep #agy-style-active-theme intact!
        await purgeActiveThemes(false);

        if (hasExternalTheme(themeKey)) {
          const out = await runExternalThemeScript(themeKey);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, theme: themeKey, output: out }));
        } else {
          // Ensure the active CSS-only theme stylesheet remains mounted
          try {
            const p = getDevToolsPort();
            const ws = await getTargetPageWsUrl(p);
            await evaluateInBrowser(ws, `window.AgyThemeManager ? window.AgyThemeManager._ensureActiveStylesheetMounted() : false`);
          } catch (_) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, theme: themeKey, mode: 'css-only' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    } else if (url.pathname === '/inject-theme') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST with JSON body.' }));
        return;
      }
      try {
        const raw = await readRequestBody(req);
        const parsed = raw ? JSON.parse(raw) : {};
        const css = parsed.css || '';
        const name = parsed.name || 'Custom AI Theme';
        const created = await injectCustomTheme(css, name, { allowFilePath: false });
        if (guardian) await guardian.refreshPreloadScript();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...created }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    } else if (url.pathname === '/persona') {
      try {
        if (req.method === 'POST') {
          const raw = await readRequestBody(req);
          const payload = raw ? JSON.parse(raw) : {};
          const saved = savePersonaToDisk(payload);
          if (guardian) await guardian.refreshPreloadScript();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...saved }));
        } else {
          const current = readInitialPersona(ROOT_DIR);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(current));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    } else if (url.pathname === '/reset') {
      try {
        await reset();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    } else if (url.pathname === '/open') {
      try {
        const tab = url.searchParams.get('tab') || 'themes';
        const p = getDevToolsPort();
        const ws = await getTargetPageWsUrl(p);
        const evalRes = await evaluateInBrowser(ws, `window.AgyOpenAntiPersonality ? window.AgyOpenAntiPersonality(${JSON.stringify(tab)}) : false`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, opened: evalRes, tab }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    } else if (url.pathname === '/themes') {
      const themesDir = path.join(ROOT_DIR, 'themes');
      const diskThemes = fs.existsSync(themesDir)
        ? fs.readdirSync(themesDir).filter(f => f.endsWith('.theme.css')).map(f => f.replace(/\.theme\.css$/, ''))
        : [];
      const merged = Array.from(new Set(Object.keys(EXTERNAL_THEME_SCRIPTS).concat(diskThemes)));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ themes: merged }));
    } else if (url.pathname === '/status') {
      try {
        const stat = await status();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stat));
      } catch (_) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ alive: true, bridge: true, version: '3.1.0' }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[AntiPersonality] Port ${port} is already bound by an active daemon. Exiting duplicate server instance.`);
      process.exit(0);
    } else {
      console.error(`[AntiPersonality] Bridge server error:`, err.message);
    }
  });

  // Bind port FIRST before starting persistent CDP guardian & file watchers
  server.listen(port, '127.0.0.1', () => {
    guardian = startPersistentCdpGuardian();
    startHotReloadWatcher(guardian);
    console.log(`[AntiPersonality] v3.1 Bridge Server, Auto-Heal Guardian & Hot-Reload Watcher listening on http://127.0.0.1:${port}`);
  });
}

// CLI Routing
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'install';

  try {
    switch (command) {
      case 'install':
      case 'inject':
        await install();
        break;
      case 'open': {
        const tab = args[1] || 'themes';
        const p = getDevToolsPort();
        const ws = await getTargetPageWsUrl(p);
        const evalRes = await evaluateInBrowser(ws, `window.AgyOpenAntiPersonality ? window.AgyOpenAntiPersonality(${JSON.stringify(tab)}) : false`);
        console.log(`[AntiPersonality] Open request (${tab}):`, evalRes);
        break;
      }
      case 'inject-theme': {
        const cssOrFile = args[1];
        const themeName = args[2] || 'Custom AI Theme';
        if (!cssOrFile) {
          throw new Error('Usage: node injector.js inject-theme "<css-or-filepath>" "[ThemeName]"');
        }
        const created = await injectCustomTheme(cssOrFile, themeName, { allowFilePath: true });
        console.log(`[AntiPersonality] Injected & saved custom theme "${created.name}" (${created.id}) -> ${created.filePath}`);
        break;
      }
      case 'apply':
      case 'theme': {
        const themeKey = (args[1] || '').toLowerCase();
        if (!themeKey) throw new Error('Usage: node injector.js apply <capri|prescript|eldritch|moonlit|black-shores|amoled|stock>');
        if (themeKey === 'stock' || themeKey === 'default') {
          await reset();
        } else {
          await purgeActiveThemes(false);
          const p = getDevToolsPort();
          const ws = await getTargetPageWsUrl(p);
          await evaluateInBrowser(ws, `window.AgyThemeManager ? window.AgyThemeManager.enableTheme(${JSON.stringify(themeKey)}, true, true) : false`);
          if (hasExternalTheme(themeKey)) {
            await runExternalThemeScript(themeKey);
          }
        }
        break;
      }
      case 'server':
      case 'daemon': {
        await install({ skipPreload: true });
        await startBridgeServer();
        break;
      }
      case 'status':
        await status();
        break;
      case 'reset':
        await reset();
        break;
      case 'watch': {
        await install({ skipPreload: true });
        const guardian = startPersistentCdpGuardian();
        startHotReloadWatcher(guardian);
        console.log(`[AntiPersonality] Watching core/, plugins/, themes/*.theme.css, and persona JSON (150ms debounce)... Press Ctrl+C to stop.`);
        break;
      }
      default:
        console.log(`Usage: node injector.js [install|open [tab]|inject-theme <css> [name]|apply <theme>|server|status|reset|watch]`);
        break;
    }
  } catch (err) {
    console.error(`[AntiPersonality] Error:`, err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
