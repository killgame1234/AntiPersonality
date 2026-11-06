/**
 * @name ImageUtilities & Zoom
 * @author AntiPersonality Team
 * @version 3.0.0
 * @description Professional lightbox overlay for chat images and diagrams with smooth focal zoom, click-drag pan, rotations, flips, PNG clipboard conversion, and keyboard navigation.
 */

class ImageZoomPlugin {
  getName() { return "ImageUtilities & Zoom"; }

  constructor() {
    this._clickHandler = null;
    this._keyHandler = null;
    this._cleanupMouseListeners = null;
    this._settings = {
      zoomSensitivity: 0.15,
      backdropBlur: true,
      doubleClickZoom: 2.5
    };
  }

  start() {
    this._loadSettings();

    const css = `
      #agy-image-zoom-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        user-select: none;
        overflow: hidden;
      }
      #agy-image-zoom-overlay.agy-blur-bg {
        backdrop-filter: blur(16px);
      }
      .agy-zoom-viewport {
        flex: 1;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        cursor: grab;
      }
      .agy-zoom-viewport.agy-dragging {
        cursor: grabbing !important;
      }
      .agy-zoom-img-wrapper {
        position: relative;
        display: inline-block;
        transition: transform 0.05s linear;
        transform-origin: center center;
      }
      .agy-zoom-img {
        max-width: 85vw;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
        pointer-events: none;
        display: block;
      }
      .agy-zoom-dock {
        position: absolute;
        bottom: 24px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--card, rgba(24, 24, 27, 0.9));
        border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
        border-radius: 999px;
        padding: 5px 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(12px);
        z-index: 1000000;
      }
      .agy-zoom-btn {
        background: var(--muted, rgba(255, 255, 255, 0.08));
        border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
        border-radius: 999px;
        color: var(--foreground, #f4f4f5);
        padding: 4px 10px;
        font-size: 11.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        outline: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        line-height: 1.3;
      }
      .agy-zoom-btn:hover {
        background: var(--sidebar-secondary, rgba(255, 255, 255, 0.18));
        border-color: var(--border, rgba(255, 255, 255, 0.3));
        color: var(--foreground, #f4f4f5);
      }
      .agy-zoom-indicator {
        font-size: 11px;
        font-weight: 600;
        color: var(--muted-foreground, #a1a1aa);
        min-width: 48px;
        text-align: center;
        user-select: none;
      }
    `;
    AgyApi.DOM.addStyle('plugin-image-zoom', css);

    this._clickHandler = (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const img = e.target && typeof e.target.closest === 'function' ? e.target.closest('img') : null;
      if (!img || !img.src) return;

      // Never hijack interactive controls, dialogs, sidebars, editors, or avatars
      if (img.closest('#agy-image-zoom-overlay, a, button, [role="button"], [role="dialog"], [role="menuitem"], nav, aside, header, .monaco-editor, .xterm, [data-no-zoom]')) {
        return;
      }
      if (img.classList.contains('rounded-full') || img.getAttribute('data-testid') === 'avatar') {
        return;
      }

      const rect = img.getBoundingClientRect();
      if (rect.width < 64 || rect.height < 64) return;

      e.preventDefault();
      e.stopPropagation();

      this._openLightbox(img.currentSrc || img.src);
    };

    document.addEventListener('click', this._clickHandler, true);
  }

  _loadSettings() {
    try {
      const saved = AgyApi.Data.load('ImageZoom', 'settings', null);
      if (saved && typeof saved === 'object') {
        this._settings = Object.assign(this._settings, saved);
      }
    } catch (_) {}
  }

  _saveSettings() {
    try {
      AgyApi.Data.save('ImageZoom', 'settings', this._settings);
    } catch (_) {}
  }

