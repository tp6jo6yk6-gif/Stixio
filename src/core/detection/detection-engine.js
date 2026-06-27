import { calculateGridBoxes } from '../grid.js';
import { regionFromGridBox } from '../crop/index.js';

export const DetectionStrategies = Object.freeze({
  GRID: 'grid',
  MANUAL: 'manual',
  AI: 'ai'
});

export function detectFrames(sourceImage, options = {}) {
  const strategy = options.strategy || DetectionStrategies.GRID;
  if (strategy === DetectionStrategies.GRID) return detectGridFrames(sourceImage, options);
  if (strategy === DetectionStrategies.MANUAL) return options.frames || [];
  if (strategy === DetectionStrategies.AI) {
    throw new Error('AI detection is not implemented yet.');
  }
  throw new Error(`Unknown detection strategy: ${strategy}`);
}

export function detectGridFrames(sourceImage, options = {}) {
  if (!sourceImage?.width || !sourceImage?.height) throw new Error('Source image width and height are required for grid detection.');
  const boxes = calculateGridBoxes(sourceImage.width, sourceImage.height, options.grid || options);
  return boxes.map((box, index) => ({
    ...regionFromGridBox(box, index),
    sourceImageId: sourceImage.id,
    detection: {
      strategy: DetectionStrategies.GRID,
      index,
      createdAt: new Date().toISOString()
    }
  }));
}

export function createManualFrame(sourceImage, bounds, name = 'Manual Frame') {
  return {
    ...regionFromGridBox({ ...bounds, row: null, col: null, exportSelected: true }, 0),
    name,
    sourceImageId: sourceImage.id,
    detection: {
      strategy: DetectionStrategies.MANUAL,
      createdAt: new Date().toISOString()
    }
  };
}
