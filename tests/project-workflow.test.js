import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryProjectStorage,
  WORKSHOP_PROJECT_SCHEMA_VERSION,
  createDocument,
  createStixioProjectArchive,
  createWorkshopProjectSnapshot,
  migrateWorkshopProject,
  parseStixioProjectArchive,
  projectSummary,
  serializeFrame,
  validateWorkshopProject,
  verifyStixioProjectArchive
} from '../src/core/index.js';

const PNG_BASE64 = Buffer.from('fake-png-data').toString('base64');
const MASK_BASE64 = Buffer.from('fake-mask-data').toString('base64');

function source(id = 'source-1') {
  return {
    id,
    name: 'Sheet A.png',
    width: 800,
    height: 800,
    mimeType: 'image/png',
    uri: `data:image/png;base64,${PNG_BASE64}`,
    img: { runtimeOnly: true }
  };
}

function maskCanvas() {
  return {
    width: 100,
    height: 100,
    toDataURL() {
      return `data:image/png;base64,${MASK_BASE64}`;
    }
  };
}

function workshopSnapshot() {
  const document = createDocument({
    id: 'doc-1',
    name: 'Project Alpha',
    sourceRefs: [source()],
    frames: [{
      id: 'frame-1',
      name: 'Hello',
      sourceImageId: 'source-1',
      geometry: { x: 10, y: 20, width: 100, height: 100 },
      state: { visible: true, exportSelected: true, reviewApproved: true, packageRole: 'sticker' },
      custom: { offsetX: 4, offsetY: -2, maskVersion: 3, protectMaskCanvas: maskCanvas() }
    }]
  });
  return createWorkshopProjectSnapshot({
    document,
    settings: { targetW: 370, targetH: 320, chromaEnabled: true, packageNamingMode: 'package' },
    sources: new Map([['source-1', source()]]),
    sourceLayouts: new Map([['source-1', { layoutMode: '2x2', rows: 2, cols: 2, marginX: 10 }]]),
    selectedFrameBySource: new Map([['source-1', 'frame-1']]),
    activeSourceId: 'source-1',
    selectedFrameId: 'frame-1',
    packageState: { settings: { zipBaseName: 'Delivery', folderMode: 'source-role' }, history: [] },
    metadata: { previewDataUrl: `data:image/png;base64,${PNG_BASE64}` },
    now: new Date('2026-06-30T00:00:00.000Z')
  });
}

class FakeZipFile {
  constructor(entry) {
    this.entry = entry;
    this.dir = false;
  }

  async async(type) {
    const bytes = this.entry.kind === 'text'
      ? new TextEncoder().encode(this.entry.value)
      : Uint8Array.from(Buffer.from(this.entry.value, 'base64'));
    if (type === 'string') return this.entry.kind === 'text' ? this.entry.value : new TextDecoder().decode(bytes);
    if (type === 'base64') return Buffer.from(bytes).toString('base64');
    if (type === 'uint8array') return bytes;
    return bytes.buffer;
  }
}

class FakeZip {
  constructor() {
    this.entries = {};
    this.files = {};
  }

  file(path, value) {
    if (arguments.length === 1) return this.files[path] || null;
    const entry = typeof value === 'string'
      ? { kind: 'text', value }
      : { kind: 'base64', value: Buffer.from(value).toString('base64') };
    this.entries[path] = entry;
    this.files[path] = new FakeZipFile(entry);
    return this;
  }

  async generateAsync(_options, onUpdate) {
    const names = Object.keys(this.entries);
    onUpdate?.({ percent: 50, currentFile: names[0] || null });
    onUpdate?.({ percent: 100, currentFile: names.at(-1) || null });
    return new Blob([JSON.stringify(this.entries)], { type: 'application/zip' });
  }

  async loadAsync(blob) {
    const entries = JSON.parse(await blob.text());
    const archive = new FakeZip();
    archive.entries = entries;
    archive.files = Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, new FakeZipFile(entry)]));
    return archive;
  }
}

test('Workshop snapshot preserves all stage state while removing runtime image objects', () => {
  const snapshot = workshopSnapshot();
  assert.equal(snapshot.schemaVersion, WORKSHOP_PROJECT_SCHEMA_VERSION);
  assert.equal(snapshot.name, 'Project Alpha');
  assert.equal(snapshot.sources[0].img, undefined);
  assert.equal(snapshot.sources[0].uri, `data:image/png;base64,${PNG_BASE64}`);
  assert.equal(snapshot.document.frames[0].state.reviewApproved, true);
  assert.equal(snapshot.document.frames[0].state.packageRole, 'sticker');
  assert.equal(snapshot.document.frames[0].custom.protectMaskCanvas, undefined);
  assert.equal(snapshot.document.frames[0].custom.protectMask.dataUrl, `data:image/png;base64,${MASK_BASE64}`);
  assert.deepEqual(snapshot.sourceLayouts[0], ['source-1', { layoutMode: '2x2', rows: 2, cols: 2, marginX: 10 }]);
  assert.equal(snapshot.packageState.settings.folderMode, 'source-role');
  assert.equal(validateWorkshopProject(snapshot).ready, true);
});

