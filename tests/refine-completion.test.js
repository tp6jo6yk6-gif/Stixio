import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyChromaKey,
  processStickerImageData,
  getMaskStatsFromImageData,
  createRefineViewState,
  zoomRefineView,
  panRefineView,
  resetRefineView,
  refineViewTransform
} from '../src/core/index.js';

function imageData(width, height, pixels) {
  return { width, height, data: new Uint8ClampedArray(pixels) };
}

function maskCanvas(width, height, pixels) {
  const data = new Uint8ClampedArray(pixels);
  return {
    width,
    height,
    getContext() {
      return {
        getImageData() {
          return { width, height, data };
        }
      };
    }
  };
}

test('mask statistics separate keep, delete and empty pixels', () => {
  const stats = getMaskStatsFromImageData(imageData(3, 1, [
    0, 255, 0, 255,
    255, 0, 0, 255,
    0, 0, 0, 0
  ]));
  assert.deepEqual(stats, {
    total: 3,
    keep: 1,
    delete: 1,
    marked: 2,
    empty: 1,
    coverage: 2 / 3,
    hasEdits: true
  });
});

test('manual delete remains active when automatic chroma removal is disabled', () => {
  const source = imageData(2, 1, [
    20, 30, 40, 255,
    100, 110, 120, 255
  ]);
  const mask = maskCanvas(2, 1, [
    255, 0, 0, 255,
    0, 0, 0, 0
  ]);
  applyChromaKey(source, { enabled: false, protectMaskCanvas: mask });
  assert.equal(source.data[3], 0);
  assert.equal(source.data[7], 255);
});

test('manual keep is restored after despeckle, erosion and feathering', () => {
  const source = imageData(3, 1, [
    255, 255, 255, 255,
    220, 20, 20, 255,
    255, 255, 255, 255
  ]);
  const mask = maskCanvas(3, 1, [
    0, 0, 0, 0,
    0, 255, 0, 255,
    0, 0, 0, 0
  ]);
  processStickerImageData(source, {
    enabled: true,
    chromaColor: [255, 255, 255],
    tolerance: 30,
    exteriorOnly: false,
    autoDespeckle: true,
    despeckle: { minComponentSize: 30 },
    shrinkRadius: 1,
    featherRadius: 1,
    protectMaskCanvas: mask
  });
  assert.deepEqual([...source.data.slice(4, 8)], [220, 20, 20, 255]);
});

test('manual delete stays transparent after feathering', () => {
  const source = imageData(3, 1, [
    20, 20, 20, 255,
    220, 20, 20, 255,
    20, 20, 20, 255
  ]);
  const mask = maskCanvas(3, 1, [
    0, 0, 0, 0,
    255, 0, 0, 255,
    0, 0, 0, 0
  ]);
  processStickerImageData(source, {
    enabled: false,
    featherRadius: 1,
    protectMaskCanvas: mask
  });
  assert.equal(source.data[7], 0);
});

test('Refine viewport zoom keeps the pointer anchor stable', () => {
  const initial = createRefineViewState({ zoom: 1, panX: 10, panY: -5 });
  const zoomed = zoomRefineView(initial, 2, { x: 50, y: 25 });
  assert.equal(zoomed.zoom, 2);
  assert.equal(zoomed.panX, -30);
  assert.equal(zoomed.panY, -35);
  const panned = panRefineView(zoomed, 12, 8);
  assert.equal(panned.panX, -18);
  assert.equal(panned.panY, -27);
  const reset = resetRefineView(panned);
  assert.deepEqual({ zoom: reset.zoom, panX: reset.panX, panY: reset.panY }, { zoom: 1, panX: 0, panY: 0 });
  assert.match(refineViewTransform(reset), /scale\(1\)/);
});
