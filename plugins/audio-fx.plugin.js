/**
 * @name AudioFX
 * @author AntiPersonality Team
 * @version 3.1.0
 * @description WebAudio synthesized procedural sound effects and tactile UI foley (toggles, theme compile swells, mechanical CSS key thocks) with warm Biquad filtering and live RMS telemetry.
 */

class AudioFxPlugin {
  getName() { return "AudioFX"; }

  constructor() {
    this.audioCtx = null;
    this._masterGain = null;
    this._analyser = null;
    this._rmsBins = null;
    this._rmsRaf = null;
    this._rmsUntil = 0;
    this._running = false;
    this._startTimer = null;
    this._tempCloseTimer = null;
    this._soundListener = null;
    this._autoSfxListener = null;
    this._pointerFoley = null;
    this._keyFoley = null;
    this._lastAutoAt = 0;
    this._lastKeyAt = 0;
    this._noiseBuffer = null;
    this._settings = {
      profile: 'minimal-glass',
      volume: 0.5,
      muted: false,
      playOnFinish: true,
      playOnError: true,
      playOnApproval: true,
      playUiFoley: true
    };
  }

  start() {
    this._running = true;
    this._loadSettings();

    this._soundListener = (e) => {
      if (!this._running) return;
      const type = e.detail?.type || 'finish';
      if (type === 'finish' && this._settings.playOnFinish) this.playFinishChime();
      else if (type === 'error' && this._settings.playOnError) this.playErrorTone();
      else if (type === 'approval' && this._settings.playOnApproval) this.playApprovalTap();
      else if (type === 'toggle-on' && this._settings.playUiFoley) this.playToggle(true);
      else if (type === 'toggle-off' && this._settings.playUiFoley) this.playToggle(false);
      else if (type === 'theme-compile' && this._settings.playUiFoley) this.playThemeCompile();
      else if (type === 'overdrive') {
        this.playThemeCompile();
        this.playFinishChime();
      }
    };
    window.addEventListener('agy:sound', this._soundListener);

    // Subscribe to unified AgyApi.Telemetry instead of running a duplicate body MutationObserver
    this._autoSfxListener = (e) => {
      if (!this._running) return;
      const now = Date.now();
      if (now - this._lastAutoAt < 1200) return;
      this._lastAutoAt = now;
      const type = e.detail?.type;
      if (type === 'finish' && this._settings.playOnFinish) this.playFinishChime();
      else if (type === 'error' && this._settings.playOnError) this.playErrorTone();
      else if (type === 'approval' && this._settings.playOnApproval) this.playApprovalTap();
    };
    window.addEventListener('agy:auto-sfx', this._autoSfxListener);

    this._pointerFoley = (e) => {
      if (!this._running || !this._settings.playUiFoley || e.button !== 0) return;
      const t = e.target;
      if (!t || !t.closest) return;
      const sw = t.closest('.agy-switch-toggle');
      if (sw) {
        const willBeOn = sw.getAttribute('aria-checked') !== 'true';
        this.playToggle(willBeOn);
        return;
      }
      if (t.closest('[data-agy-tab]')) {
        this.playToggle(true, 0.55);
      }
    };
    document.addEventListener('pointerdown', this._pointerFoley, { capture: true, passive: true });

    this._keyFoley = (e) => {
      if (!this._running || !this._settings.playUiFoley) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (!t || t.id !== 'agy-custom-css-editor') return;
      const now = performance.now();
      if (now - this._lastKeyAt < 28) return;
      this._lastKeyAt = now;
      this.playKeyThock(e.key);
    };
    document.addEventListener('keydown', this._keyFoley, { capture: true, passive: true });

    if (!this._settings.muted && (this._settings.volume ?? 0.5) > 0.001) {
      this._startTimer = setTimeout(() => {
        this._startTimer = null;
        if (this._running) this.playFinishChime();
      }, 280);
    }
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('AudioFX', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('AudioFX', 'settings', this._settings);
    } catch (_) {}
  }

