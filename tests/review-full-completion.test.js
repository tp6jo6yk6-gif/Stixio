import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewFilterModes,
  ReviewIssueSeverity,
  ReviewSortModes,
  analyzeRenderedCanvas,
  buildReviewItems,
  filterReviewItems,
  findDuplicateFileNames,
  getReviewProgress,
  invertFramesExportSelection,
  nextReviewFrameId,
  runFullReview,
  setFrameReviewApproval,
  setFramesExportSelection,
  setFramesReviewApproval,
  sortReviewItems
} from '../src/core/index.js';

function frame(id, overrides = {}) {
  return {
    id,
    name: overrides.name || id,
    sourceImageId: overrides.sourceImageId || 'source-1',
    geometry: overrides.geometry || { x: 0, y: 0, width: 100, height: 100 },
    state: {
      visible: true,
      exportSelected: true,
      reviewApproved: false,
      ...(overrides.state || {})
    },
    custom: overrides.custom || {}
  };
}

function fakeRendered(width, height, alphaAt, bytes = 2048) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = 100;
      data[offset + 1] = 120;
      data[offset + 2] = 140;
      data[offset + 3] = alphaAt(x, y);
    }
  }
  return {
    width,
    height,
    byteLength: bytes,
    getContext() {
      return {
        getImageData() {
          return { width, height, data };
        }
      };
    }
  };
}

test('pixel analysis reports directional margins and transparency ratios', () => {
  const rendered = fakeRendered(10, 8, (x, y) => x >= 2 && x <= 7 && y >= 1 && y <= 5 ? 255 : 0);
  const analysis = analyzeRenderedCanvas(rendered);
  assert.equal(analysis.supported, true);
  assert.deepEqual(analysis.edgeMargins, { top: 1, right: 2, bottom: 2, left: 2 });
  assert.equal(analysis.alphaCount, 30);
  assert.equal(analysis.nonTransparentRatio, 30 / 80);
  assert.equal(analysis.transparentRatio, 50 / 80);
});

test('full Review catches blank, safe-area, opaque, oversize and duplicate filenames', () => {
  const frames = [frame('a'), frame('b')];
  const renderedMap = new Map([
    ['a', fakeRendered(10, 10, () => 0, 9000)],
    ['b', fakeRendered(10, 10, () => 255, 9000)]
  ]);
  const report = runFullReview(frames, renderedMap, {
    targetW: 10,
    targetH: 10,
    safeMargin: 2,
    maxFileSizeKB: 1,
    packageItems: [
      { artworkId: 'a', fileName: 'same.png' },
      { artworkId: 'b', fileName: 'same.png' }
    ]
  });
  const codes = report.issues.map(issue => issue.code);
  assert.ok(codes.includes('render.blank'));
  assert.ok(codes.includes('render.safeMargin'));
  assert.ok(codes.includes('render.opaqueBackground'));
  assert.ok(codes.includes('render.fileTooLarge'));
  assert.ok(codes.includes('package.duplicateFilename'));
  assert.equal(report.ready, false);
  assert.equal(report.canPackage, false);
});

test('approval gating requires all selected frames approved and no errors', () => {
  const clean = fakeRendered(10, 10, (x, y) => x >= 2 && x <= 7 && y >= 2 && y <= 7 ? 255 : 0, 500);
  let frames = [frame('a'), frame('b')];
  const renderedMap = new Map([['a', clean], ['b', clean]]);
  let report = runFullReview(frames, renderedMap, { targetW: 10, targetH: 10, safeMargin: 2 });
  assert.equal(report.ready, false);
  assert.equal(report.approvedCount, 0);
  frames = setFramesReviewApproval(frames, ['a', 'b'], true);
  report = runFullReview(frames, renderedMap, { targetW: 10, targetH: 10, safeMargin: 2 });
  assert.equal(report.ready, true);
  assert.equal(report.canPackage, true);
  assert.equal(report.approvedCount, 2);
});

