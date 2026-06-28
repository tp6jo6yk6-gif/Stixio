// Refine Effects Engine
// Pixel/canvas-level effects used by Render, Review, and Export.

export function trimTransparentCanvas(sourceCanvas, threshold = 1, padding = 0) {
  const ctx = sourceCanvas.getContext('2d');
  const { width, height } = sourceCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const bounds = getAlphaBounds(imageData, threshold);

  if (!bounds) {
    return {
      canvas: cloneCanvas(sourceCanvas),
      bounds: { x: 0, y: 0, width, height },
      trimmed: false
    };
  }

  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  const right = Math.min(width, bounds.x + bounds.width + padding);
  const bottom = Math.min(height, bounds.y + bounds.height + padding);
  const trimWidth = Math.max(1, right - x);
  const trimHeight = Math.max(1, bottom - y);
  const canvas = createCanvas(trimWidth, trimHeight);
  canvas.getContext('2d').drawImage(sourceCanvas, x, y, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);

  return {
    canvas,
    bounds: { x, y, width: trimWidth, height: trimHeight },
    trimmed: true
  };
}

export function addWhiteBorderCanvas(sourceCanvas, options = {}) {
  const size = Math.max(0, Number(options.size) || 0);
  if (size <= 0) return cloneCanvas(sourceCanvas);

  const color = options.color || '#ffffff';
  const iterations = Math.ceil(size);
  const width = sourceCanvas.width + size * 2;
  const height = sourceCanvas.height + size * 2;
  const alphaCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  alphaCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);

  let mask = extractAlphaMask(alphaCanvas);
  for (let i = 0; i < iterations; i++) {
    mask = dilateAlphaMask(mask, sourceCanvas.width, sourceCanvas.height);
  }

  const borderCanvas = createCanvas(width, height);
  const borderCtx = borderCanvas.getContext('2d');
  const borderImageData = borderCtx.createImageData(width, height);
  const fill = parseColor(color);

  for (let y = 0; y < sourceCanvas.height; y++) {
    for (let x = 0; x < sourceCanvas.width; x++) {
      const maskAlpha = mask[y * sourceCanvas.width + x];
      if (!maskAlpha) continue;
      const targetIndex = ((y + size) * width + (x + size)) * 4;
      borderImageData.data[targetIndex] = fill.r;
      borderImageData.data[targetIndex + 1] = fill.g;
      borderImageData.data[targetIndex + 2] = fill.b;
      borderImageData.data[targetIndex + 3] = maskAlpha;
    }
  }

  borderCtx.putImageData(borderImageData, 0, 0);
  borderCtx.drawImage(sourceCanvas, size, size);
  return borderCanvas;
}

export function addShadowCanvas(sourceCanvas, options = {}) {
  if (!options.enabled) return cloneCanvas(sourceCanvas);
  const blur = Math.max(0, Number(options.blur) || 8);
  const offsetX = Number(options.offsetX) || 0;
  const offsetY = Number(options.offsetY) || 4;
  const color = options.color || 'rgba(0,0,0,0.28)';
  const spread = Math.ceil(blur + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + 4);
  const canvas = createCanvas(sourceCanvas.width + spread * 2, sourceCanvas.height + spread * 2);
  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  ctx.drawImage(sourceCanvas, spread, spread);
  ctx.restore();
  ctx.drawImage(sourceCanvas, spread, spread);
  return canvas;
}

export function applyRefineEffects(sourceCanvas, effects = {}) {
  let canvas = cloneCanvas(sourceCanvas);

  if (effects.trim?.enabled) {
    canvas = trimTransparentCanvas(canvas, effects.trim.threshold ?? 1, effects.trim.padding ?? 0).canvas;
  }

  if (effects.whiteBorder?.enabled) {
    canvas = addWhiteBorderCanvas(canvas, effects.whiteBorder);
  }

  if (effects.shadow?.enabled) {
    canvas = addShadowCanvas(canvas, effects.shadow);
  }

  return canvas;
}

export function getAlphaBounds(imageData, threshold = 1) {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha >= threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function extractAlphaMask(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const mask = new Uint8ClampedArray(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = imageData.data[i * 4 + 3];
  return mask;
}

function dilateAlphaMask(mask, width, height) {
  const next = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          max = Math.max(max, mask[ny * width + nx]);
        }
      }
      next[y * width + x] = max;
    }
  }
  return next;
}

function cloneCanvas(sourceCanvas) {
  const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  canvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function parseColor(color) {
  if (Array.isArray(color)) {
    return { r: color[0] ?? 255, g: color[1] ?? 255, b: color[2] ?? 255 };
  }
  if (typeof color === 'string' && color.startsWith('#')) {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
  }
  return { r: 255, g: 255, b: 255 };
}
