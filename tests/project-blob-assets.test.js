import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument,
  createStixioProjectArchive,
  createWorkshopProjectSnapshot,
  parseStixioProjectArchive
} from '../src/core/index.js';

class ZipFile {
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

class Zip {
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
    this.files[path] = new ZipFile(entry);
    return this;
  }

  async generateAsync() {
    return new Blob([JSON.stringify(this.entries)], { type: 'application/zip' });
  }

  async loadAsync(blob) {
    const entries = JSON.parse(await blob.text());
    const archive = new Zip();
    archive.entries = entries;
    archive.files = Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, new ZipFile(entry)]));
    return archive;
  }
}

test('.stixio archive accepts Blob-backed source assets without persistent Base64 input', async () => {
  const sourceBlob = new Blob([Buffer.from('blob-backed-source')], { type: 'image/png' });
  const document = createDocument({
    id: 'blob-doc',
    name: 'Blob Project',
    sourceRefs: [{ id: 'blob-source', name: 'blob.png', width: 32, height: 32, mimeType: 'image/png' }],
    frames: [{
      id: 'blob-frame',
      name: 'Blob Frame',
      sourceImageId: 'blob-source',
      geometry: { x: 0, y: 0, width: 32, height: 32 },
      state: { visible: true, exportSelected: true, reviewApproved: false },
      custom: {}
    }]
  });
  const snapshot = createWorkshopProjectSnapshot({
    document,
    sources: [{
      id: 'blob-source',
      name: 'blob.png',
      width: 32,
      height: 32,
      mimeType: 'image/png',
      uri: null,
      blob: sourceBlob
    }]
  });

  assert.ok(snapshot.sources[0].blob instanceof Blob);
  assert.equal(snapshot.sources[0].uri, null);

  const archive = await createStixioProjectArchive({ snapshot, JSZipClass: Zip });
  const parsed = await parseStixioProjectArchive({ blob: archive.blob, JSZipClass: Zip });
  assert.ok(parsed.snapshot.sources[0].blob instanceof Blob);
  assert.equal(await parsed.snapshot.sources[0].blob.text(), 'blob-backed-source');
});
