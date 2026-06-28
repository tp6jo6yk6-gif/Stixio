import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecoverySnapshot,
  saveRecoverySnapshot,
  loadRecoverySnapshot,
  clearRecoverySnapshot
} from '../src/core/recovery/index.js';

function createMemoryStorage() {
  const store = new Map();
  return {
    setItem: (key, value) => store.set(key, value),
    getItem: key => store.get(key) || null,
    removeItem: key => store.delete(key)
  };
}

test('local recovery saves and loads snapshot', () => {
  const storage = createMemoryStorage();
  const snapshot = createRecoverySnapshot({
    source: { id: 'source-1', fileName: 'sheet.png', width: 100, height: 100, dataUrl: 'data:image/png;base64,abc' },
    frames: [{ id: 'frame-1', geometry: { x: 0, y: 0, width: 10, height: 10 } }],
    settings: { rows: 1, cols: 1 }
  });

  assert.equal(saveRecoverySnapshot(snapshot, storage), true);
  const loaded = loadRecoverySnapshot(storage);
  assert.equal(loaded.source.fileName, 'sheet.png');
  assert.equal(loaded.frames.length, 1);
  assert.equal(loaded.settings.rows, 1);
});

test('local recovery can clear snapshot', () => {
  const storage = createMemoryStorage();
  const snapshot = createRecoverySnapshot({ frames: [], settings: {} });
  saveRecoverySnapshot(snapshot, storage);
  assert.equal(clearRecoverySnapshot(storage), true);
  assert.equal(loadRecoverySnapshot(storage), null);
});
