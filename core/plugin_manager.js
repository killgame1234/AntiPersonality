/**
 * PluginManager v3.0.0: Manages client plugin registration, hot-swap lifecycle (start/stop),
 * partial-init rollback, automatic AgyApi.Patcher teardown, and isolated error boundaries.
 */

(function () {
  // Teardown any running instances from a previous bundle before hot-swapping
  if (window.AgyPluginManager && typeof window.AgyPluginManager._teardownForHotReload === 'function') {
    try {
      window.AgyPluginManager._teardownForHotReload();
    } catch (_) {}
  } else if (window.AgyPluginManager && window.AgyPluginManager.plugins) {
    for (const [id, p] of window.AgyPluginManager.plugins.entries()) {
      if (p && p.enabled && p.instance && typeof p.instance.stop === 'function') {
        try { p.instance.stop(); } catch (_) {}
      }
      if (window.AgyApi && window.AgyApi.Patcher) {
        try { window.AgyApi.Patcher.unpatchAll(id); } catch (_) {}
      }
    }
  }

  class PluginManager {
    constructor() {
      this.plugins = new Map(); // id -> { id, meta, instance, enabled }
    }

    registerPlugin(id, meta, pluginClassOrInstance) {
      if (this.plugins.has(id)) {
        const prev = this.plugins.get(id);
        if (prev.enabled && prev.instance && typeof prev.instance.stop === 'function') {
          try { prev.instance.stop(); } catch (_) {}
        }
        if (window.AgyApi && window.AgyApi.Patcher) {
          try { window.AgyApi.Patcher.unpatchAll(id); } catch (_) {}
        }
      }

      const instance = typeof pluginClassOrInstance === 'function'
        ? new pluginClassOrInstance()
        : pluginClassOrInstance;

      this.plugins.set(id, {
        id,
        meta,
        instance,
        enabled: false
      });
    }

    getAllPlugins() {
      return Array.from(this.plugins.values());
    }

    getPlugin(id) {
      return this.plugins.get(id);
    }

    enablePlugin(id, showToastNotification = true) {
      const p = this.plugins.get(id);
      if (!p) {
        console.warn(`[PluginManager] Plugin ${id} not found.`);
        return false;
      }
      if (p.enabled) return true;

      try {
        if (typeof p.instance.start === 'function') {
          p.instance.start();
        }
        p.enabled = true;
        AgyApi.Data.save('PluginManager', `plugin:${id}`, true);

        if (showToastNotification) {
          AgyApi.UI.showToast(`Plugin enabled: ${p.meta.name}`, { type: 'success' });
        }
        this._emitChange();
        return true;
      } catch (err) {
        console.error(`[PluginManager] Error starting plugin ${id}:`, err);
        // Clean up any half-mounted styles, observers, or listeners before aborting
        try {
          if (p.instance && typeof p.instance.stop === 'function') {
            p.instance.stop();
          }
        } catch (_) {}
        if (window.AgyApi && window.AgyApi.Patcher) {
          try { window.AgyApi.Patcher.unpatchAll(id); } catch (_) {}
        }
        p.enabled = false;
        AgyApi.UI.showToast(`Error starting ${p.meta.name}: ${err.message}`, { type: 'error' });
        return false;
      }
    }

    disablePlugin(id, showToastNotification = true) {
      const p = this.plugins.get(id);
      if (!p || !p.enabled) return false;

      try {
        if (typeof p.instance.stop === 'function') {
          p.instance.stop();
        }
      } catch (err) {
        console.error(`[PluginManager] Error stopping plugin ${id}:`, err);
      }

      if (window.AgyApi && window.AgyApi.Patcher) {
        try { window.AgyApi.Patcher.unpatchAll(id); } catch (_) {}
      }

      p.enabled = false;
      AgyApi.Data.save('PluginManager', `plugin:${id}`, false);

      if (showToastNotification) {
        AgyApi.UI.showToast(`Plugin disabled: ${p.meta.name}`, { type: 'info' });
      }
      this._emitChange();
      return true;
    }

    togglePlugin(id) {
      const p = this.plugins.get(id);
      if (!p) return false;
      return p.enabled ? this.disablePlugin(id) : this.enablePlugin(id);
    }

    init() {
      for (const [id] of this.plugins.entries()) {
        const isEnabled = AgyApi.Data.load('PluginManager', `plugin:${id}`, false);
        if (isEnabled) {
          this.enablePlugin(id, false);
        }
      }
    }

    _teardownForHotReload() {
      for (const [id, p] of this.plugins.entries()) {
        if (p.enabled && p.instance && typeof p.instance.stop === 'function') {
          try { p.instance.stop(); } catch (_) {}
        }
        if (window.AgyApi && window.AgyApi.Patcher) {
          try { window.AgyApi.Patcher.unpatchAll(id); } catch (_) {}
        }
      }
    }

    _emitChange() {
      window.dispatchEvent(new CustomEvent('agy:plugin-change'));
    }
  }

  const manager = new PluginManager();
  window.AgyPluginManager = manager;
  if (window.AgyApi) window.AgyApi.Plugins = manager;
})();
