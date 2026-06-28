import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLinePreset,
  LineStickerCategories,
  LineAssetRoles,
  getLineStickerFilename,
  getLineRoleFilename,
  buildPackageFilenames
} from '../src/core/index.js';

test('LINE big sticker preset applies platform canvas and safe margin', () => {
  const settings = applyLinePreset({}, LineStickerCategories.BIG, LineAssetRoles.STICKER);
  assert.equal(settings.targetW, 396);
  assert.equal(settings.targetH, 660);
  assert.equal(settings.safeMargin, 20);
});

test('legacy order naming API remains backwards compatible', () => {
  assert.equal(getLineStickerFilename(0), 'main.png');
  assert.equal(getLineStickerFilename(1), 'tab.png');
  assert.equal(getLineStickerFilename(2), '01.png');
});

test('explicit package roles do not consume sticker numbering', () => {
  assert.equal(getLineRoleFilename(LineAssetRoles.MAIN), 'main.png');
  assert.equal(getLineRoleFilename(LineAssetRoles.TAB), 'tab.png');
  assert.equal(getLineRoleFilename(LineAssetRoles.STICKER, 0), '01.png');
  assert.equal(getLineRoleFilename(LineAssetRoles.STICKER, 1), '02.png');
});

test('role-aware package filenames number stickers independently', () => {
  const items = buildPackageFilenames([
    { index: 0, role: LineAssetRoles.STICKER },
    { index: 1, role: LineAssetRoles.MAIN },
    { index: 2, role: LineAssetRoles.TAB },
    { index: 3, role: LineAssetRoles.STICKER }
  ], { lineNamingMode: true });

  assert.deepEqual(items.map(item => item.fileName), ['01.png', 'main.png', 'tab.png', '02.png']);
});
