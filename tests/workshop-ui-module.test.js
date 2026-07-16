import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

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
  assert.match(source, /stage-layout/);
  assert.match(source, /stage-review/);
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
  assert.match(source, /getAvailablePlatformSpecs/);
  assert.match(source, /getPlatformSpec/);
  assert.match(source, /PlatformSpecKeys\.MESSAGING_STANDARD/);
  assert.match(source, /reviewPackCriterionInput/);
  assert.match(source, /reviewStickerCountInput/);
  assert.match(source, /reviewApplyPackRuleBtn/);
  assert.match(source, /applyReviewPackRule/);
  assert.match(source, /applyPlatformStickerReviewRule/);
  assert.match(source, /normalizePlatformStickerCount/);
  assert.match(source, /single-download/);
  assert.match(source, /export-check/);
  assert.match(source, /role-select/);
  assert.match(source, /review-approve/);
  assert.match(source, /min-h-\[78px\]/);
  assert.match(source, /progress\.approved/);
  assert.match(source, /progress\.withErrors/);
  assert.match(source, /progress\.withWarnings/);
  assert.match(source, /progress\.excluded/);
});

test('Platform specs are the Review and Package source of truth', async () => {
  const specs = await import('../src/core/platform-specs.js');
  const available = specs.getAvailablePlatformSpecs();
  const standard = specs.getPlatformSpec(specs.PlatformSpecKeys.MESSAGING_STANDARD);
  const app = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  const pkg = await readFile(new URL('../src/ui/package-controller.js', import.meta.url), 'utf8');

  assert.ok(available.length >= 1);
  assert.equal(standard.key, specs.PlatformSpecKeys.MESSAGING_STANDARD);
  assert.equal(standard.deliveryLabel, '訊息貼圖標準包');
  assert.equal(standard.status, specs.PlatformSpecStatuses.AVAILABLE);
  assert.deepEqual(specs.getPlatformStickerCounts(standard.key), [8, 16, 24, 32, 40]);
  assert.equal(specs.getPlatformSlots(standard.key).main.fileName, 'main.png');
  assert.equal(specs.getPlatformSlots(standard.key).tab.fileName, 'tab.png');
  assert.equal(specs.getPlatformNaming(standard.key).stickerFileNameAt(0), '01.png');
  assert.equal(specs.normalizePlatformStickerCount(standard.key, 24), 24);
  assert.equal(specs.normalizePlatformStickerCount(standard.key, 99), standard.defaultStickerCount);
  assert.match(app, /getPlatformSpec\(state\.settings\.reviewPackCriterion\)/);
  assert.match(app, /getPlatformSpec:\(\)=>getPlatformSpec\(state\.settings\.reviewPackCriterion\)/);
  assert.match(pkg, /snapshot\.platformSpec\?\.deliveryLabel/);
});

test("Workshop Package UI presents delivery confirmation controls", async () => {
  const source = await readFile(new URL("../src/ui/package-controller.js", import.meta.url), "utf8");
  assert.match(source, /Package . Delivery Confirmation/);
  assert.match(source, /交付確認/);
  assert.match(source, /產生交付 ZIP/);
  assert.match(source, /下載全部 PNG/);
  assert.doesNotMatch(source, /LINE ZIP/);
  assert.match(source, /交付規格/);
  assert.match(source, /platformSpec/);
  assert.match(source, /packageDeliverySummary/);
  assert.match(source, /packageBackToReviewBtn/);
  assert.match(source, /renderDeliverySummary/);
  assert.match(source, /packageAdvancedSettings/);
  assert.match(source, /packageFileDetails/);
  assert.match(source, /summaryTile/);
  assert.match(source, /openReview/);
  assert.match(source, /getAllFrames/);
  assert.ok(source.includes("iconMark('PNG')"));
  assert.ok(source.includes("iconMark('ZIP')"));
  assert.ok(source.includes("toggleOption('packageManifestJsonInput','DOC'"));
});
test('Workshop uses Review-led planning screens', async () => {
  const app = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../src/ui/stixio-browser-entry.js', import.meta.url), 'utf8');
  assert.match(app, /renderReviewLedBoard/);
  assert.match(app, /renderDeliveryConfirmBoard/);
  assert.match(app, /renderReviewDecisionPanel/);
  assert.match(app, /renderDeliveryConfirmPanel/);
  assert.match(app, /reviewPackCriterionInput/);
  assert.match(app, /reviewStickerCountInput/);
  assert.match(app, /reviewApplyPackRuleBtn/);
  assert.match(app, /packageWorkspaceRoot/);
  assert.match(app, /packageSettingsRoot/);
  assert.doesNotMatch(entry, /^\s*enhanceWorkshopUx\(root\);/m);
  assert.doesNotMatch(entry, /^\s*bridgeWorkshopLegacyControls\(root\);/m);
  assert.doesNotMatch(entry, /^\s*installMagicLoupe\(root\);/m);
});

test('Workshop runtime assets and bootstrap guards are present', async () => {
  await access(new URL('../public/vendor/jszip-3.10.1.min.js', import.meta.url));
  await access(new URL('../public/vendor/tailwind-3.4.17.css', import.meta.url));
  const source = await readFile(new URL('../src/ui/stixio-workshop-app-v2.js', import.meta.url), 'utf8');
  assert.match(source, /function bindSourceCanvas\(canvas\)\{if\(!canvas\)return;/);
  assert.match(source, /function bindRefineCanvas\(canvas\)\{if\(!canvas\)return;/);
  assert.match(source, /root\.querySelector\('#reviewApproveCurrentBtn'\)\?\.addEventListener/);
});
