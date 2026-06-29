// Image processing helpers extracted from the production app.
// These functions operate on ImageData and are DOM-free except for optional mask canvas reading.

export function applyChromaKey(imageData, options = {}) {
  const {
    enabled = true,
    chromaColor = [255, 255, 255],
    tolerance = 30,
    exteriorOnly = true,
    protectMaskCanvas = null
  } = options;

  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const [targetR, targetG, targetB] = chromaColor;
  const protectMaskData = readMaskData(protectMaskCanvas, width, height);

  let visited = null;
  if (!enabled) {
    applyDeleteMaskOnly(data, protectMaskData);
    return { imageData, visited };
  }

  if (exteriorOnly) {
    visited = floodExteriorBackground({
      data,
      width,
      height,
      targetR,
      targetG,
      targetB,
      tolerance,
      protectMaskData
    });

    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      const mask = readMaskAction(protectMaskData, offset);
      if (mask === 'keep') continue;

      if (mask === 'delete' || visited[i]) {
        if (mask === 'delete') {
          data[offset + 3] = 0;
        } else {
          softenAlphaForDistance(data, offset, targetR, targetG, targetB, tolerance);
        }
        if (data[offset + 3] === 0) setWhite(data, offset);
      }
    }
  } else {
    for (let offset = 0; offset < data.length; offset += 4) {
      const mask = readMaskAction(protectMaskData, offset);
      if (mask === 'keep') continue;
      if (mask === 'delete') {
        data[offset + 3] = 0;
        setWhite(data, offset);
        continue;
      }
      softenAlphaForDistance(data, offset, targetR, targetG, targetB, tolerance);
      if (data[offset + 3] === 0) setWhite(data, offset);
    }
  }

  return { imageData, visited };
}

export function applyDespeckle(imageData, { minComponentSize = 30, protectMaskCanvas = null } = {}) {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const protectMaskData = readMaskData(protectMaskCanvas, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (data[index * 4 + 3] <= 0 || visited[index]) continue;

      const queue = [x, y];
      const component = [index];
      let containsProtectedPixel = readMaskAction(protectMaskData, index * 4) === 'keep';
      visited[index] = 1;
      let head = 0;

      while (head < queue.length) {
        const currentX = queue[head++];
        const currentY = queue[head++];
        visitNeighbors(currentX, currentY, width, height, (nx, ny) => {
          const ni = ny * width + nx;
          if (!visited[ni] && data[ni * 4 + 3] > 0) {
            visited[ni] = 1;
            queue.push(nx, ny);
            component.push(ni);
            if (readMaskAction(protectMaskData, ni * 4) === 'keep') containsProtectedPixel = true;
          }
        });
      }

      if (component.length < minComponentSize && !containsProtectedPixel) {
        component.forEach(componentIndex => {
          const offset = componentIndex * 4;
          data[offset + 3] = 0;
          setWhite(data, offset);
        });
      }
    }
  }

  return imageData;
}

export function applyErosion(imageData, radius = 0) {
  if (radius <= 0) return imageData;
  const { width, height, data } = imageData;
  const sourceAlpha = new Uint8Array(width * height);
  const targetAlpha = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) sourceAlpha[i] = data[i * 4 + 3];

  for (let step = 0; step < radius; step++) {
    for (let i = 0; i < width * height; i++) targetAlpha[i] = sourceAlpha[i];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (sourceAlpha[index] > 0 && hasTransparentNeighbor(sourceAlpha, width, height, x, y)) {
          targetAlpha[index] = 0;
        }
      }
    }

    for (let i = 0; i < width * height; i++) sourceAlpha[i] = targetAlpha[i];
  }

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset + 3] = sourceAlpha[i];
    if (sourceAlpha[i] === 0) setWhite(data, offset);
  }

  return imageData;
}

export function applyFeathering(imageData, radius = 0) {
  if (radius <= 0) return imageData;
  const { width, height, data } = imageData;
  const alpha = new Uint8Array(width * height);
  const temp = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) alpha[i] = data[i * 4 + 3];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) {
        sum += alpha[y * width + k];
        count++;
      }
      temp[y * width + x] = sum / count;
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) {
        sum += temp[k * width + x];
        count++;
      }
      data[(y * width + x) * 4 + 3] = sum / count;
    }
  }

  return imageData;
}

