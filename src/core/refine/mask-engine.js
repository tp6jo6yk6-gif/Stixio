// Manual keep/delete mask tools used by Refine Engine.
// Green pixels mean keep, red pixels mean delete. image-processing.js already consumes this format.

export const MaskActions = Object.freeze({
  KEEP: 'keep',
  DELETE: 'delete',
  CLEAR: 'clear'
});

export function createMaskCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function resizeMaskCanvas(maskCanvas, width, height) {
  if (!maskCanvas) return createMaskCanvas(width, height);
  const resized = createMaskCanvas(width, height);
  resized.getContext('2d').drawImage(maskCanvas, 0, 0, maskCanvas.width, maskCanvas.height, 0, 0, resized.width, resized.height);
  return resized;
}

export function clearMask(maskCanvas) {
  if (!maskCanvas) return;
  maskCanvas.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height);
}

export function paintMaskStroke(maskCanvas, from, to = from, options = {}) {
  if (!maskCanvas) throw new Error('paintMaskStroke requires a mask canvas.');
  const { action = MaskActions.KEEP, size = 15 } = options;
  const ctx = maskCanvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = action === MaskActions.CLEAR ? 'destination-out' : 'source-over';
  ctx.strokeStyle = action === MaskActions.DELETE ? 'rgba(255,0,0,1)' : 'rgba(0,255,0,1)';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(to.x, to.y, Math.max(0.5, size / 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return maskCanvas;
}

export function applyMagicMask(sourceCanvas, maskCanvas, startX, startY, options = {}) {
  if (!sourceCanvas || !maskCanvas) throw new Error('applyMagicMask requires source and mask canvases.');
  const {
    action = MaskActions.DELETE,
    tolerance = 30,
    contiguous = true
  } = options;

  if (action === MaskActions.CLEAR) throw new Error('Magic mask supports keep or delete actions only.');

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const x = clamp(Math.round(startX), 0, width - 1);
  const y = clamp(Math.round(startY), 0, height - 1);
  const source = sourceCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height);
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  const mask = maskCtx.getImageData(0, 0, width, height);
  const seedOffset = (y * width + x) * 4;
  const target = [source.data[seedOffset], source.data[seedOffset + 1], source.data[seedOffset + 2], source.data[seedOffset + 3]];
  const color = action === MaskActions.DELETE ? [255, 0, 0, 255] : [0, 255, 0, 255];

  if (!contiguous) {
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      if (matches(source.data, offset, target, tolerance)) writeColor(mask.data, offset, color);
    }
  } else {
    const visited = new Uint8Array(width * height);
    const queue = [x, y];
    visited[y * width + x] = 1;
    let head = 0;
    while (head < queue.length) {
      const currentX = queue[head++];
      const currentY = queue[head++];
      const index = currentY * width + currentX;
      const offset = index * 4;
      if (!matches(source.data, offset, target, tolerance)) continue;
      writeColor(mask.data, offset, color);
      visitNeighbors(currentX, currentY, width, height, (nextX, nextY) => {
        const nextIndex = nextY * width + nextX;
        if (visited[nextIndex]) return;
        visited[nextIndex] = 1;
        queue.push(nextX, nextY);
      });
    }
  }

  maskCtx.putImageData(mask, 0, 0);
  return maskCanvas;
}

export function getMaskStats(maskCanvas) {
  if (!maskCanvas) return emptyMaskStats(0);
  const imageData = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  return getMaskStatsFromImageData(imageData);
}

export function getMaskStatsFromImageData(imageData) {
  const total = Math.max(0, imageData?.width * imageData?.height || 0);
  if (!imageData?.data || total === 0) return emptyMaskStats(total);
  let keep = 0;
  let deleted = 0;

  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset + 3] <= 0) continue;
    if (imageData.data[offset + 1] > 128) keep++;
    else if (imageData.data[offset] > 128) deleted++;
  }

  const marked = keep + deleted;
  return {
    total,
    keep,
    delete: deleted,
    marked,
    empty: Math.max(0, total - marked),
    coverage: total ? marked / total : 0,
    hasEdits: marked > 0
  };
}

export function captureMaskSnapshot(maskCanvas) {
  if (!maskCanvas) return null;
  return maskCanvas.getContext('2d').getImageData(0, 0, maskCanvas.width, maskCanvas.height);
}

export function restoreMaskSnapshot(maskCanvas, snapshot) {
  if (!maskCanvas || !snapshot) return maskCanvas;
  if (maskCanvas.width !== snapshot.width || maskCanvas.height !== snapshot.height) {
    maskCanvas.width = snapshot.width;
    maskCanvas.height = snapshot.height;
  }
  maskCanvas.getContext('2d').putImageData(snapshot, 0, 0);
  return maskCanvas;
}

function emptyMaskStats(total) {
  return { total, keep: 0, delete: 0, marked: 0, empty: total, coverage: 0, hasEdits: false };
}

function matches(data, offset, target, tolerance) {
  const distance = Math.abs(data[offset] - target[0])
    + Math.abs(data[offset + 1] - target[1])
    + Math.abs(data[offset + 2] - target[2])
    + Math.abs(data[offset + 3] - target[3]);
  return distance <= tolerance * 3;
}

function writeColor(data, offset, color) {
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = color[3];
}

function visitNeighbors(x, y, width, height, fn) {
  const points = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  points.forEach(([nextX, nextY]) => {
    if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) fn(nextX, nextY);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
