/**
 * AntiPersonality v3.1 Automated Smoke & Idempotency Verification Suite
 * Verifies bundle syntax, zero-emoji hygiene, 3x hot-reload idempotency,
 * Pillar A-D runtime capabilities, and non-destructive state restoration over live CDP.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { generateRuntimeBundle } = require('../core/bundle_runtime');

const ROOT_DIR = path.resolve(__dirname, '..');

function getDevToolsPort() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const portFile = path.join(appData, 'Antigravity', 'DevToolsActivePort');
  assert.ok(fs.existsSync(portFile), `DevToolsActivePort missing at ${portFile}`);
  const port = parseInt(fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/)[0], 10);
  assert.ok(Number.isFinite(port), 'Invalid DevTools port');
  return port;
}

async function getTargetPageWsUrl(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  assert.ok(res.ok, `Failed /json/list: ${res.status}`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && !t.url.startsWith('devtools://')) || targets.find(t => t.type === 'page');
  assert.ok(page && page.webSocketDebuggerUrl, 'No active Antigravity page target found');
  return page.webSocketDebuggerUrl;
}

function evalCdp(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error('CDP eval timeout'));
    }, 8000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== 1) return;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      if (msg.error) return reject(new Error(msg.error.message));
      if (msg.result && msg.result.exceptionDetails) {
        return reject(new Error(msg.result.exceptionDetails.text || JSON.stringify(msg.result.exceptionDetails)));
      }
      resolve(msg.result && msg.result.result ? msg.result.result.value : undefined);
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(err);
    };
  });
}

function checkZeroEmojis() {
  const dirs = ['core', 'plugins', 'themes'];
  const emojiRegex = /\p{Extended_Pictographic}/u;
  for (const sub of dirs) {
    const dirPath = path.join(ROOT_DIR, sub);
    if (!fs.existsSync(dirPath)) continue;
    for (const f of fs.readdirSync(dirPath)) {
      if (!/\.(js|css)$/.test(f)) continue;
      const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
      assert.equal(emojiRegex.test(content), false, `Unexpected emoji character found in ${sub}/${f}`);
    }
  }
}

function checkLegalAndPrivacyHygiene() {
  const requiredDocs = [
    'LICENSE',
    'PRIVACY.md',
    'COOKIE_STORAGE_POLICY.md',
    'TERMS.md',
    'SECURITY.md',
    '.gitignore'
  ];
  for (const doc of requiredDocs) {
    const full = path.join(ROOT_DIR, doc);
    assert.equal(fs.existsSync(full), true, `Missing required legal/compliance file: ${doc}`);
    assert.ok(fs.statSync(full).size > 80, `Compliance file appears empty: ${doc}`);
  }

  const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
  assert.equal(gitignore.includes('.agents/personality.json'), true, '.gitignore must exclude .agents/personality.json');
  assert.equal(gitignore.includes('*.mp4'), true, '.gitignore must exclude video media');
  assert.equal(gitignore.includes('!.agents/skills/antipersonality/'), true, '.gitignore must isolate third-party skills');

  const scanDirs = ['core', 'plugins', 'themes', 'ui', 'skills', 'templates', 'rules'];
  const piiOrTrackingRe = /(?:[A-Za-z]:\\Users\\|@gmail\.com|google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|@author\s+Project\s+Moon)/i;

  const checkFile = (relPath) => {
    const full = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return;
    const text = fs.readFileSync(full, 'utf8');
    assert.equal(piiOrTrackingRe.test(text), false, `Found hardcoded local path, PII, tracker, or false studio attribution in ${relPath}`);
  };

  ['injector.js', 'plugin.json', 'README.md', 'PRIVACY.md', 'TERMS.md', 'COOKIE_STORAGE_POLICY.md', 'SECURITY.md'].forEach(checkFile);
  for (const dir of scanDirs) {
    const absDir = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(absDir)) continue;
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(js|css|html|md|json)$/i.test(entry.name)) {
          checkFile(path.relative(ROOT_DIR, p));
        }
      }
    };
    walk(absDir);
  }
}

async function main() {
  console.log('[Smoke] 1/6 Checking bundle syntax, CSP hygiene, zero-emoji, and legal/privacy gate...');
  const bundle = generateRuntimeBundle({ silent: true });
  new vm.Script(bundle, { filename: 'antipersonality-runtime-v3.1.js' });
  assert.equal(/\beval\s*\(/.test(bundle), false, 'Bundle must not use eval()');
  assert.equal(/new\s+Function\s*\(/.test(bundle), false, 'Bundle must not use new Function()');
  checkZeroEmojis();
  checkLegalAndPrivacyHygiene();

  const port = getDevToolsPort();
  const wsUrl = await getTargetPageWsUrl(port);

  console.log('[Smoke] 2/5 Running 3x consecutive hot-reload idempotency check...');
  for (let i = 0; i < 3; i++) {
    const out = await evalCdp(wsUrl, bundle);
    assert.equal(out, 'AntiPersonality v3.1 successfully bundled and initialized!');
  }

  console.log('[Smoke] 3/5 Verifying Pillar A & C (Motion CSS, Toast cap, Modal, Telemetry, Plugins)...');
  const pillarAC = await evalCdp(wsUrl, `(() => {
    const countId = (id) => document.querySelectorAll('#' + id).length;
    const motionCount = countId('agy-style-core-motion');
    const delightCount = countId('agy-style-settings-delight');
    const guardCount = countId('agy-style-font-guardrails');

    // Toast cap at 4
    for (let i = 0; i < 6; i++) {
      window.AgyApi.UI.showToast('Smoke toast ' + i, { timeout: 5000 });
    }
    const toastBox = document.getElementById('agy-toast-container');
    const activeToasts = toastBox ? Array.from(toastBox.children).filter(el => el.dataset.dismissing !== '1').length : 0;

    // Non-blocking glass alert modal
    window.AgyApi.UI.alert('Smoke Title', 'Non-blocking check');
    const alertOverlay = document.getElementById('agy-alert-overlay');
    const modalMounted = Boolean(alertOverlay);
    const okBtn = alertOverlay ? alertOverlay.querySelector('button') : null;
    if (okBtn) okBtn.click();
    const modalDismissed = !document.getElementById('agy-alert-overlay');

    // Compile laser + particle burst
    window.AgyApi.UI.flashCompileBar();
    window.AgyApi.UI.spawnBurst(200, 200, '#38bdf8');
    const hasLaser = Boolean(document.getElementById('agy-hotreload-bar'));

    // Telemetry + Plugins
    const hasTelemetry = Boolean(window.AgyApi.Telemetry && typeof window.AgyApi.Telemetry.getState === 'function');
    const audioPlugin = window.AgyPluginManager.getPlugin('audio-fx');
    const logoPlugin = window.AgyPluginManager.getPlugin('custom-logo');

    // Clear smoke toasts
    if (toastBox) toastBox.innerHTML = '';

    return {
      motionCount,
      delightCount,
      guardCount,
      activeToasts,
      modalMounted,
      modalDismissed,
      hasLaser,
      hasTelemetry,
      themeCount: window.AgyThemeManager.getAllThemes().length,
      pluginCount: window.AgyPluginManager.getAllPlugins().length,
      hasFoleyMethods: Boolean(audioPlugin && audioPlugin.instance && typeof audioPlugin.instance.playToggle === 'function' && typeof audioPlugin.instance.playThemeCompile === 'function'),
      hasOverdriveMethod: Boolean(logoPlugin && logoPlugin.instance && typeof logoPlugin.instance._toggleOverdrive === 'function')
    };
  })()`);

  assert.equal(pillarAC.motionCount, 1, 'Duplicate #agy-style-core-motion');
  assert.equal(pillarAC.delightCount, 1, 'Duplicate #agy-style-settings-delight');
  assert.equal(pillarAC.guardCount, 1, 'Duplicate #agy-style-font-guardrails');
  assert.ok(pillarAC.activeToasts <= 4 && pillarAC.activeToasts >= 1, `Toast cap failed: ${pillarAC.activeToasts}`);
  assert.equal(pillarAC.modalMounted, true, 'Non-blocking alert modal did not mount');
  assert.equal(pillarAC.modalDismissed, true, 'Non-blocking alert modal did not dismiss');
  assert.equal(pillarAC.hasLaser, true, 'Compile laser bar missing');
  assert.equal(pillarAC.hasTelemetry, true, 'AgyApi.Telemetry missing');
  assert.ok(pillarAC.themeCount >= 6, `Expected >= 6 themes, got ${pillarAC.themeCount}`);
  assert.equal(pillarAC.pluginCount, 8, `Expected 8 plugins, got ${pillarAC.pluginCount}`);
  assert.equal(pillarAC.hasFoleyMethods, true, 'AudioFX v3.1 foley methods missing');
  assert.equal(pillarAC.hasOverdriveMethod, true, 'CustomLogo v3.1 overdrive method missing');

  console.log('[Smoke] 4/5 Verifying Pillar B & D (AMOLED zero-grain, Palette live preview/revert, Radial wheel)...');
  const pillarBD = await evalCdp(wsUrl, `(() => {
    const savedThemeId = window.AgyThemeManager.activeThemeId;

    // Non-destructive AMOLED preview + zero-grain check
    window.AgyThemeManager.previewTheme('amoled');
    const styleText = (document.getElementById('agy-style-active-theme') || {}).textContent || '';
    const amoledZeroGrain = /--agy-grain-opacity\\s*:\\s*0\\b/.test(styleText);
    const idUnchangedDuringPreview = window.AgyThemeManager.activeThemeId === savedThemeId;
    window.AgyThemeManager.restoreActiveThemeStyles();

    // CommandPalette open -> preview -> Escape revert
    window.AgyCommandPalette.open('capri');
    const paletteOpened = window.AgyCommandPalette.isOpen();
    window.AgyThemeManager.previewTheme('capri');
    window.AgyCommandPalette._previewed = true;
    window.AgyCommandPalette.close();
    const paletteClosed = !window.AgyCommandPalette.isOpen();
    const themeAfterCancel = window.AgyThemeManager.activeThemeId;

    // Radial Quick-Switch Wheel
    window.AgyRadialWheel.open(420, 320);
    const radialOpened = window.AgyRadialWheel.isOpen();
    const wedgeCount = document.querySelectorAll('[data-radial-wedge]').length;
    window.AgyRadialWheel._updateAim(500, 270);
    const aimedSlice = window.AgyRadialWheel._activeIndex;
    window.AgyRadialWheel.close();
    const radialClosed = !window.AgyRadialWheel.isOpen();

    // Verbosity specimen helper
    const specimenCheck = typeof window.__agyPreviewVerbosity === 'function';

    // Sidebar pill singleton check (if Settings modal happens to be open)
    const pillCount = document.querySelectorAll('#agy-sidebar-active-pill').length;

    return {
      amoledZeroGrain,
      idUnchangedDuringPreview,
      paletteOpened,
      paletteClosed,
      revertedCleanly: themeAfterCancel === savedThemeId,
      radialOpened,
      wedgeCount,
      aimedSlice,
      radialClosed,
      specimenCheck,
      pillCount
    };
  })()`);

  assert.equal(pillarBD.amoledZeroGrain, true, 'AMOLED theme must keep --agy-grain-opacity: 0');
  assert.equal(pillarBD.idUnchangedDuringPreview, true, 'previewTheme mutated activeThemeId');
  assert.equal(pillarBD.paletteOpened, true, 'CommandPalette failed to open');
  assert.equal(pillarBD.paletteClosed, true, 'CommandPalette failed to close');
  assert.equal(pillarBD.revertedCleanly, true, 'CommandPalette cancel mutated activeThemeId');
  assert.equal(pillarBD.radialOpened, true, 'Radial wheel failed to open');
  assert.equal(pillarBD.wedgeCount, 6, `Expected 6 radial wedges, got ${pillarBD.wedgeCount}`);
  assert.equal(pillarBD.aimedSlice, 1, `Expected radial slice 1 at (500,270) from (420,320), got ${pillarBD.aimedSlice}`);
  assert.equal(pillarBD.radialClosed, true, 'Radial wheel failed to close');
  assert.equal(pillarBD.specimenCheck, true, '__agyPreviewVerbosity missing');
  assert.ok(pillarBD.pillCount <= 1, `Duplicate #agy-sidebar-active-pill (${pillarBD.pillCount})`);

  console.log('[Smoke] 5/6 Checking Right-to-Erasure & WCAG focus-visible runtime hooks...');
  const legalRuntime = await evalCdp(wsUrl, `(() => {
    const motionCss = (document.getElementById('agy-style-core-motion') || {}).textContent || '';
    return {
      hasPurgeAll: Boolean(window.AgyApi && window.AgyApi.Data && typeof window.AgyApi.Data.purgeAll === 'function'),
      hasConfirm: Boolean(window.AgyApi && window.AgyApi.UI && typeof window.AgyApi.UI.confirm === 'function'),
      hasPurgeUiAction: typeof window.__agyPurgeLocalData === 'function',
      hasFocusVisible: motionCss.includes(':focus-visible')
    };
  })()`);
  assert.equal(legalRuntime.hasPurgeAll, true, 'AgyApi.Data.purgeAll missing');
  assert.equal(legalRuntime.hasConfirm, true, 'AgyApi.UI.confirm missing');
  assert.equal(legalRuntime.hasPurgeUiAction, true, '__agyPurgeLocalData missing');
  assert.equal(legalRuntime.hasFocusVisible, true, 'WCAG :focus-visible ring missing');

  console.log('[Smoke] 6/6 Checking HTTP Bridge (:51788/status)...');
  const bridgeRes = await fetch('http://127.0.0.1:51788/status');
  assert.equal(bridgeRes.ok, true, 'HTTP Bridge :51788/status unreachable');
  const bridgeJson = await bridgeRes.json();
  assert.equal(Boolean(bridgeJson.installed || bridgeJson.alive), true, 'HTTP Bridge reported unhealthy status');

  console.log('[Smoke] PASS: All AntiPersonality v3.1 runtime, accessibility & legal checks succeeded.');
}

main().catch((err) => {
  console.error('[Smoke] FAIL:', err);
  process.exit(1);
});
