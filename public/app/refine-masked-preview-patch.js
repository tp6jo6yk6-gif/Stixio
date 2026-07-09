(() => {
  if (window.__stixioRefineMaskedPreviewPatch) return;
  window.__stixioRefineMaskedPreviewPatch = true;

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

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

  function tintDeletePixel(image, offset, strength = 0.38) {
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
      if (distance <= tolerance) tintDeletePixel(image, offset, 0.34);
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
      if (red > 128 && red > green) tintDeletePixel(image, offset, 0.55);
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
})();
