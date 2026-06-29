import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AssetRoles,
  PackageNamingModes,
  StickerCategories,
  buildWorkshopPackagePlan,
  clampSafeMargin,
  createPlatformNeutralRules,
  createSourceLayoutSettings,
  getAvailableAssetRoles,
  getStickerPackageFilename,
  getStickerPlacement,
  getStickerFilename
} from '../src/core/index.js';

test('fullscreen and effect categories expose their background roles', () => {
  assert.ok(getAvailableAssetRoles(StickerCategories.FULLSCREEN).includes(AssetRoles.BACKGROUND));
  assert.ok(getAvailableAssetRoles(StickerCategories.EFFECT).includes(AssetRoles.EFFECT_BACKGROUND));
});

test('source layout settings remain independent per source', () => {
  const first = createSourceLayoutSettings({ rows: 2, cols: 3, marginX: 10 });
  const second = createSourceLayoutSettings({ rows: 4, cols: 1, marginX: 20 });
  assert.notDeepEqual(first, second);
  assert.equal(first.rows, 2);
  assert.equal(second.rows, 4);
});

test('safe margin is clamped to the custom canvas', () => {
  assert.equal(clampSafeMargin(999, 100, 80), 39);
  assert.equal(clampSafeMargin(-5, 100, 80), 0);
});

test('platform-neutral rules do not use a platform brand key', () => {
  const rules = createPlatformNeutralRules({ targetW: 512, targetH: 512 });
  assert.equal(rules.key, 'workshop');
  assert.equal(rules.canvas.width, 512);
  assert.equal(rules.canvas.height, 512);
});

test('Workshop package plan supports special roles and package filenames', () => {
  const frames = [
    { id: 'main', state: { packageRole: AssetRoles.MAIN } },
    { id: 'tab', state: { packageRole: AssetRoles.TAB } },
    { id: 'one', state: { packageRole: AssetRoles.STICKER } },
    { id: 'two', state: { packageRole: AssetRoles.STICKER } }
  ];
  const plan = buildWorkshopPackagePlan(frames, { category: StickerCategories.NORMAL, namingMode: PackageNamingModes.PACKAGE });
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.items.map(item => item.fileName), ['main.png', 'tab.png', '01.png', '02.png']);
  assert.equal(getStickerPackageFilename(0), 'main.png');
  assert.equal(getStickerFilename(2, { packageNamingMode: true }), '01.png');
});

test('custom sequential naming applies prefix and suffix', () => {
  const frames = [{ id: 'a' }, { id: 'b' }];
  const plan = buildWorkshopPackagePlan(frames, {
    category: StickerCategories.NORMAL,
    namingMode: PackageNamingModes.SEQUENTIAL,
    prefix: 'pack',
    suffix: 'final'
  });
  assert.deepEqual(plan.items.map(item => item.fileName), ['pack_1_final.png', 'pack_2_final.png']);
});

test('placement supports bottom alignment and output offsets', () => {
  const placement = getStickerPlacement({ cropW: 100, cropH: 100 }, {
    targetW: 200,
    targetH: 300,
    safeMargin: 20,
    alignMode: 'bottom',
    offsetX: 5,
    offsetY: -3
  });
  assert.equal(placement.drawX, 25);
  assert.equal(placement.drawY, 117);
});

test('Workshop UI includes all first-batch output controls', async () => {
  const app = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  const packageController = await readFile(new URL('../src/ui/package-controller.js', import.meta.url), 'utf8');
  const ui = `${app}\n${packageController}`;
  for (const token of [
    'targetWInput',
    'safeMarginInput',
    'align-btn',
    'offsetXInput',
    'toggleSafeGuideBtn',
    'packageNamingModeInput',
    'reviewHeroStage',
    'maxFileSizeKBInput',
    'sourceLayouts'
  ]) {
    assert.match(ui, new RegExp(token));
  }
  assert.doesNotMatch(ui, /key\s*:\s*['"]line['"]/);
});
