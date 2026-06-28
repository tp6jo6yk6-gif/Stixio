import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStickerPreset,
  StickerCategories,
  AssetRoles,
  getStickerPackageFilename,
  getRolePackageFilename,
  buildPackageFilenames
} from '../src/core/index.js';

test('Sticker big sticker preset applies platform canvas and safe margin', () => {
  const settings = applyStickerPreset({}, StickerCategories.BIG, AssetRoles.STICKER);
  assert.equal(settings.targetW, 396);
  assert.equal(settings.targetH, 660);
  assert.equal(settings.safeMargin, 20);
});

test('legacy order naming API remains backwards compatible', () => {
  assert.equal(getStickerPackageFilename(0), 'main.png');
  assert.equal(getStickerPackageFilename(1), 'tab.png');
  assert.equal(getStickerPackageFilename(2), '01.png');
});

test('explicit package roles do not consume sticker numbering', () => {
  assert.equal(getRolePackageFilename(AssetRoles.MAIN), 'main.png');
  assert.equal(getRolePackageFilename(AssetRoles.TAB), 'tab.png');
  assert.equal(getRolePackageFilename(AssetRoles.STICKER, 0), '01.png');
  assert.equal(getRolePackageFilename(AssetRoles.STICKER, 1), '02.png');
});

test('role-aware package filenames number stickers independently', () => {
  const items = buildPackageFilenames([
    { index: 0, role: AssetRoles.STICKER },
    { index: 1, role: AssetRoles.MAIN },
    { index: 2, role: AssetRoles.TAB },
    { index: 3, role: AssetRoles.STICKER }
  ], { packageNamingMode: true });

  assert.deepEqual(items.map(item => item.fileName), ['01.png', 'main.png', 'tab.png', '02.png']);
});
