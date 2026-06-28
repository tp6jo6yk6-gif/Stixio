import { frameFromGridBox } from '../frame/index.js';
import { DetectionStrategies } from './detection-engine.js';
import { tightenFramesToContent } from './content-bounds.js';

// Detect rows and columns by finding low-density projection valleys between artwork groups.
// Ported from the original Sticker tool's automatic layout mode.
export function detectProjectionGrid(sourceImage, options = {}) {
  if (!sourceImage?.img) throw new Error('detectProjectionGrid requires sourceImage.img.');
  const {
    chromaEnabled = true,
    chromaColor = [255, 255, 255],
    tolerance = 30,
    alphaThreshold = 45,
    tighten = true,
    contentPadding = 4
  } = options;

  const image = sourceImage.img;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  const rowScores = new Int32Array(image.height);
  const colScores = new Int32Array(image.width);

  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    if (!isArtworkPixel(pixels, offset, { chromaEnabled, chromaColor, tolerance, alphaThreshold })) continue;
    rowScores[Math.floor(index / image.width)] += 1;
    colScores[index % image.width] += 1;
  }

  const smoothedCols = smoothProjection(colScores);
  const smoothedRows = smoothProjection(rowScores);
  const minGapX = Math.max(8, image.width * 0.015);
  const minGapY = Math.max(8, image.height * 0.015);
  const colThreshold = Math.max(2, image.height * 0.005);
  const rowThreshold = Math.max(2, image.width * 0.005);
  const verticalCuts = findCuts(smoothedCols, colThreshold, minGapX, image.width);
  const horizontalCuts = findCuts(smoothedRows, rowThreshold, minGapY, image.height);
  const boxes = buildBoxes(verticalCuts, horizontalCuts);

  let frames = boxes.map((box, index) => ({
    ...frameFromGridBox(box, index, sourceImage.id),
    detection: {
      strategy: 'projection-grid',
      index,
      qualityScore: 100,
      issues: [],
      createdAt: new Date().toISOString()
    }
  }));

  if (tighten) {
    frames = tightenFramesToContent(sourceImage, frames, {
      padding: contentPadding,
      chromaColor,
      tolerance,
      alphaThreshold
    });
  }

  return {
    strategy: 'projection-grid',
    rows: horizontalCuts.length - 1,
    cols: verticalCuts.length - 1,
    verticalCuts,
    horizontalCuts,
    boxes,
    frames,
    quality: {
      score: frames.length ? 100 : 0,
      frameCount: frames.length,
      issues: frames.length ? [] : ['No artwork groups detected.']
    }
  };
}

function isArtworkPixel(data, offset, { chromaEnabled, chromaColor, tolerance, alphaThreshold }) {
  if (data[offset + 3] <= alphaThreshold) return false;
  if (!chromaEnabled) return true;
  const distance = Math.abs(data[offset] - chromaColor[0])
    + Math.abs(data[offset + 1] - chromaColor[1])
    + Math.abs(data[offset + 2] - chromaColor[2]);
  return distance > tolerance;
}

function smoothProjection(source) {
  const output = new Int32Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    output[index] = source[index]
      + (index > 0 ? source[index - 1] : 0)
      + (index < source.length - 1 ? source[index + 1] : 0);
  }
  return output;
}

function findCuts(scores, threshold, minGap, end) {
  const cuts = [0];
  let inContent = false;
  let gapStart = 0;
  for (let index = 0; index < scores.length; index += 1) {
    if (scores[index] >= threshold) {
      if (!inContent) {
        if (gapStart > 0 && index - gapStart >= minGap) cuts.push(Math.floor((gapStart + index) / 2));
        inContent = true;
      }
    } else if (inContent) {
      gapStart = index;
      inContent = false;
    }
  }
  cuts.push(end);
  return dedupeSorted(cuts);
}

function buildBoxes(verticalCuts, horizontalCuts) {
  const boxes = [];
  for (let row = 0; row < horizontalCuts.length - 1; row += 1) {
    for (let col = 0; col < verticalCuts.length - 1; col += 1) {
      boxes.push({
        row,
        col,
        x: verticalCuts[col],
        y: horizontalCuts[row],
        width: verticalCuts[col + 1] - verticalCuts[col],
        height: horizontalCuts[row + 1] - horizontalCuts[row],
        exportSelected: true
      });
    }
  }
  return boxes;
}

function dedupeSorted(values) {
  return [...new Set(values.map(value => Math.round(value)))].sort((a, b) => a - b);
}
