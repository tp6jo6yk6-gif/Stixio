import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshopPath = new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url);

async function readWorkshopSource() {
  return readFile(workshopPath, 'utf8');
}

test('Slider interaction uses a low-quality proxy and deferred full-quality rendering', async () => {
  const source = await readWorkshopSource();
  assert.match(source, /WORKSHOP_INTERACTION_PERFORMANCE_V1/);
  assert.match(source, /function renderSelectedLowQualityPreview\(\)/);
  assert.match(source, /maxSide=480/);
  assert.match(source, /highQuality:false/);
  assert.match(source, /function scheduleRenderAll\(delay=320\)/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /clearRenderCache\(false\)/);
});

test('Workshop refresh is split into focused UI sections', async () => {
  const source = await readWorkshopSource();
  for (const functionName of [
    'refreshLayoutSection',
    'refreshRefineSection',
    'refreshReviewSection',
    'refreshPackageSection',
    'refreshProjectSection',
    'refreshSelectionSections'
  ]) {
    assert.match(source, new RegExp(`function ${functionName}\\(`));
  }
});

test('Common interactions no longer rebuild the entire Workshop shell', async () => {
  const source = await readWorkshopSource();
  const shellRebuildCalls = source.match(/rerenderShell\(\);/g) || [];
  assert.ok(shellRebuildCalls.length <= 3, `Expected at most 3 exceptional shell rebuilds, received ${shellRebuildCalls.length}.`);

  assert.doesNotMatch(source, /function setLayoutMode\([^}]+rerenderShell\(\)/);
  assert.doesNotMatch(source, /function activateSource\([^}]+rerenderShell\(\)/);
  assert.doesNotMatch(source, /function resetRefineSettings\([^}]+rerenderShell\(\)/);
});

test('Deferred quality work cannot clear approvals created after an interaction', async () => {
  const source = await readWorkshopSource();
  assert.match(source, /WORKSHOP_INTERACTION_APPROVAL_RACE_FIX/);
  assert.match(source, /if\(!wasPreviewActive\)\{invalidateAllReviewApprovals\(\);invalidateReviewCaches\(\);\}/);
  assert.match(source, /function startFullQualityRender\([^)]*\)\{[^}]*clearRenderCache\(false\)/);
});