  _openLightbox(src) {
    this._closeLightbox();

    let scale = 1.0;
    let translateX = 0;
    let translateY = 0;
    let rotation = 0;
    let flipH = false;
    let isDragging = false;
    let dragMoved = false;
    let downX = 0;
    let downY = 0;
    let startX = 0;
    let startY = 0;

    const overlay = document.createElement('div');
    overlay.id = 'agy-image-zoom-overlay';
    if (this._settings.backdropBlur) {
      overlay.classList.add('agy-blur-bg');
    }

    overlay.innerHTML = `
      <div class="agy-zoom-viewport">
        <div class="agy-zoom-img-wrapper"></div>
      </div>
      <div class="agy-zoom-dock">
        <button class="agy-zoom-btn" id="agy-btn-zoomout" title="Zoom Out (-)">-</button>
        <button class="agy-zoom-btn" id="agy-btn-reset" title="Reset View (0)">
          <span class="agy-zoom-indicator" id="agy-zoom-pct">100%</span>
        </button>
        <button class="agy-zoom-btn" id="agy-btn-zoomin" title="Zoom In (+)">+</button>
        <div style="width:1px; height:14px; background:var(--border, rgba(255,255,255,0.15)); margin:0 2px;"></div>
        <button class="agy-zoom-btn" id="agy-btn-rotate" title="Rotate 90 deg CW (R)">Rotate</button>
        <button class="agy-zoom-btn" id="agy-btn-flip" title="Flip Horizontal (F)">Flip</button>
        <button class="agy-zoom-btn" id="agy-btn-copy" title="Copy Image to Clipboard (C)">Copy</button>
        <button class="agy-zoom-btn" id="agy-btn-download" title="Save Image (S)">Save</button>
        <button class="agy-zoom-btn" id="agy-btn-close" title="Close Lightbox (Esc)">Close</button>
      </div>
    `;

    const viewport = overlay.querySelector('.agy-zoom-viewport');
    const wrapper = overlay.querySelector('.agy-zoom-img-wrapper');
    const pctEl = overlay.querySelector('#agy-zoom-pct');

    // Safe DOM construction prevents attribute-breakout XSS on data: or custom URLs
    const imgEl = document.createElement('img');
    imgEl.className = 'agy-zoom-img';
    imgEl.alt = 'Zoom View';
    imgEl.draggable = false;
    imgEl.src = String(src || '');
    wrapper.appendChild(imgEl);

    document.body.appendChild(overlay);

    const updateTransform = () => {
      const flipScale = flipH ? -1 : 1;
      wrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale * flipScale}, ${scale}) rotate(${rotation}deg)`;
      if (pctEl) {
        pctEl.textContent = `${Math.round(scale * 100)}%`;
      }
    };

    // 1. Smooth Focal Wheel Zoom
    viewport.onwheel = (e) => {
      e.preventDefault();
      const sensitivity = Number(this._settings.zoomSensitivity) || 0.15;
      const prevScale = scale;
      const factor = e.deltaY < 0 ? (1 + sensitivity) : (1 / (1 + sensitivity));
      const nextScale = Math.min(Math.max(0.3, scale * factor), 8.0);

      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);

      translateX -= (cx - translateX) * (nextScale / prevScale - 1);
      translateY -= (cy - translateY) * (nextScale / prevScale - 1);
      scale = nextScale;
      updateTransform();
    };

    // 2. Pan Drag + Backdrop Click-to-Close
    viewport.onmousedown = (e) => {
      if (e.button !== 0 || e.target.closest('.agy-zoom-dock')) return;
      isDragging = true;
      dragMoved = false;
      downX = e.clientX;
      downY = e.clientY;
      viewport.classList.add('agy-dragging');
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
    };

    const mouseMoveHandler = (e) => {
      if (!isDragging) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) {
        dragMoved = true;
      }
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    };

    const mouseUpHandler = () => {
      if (isDragging) {
        isDragging = false;
        viewport.classList.remove('agy-dragging');
      }
    };

    viewport.onclick = (e) => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      if (e.target === viewport || e.target === overlay) {
        this._closeLightbox();
      }
    };

    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    // 3. Double-Click Toggle
    viewport.ondblclick = (e) => {
      if (e.target.closest('.agy-zoom-dock')) return;
      const targetZoom = Number(this._settings.doubleClickZoom) || 2.5;
      if (scale > 1.1) {
        scale = 1.0;
        translateX = 0;
        translateY = 0;
      } else {
        scale = targetZoom;
      }
      updateTransform();
    };

    // 4. Buttons
    overlay.querySelector('#agy-btn-zoomin').onclick = (e) => {
      e.stopPropagation();
      scale = Math.min(8.0, scale * 1.25);
      updateTransform();
    };

    overlay.querySelector('#agy-btn-zoomout').onclick = (e) => {
      e.stopPropagation();
      scale = Math.max(0.3, scale / 1.25);
      updateTransform();
    };

    overlay.querySelector('#agy-btn-reset').onclick = (e) => {
      e.stopPropagation();
      scale = 1.0;
      translateX = 0;
      translateY = 0;
      rotation = 0;
      flipH = false;
      updateTransform();
    };

    overlay.querySelector('#agy-btn-rotate').onclick = (e) => {
      e.stopPropagation();
      rotation = (rotation + 90) % 360;
      updateTransform();
    };

    overlay.querySelector('#agy-btn-flip').onclick = (e) => {
      e.stopPropagation();
      flipH = !flipH;
      updateTransform();
    };

    overlay.querySelector('#agy-btn-close').onclick = (e) => {
      e.stopPropagation();
      this._closeLightbox();
    };

    // 5. Copy Image (with PNG canvas normalization for JPEG/WebP/SVG)
    const toPngBlobFromElement = () => new Promise((resolve, reject) => {
      try {
        const w = imgEl.naturalWidth || imgEl.width;
        const h = imgEl.naturalHeight || imgEl.height;
        if (!w || !h) return reject(new Error('Image not loaded'));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, w, h);
        canvas.toBlob((b) => {
          canvas.width = 0;
          canvas.height = 0;
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    });

    const copyImage = async () => {
      try {
        let pngBlob = null;
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          if (blob.type === 'image/png') {
            pngBlob = blob;
          }
        } catch (_) {}
        if (!pngBlob) {
          pngBlob = await toPngBlobFromElement();
        }
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        AgyApi.UI.showToast('Image copied to clipboard', { type: 'success' });
      } catch (_) {
        try {
          await navigator.clipboard.writeText(src);
          AgyApi.UI.showToast('Image URL copied to clipboard', { type: 'success' });
        } catch (_) {
          AgyApi.UI.showToast('Copy failed', { type: 'error' });
        }
      }
    };
    overlay.querySelector('#agy-btn-copy').onclick = (e) => {
      e.stopPropagation();
      copyImage();
    };

    // 6. Download / Save via Blob URL so cross-origin links never navigate the Electron window
    const saveImage = async () => {
      let blobUrl = null;
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `antigravity-visual-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        AgyApi.UI.showToast('Image download started', { type: 'info' });
      } catch (_) {
        try {
          const pngBlob = await toPngBlobFromElement();
          blobUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `antigravity-visual-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          AgyApi.UI.showToast('Image download started', { type: 'info' });
        } catch (_) {
          AgyApi.UI.showToast('Unable to download image directly', { type: 'error' });
        }
      } finally {
        if (blobUrl) {
          setTimeout(() => {
            try { URL.revokeObjectURL(blobUrl); } catch (_) {}
          }, 5000);
        }
      }
    };
    overlay.querySelector('#agy-btn-download').onclick = (e) => {
      e.stopPropagation();
      saveImage();
    };

    // 7. Capture-Phase Keyboard Navigation (isolates Escape & hotkeys from underlying UI)
    this._keyHandler = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.altKey || e.metaKey) return;
      if (e.ctrlKey && e.key.toLowerCase() !== 'c') return;

      let handled = true;
      switch (e.key) {
        case 'Escape':
          this._closeLightbox();
          break;
        case '+':
        case '=':
          scale = Math.min(8.0, scale * 1.25);
          updateTransform();
          break;
        case '-':
        case '_':
          scale = Math.max(0.3, scale / 1.25);
          updateTransform();
          break;
        case '0':
          scale = 1.0;
          translateX = 0;
          translateY = 0;
          rotation = 0;
          flipH = false;
          updateTransform();
          break;
        case 'r':
        case 'R':
          rotation = (rotation + 90) % 360;
          updateTransform();
          break;
        case 'f':
        case 'F':
          flipH = !flipH;
          updateTransform();
          break;
        case 'c':
        case 'C':
          copyImage();
          break;
        case 's':
        case 'S':
          saveImage();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', this._keyHandler, true);

    this._cleanupMouseListeners = () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      window.removeEventListener('mouseup', mouseUpHandler);
    };
  }

  _closeLightbox() {
    const el = document.getElementById('agy-image-zoom-overlay');
    if (el) el.remove();
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    if (this._cleanupMouseListeners) {
      this._cleanupMouseListeners();
      this._cleanupMouseListeners = null;
    }
  }

  stop() {
    this._closeLightbox();
    if (this._clickHandler) {
      document.removeEventListener('click', this._clickHandler, true);
      this._clickHandler = null;
    }
    AgyApi.DOM.removeStyle('plugin-image-zoom');
  }

  getSettingsPanel() {
    this._loadSettings();
    const idPrefix = 'agy-iz-set-';
    const sensValNum = Number(this._settings.zoomSensitivity) || 0.15;
    const dblValNum = Number(this._settings.doubleClickZoom) || 2.5;

    setTimeout(() => {
      const sensInput = document.getElementById(idPrefix + 'sens');
      const sensVal = document.getElementById(idPrefix + 'sens-val');
      if (sensInput && sensVal) {
        sensInput.oninput = (e) => {
          const val = parseFloat(e.target.value);
          this._settings.zoomSensitivity = val;
          sensVal.textContent = val.toFixed(2);
          this._saveSettings();
        };
      }

      const blurBtn = document.getElementById(idPrefix + 'blur');
      if (blurBtn) {
        blurBtn.onclick = () => {
          this._settings.backdropBlur = !this._settings.backdropBlur;
          this._saveSettings();
          const ch = this._settings.backdropBlur;
          blurBtn.style.background = ch ? 'var(--foreground, #f4f4f5)' : 'var(--muted, #27272a)';
          blurBtn.style.borderColor = ch ? 'var(--foreground, #f4f4f5)' : 'var(--border, #3f3f46)';
          const dot = blurBtn.querySelector('span');
          if (dot) {
            dot.style.left = ch ? '17px' : '1px';
            dot.style.background = ch ? 'var(--background, #09090b)' : 'var(--muted-foreground, #a1a1aa)';
          }
        };
      }

      const dblInput = document.getElementById(idPrefix + 'dbl');
      const dblVal = document.getElementById(idPrefix + 'dbl-val');
      if (dblInput && dblVal) {
        dblInput.oninput = (e) => {
          const val = parseFloat(e.target.value);
          this._settings.doubleClickZoom = val;
          dblVal.textContent = `${val.toFixed(1)}x`;
          this._saveSettings();
        };
      }
    }, 50);

    const checked = this._settings.backdropBlur;

    return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Zoom Sensitivity</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Mouse wheel focal zoom scaling speed</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="range" id="${idPrefix}sens" min="0.05" max="0.35" step="0.02" value="${sensValNum}" style="width:100px; accent-color:var(--foreground, #f4f4f5); cursor:pointer;" />
            <span id="${idPrefix}sens-val" style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5); min-width:32px;">${sensValNum.toFixed(2)}</span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border, rgba(255,255,255,0.06));">
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Backdrop Blur</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Glassmorphic blur behind lightbox</div>
          </div>
          <button id="${idPrefix}blur" class="agy-switch-toggle" style="
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
            <div style="font-size:13px; font-weight:600; color:var(--foreground, #f4f4f5);">Double-Click Target Zoom</div>
            <div style="font-size:11.5px; color:var(--muted-foreground, #71717a);">Target magnification level when double-clicking an image</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="range" id="${idPrefix}dbl" min="1.5" max="4.0" step="0.5" value="${dblValNum}" style="width:100px; accent-color:var(--foreground, #f4f4f5); cursor:pointer;" />
            <span id="${idPrefix}dbl-val" style="font-size:12px; font-weight:600; color:var(--foreground, #f4f4f5); min-width:32px;">${dblValNum.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageZoomPlugin;
}
