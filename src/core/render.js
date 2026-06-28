// Render helpers and Frame Render Engine.
// DOM/canvas work is intentionally isolated here so UI, Review, and Export share one render path.

import { frameToArtworkSlice } from './frame/index.js';
import { processStickerImageData } from './image-processing.js';

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
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function createRenderOptions(options = {}) {
  return {
    targetW: 370,
    targetH: 320,
    safeMargin: 15,
    alignMode: 'center',
    highQuality: true,
    refine: {
      enabled: true,
      chromaEnabled: true,
      chromaColor: [255, 255, 255],
      tolerance: 30,
      exteriorOnly: true,
      autoDespeckle: true,
      shrinkRadius: 0,
      featherRadius: 1
    },
    ...options,
    refine: {
      enabled: true,
      chromaEnabled: true,
      chromaColor: [255, 255, 255],
      tolerance: 30,
      exteriorOnly: true,
      autoDespeckle: true,
      shrinkRadius: 0,
      featherRadius: 1,
      ...(options.refine || {})
    }
  };
}

export function renderFrameToCanvas(sourceImage, frame, options = {}) {
  if (!sourceImage?.img) throw new Error('renderFrameToCanvas requires sourceImage.img.');
  if (!frame) throw new Error('renderFrameToCanvas requires a frame.');

  const renderOptions = createRenderOptions(options);
  const slice = frameToArtworkSlice(frame);
  const sourceCanvas = cropSourceToCanvas(sourceImage.img, slice);
  const refinedCanvas = renderOptions.refine?.enabled === false
    ? sourceCanvas
    : refineSourceCanvas(sourceCanvas, renderOptions.refine);

  const targetCanvas = createCanvas(renderOptions.targetW, renderOptions.targetH);
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = renderOptions.highQuality ? 'high' : 'medium';

  const placement = getStickerPlacement({
    width: slice.width,
    height: slice.height,
    cropW: slice.width,
    cropH: slice.height,
    offsetX: 0,
    offsetY: 0
  }, renderOptions);

  ctx.drawImage(refinedCanvas, placement.drawX, placement.drawY, placement.drawW, placement.drawH);

  return {
    canvas: targetCanvas,
    sourceCanvas,
    placement,
    frameId: frame.id,
    renderedAt: new Date().toISOString(),
    options: renderOptions
  };
}

export function renderFramesToCanvasMap(sourceImage, frames, options = {}) {
  const rendered = new Map();
  frames.forEach(frame => {
    rendered.set(frame.id, renderFrameToCanvas(sourceImage, frame, options).canvas);
  });
  return rendered;
}

export function createRenderCache() {
  return new Map();
}

export function getRenderCacheKey(sourceImage, frame, options = {}) {
  const geometry = frame.geometry || {};
  const refine = options.refine || {};
  return JSON.stringify({
    sourceId: sourceImage?.id,
    frameId: frame?.id,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: geometry.rotation,
    targetW: options.targetW,
    targetH: options.targetH,
    safeMargin: options.safeMargin,
    refine
  });
}

export function renderFrameWithCache(sourceImage, frame, options = {}, cache = createRenderCache()) {
  const key = getRenderCacheKey(sourceImage, frame, options);
  if (cache.has(key)) return cache.get(key);
  const result = renderFrameToCanvas(sourceImage, frame, options);
  cache.set(key, result);
  return result;
}

function cropSourceToCanvas(image, slice) {
  const sourceCanvas = createCanvas(slice.width, slice.height);
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.imageSmoothingEnabled = true;
  sourceCtx.imageSmoothingQuality = 'high';
  sourceCtx.drawImage(
    image,
    slice.x,
    slice.y,
    slice.width,
    slice.height,
    0,
    0,
    slice.width,
    slice.height
  );
  return sourceCanvas;
}

function refineSourceCanvas(sourceCanvas, refineOptions = {}) {
  const sourceCtx = sourceCanvas.getContext('2d');
  const raw = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const processed = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
  processStickerImageData(processed, {
    enabled: refineOptions.chromaEnabled,
    chromaColor: refineOptions.chromaColor,
    tolerance: refineOptions.tolerance,
    exteriorOnly: refineOptions.exteriorOnly,
    autoDespeckle: refineOptions.autoDespeckle,
    shrinkRadius: refineOptions.shrinkRadius,
    featherRadius: refineOptions.featherRadius
  });
  sourceCtx.putImageData(processed, 0, 0);
  return sourceCanvas;
}
