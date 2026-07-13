(() => {
  if (window.__stixioRefineMaskedPreviewPatch) return;
  window.__stixioRefineMaskedPreviewPatch = true;

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  const DELETE_MARK_STRENGTH = 0.34;
  const LOUPE_SIZE = 148;
  const SAMPLE_SIZE = 26;

  installVisualLockStyles();
  installMagicLoupe();

  function installVisualLockStyles() {
    if (document.getElementById('stixio-refine-visual-lock')) return;
    const style = document.createElement('style');
    style.id = 'stixio-refine-visual-lock';
    style.textContent = `
      #stage-refine #refineWorkspace {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      #stage-refine #refineViewport,
      #stage-refine #refineResultPane {
        display: grid !important;
        min-height: 430px !important;
      }

      #stage-refine #refineCanvas,
      #stage-refine #refineOutputCanvas {
        image-rendering: auto;
      }

      #refineMagicLoupe {
        position: fixed;
        z-index: 90;
        width: 74px;
        height: 74px;
        border-radius: 999px;
        border: 2px solid #0f172a;
        background: #fff;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.26), inset 0 0 0 1px rgba(255, 255, 255, 0.88);
        pointer-events: none;
      }

      #refineMagicLoupe[hidden] {
        display: none !important;
      }

      @media (max-width: 1023px) {
        #stage-refine #refineWorkspace {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isRefineSourceDraw(ctx, source) {
    return ctx?.canvas?.id === 'refineCanvas'
      && ctx.globalAlpha === 1
      && (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || (window.ImageBitmap && source instanceof ImageBitmap));
  }

  function isRefineMaskOverlay(ctx, source) {
    return ctx?.canvas?.id === 'refineCanvas'
      && source instanceof HTMLCanvasElement
      && source.id !== 'refineCanvas'
      && ctx.globalAlpha > 0
      && ctx.globalAlpha < 1;
  }

  function readBackgroundColor() {
    const value = document.getElementById('chromaColorInput')?.value || '#ffffff';
    const hex = value.replace('#', '').padEnd(6, 'f').slice(0, 6);
    return [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16) || 255);
  }

  function readTolerance() {
    const value = Number(document.getElementById('toleranceInput')?.value);
    return Number.isFinite(value) ? Math.max(5, Math.min(160, value)) : 30;
  }

  function tintDeletePixel(image, offset) {
    const strength = DELETE_MARK_STRENGTH;
    image.data[offset] = Math.min(255, Math.round(image.data[offset] * (1 - strength) + 255 * strength));
    image.data[offset + 1] = Math.round(image.data[offset + 1] * (1 - strength));
    image.data[offset + 2] = Math.round(image.data[offset + 2] * (1 - strength));
  }

  function applyAutoDeleteMarks(ctx) {
    const canvas = ctx.canvas;
    if (!canvas?.width || !canvas?.height) return;

    let image;
    try {
      image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }

    const target = readBackgroundColor();
    const tolerance = readTolerance() * 3;

    for (let offset = 0; offset < image.data.length; offset += 4) {
      if (image.data[offset + 3] <= 8) continue;
      const distance = Math.abs(image.data[offset] - target[0])
        + Math.abs(image.data[offset + 1] - target[1])
        + Math.abs(image.data[offset + 2] - target[2]);
      if (distance <= tolerance) tintDeletePixel(image, offset);
    }

    ctx.putImageData(image, 0, 0);
  }

  function drawDeleteMaskOnly(ctx, maskCanvas) {
    const canvas = ctx.canvas;
    if (!canvas?.width || !canvas?.height || !maskCanvas?.width || !maskCanvas?.height) return false;

    const maskBuffer = document.createElement('canvas');
    maskBuffer.width = canvas.width;
    maskBuffer.height = canvas.height;
    const maskCtx = maskBuffer.getContext('2d', { willReadFrequently: true });
    maskCtx.imageSmoothingEnabled = false;
    originalDrawImage.call(maskCtx, maskCanvas, 0, 0, canvas.width, canvas.height);

    let image;
    let mask;
    try {
      image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      mask = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return false;
    }

    for (let offset = 0; offset < mask.data.length; offset += 4) {
      if (mask.data[offset + 3] <= 0) continue;
      const red = mask.data[offset];
      const green = mask.data[offset + 1];
      if (red > 128 && red > green) tintDeletePixel(image, offset);
    }

    ctx.putImageData(image, 0, 0);
    return true;
  }

  CanvasRenderingContext2D.prototype.drawImage = function patchedDrawImage(source, ...args) {
    if (isRefineMaskOverlay(this, source)) {
      if (drawDeleteMaskOnly(this, source)) return;
    }

    const result = originalDrawImage.call(this, source, ...args);
    if (isRefineSourceDraw(this, source)) applyAutoDeleteMarks(this);
    return result;
  };

  function getLoupe() {
    let loupe = document.getElementById('refineMagicLoupe');
    if (!loupe) {
      loupe = document.createElement('canvas');
      loupe.id = 'refineMagicLoupe';
      loupe.width = LOUPE_SIZE;
      loupe.height = LOUPE_SIZE;
      loupe.hidden = true;
      document.body.appendChild(loupe);
    }
    return loupe;
  }

  function hideLoupe() {
    const loupe = document.getElementById('refineMagicLoupe');
    if (loupe) loupe.hidden = true;
  }

  function isMagicActive() {
    return Boolean(document.querySelector('#stage-refine .mask-tool[data-mask-tool="magic"].bg-emerald-300'));
  }

  function installMagicLoupe() {
    document.addEventListener('pointermove', event => {
      const viewport = document.getElementById('refineViewport');
      const canvas = document.getElementById('refineCanvas');
      if (!viewport || !canvas || !isMagicActive() || !viewport.contains(event.target)) {
        hideLoupe();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        hideLoupe();
        return;
      }

      const loupe = getLoupe();
      const ctx = loupe.getContext('2d');
      if (!ctx || !canvas.width || !canvas.height) return;

      const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
      const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
      const sx = Math.max(0, Math.min(canvas.width - SAMPLE_SIZE, canvasX - SAMPLE_SIZE / 2));
      const sy = Math.max(0, Math.min(canvas.height - SAMPLE_SIZE, canvasY - SAMPLE_SIZE / 2));

      ctx.clearRect(0, 0, loupe.width, loupe.height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(loupe.width / 2, loupe.height / 2, loupe.width / 2 - 3, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, sx, sy, SAMPLE_SIZE, SAMPLE_SIZE, 0, 0, loupe.width, loupe.height);
      ctx.restore();

      const center = loupe.width / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center - 12, center);
      ctx.lineTo(center + 12, center);
      ctx.moveTo(center, center - 12);
      ctx.lineTo(center, center + 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center, center, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fca5a5';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      loupe.style.left = `${event.clientX + 18}px`;
      loupe.style.top = `${event.clientY - 86}px`;
      loupe.hidden = false;
    }, true);

    document.addEventListener('pointerleave', hideLoupe, true);
  }
})();
