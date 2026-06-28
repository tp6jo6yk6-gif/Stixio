import { cloneFrame } from '../frame/index.js';

// Tighten an existing grid/manual Frame to the visible artwork inside it.
// This ports Workshop's content-aware crop into Detection Engine without coupling it to UI state.
export function detectContentBounds(sourceImage, geometry, options = {}) {
  if (!sourceImage?.img) throw new Error('detectContentBounds requires sourceImage.img.');
  const {
    padding = 4,
    searchPadding = 0,
    alphaThreshold = 8,
    chromaColor = [255, 255, 255],
    tolerance = 30
  } = options;

  const image = sourceImage.img;
  const region = expandAndClampGeometry(geometry, searchPadding, image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.width));
  canvas.height = Math.max(1, Math.round(region.height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      if (!isArtworkPixel(data, offset, { alphaThreshold, chromaColor, tolerance })) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return { found: false, geometry: { ...geometry } };

  const x = clamp(region.x + minX - padding, 0, image.width - 1);
  const y = clamp(region.y + minY - padding, 0, image.height - 1);
  const right = clamp(region.x + maxX + 1 + padding, x + 1, image.width);
  const bottom = clamp(region.y + maxY + 1 + padding, y + 1, image.height);

  return {
    found: true,
    geometry: { x, y, width: right - x, height: bottom - y }
  };
}

export function tightenFrameToContent(sourceImage, frame, options = {}) {
  const result = detectContentBounds(sourceImage, frame.geometry, options);
  if (!result.found) return cloneFrame(frame);
  return cloneFrame(frame, {
    geometry: result.geometry,
    detection: {
      ...(frame.detection || {}),
      contentAware: true,
      contentBoundsAt: new Date().toISOString()
    }
  });
}

export function tightenFramesToContent(sourceImage, frames, options = {}) {
  return frames.map(frame => frame.sourceImageId && frame.sourceImageId !== sourceImage.id
    ? cloneFrame(frame)
    : tightenFrameToContent(sourceImage, frame, options));
}

// Used after manual resizing. Search only a small fence around the Frame so it cannot jump to a neighbouring sticker.
export function smartSnapFrameToContent(sourceImage, frame, options = {}) {
  return tightenFrameToContent(sourceImage, frame, {
    padding: options.padding ?? 4,
    searchPadding: options.searchPadding ?? 12,
    alphaThreshold: options.alphaThreshold ?? 8,
    chromaColor: options.chromaColor ?? [255, 255, 255],
    tolerance: options.tolerance ?? 30
  });
}

function isArtworkPixel(data, offset, { alphaThreshold, chromaColor, tolerance }) {
  const alpha = data[offset + 3];
  if (alpha <= alphaThreshold) return false;
  const distance = Math.abs(data[offset] - chromaColor[0])
    + Math.abs(data[offset + 1] - chromaColor[1])
    + Math.abs(data[offset + 2] - chromaColor[2]);
  return distance > tolerance * 1.35;
}

function expandAndClampGeometry(geometry, padding, maxWidth, maxHeight) {
  const x = clamp(Math.floor(geometry.x - padding), 0, maxWidth - 1);
  const y = clamp(Math.floor(geometry.y - padding), 0, maxHeight - 1);
  const right = clamp(Math.ceil(geometry.x + geometry.width + padding), x + 1, maxWidth);
  const bottom = clamp(Math.ceil(geometry.y + geometry.height + padding), y + 1, maxHeight);
  return { x, y, width: right - x, height: bottom - y };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
