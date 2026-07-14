import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Workshop UI module resolves every Core import', async () => {
  const module = await import('../src/ui/stixio-workshop-app-v2.js');
  assert.equal(typeof module.initStixioWorkshop, 'function');
});

test('Workshop detection UI starts with auto-first collapsed manual controls', async () => {
  const source = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  assert.match(source, /layoutMode:\s*'auto'/);
  assert.match(source, /manualLayoutOpen:\s*false/);
  assert.match(source, /manualLayoutToggle/);
  assert.match(source, /manualLayoutFields/);
  assert.match(source, /layoutMode:'auto',rows:1,cols:1,marginX:0,marginY:0,gapX:0,gapY:0,manualLayoutOpen:false/);
});

test('Workshop Refine editor stays quiet until a Frame is selected', async () => {
  const source = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  assert.match(source, /refineEmptyState/);
  assert.match(source, /尚未選取 Frame/);
  assert.match(source, /先在 Layout 或 Review 選一張貼圖/);
});

test('Workshop Refine controls use aligned compact rows', async () => {
  const source = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  assert.match(source, /compactRangeInput\('maskSizeInput'/);
  assert.match(source, /compactRangeInput\('maskOverlayOpacityInput'/);
  assert.match(source, /grid items-start gap-3/);
  assert.match(source, /mask-tool h-9/);
});

test('Workshop Review UI groups actions and keeps cards aligned', async () => {
  const source = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  assert.match(source, /reviewNextStepHint/);
  assert.match(source, /單張成品確認與儲存/);
  assert.match(source, /套用貼圖準則完成整包排序/);
  assert.match(source, /reviewPackCriterionInput/);
  assert.match(source, /LINE 一般貼圖/);
  assert.match(source, /reviewStickerCountInput/);
  assert.match(source, /reviewApplyPackRuleBtn/);
  assert.match(source, /applyReviewPackRule/);
  assert.match(source, /DestinationProfileKeys\.STANDARD/);
  assert.match(source, /其餘放入備選/);
  assert.match(source, /reviewGoPackageBtn/);
  assert.match(source, /儲存 PNG/);
  assert.match(source, /備選/);
  assert.match(source, />選取</);
  assert.match(source, />核准</);
  assert.match(source, /min-h-\[78px\]/);
  assert.match(source, /\$\{progress\.approved\}\/\$\{progress\.selected\} 已核准/);
  assert.match(source, /\$\{progress\.withErrors\} 錯誤/);
  assert.match(source, /\$\{progress\.withWarnings\} 警告/);
  assert.match(source, /\$\{progress\.excluded\} 排除/);
});

test('Workshop Package UI owns arrangement and delivery wording', async () => {
  const source = await readFile(new URL('../src/ui/package-controller.js', import.meta.url), 'utf8');
  assert.match(source, /Package · Arrange & Delivery/);
  assert.match(source, /整包編排與交付/);
  assert.match(source, /確認整包角色、輸出路徑、檔案大小與核准狀態/);
  assert.match(source, /iconMark\('↓'\)/);
  assert.match(source, /iconMark\('ZIP'\)/);
  assert.match(source, /toggleOption\('packageManifestJsonInput','DOC','JSON 清單'/);
  assert.match(source, /已可交付，可下載 PNG 或產生 ZIP/);
  assert.match(source, /輸出清單/);
});
