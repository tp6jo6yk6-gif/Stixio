import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshopUrl = new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url);
const workflowUrl = new URL('../src/core/project-workflow.js', import.meta.url);
const workerUrl = new URL('../public/app/stixio-image-worker.js', import.meta.url);

async function source(url) {
  return readFile(url, 'utf8');
}

test('Review Grid uses a bounded virtual window for large result sets', async () => {
  const workshop = await source(workshopUrl);
  assert.match(workshop, /LARGE_PROJECT_PERFORMANCE_V1/);
  assert.match(workshop, /REVIEW_VIRTUAL_THRESHOLD=48/);
  assert.match(workshop, /function reviewVirtualWindow\(/);
  assert.match(workshop, /virtual\.items\.forEach/);
  assert.match(workshop, /reviewVirtualSpacer/);
});

test('Canvas and thumbnail caches have independent LRU limits', async () => {
  const workshop = await source(workshopUrl);
  assert.match(workshop, /renderCacheLimit: 48/);
  assert.match(workshop, /thumbnailCacheLimit: 160/);
  assert.match(workshop, /function enforceRenderCacheLimit\(/);
  assert.match(workshop, /function enforceThumbnailCacheLimit\(/);
  assert.match(workshop, /state\.reviewPassActive=true/);
  assert.match(workshop, /enforceRenderCacheLimit\(\)/);
});

test('Worker thumbnail pipeline uses createImageBitmap and OffscreenCanvas', async () => {
  const workshop = await source(workshopUrl);
  const worker = await source(workerUrl);
  assert.match(workshop, /function ensureImageWorker\(/);
  assert.match(workshop, /createImageBitmap\(canvas\)/);
  assert.match(workshop, /stixio-image-worker\.js/);
  assert.match(worker, /new OffscreenCanvas\(/);
  assert.match(worker, /convertToBlob/);
  assert.match(worker, /analyzeAlpha/);
});

test('Browser source images use Blob URLs instead of persistent Base64 strings', async () => {
  const workshop = await source(workshopUrl);
  const workflow = await source(workflowUrl);
  assert.match(workshop, /PROJECT_BLOB_ASSETS_V1/);
  assert.match(workshop, /URL\.createObjectURL\(file\)/);
  assert.match(workshop, /blob:file, objectUrl/);
  assert.match(workshop, /releaseAllSourceObjectUrls/);
  assert.match(workflow, /PROJECT_ARCHIVE_BLOB_ASSETS_V1/);
  assert.match(workflow, /sourceBlob\.arrayBuffer\(\)/);
  assert.match(workflow, /source\.blob = new Blob/);
});
