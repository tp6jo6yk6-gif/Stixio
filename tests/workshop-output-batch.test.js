import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AssetRoles,
  StickerCategories,
  PackageNamingModes,
  getAvailableAssetRoles,
  createSourceLayoutSettings,
  applySourceLayoutSettings,
  clampSafeMargin,
  createPlatformNeutralRules,
  buildWorkshopPackagePlan,
  getStickerPlacement
} from '../src/core/index.js';

const root = new URL('../', import.meta.url);

test('fullscreen and effect categories expose their background roles', () => {
  assert.ok(getAvailableAssetRoles(StickerCategories.FULLSCREEN).includes(AssetRoles.BACKGROUND));
  assert.ok(getAvailableAssetRoles(StickerCategories.EFFECT).includes(AssetRoles.EFFECT_BACKGROUND));
});

test('source layout settings remain independent per source', () => {
  const first = createSourceLayoutSettings({ layoutMode: '2x2', rows: 2, cols: 2, gapX: 8 });
  const second = createSourceLayoutSettings({ layoutMode: '3x3', rows: 3, cols: 3, gapX: 20 });
  const merged = applySourceLayoutSettings({ tolerance: 30 }, first);
  assert.equal(merged.rows, 2);
  assert.equal(first.gapX, 8);
  assert.equal(second.gapX, 20);
});

test('safe margin is clamped to the custom canvas', () => {
  assert.equal(clampSafeMargin(100, 100, 80), 39);
  assert.equal(clampSafeMargin(12, 370, 320), 12);
});

test('platform-neutral rules do not use a platform brand key', () => {
  const rules = createPlatformNeutralRules({ category: StickerCategories.FULLSCREEN });
  assert.equal(rules.key, 'workshop');
  assert.ok(rules.package.roles.some(role => role.key === AssetRoles.BACKGROUND));
});

test('Workshop package plan supports special roles and package filenames', () => {
  const plan = buildWorkshopPackagePlan([
    { id: 's1', state: { packageRole: AssetRoles.STICKER } },
    { id: 'main', state: { packageRole: AssetRoles.MAIN } },
    { id: 'tab', state: { packageRole: AssetRoles.TAB } },
    { id: 'bg', state: { packageRole: AssetRoles.BACKGROUND } }
  ], { category: StickerCategories.FULLSCREEN, namingMode: PackageNamingModes.PACKAGE });
  assert.deepEqual(plan.items.map(item => item.fileName), ['01.png', 'main.png', 'tab.png', 'background.png']);
  assert.equal(plan.ready, true);
});

test('custom sequential naming applies prefix and suffix', () => {
  const plan = buildWorkshopPackagePlan([
    { id: 'a', state: { packageRole: AssetRoles.STICKER } },
    { id: 'b', state: { packageRole: AssetRoles.STICKER } }
  ], { namingMode: PackageNamingModes.SEQUENTIAL, prefix: 'pack', suffix: 'final' });
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
    assert.match(app, new RegExp(token));
  }
  assert.doesNotMatch(app, /key\s*:\s*['"]line['"]/);
});
