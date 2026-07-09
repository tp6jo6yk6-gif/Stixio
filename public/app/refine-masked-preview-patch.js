(() => {
  if (window.__stixioRefineMaskedPreviewPatch) return;
  window.__stixioRefineMaskedPreviewPatch = true;

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  const originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;

  function isRefineMaskOverlay(ctx, source) {
    return ctx?.canvas?.id === 'refineCanvas'
      && source instanceof HTMLCanvasElement
      && source.id !== 'refineCanvas'
      && ctx.globalAlpha > 0
      && ctx.globalAlpha < 1;
  }

  function applyMaskedPreview(ctx, maskCanvas) {
    const canvas = ctx.canvas;
    if (!canvas?.width || !canvas?.height || !maskCanvas?.width || !maskCanvas?.height) return false;

    const maskBuffer = document.createElement('canvas');
    maskBuffer.width = canvas.width;
    maskBuffer.height = canvas.height;
    const maskCtx = maskBuffer.getContext('2d', { willReadFrequently: true });
    maskCtx.imageSmoothingEnabled = false;
    originalDrawImage.call(maskCtx, maskCanvas, 0, 0, canvas.width, canvas.height);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < mask.data.length; i += 4) {
      const alpha = mask.data[i + 3];
      if (alpha <= 0) continue;
      const red = mask.data[i];
      const green = mask.data[i + 1];
      if (red > 128 && red > green) {
        image.data[i + 3] = 0;
      } else if (green > 128) {
        image.data[i] = Math.round(image.data[i] * 0.72);
        image.data[i + 1] = Math.min(255, Math.round(image.data[i + 1] * 0.72 + 80));
        image.data[i + 2] = Math.round(image.data[i + 2] * 0.72);
      }
    }

    originalPutImageData.call(ctx, image, 0, 0);
    return true;
  }

  CanvasRenderingContext2D.prototype.drawImage = function patchedDrawImage(source, ...args) {
    if (isRefineMaskOverlay(this, source) && applyMaskedPreview(this, source)) return;
    return originalDrawImage.call(this, source, ...args);
  };
})();
