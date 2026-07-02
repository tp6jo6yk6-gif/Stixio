import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKFLOW_STAGES,
  adjacentStage,
  summarizeWorkflowMetrics
} from '../src/ui/workshop-flow-app.js';

test('workflow exposes four ordered stages', () => {
  assert.deepEqual(
    WORKFLOW_STAGES.map(stage => stage.id),
    ['layout', 'refine', 'review', 'package']
  );
});

test('adjacentStage stops at workflow boundaries', () => {
  assert.equal(adjacentStage('layout', -1), null);
  assert.equal(adjacentStage('layout', 1), 'refine');
  assert.equal(adjacentStage('review', -1), 'refine');
  assert.equal(adjacentStage('package', 1), null);
});

test('workflow summaries use real counts and quality state', () => {
  const summary = summarizeWorkflowMetrics({
    sourceCount: 2,
    totalFrames: 40,
    refinedCount: 32,
    selectedCount: 40,
    approvedCount: 28,
    errors: 0,
    warnings: 3,
    packageReady: false,
    packageFileCount: 40
  });

  assert.equal(summary.layout.value, '2 張原圖 · 40 張貼圖');
  assert.equal(summary.refine.value, '已完成 32/40');
  assert.equal(summary.refine.percent, 80);
  assert.equal(summary.review.value, '已核准 28/40 · 3 警告');
  assert.equal(summary.review.tone, 'warning');
  assert.equal(summary.package.value, '尚缺 12 張核准');
});

test('ready package reports downloadable file count', () => {
  const summary = summarizeWorkflowMetrics({
    totalFrames: 24,
    selectedCount: 24,
    approvedCount: 24,
    packageReady: true,
    packageFileCount: 27
  });

  assert.equal(summary.review.percent, 100);
  assert.equal(summary.package.value, '可下載 · 27 個檔案');
  assert.equal(summary.package.percent, 100);
  assert.equal(summary.package.tone, 'complete');
});
