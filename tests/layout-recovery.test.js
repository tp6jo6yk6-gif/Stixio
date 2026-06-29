import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDocument,
  addSourceRef,
  removeSourceRef,
  mergeDetectedFrameStates,
  getNextSourceId
} from '../src/core/index.js';

test('removing a source also removes only its Frames', () => {
  let document = createDocument({
    sourceRefs: [{ id: 'a' }, { id: 'b' }],
    frames: [
      { id: 'a1', sourceImageId: 'a' },
      { id: 'b1', sourceImageId: 'b' }
    ]
  });
  document = removeSourceRef(document, 'a');
  assert.deepEqual(document.sourceRefs.map(item => item.id), ['b']);
  assert.deepEqual(document.frames.map(item => item.id), ['b1']);
});

test('redetection preserves Frame ids and Package state', () => {
  const previous = [{
    id: 'old-1',
    name: 'Keep Me',
    geometry: { x: 0, y: 0, width: 100, height: 100 },
    custom: { outputRole: 'main', offsetX: 9, offsetY: -4, maskVersion: 3 },
    state: { exportSelected: false, packageRole: 'main' }
  }];
  const detected = [{
    id: 'new-1',
    geometry: { x: 3, y: 4, width: 95, height: 96 },
    custom: {},
    state: {}
  }];
  const merged = mergeDetectedFrameStates(previous, detected);
  assert.equal(merged[0].id, 'old-1');
  assert.equal(merged[0].name, 'Keep Me');
  assert.equal(merged[0].custom.outputRole, 'main');
  assert.equal(merged[0].custom.offsetX, 9);
  assert.equal(merged[0].custom.offsetY, -4);
  assert.equal(merged[0].state.exportSelected, false);
  assert.equal(merged[0].state.packageRole, 'main');
  assert.deepEqual(merged[0].geometry, detected[0].geometry);
});

test('redetection matches Frames by nearest geometry instead of array order', () => {
  const previous = [
    { id: 'left', geometry: { x: 0, y: 0, width: 100, height: 100 }, custom: { offsetX: 1 } },
    { id: 'right', geometry: { x: 500, y: 0, width: 100, height: 100 }, custom: { offsetX: 2 } }
  ];
  const detected = [
    { id: 'new-right', geometry: { x: 505, y: 0, width: 100, height: 100 } },
    { id: 'new-left', geometry: { x: 5, y: 0, width: 100, height: 100 } }
  ];
  const merged = mergeDetectedFrameStates(previous, detected);
  assert.equal(merged[0].id, 'right');
  assert.equal(merged[0].custom.offsetX, 2);
  assert.equal(merged[1].id, 'left');
  assert.equal(merged[1].custom.offsetX, 1);
});

test('source deletion selects the next source or previous last source', () => {
  assert.equal(getNextSourceId(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(getNextSourceId(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(getNextSourceId(['a'], 'a'), null);
});

test('Workshop UI exposes source deletion and state-preserving detection', async () => {
  const app = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  for (const token of [
    'selectedFrameBySource',
    'mergeDetectedFrameStates',
    'deleteSource(sourceId)',
    'removeSourceRef',
    "remove.textContent='刪除'",
    'selectFrame(frameId)'
  ]) assert.match(app, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