export function applyManualMaskOverrides(imageData, originalData, protectMaskCanvas = null) {
  if (!protectMaskCanvas) return imageData;
  const { width, height, data } = imageData;
  const maskData = readMaskData(protectMaskCanvas, width, height);
  if (!maskData) return imageData;
  const original = originalData?.data || originalData;

  for (let offset = 0; offset < data.length; offset += 4) {
    const action = readMaskAction(maskData, offset);
    if (action === 'keep' && original) {
      data[offset] = original[offset];
      data[offset + 1] = original[offset + 1];
      data[offset + 2] = original[offset + 2];
      data[offset + 3] = original[offset + 3];
    } else if (action === 'delete') {
      data[offset + 3] = 0;
      setWhite(data, offset);
    }
  }

  return imageData;
}

export function processStickerImageData(imageData, options = {}) {
  const originalData = new Uint8ClampedArray(imageData.data);
  const { imageData: chromaData, visited } = applyChromaKey(imageData, options);
  if (options.autoDespeckle) {
    applyDespeckle(chromaData, {
      ...(options.despeckle || {}),
      protectMaskCanvas: options.protectMaskCanvas || null
    });
  }
  applyErosion(chromaData, options.shrinkRadius || 0);
  applyFeathering(chromaData, options.featherRadius || 0);
  applyManualMaskOverrides(chromaData, originalData, options.protectMaskCanvas || null);
  return { imageData: chromaData, visited };
}

function floodExteriorBackground({ data, width, height, targetR, targetG, targetB, tolerance, protectMaskData }) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBackground = (x, y) => {
    const offset = (y * width + x) * 4;
    const mask = readMaskAction(protectMaskData, offset);
    if (mask === 'keep') return false;
    if (data[offset + 3] === 0) return true;
    return colorDistance(data, offset, targetR, targetG, targetB) <= tolerance * 1.35;
  };

  for (let x = 0; x < width; x++) {
    addSeed(x, 0);
    addSeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    addSeed(0, y);
    addSeed(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const currentX = queue[head++];
    const currentY = queue[head++];
    visitNeighbors(currentX, currentY, width, height, (nx, ny) => {
      const ni = ny * width + nx;
      if (!visited[ni] && isBackground(nx, ny)) {
        visited[ni] = 1;
        queue.push(nx, ny);
      }
    });
  }

  return visited;

  function addSeed(x, y) {
    const index = y * width + x;
    if (!visited[index] && isBackground(x, y)) {
      visited[index] = 1;
      queue.push(x, y);
    }
  }
}

function applyDeleteMaskOnly(data, maskData) {
  if (!maskData) return;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (readMaskAction(maskData, offset) === 'delete') {
      data[offset + 3] = 0;
      setWhite(data, offset);
    }
  }
}

function readMaskData(maskCanvas, width, height) {
  if (!maskCanvas) return null;
  if (maskCanvas.width !== width || maskCanvas.height !== height) return null;
  return maskCanvas.getContext('2d').getImageData(0, 0, width, height).data;
}

function readMaskAction(maskData, offset) {
  if (!maskData || maskData[offset + 3] <= 0) return null;
  if (maskData[offset + 1] > 128) return 'keep';
  if (maskData[offset] > 128) return 'delete';
  return null;
}

function softenAlphaForDistance(data, offset, targetR, targetG, targetB, tolerance) {
  const distance = colorDistance(data, offset, targetR, targetG, targetB);
  if (distance <= tolerance) {
    data[offset + 3] = 0;
  } else if (distance < tolerance * 1.4) {
    data[offset + 3] = Math.floor(data[offset + 3] * ((distance - tolerance) / (tolerance * 0.4)));
  }
}

function colorDistance(data, offset, r, g, b) {
  return Math.abs(data[offset] - r) + Math.abs(data[offset + 1] - g) + Math.abs(data[offset + 2] - b);
}

function setWhite(data, offset) {
  data[offset] = 255;
  data[offset + 1] = 255;
  data[offset + 2] = 255;
}

function visitNeighbors(x, y, width, height, fn) {
  const points = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  for (const [nx, ny] of points) {
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) fn(nx, ny);
  }
}

function hasTransparentNeighbor(alpha, width, height, x, y) {
  for (let ny = y - 1; ny <= y + 1; ny++) {
    for (let nx = x - 1; nx <= x + 1; nx++) {
      if (nx === x && ny === y) continue;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (alpha[ny * width + nx] === 0) return true;
    }
  }
  return false;
}
