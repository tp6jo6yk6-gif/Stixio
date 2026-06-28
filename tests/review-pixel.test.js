import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRenderedCanvas, reviewRenderedPixels } from '../src/core/review/index.js';

function createImageData(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  paint?.(data, width, height);
  return { width, height, data };
}

test('pixel review detects blank transparent output', () => {
  const imageData = createImageData(10, 10);
  const issues = reviewRenderedPixels(imageData, { id: 'f1', name: 'Frame 1' });
  assert.equal(issues.some(issue => issue.code === 'render.blank'), true);
});

test('pixel review detects edge touch', () => {
  const imageData = createImageData(10, 10, (data, width) => {
    for (let y = 0; y < 10; y++) {
      const index = (y * width + 0) * 4;
      data[index + 3] = 255;
    }
  });
  const issues = reviewRenderedPixels(imageData, { id: 'f1', name: 'Frame 1' }, 'Frame 1', {
    blankRatioThreshold: 0,
    edgeTouchRatioThreshold: 0.01
  });
  assert.equal(issues.some(issue => issue.code === 'render.edgeTouch'), true);
});

test('pixel analysis returns visible bounds', () => {
  const imageData = createImageData(10, 10, (data, width) => {
    const index = (5 * width + 5) * 4;
    data[index + 3] = 255;
  });
  const analysis = analyzeRenderedCanvas(imageData);
  assert.equal(analysis.alphaCount, 1);
  assert.deepEqual(analysis.bounds, { x: 5, y: 5, width: 1, height: 1, margin: 4 });
});
