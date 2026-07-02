'use strict';

self.onmessage = async event => {
  const message = event.data || {};
  const { id, type, bitmap } = message;
  if (!id || !bitmap) return;

  try {
    if (type !== 'thumbnail') throw new Error(`Unsupported image worker request: ${type}`);
    if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas is unavailable.');

    const sourceWidth = Math.max(1, bitmap.width || 1);
    const sourceHeight = Math.max(1, bitmap.height || 1);
    const maxWidth = Math.max(1, Number(message.maxWidth) || 370);
    const maxHeight = Math.max(1, Number(message.maxHeight) || 320);
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'medium';
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const analysis = analyzeAlpha(context, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    self.postMessage({ id, ok: true, blob, analysis, width, height });
  } catch (error) {
    bitmap.close?.();
    self.postMessage({
      id,
      ok: false,
      error: error?.message || String(error)
    });
  }
};

function analyzeAlpha(context, width, height) {
  const data = context.getImageData(0, 0, width, height).data;
  let visible = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) continue;
      visible += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  return {
    width,
    height,
    visibleRatio: visible / Math.max(1, width * height),
    transparentRatio: 1 - visible / Math.max(1, width * height),
    bounds: maxX >= minX && maxY >= minY
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null
  };
}
