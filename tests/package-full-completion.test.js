import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PackageCompressionModes,
  PackageFolderModes,
  addPackageChecksums,
  buildPackageEntries,
  buildPackagePath,
  createChecksumsFile,
  createCompletePackageArchive,
  createPackageDeliverySettings,
  createPackageManifest,
  createPackageManifestCsv,
  createPackagePreflight,
  normalizeZipFileName,
  sanitizePackageFileName,
  sanitizePackageSegment,
  sha256Hex,
  validatePackageEntries
} from '../src/core/index.js';

function fakeCanvas(base64 = Buffer.from('png-bytes').toString('base64'), width = 370, height = 320) {
  return {
    width,
    height,
    toDataURL() {
      return `data:image/png;base64,${base64}`;
    }
  };
}

function frame(id, overrides = {}) {
  return {
    id,
    name: overrides.name || id,
    sourceImageId: overrides.sourceImageId || 'source-1',
    state: {
      visible: true,
      exportSelected: true,
      reviewApproved: true,
      ...(overrides.state || {})
    }
  };
}

class FakeZip {
  static lastGeneratedFiles = null;

  constructor() {
    this.files = {};
  }

  file(path, data, options = {}) {
    this.files[path] = { data, options, dir: false };
    return this;
  }

  async generateAsync(_options, onUpdate) {
    FakeZip.lastGeneratedFiles = Object.keys(this.files);
    onUpdate?.({ percent: 25, currentFile: FakeZip.lastGeneratedFiles[0] });
    onUpdate?.({ percent: 100, currentFile: FakeZip.lastGeneratedFiles.at(-1) });
    return new Blob([JSON.stringify(FakeZip.lastGeneratedFiles)], { type: 'application/zip' });
  }

  async loadAsync(blob) {
    const names = JSON.parse(await blob.text());
    return { files: Object.fromEntries(names.map(name => [name, { dir: false }])) };
  }
}

test('Package names remove unsafe and reserved filesystem characters', () => {
  assert.equal(sanitizePackageSegment('  CON  '), '_CON');
  assert.equal(sanitizePackageSegment('a/b:c*?d'), 'a-b-c-d');
  assert.equal(sanitizePackageFileName('../Hero:01.PNG'), 'Hero-01.png');
  assert.equal(normalizeZipFileName('  My / Package.zip '), 'My-Package.zip');
});

test('Package paths support flat, role, source and source-role layouts', () => {
  const item = { fileName: '01.png', role: 'sticker', sourceImageId: 'source-1' };
  const names = new Map([['source-1', 'Sheet A']]);
  assert.equal(buildPackagePath(item, { folderMode: PackageFolderModes.FLAT }, names), '01.png');
  assert.equal(buildPackagePath(item, { folderMode: PackageFolderModes.ROLE }, names), 'sticker/01.png');
  assert.equal(buildPackagePath(item, { folderMode: PackageFolderModes.SOURCE }, names), 'Sheet A/01.png');
  assert.equal(buildPackagePath(item, { folderMode: PackageFolderModes.SOURCE_ROLE, rootFolder: 'Delivery' }, names), 'Delivery/Sheet A/sticker/01.png');
});

test('Package entries include source, dimensions, size, approval and final path', () => {
  const frames = [frame('a', { name: 'Hello', sourceImageId: 'sheet-a' })];
  const canvas = fakeCanvas();
  const entries = buildPackageEntries({
    items: [{ artworkId: 'a', role: 'sticker', roleLabel: 'Sticker', fileName: '01.png', order: 0, stickerIndex: 1 }],
    frames,
    renderedMap: new Map([['a', canvas]]),
    sourceNames: new Map([['sheet-a', 'Sheet A']]),
    settings: { folderMode: PackageFolderModes.SOURCE_ROLE, rootFolder: 'Output' }
  });
  assert.equal(entries[0].path, 'Output/Sheet A/sticker/01.png');
  assert.equal(entries[0].sourceName, 'Sheet A');
  assert.equal(entries[0].width, 370);
  assert.equal(entries[0].height, 320);
  assert.equal(entries[0].approved, true);
  assert.ok(entries[0].bytes > 0);
});

test('Package validation blocks missing renders, unapproved files and duplicate paths', () => {
  const canvas = fakeCanvas();
  const entries = [
    { frameId: 'a', name: 'A', path: '01.png', fileName: '01.png', approved: false, canvas, bytes: 10 },
    { frameId: 'b', name: 'B', path: '01.png', fileName: '01.png', approved: true, canvas: null, bytes: 0 }
  ];
  const validation = validatePackageEntries(entries, { includeManifestJson: false, includeManifestCsv: false, includeChecksums: false });
  const codes = validation.errors.map(issue => issue.code);
  assert.ok(codes.includes('package.review.pending'));
  assert.ok(codes.includes('package.canvas.missing'));
  assert.ok(codes.includes('package.path.duplicate'));
  assert.equal(validation.ready, false);
  assert.ok(validation.warnings.some(issue => issue.code === 'package.manifest.disabled'));
  assert.ok(validation.warnings.some(issue => issue.code === 'package.checksums.disabled'));
});