test('Review items filter, sort, progress and navigation stay deterministic', () => {
  const frames = [
    setFrameReviewApproval(frame('b', { name: 'Beta', sourceImageId: 'source-2' }), true, '2026-01-01T00:00:00.000Z'),
    frame('a', { name: 'Alpha', sourceImageId: 'source-1' }),
    frame('c', { name: 'Charlie', state: { exportSelected: false } })
  ];
  const renderedMap = new Map([
    ['b', fakeRendered(10, 10, () => 255, 5000)],
    ['a', fakeRendered(10, 10, () => 255, 1000)],
    ['c', fakeRendered(10, 10, () => 255, 3000)]
  ]);
  const issues = [
    { frameId: 'a', severity: ReviewIssueSeverity.ERROR, code: 'x', message: 'error' },
    { frameId: 'b', severity: ReviewIssueSeverity.WARNING, code: 'y', message: 'warning' }
  ];
  const items = buildReviewItems({
    frames,
    renderedMap,
    issues,
    packageItems: [
      { artworkId: 'a', fileName: 'alpha.png' },
      { artworkId: 'b', fileName: 'beta.png' },
      { artworkId: 'c', fileName: 'charlie.png' }
    ],
    sourceNames: new Map([['source-1', 'One'], ['source-2', 'Two']])
  });

  assert.deepEqual(filterReviewItems(items, { filter: ReviewFilterModes.ERRORS }).map(item => item.frameId), ['a']);
  assert.deepEqual(filterReviewItems(items, { filter: ReviewFilterModes.APPROVED }).map(item => item.frameId), ['b']);
  assert.deepEqual(filterReviewItems(items, { filter: ReviewFilterModes.EXCLUDED }).map(item => item.frameId), ['c']);
  assert.deepEqual(filterReviewItems(items, { query: 'alpha' }).map(item => item.frameId), ['a']);
  assert.deepEqual(sortReviewItems(items, ReviewSortModes.ISSUE_SEVERITY).map(item => item.frameId), ['a', 'b', 'c']);
  assert.deepEqual(sortReviewItems(items, ReviewSortModes.FILE_SIZE_DESC).map(item => item.frameId), ['b', 'c', 'a']);
  assert.deepEqual(sortReviewItems(items, ReviewSortModes.NAME).map(item => item.frameId), ['a', 'b', 'c']);

  const progress = getReviewProgress(items);
  assert.deepEqual(progress, {
    total: 3,
    selected: 2,
    excluded: 1,
    approved: 1,
    pending: 1,
    withErrors: 1,
    withWarnings: 1,
    percent: 50,
    ready: false
  });
  assert.equal(nextReviewFrameId(items, 'b', 1), 'a');
  assert.equal(nextReviewFrameId(items, 'b', -1), 'c');
});

test('batch export selection and approval helpers preserve unrelated frames', () => {
  const frames = [frame('a'), frame('b'), frame('c')];
  const selected = setFramesExportSelection(frames, ['a', 'c'], false);
  assert.equal(selected[0].state.exportSelected, false);
  assert.equal(selected[1].state.exportSelected, true);
  assert.equal(selected[2].state.exportSelected, false);

  const inverted = invertFramesExportSelection(selected, ['a', 'b']);
  assert.equal(inverted[0].state.exportSelected, true);
  assert.equal(inverted[1].state.exportSelected, false);
  assert.equal(inverted[2].state.exportSelected, false);

  const approved = setFramesReviewApproval(frames, ['a', 'b', 'c'], true, { blockedFrameIds: ['b'], timestamp: '2026-01-01T00:00:00.000Z' });
  assert.equal(approved[0].state.reviewApproved, true);
  assert.equal(approved[1].state.reviewApproved, false);
  assert.equal(approved[2].state.reviewApproved, true);
});

test('duplicate filename detection is case-insensitive and ignores blanks', () => {
  const groups = findDuplicateFileNames([
    { artworkId: 'a', fileName: 'Sticker.png' },
    { artworkId: 'b', fileName: 'sticker.PNG' },
    { artworkId: 'c', fileName: '' }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].fileName, 'sticker.png');
  assert.deepEqual(groups[0].items.map(item => item.artworkId), ['a', 'b']);
});