test('Frame serialization retains mask dimensions and custom offsets', () => {
  const frame = serializeFrame({
    id: 'frame-a',
    custom: { offsetX: 8, offsetY: 3, protectMaskCanvas: maskCanvas() }
  });
  assert.equal(frame.custom.offsetX, 8);
  assert.equal(frame.custom.protectMask.width, 100);
  assert.equal(frame.custom.protectMask.height, 100);
  assert.equal(frame.custom.protectMaskCanvas, undefined);
});

test('Legacy project data migrates into the current Workshop schema', () => {
  const migrated = migrateWorkshopProject({
    schemaVersion: '1.0.0',
    id: 'legacy-1',
    name: 'Legacy',
    sources: [source()],
    frames: [{ id: 'frame-1', sourceImageId: 'source-1', geometry: { x: 0, y: 0, width: 10, height: 10 } }],
    settings: { targetW: 512, targetH: 512 }
  });
  assert.equal(migrated.schemaVersion, WORKSHOP_PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.document.frames.length, 1);
  assert.equal(migrated.metadata.migratedFrom, '1.0.0');
});

test('Future project schema is rejected instead of silently corrupting state', () => {
  assert.throws(
    () => migrateWorkshopProject({ schemaVersion: '99.0.0' }),
    error => error.name === 'ProjectVersionError'
  );
});

test('Project validation identifies missing source references', () => {
  const snapshot = workshopSnapshot();
  snapshot.document.frames[0].sourceImageId = 'missing-source';
  const validation = validateWorkshopProject(snapshot);
  assert.equal(validation.ready, false);
  assert.ok(validation.errors.some(issue => issue.code === 'project.frame.sourceMissing'));
});

test('.stixio archive round trip restores source assets and manual masks', async () => {
  const progress = [];
  const created = await createStixioProjectArchive({
    snapshot: workshopSnapshot(),
    JSZipClass: FakeZip,
    now: new Date('2026-06-30T01:00:00.000Z'),
    onProgress: update => progress.push(update.stage)
  });
  assert.equal(created.fileName, 'Project Alpha.stixio');
  assert.equal(created.verification.verified, true);
  assert.ok(progress.includes('hashing'));
  assert.ok(progress.includes('compressing'));
  assert.ok(progress.includes('complete'));

  const parsed = await parseStixioProjectArchive({ blob: created.blob, JSZipClass: FakeZip });
  assert.equal(parsed.snapshot.sources[0].uri, `data:image/png;base64,${PNG_BASE64}`);
  assert.equal(parsed.snapshot.document.frames[0].custom.protectMask.dataUrl, `data:image/png;base64,${MASK_BASE64}`);
  assert.equal(parsed.snapshot.document.frames[0].state.reviewApproved, true);
  assert.equal(parsed.snapshot.packageState.settings.zipBaseName, 'Delivery');
});

test('.stixio archive exposes verified internal files', async () => {
  const created = await createStixioProjectArchive({ snapshot: workshopSnapshot(), JSZipClass: FakeZip });
  const verification = await verifyStixioProjectArchive({ blob: created.blob, JSZipClass: FakeZip });
  assert.equal(verification.verified, true);
  assert.ok(verification.paths.includes('project.json'));
  assert.ok(verification.paths.includes('assets/source-1.png'));
  assert.ok(verification.paths.includes('masks/frame-1.png'));
  assert.ok(verification.paths.includes('checksums.sha256'));
});

test('Memory project storage supports save, recent list, duplicate, autosave and delete', async () => {
  const storage = new MemoryProjectStorage();
  const saved = await storage.saveProject(workshopSnapshot());
  assert.equal(saved.id, 'doc-1');
  assert.equal((await storage.listProjects()).length, 1);
  assert.equal((await storage.loadProject('doc-1')).name, 'Project Alpha');

  const duplicate = await storage.duplicateProject('doc-1', { name: 'Project Alpha Copy' });
  assert.notEqual(duplicate.id, 'doc-1');
  assert.equal(duplicate.name, 'Project Alpha Copy');
  assert.equal((await storage.listProjects()).length, 2);

  await storage.saveAutosave({ ...workshopSnapshot(), name: 'Autosaved Project' });
  const autosave = await storage.getLatestAutosave();
  assert.equal(autosave.name, 'Autosaved Project');
  await storage.clearAutosave('doc-1');
  assert.equal(await storage.loadAutosave('doc-1'), null);

  await storage.deleteProject(duplicate.id);
  assert.equal((await storage.listProjects()).length, 1);
});

test('Project summary is compact and suitable for recent project cards', () => {
  const snapshot = workshopSnapshot();
  const summary = projectSummary(snapshot);
  assert.deepEqual(summary, {
    id: 'doc-1',
    name: 'Project Alpha',
    createdAt: snapshot.createdAt,
    updatedAt: '2026-06-30T00:00:00.000Z',
    sourceCount: 1,
    frameCount: 1,
    schemaVersion: WORKSHOP_PROJECT_SCHEMA_VERSION,
    previewDataUrl: `data:image/png;base64,${PNG_BASE64}`
  });
});