test('Package preflight merges role, Review and delivery issues without duplicates', () => {
  const canvas = fakeCanvas();
  const entries = [{ frameId: 'a', name: 'A', path: '01.png', fileName: '01.png', approved: true, canvas, bytes: 10, role: 'sticker' }];
  const issue = { code: 'same', message: 'Same issue', severity: 'warning', frameId: 'a' };
  const preflight = createPackagePreflight({
    entries,
    packagePlan: { ready: true, validation: { errors: [], warnings: [issue] } },
    reviewReport: { canPackage: true, issues: [issue] },
    settings: {}
  });
  assert.equal(preflight.ready, true);
  assert.equal(preflight.warnings.filter(item => item.code === 'same').length, 1);
});

test('Manifest JSON and CSV contain reproducible package metadata', () => {
  const entries = [{
    frameId: 'a', fileName: '01.png', path: 'stickers/01.png', name: 'Hello, "World"', role: 'sticker',
    sourceImageId: 'source-1', sourceName: 'Sheet A', order: 0, stickerIndex: 1,
    width: 370, height: 320, bytes: 1234, sha256: 'abc', approved: true
  }];
  const manifest = createPackageManifest({
    entries,
    settings: { zipBaseName: 'Demo', folderMode: PackageFolderModes.ROLE },
    metadata: { documentId: 'doc-1', documentName: 'Demo Project', targetW: 370, targetH: 320, category: 'normal', safeMargin: 15 },
    now: new Date('2026-06-29T00:00:00.000Z')
  });
  assert.equal(manifest.generatedAt, '2026-06-29T00:00:00.000Z');
  assert.equal(manifest.delivery.zipFileName, 'Demo.zip');
  assert.equal(manifest.files[0].path, 'stickers/01.png');
  const csv = createPackageManifestCsv(entries);
  assert.match(csv, /"Hello, ""World"""/);
});

test('SHA-256 and checksum file use real digest values', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  const entries = await addPackageChecksums([{ path: '01.png', base64: Buffer.from('abc').toString('base64') }]);
  assert.equal(entries[0].sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(createChecksumsFile(entries), `${entries[0].sha256}  01.png`);
});

test('Complete Package archive includes support files and verifies final contents', async () => {
  const settings = createPackageDeliverySettings({
    zipBaseName: 'Release',
    rootFolder: 'Delivery',
    folderMode: PackageFolderModes.FLAT,
    includeManifestJson: true,
    includeManifestCsv: true,
    includeChecksums: true,
    includeReadme: true,
    compression: PackageCompressionModes.DEFLATE,
    compressionLevel: 7
  });
  const entries = [{
    frameId: 'a', name: 'A', role: 'sticker', sourceImageId: 'source-1', sourceName: 'Sheet A',
    fileName: '01.png', path: 'Delivery/01.png', order: 0, stickerIndex: 1,
    width: 370, height: 320, bytes: 3, approved: true, base64: Buffer.from('abc').toString('base64')
  }];
  const progress = [];
  const result = await createCompletePackageArchive({
    entries,
    settings,
    metadata: { documentName: 'Release', targetW: 370, targetH: 320 },
    JSZipClass: FakeZip,
    onProgress: update => progress.push(update.stage),
    now: new Date('2026-06-29T00:00:00.000Z')
  });
  assert.equal(result.fileName, 'Release.zip');
  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.supportFiles.sort(), [
    'Delivery/README.txt',
    'Delivery/checksums.sha256',
    'Delivery/stixio-package.csv',
    'Delivery/stixio-package.json'
  ].sort());
  assert.ok(progress.includes('hashing'));
  assert.ok(progress.includes('compressing'));
  assert.ok(progress.includes('verifying'));
  assert.ok(progress.includes('complete'));
});

test('Complete Package archive supports cancellation before generation', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    createCompletePackageArchive({
      entries: [{ frameId: 'a', name: 'A', path: '01.png', fileName: '01.png', approved: true, base64: Buffer.from('abc').toString('base64'), bytes: 3, canvas: fakeCanvas() }],
      JSZipClass: FakeZip,
      signal: controller.signal
    }),
    error => error.name === 'AbortError'
  );
});