  _ensureAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
        this._masterGain = this.audioCtx.createGain();
        this._analyser = this.audioCtx.createAnalyser();
        this._analyser.fftSize = 32;
        this._rmsBins = new Uint8Array(this._analyser.frequencyBinCount);
        this._masterGain.connect(this._analyser);
        this._analyser.connect(this.audioCtx.destination);
        this._noiseBuffer = null;
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (!this._running) {
        if (this._tempCloseTimer) clearTimeout(this._tempCloseTimer);
        this._tempCloseTimer = setTimeout(() => {
          this._tempCloseTimer = null;
          if (!this._running && this.audioCtx) {
            try { this.audioCtx.close(); } catch (_) {}
            this.audioCtx = null;
            this._masterGain = null;
            this._analyser = null;
          }
        }, 900);
      }
      return this.audioCtx;
    } catch (_) {
      return null;
    }
  }

  _pulseRmsWindow(durationMs) {
    if (!this._analyser || !this._rmsBins) return;
    this._rmsUntil = Math.max(this._rmsUntil, performance.now() + durationMs + 60);
    if (this._rmsRaf !== null) return;

    const tick = () => {
      if (!this._analyser || performance.now() > this._rmsUntil) {
        this._rmsRaf = null;
        document.documentElement?.style.setProperty('--agy-audio-rms', '0');
        return;
      }
      this._analyser.getByteTimeDomainData(this._rmsBins);
      let sum = 0;
      for (let i = 0; i < this._rmsBins.length; i++) {
        const v = (this._rmsBins[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.min(1, Math.sqrt(sum / this._rmsBins.length) * 4.5);
      document.documentElement?.style.setProperty('--agy-audio-rms', rms.toFixed(3));
      this._rmsRaf = requestAnimationFrame(tick);
    };
    this._rmsRaf = requestAnimationFrame(tick);
  }

  _getSafeVolume(multiplier) {
    if (this._settings.muted) return 0;
    const raw = Number(this._settings.volume ?? 0.5);
    if (!Number.isFinite(raw) || raw <= 0.001) return 0;
    return Math.max(0.0002, Math.min(1, raw) * multiplier);
  }

  playFinishChime() {
    const vol = this._getSafeVolume(0.15);
    if (vol <= 0) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this._masterGain) return;

    const now = ctx.currentTime;
    const profile = this._settings.profile || 'minimal-glass';

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(profile === 'cyberpunk' ? 2400 : 3400, now);
    lp.frequency.exponentialRampToValueAtTime(900, now + 0.62);
    lp.Q.value = profile === 'cyberpunk' ? 3.2 : 1.2;
    lp.connect(this._masterGain);

    const notes = [
      { freq: 587.33, start: 0, dur: 0.24 },     // D5
      { freq: 880.00, start: 0.075, dur: 0.28 }, // A5
      { freq: 1174.66, start: 0.15, dur: 0.48 }  // D6
    ];

    notes.forEach((n, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (profile === 'cyberpunk') osc.type = 'sawtooth';
      else if (profile === 'marimba') osc.type = 'triangle';
      else if (profile === '8bit') osc.type = 'square';
      else osc.type = 'sine';

      osc.frequency.setValueAtTime(n.freq, now + n.start);
      osc.detune.value = (idx - 1) * 4;

      gain.gain.setValueAtTime(0.0002, now + n.start);
      gain.gain.exponentialRampToValueAtTime(vol, now + n.start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(lp);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.01);
    });
    this._pulseRmsWindow(650);
  }

  playErrorTone() {
    const vol = this._getSafeVolume(0.18);
    if (vol <= 0) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this._masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(138.59, now + 0.24); // C#3

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(980, now);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.26);
    lp.Q.value = 2.6;

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);

    osc.connect(lp).connect(gain).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
    this._pulseRmsWindow(280);
  }

  playApprovalTap() {
    const vol = this._getSafeVolume(0.14);
    if (vol <= 0) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this._masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(lp).connect(gain).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
    this._pulseRmsWindow(160);
  }

  playToggle(isOn = true, scale = 1) {
    const vol = this._getSafeVolume(0.11 * scale);
    if (vol <= 0) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this._masterGain) return;

    const t = ctx.currentTime;
    const body = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    body.type = 'triangle';
    body.frequency.setValueAtTime(isOn ? 1420 : 960, t);
    body.frequency.exponentialRampToValueAtTime(isOn ? 270 : 150, t + 0.016);

    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isOn ? 1750 : 1080, t);
    bp.Q.value = 2.2;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

    body.connect(bp).connect(gain).connect(this._masterGain);
    body.start(t);
    body.stop(t + 0.02);
  }

  playThemeCompile() {
    const vol = this._getSafeVolume(0.08);
    if (vol <= 0) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this._masterGain) return;

    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(190, t);
    lp.frequency.exponentialRampToValueAtTime(2200, t + 0.2);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.58);
    lp.Q.value = 3.8;
    lp.connect(this._masterGain);

    [220, 329.63, 440.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 2 ? 'sawtooth' : 'sine';
      osc.detune.value = (i - 1) * 5;
      osc.frequency.setValueAtTime(freq, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);

      osc.connect(g).connect(lp);
      osc.start(t);
      osc.stop(t + 0.6);
    });
    this._pulseRmsWindow(600);
  }

  playKeyThock(key = '') {
    const vol = this._getSafeVolume(0.085);
    if (vol <= 0) return;
    const ctx = this._ensureAudioContext();
    if (!ctx || !this._masterGain) return;

    if (!this._noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.014);
      this._noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.24));
      }
    }

    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const baseFreq = (key === 'Enter' || key === ' ' || key === 'Tab') ? 500 : 760;
    lp.frequency.setValueAtTime(baseFreq + (Math.random() - 0.5) * 120, t);
    lp.Q.value = 1.7;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.013);

    src.connect(lp).connect(g).connect(this._masterGain);
    src.start(t);
  }

  stop() {
    this._running = false;
    if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
    if (this._tempCloseTimer) { clearTimeout(this._tempCloseTimer); this._tempCloseTimer = null; }
    if (this._rmsRaf !== null) {
      cancelAnimationFrame(this._rmsRaf);
      this._rmsRaf = null;
      document.documentElement?.style.setProperty('--agy-audio-rms', '0');
    }
    if (this._soundListener) {
      window.removeEventListener('agy:sound', this._soundListener);
      this._soundListener = null;
    }
    if (this._autoSfxListener) {
      window.removeEventListener('agy:auto-sfx', this._autoSfxListener);
      this._autoSfxListener = null;
    }
    if (this._pointerFoley) {
      document.removeEventListener('pointerdown', this._pointerFoley, true);
      this._pointerFoley = null;
    }
    if (this._keyFoley) {
      document.removeEventListener('keydown', this._keyFoley, true);
      this._keyFoley = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (_) {}
      this.audioCtx = null;
      this._masterGain = null;
      this._analyser = null;
      this._noiseBuffer = null;
    }
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-afx-set-';
    const volNum = Number.isFinite(Number(this._settings.volume)) ? Number(this._settings.volume) : 0.5;

    const renderSwitch = (id, label, desc, checked) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">${label}</div>
          <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">${desc}</div>
        </div>
        <button id="${idPrefix}${id}" type="button" role="switch" aria-checked="${checked ? 'true' : 'false'}" class="agy-switch-toggle" style="
          width: 38px; height: 22px; border-radius: 999px;
          background: ${checked ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)'};
          border: 1px solid ${checked ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)'};
          position: relative; cursor: pointer; padding: 0; outline: none;
        ">
          <span class="agy-switch-thumb" style="
            position: absolute; top: 2px; left: 2px;
            width: 16px; height: 16px; border-radius: 50%;
            background: ${checked ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)'};
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></span>
        </button>
      </div>
    `;

    setTimeout(() => {
      const bindSwitch = (key, id) => {
        const btn = document.getElementById(idPrefix + id);
        if (!btn) return;
        btn.onclick = () => {
          this._settings[key] = !this._settings[key];
          this._saveSettings();
          const ch = Boolean(this._settings[key]);
          btn.setAttribute('aria-checked', ch ? 'true' : 'false');
          btn.style.background = ch ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
          btn.style.borderColor = ch ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
          const dot = btn.querySelector('.agy-switch-thumb');
          if (dot) {
            dot.style.background = ch ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
          }
        };
      };

      const profSel = document.getElementById(idPrefix + 'prof');
      if (profSel) {
        profSel.onchange = (e) => {
          this._settings.profile = e.target.value;
          this._saveSettings();
          this.playFinishChime();
        };
      }

      const volSlider = document.getElementById(idPrefix + 'vol');
      const volVal = document.getElementById(idPrefix + 'vol-val');
      if (volSlider && volVal) {
        volSlider.oninput = (e) => {
          const val = parseFloat(e.target.value);
          this._settings.volume = Number.isFinite(val) ? val : 0;
          volVal.textContent = `${Math.round(this._settings.volume * 100)}%`;
          this._saveSettings();
        };
      }

      bindSwitch('muted', 'mute');
      bindSwitch('playUiFoley', 'ui-foley');
      bindSwitch('playOnFinish', 'on-finish');
      bindSwitch('playOnError', 'on-error');
      bindSwitch('playOnApproval', 'on-approval');

      document.getElementById(idPrefix + 'btn-finish')?.addEventListener('click', () => this.playFinishChime());
      document.getElementById(idPrefix + 'btn-compile')?.addEventListener('click', () => this.playThemeCompile());
      document.getElementById(idPrefix + 'btn-error')?.addEventListener('click', () => this.playErrorTone());
      document.getElementById(idPrefix + 'btn-appr')?.addEventListener('click', () => this.playApprovalTap());
    }, 50);

    return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Sound Profile</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Filtered synthesizer tone color</div>
          </div>
          <select id="${idPrefix}prof" style="
            background: var(--background, #09090b); color: var(--foreground, #f4f4f5);
            border: 1px solid var(--border, rgba(255,255,255,0.15)); border-radius: 6px;
            padding: 4px 8px; font-size: 12px; outline: none;
          ">
            <option value="minimal-glass" ${this._settings.profile === 'minimal-glass' ? 'selected' : ''}>Minimal Glass (Sine)</option>
            <option value="cyberpunk" ${this._settings.profile === 'cyberpunk' ? 'selected' : ''}>Cyberpunk Pulse (Filtered Saw)</option>
            <option value="marimba" ${this._settings.profile === 'marimba' ? 'selected' : ''}>Soft Marimba (Triangle)</option>
            <option value="8bit" ${this._settings.profile === '8bit' ? 'selected' : ''}>Retro 8-Bit (Warm Square)</option>
          </select>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Master Volume</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Audio playback volume (0% to 100%)</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="range" id="${idPrefix}vol" min="0" max="1" step="0.05" value="${volNum}" style="width:100px; accent-color:var(--foreground, #f4f4f5); cursor:pointer;" />
            <span id="${idPrefix}vol-val" style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5); min-width:32px;">${Math.round(volNum * 100)}%</span>
          </div>
        </div>

        ${renderSwitch('mute', 'Mute Audio', 'Mute all sounds silently', Boolean(this._settings.muted))}
        ${renderSwitch('ui-foley', 'UI Tactile Foley', 'Micro-clicks on switches, theme compile swells, and CSS editor key thocks', this._settings.playUiFoley !== false)}
        ${renderSwitch('on-finish', 'Task Completion Chime', 'Play chime when agent finishes streaming a turn', this._settings.playOnFinish !== false)}
        ${renderSwitch('on-error', 'Error Alert Tone', 'Play warning tone when an error toast surfaces', this._settings.playOnError !== false)}
        ${renderSwitch('on-approval', 'Approval Prompt Tap', 'Play subtle tap when confirmation controls appear', this._settings.playOnApproval !== false)}

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0 4px 0;">
          <span style="font-size:12px; color:var(--muted-foreground, #71717a);">Test Synthesizer Audio:</span>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button id="${idPrefix}btn-finish" type="button" class="agy-btn" style="
              padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;
              background: var(--muted, #27272a); color: var(--foreground, #f4f4f5);
              border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;
            ">Finish</button>
            <button id="${idPrefix}btn-compile" type="button" class="agy-btn" style="
              padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;
              background: var(--muted, #27272a); color: var(--foreground, #f4f4f5);
              border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;
            ">Compile</button>
            <button id="${idPrefix}btn-error" type="button" class="agy-btn" style="
              padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;
              background: var(--muted, #27272a); color: var(--secondary-foreground, #e4e4e7);
              border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;
            ">Error</button>
            <button id="${idPrefix}btn-appr" type="button" class="agy-btn" style="
              padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500;
              background: var(--muted, #27272a); color: var(--foreground, #f4f4f5);
              border: 1px solid var(--border, rgba(255,255,255,0.1)); cursor: pointer;
            ">Approval</button>
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioFxPlugin;
}
