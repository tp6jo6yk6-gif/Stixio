import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getWorkflowEmptyState,
  normalizeCollapsedColumns
} from '../src/ui/workshop-flow-experience.js';

test('layout shows an import guide only when no source exists', () => {
  assert.equal(getWorkflowEmptyState('layout', { sourceCount: 0, frameCount: 0 })?.title, '尚未匯入圖片');
  assert.equal(getWorkflowEmptyState('layout', { sourceCount: 1, frameCount: 0 }), null);
});

test('later workflow stages guide users back when there are no frames', () => {
  assert.equal(getWorkflowEmptyState('refine', { frameCount: 0 })?.action, 'layout');
  assert.equal(getWorkflowEmptyState('review', { frameCount: 0 })?.title, '尚無貼圖可檢查');
  assert.equal(getWorkflowEmptyState('package', { frameCount: 4 }), null);
});

test('collapsed column preferences are normalized to booleans', () => {
  assert.deepEqual(normalizeCollapsedColumns({ left: 1, right: 0 }), { left: true, right: false });
  assert.deepEqual(normalizeCollapsedColumns(), { left: false, right: false });
});
