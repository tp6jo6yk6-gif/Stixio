import { calculateGridDetectionResult } from '../grid.js';
import { createFrame, frameFromGridBox } from '../frame/index.js';

export const DetectionStrategies = Object.freeze({
  GRID: 'grid',
  MANUAL: 'manual',
  AI: 'ai'
});

export function detectFrames(sourceImage, options = {}) {
  const strategy = options.strategy || DetectionStrategies.GRID;
  if (strategy === DetectionStrategies.GRID) return detectGridFrames(sourceImage, options);
  if (strategy === DetectionStrategies.MANUAL) return normalizeManualFrames(sourceImage, options.frames || []);
  if (strategy === DetectionStrategies.AI) {
    throw new Error('AI detection is not implemented yet.');
  }
  throw new Error(`Unknown detection strategy: ${strategy}`);
}

export function detectGridFrames(sourceImage, options = {}) {
  return detectGrid(sourceImage, options).frames;
}

export function detectGrid(sourceImage, options = {}) {
  if (!sourceImage?.width || !sourceImage?.height) throw new Error('Source image width and height are required for grid detection.');
  const result = calculateGridDetectionResult(sourceImage.width, sourceImage.height, options.grid || options);
  const frames = result.boxes.map((box, index) => ({
    ...frameFromGridBox(box, index, sourceImage.id),
    detection: {
      strategy: DetectionStrategies.GRID,
      index,
      qualityScore: result.quality.score,
      issues: result.quality.issues,
      createdAt: new Date().toISOString()
    }
  }));

  return {
    ...result,
    frames
  };
}

export function createManualFrame(sourceImage, geometry, name = 'Manual Frame') {
  return createFrame({
    name,
    sourceImageId: sourceImage.id,
    geometry,
    detection: {
      strategy: DetectionStrategies.MANUAL,
      qualityScore: 100,
      issues: [],
      createdAt: new Date().toISOString()
    }
  });
}

function normalizeManualFrames(sourceImage, frames) {
  return frames.map((frame, index) => createFrame({
    ...frame,
    name: frame.name || `Frame ${String(index + 1).padStart(2, '0')}`,
    sourceImageId: frame.sourceImageId || sourceImage.id,
    detection: frame.detection || {
      strategy: DetectionStrategies.MANUAL,
      index,
      qualityScore: 100,
      issues: [],
      createdAt: new Date().toISOString()
    }
  }));
}
