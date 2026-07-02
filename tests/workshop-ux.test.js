import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GRID_RESET_FIELDS,
  clampViewportZoom,
  getWorkshopShortcut
} from '../src/ui/workshop-ux.js';

const root = new URL('../', import.meta.url);

const shortcut = (key, options = {}) => getWorkshopShortcut({ key, ...options });

test('viewport zoom is clamped to the supported range', () => {
  assert.equal(clampViewportZoom(0.01), 0.2);
  assert.equal(clampViewportZoom(2.5), 2.5);
  assert.equal(clampViewportZoom(99), 5);
  assert.equal(clampViewportZoom('invalid'), 1);
});

test('keyboard shortcuts cover history, frame actions, nudging and zoom', () => {
  assert.equal(shortcut('z', { ctrlKey: true }), 'undo');
  assert.equal(shortcut('z', { metaKey: true, shiftKey: true }), 'redo');
  assert.equal(shortcut('y', { ctrlKey: true }), 'redo');
  assert.equal(shortcut('d', { ctrlKey: true }), 'duplicate');
  assert.equal(shortcut('e', { ctrlKey: true, shiftKey: true }), 'export');
  assert.equal(shortcut('Delete'), 'delete');
  assert.equal(shortcut('ArrowLeft'), 'nudge-left');
  assert.equal(shortcut('ArrowRight', { shiftKey: true }), 'nudge-right-5');
  assert.equal(shortcut('0'), 'zoom-reset');
  assert.equal(shortcut('+'), 'zoom-in');
  assert.equal(shortcut('-'), 'zoom-out');
});

test('grid reset covers both margins and both gaps', () => {
  assert.deepEqual(GRID_RESET_FIELDS, [
    'marginXInput',
    'marginYInput',
    'gapXInput',
    'gapYInput'
  ]);
});

test('UX controller includes viewport, workspace and theme behavior', async () => {
  const source = await readFile(new URL('../src/ui/workshop-ux.js', import.meta.url), 'utf8');
  for (const token of [
    "addEventListener('wheel'",
    "addEventListener('pointerdown'",
    'MutationObserver',
    'uxClearWorkspace',
    'uxGridReset',
    'uxThemeToggle',
    'localStorage.setItem',
    'window.location.reload',
    'Space'
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('production entry bundles Workshop, UX, bridge, and diagnostics', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../src/ui/stixio-browser-entry.js', import.meta.url), 'utf8');
  assert.match(index, /public\/app\/stixio-workshop-1\.0\.0\.js/);
  assert.doesNotMatch(index, /import\(['"]\.\/src\//);
  assert.match(entry, /initStixioWorkshop/);
  assert.match(entry, /enhanceWorkshopUx/);
  assert.match(entry, /bridgeWorkshopLegacyControls/);
  assert.match(entry, /installBetaHardening/);
  assert.match(entry, /stixioReady/);
});
