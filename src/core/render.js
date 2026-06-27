// Render helpers.
// These functions are pure unless explicitly receiving a canvas/context.

export function getStickerPlacement(box, renderOptions = {}) {
  const {
    targetW = 370,
    targetH = 320,
    safeMargin = 15,
    alignMode = 'center',
    offsetX = box.offsetX || 0,
    offsetY = box.offsetY || 0
  } = renderOptions;

  const cropW = box.cropW ?? box.width;
  const cropH = box.cropH ?? box.height;
  const scale = Math.min(
    (targetW - safeMargin * 2) / cropW,
    (targetH - safeMargin * 2) / cropH
  );

  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const drawX = (targetW - drawW) / 2 + offsetX;
  const baseY = alignMode === 'bottom'
    ? targetH - safeMargin - drawH
    : (targetH - drawH) / 2;
  const drawY = baseY + offsetY;

  return {
    scale,
    drawW,
    drawH,
    drawX,
    drawY
  };
}

export function getSafeAreaRect({ targetW = 370, targetH = 320, safeMargin = 15 } = {}) {
  return {
    x: safeMargin,
    y: safeMargin,
    width: Math.max(0, targetW - safeMargin * 2),
    height: Math.max(0, targetH - safeMargin * 2)
  };
}

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
