import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyStixioFailure,
  createDiagnosticsSnapshot,
  inspectStixioProjectArchive,
  STIXIO_BETA_LIMITS,
  validateImportFiles
} from '../src/ui/beta-hardening-core.js';

test('classifies storage, damaged project, and runtime dependency failures', () => {
  assert.equal(classifyStixioFailure(new DOMException('Quota reached', 'QuotaExceededError')).code, 'STORAGE_UNAVAILABLE');

  const damaged = new Error('這不是有效的 .stixio 專案檔案。');
  damaged.name = 'ProjectArchiveError';
  assert.deepEqual(
    { code: classifyStixioFailure(damaged).code, title: classifyStixioFailure(damaged).title },
    { code: 'PROJECT_DAMAGED', title: '專案檔案可能已損壞' }
  );

  const runtime = new Error('JSZip is not available.');
  runtime.name = 'RuntimeAssetError';
  assert.equal(classifyStixioFailure(runtime).code, 'RUNTIME_ASSET_MISSING');
});

test('validates artwork type, size, and empty files before import', () => {
  const valid = { name: 'sticker.png', type: 'image/png', size: 12_345 };
  const invalid = { name: 'notes.txt', type: 'text/plain', size: 12 };
  const empty = { name: 'empty.png', type: 'image/png', size: 0 };
  const huge = { name: 'huge.webp', type: 'image/webp', size: STIXIO_BETA_LIMITS.maxImageBytes + 1 };

  const result = validateImportFiles([valid, invalid, empty, huge]);
  assert.deepEqual(result.accepted, [valid]);
  assert.deepEqual(result.rejected.map(item => item.code), [
    'UNSUPPORTED_IMAGE_TYPE', 'EMPTY_FILE', 'IMAGE_TOO_LARGE'
  ]);
  assert.equal(result.ready, false);
});

test('diagnostics contain runtime metadata but not project or artwork payloads', () => {
  const report = createDiagnosticsSnapshot({
    version: '1.0.0-rc.1',
    build: 'abc123',
    navigator: { onLine: true, userAgent: 'Test Browser', language: 'zh-TW', platform: 'test' },
    screen: { width: 1920, height: 1080 },
    location: { pathname: '/index.html' },
    storage: { usage: 10, quota: 100 },
    errors: [{ time: '2026-07-01T00:00:00Z', code: 'TEST', title: 'Test', message: 'safe summary', source: 'unit' }],
    indexedDB: true,
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2
  });

  assert.equal(report.schema, 'stixio-diagnostics/v1');
  assert.deepEqual(report.app, { name: 'Stixio Workshop', version: '1.0.0-rc.1', build: 'abc123' });
  assert.deepEqual(report.storage, { usage: 10, quota: 100, remaining: 90 });
  assert.equal(report.recentErrors.length, 1);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /data:image|project\.json|sourceRefs|protectMask/i);
});

test('rejects oversized project archives before ZIP parsing', async () => {
  await assert.rejects(
    inspectStixioProjectArchive(
      { size: 101 },
      { JSZipClass: class FakeZip {}, limits: { ...STIXIO_BETA_LIMITS, maxProjectBytes: 100 } }
    ),
    error => error.name === 'ProjectArchiveSizeError' && /超過/.test(error.message)
  );
});

test('rejects unsafe archive paths before project restoration', async () => {
  class UnsafeZip {
    static async loadAsync() {
      return {
        files: {
          '../outside.txt': { dir: false, unsafeOriginalName: '../outside.txt' }
        },
        file() { return null; }
      };
    }
  }

  await assert.rejects(
    inspectStixioProjectArchive({ size: 10 }, { JSZipClass: UnsafeZip }),
    error => error.name === 'ProjectArchivePathError' && /不安全路徑/.test(error.message)
  );
});
