import test from 'node:test';
import assert from 'node:assert/strict';
import { assertExportReviewReady } from '../src/core/export/index.js';
import { ReviewIssueSeverity } from '../src/core/review/index.js';

test('ZIP export blocks review errors even when warnings are allowed', () => {
  const review = {
    issues: [
      { code: 'render.blank', message: 'Blank output.', severity: ReviewIssueSeverity.ERROR }
    ]
  };

  assert.throws(
    () => assertExportReviewReady(review, { allowWarnings: true, allowWarningsOnly: true }),
    /ZIP export blocked/
  );
});

test('ZIP export allows warnings only when explicitly allowed', () => {
  const review = {
    issues: [
      { code: 'render.safeMargin', message: 'Near edge.', severity: ReviewIssueSeverity.WARNING }
    ]
  };

  assert.doesNotThrow(() => assertExportReviewReady(review, { allowWarnings: true }));
});
