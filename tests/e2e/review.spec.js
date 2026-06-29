import { test, expect } from '@playwright/test';

function fourPanelSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="white"/>
      <rect x="35" y="35" width="330" height="330" rx="32" fill="#ef4444"/>
      <circle cx="200" cy="200" r="65" fill="#facc15"/>
      <rect x="435" y="35" width="330" height="330" rx="32" fill="#3b82f6"/>
      <circle cx="600" cy="200" r="65" fill="#ffffff"/>
      <rect x="35" y="435" width="330" height="330" rx="32" fill="#22c55e"/>
      <path d="M100 650 L200 500 L300 650 Z" fill="#111827"/>
      <rect x="435" y="435" width="330" height="330" rx="32" fill="#a855f7"/>
      <path d="M500 520 H700 V700 H500 Z" fill="#f97316"/>
    </svg>
  `);
}

function singleArtworkSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="white"/>
      <rect x="40" y="40" width="320" height="320" rx="50" fill="#ef4444"/>
      <circle cx="200" cy="200" r="75" fill="#fde047"/>
    </svg>
  `);
}

function blankSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="white"/>
    </svg>
  `);
}

async function openWorkshop(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#fileInput', { state: 'attached', timeout: 10_000 });
    await page.waitForSelector('#stage-review', { state: 'attached', timeout: 10_000 });
    await page.waitForSelector('#reviewFilterInput', { state: 'attached', timeout: 10_000 });
  } catch (error) {
    throw new Error(`Workshop boot failed.\n${errors.join('\n') || 'No browser error captured.'}\n${error.message}`);
  }
}

async function importArtwork(page, buffer, layout = '1x1', name = 'review.svg') {
  await page.locator(`[data-layout="${layout}"]`).click();
  await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/svg+xml', buffer });
  const expected = layout === '2x2' ? 4 : 1;
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(expected, { timeout: 20_000 });
  await page.locator('#stage-review').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#reviewHeroImage').getAttribute('src'), { timeout: 10_000 }).not.toBeNull();
}

async function selectedHeroText(page) {
  return page.locator('#reviewHeroMeta').innerText();
}

function visiblePoint(box, viewport) {
  const left = Math.max(0, box.x);
  const right = Math.min(viewport.width, box.x + box.width);
  const top = Math.max(0, box.y);
  const bottom = Math.min(viewport.height, box.y + box.height);
  if (right <= left || bottom <= top) throw new Error('Review hero stage has no visible intersection with the viewport.');
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

test.describe('Review browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await openWorkshop(page);
  });

  test('large preview supports four backgrounds, guides, wheel zoom and drag pan', async ({ page }) => {
    await importArtwork(page, fourPanelSvg(), '2x2', 'four-panel.svg');
    const stage = page.locator('#reviewHeroStage');

    for (const background of ['white', 'black', 'sticker-preview', 'checker']) {
      await page.locator(`[data-review-bg="${background}"]`).click();
      await expect(stage).toHaveAttribute('data-review-background', background);
    }

    await expect(page.locator('#reviewSafeGuide')).not.toHaveClass(/hidden/);
    await page.locator('#toggleSafeGuideBtn').click();
    await expect(page.locator('#reviewSafeGuide')).toHaveClass(/hidden/);
    await page.locator('#toggleSafeGuideBtn').click();
    await expect(page.locator('#reviewSafeGuide')).not.toHaveClass(/hidden/);

    await expect(page.locator('#reviewContentBounds')).not.toHaveClass(/hidden/);
    await page.locator('#toggleContentBoundsBtn').click();
    await expect(page.locator('#reviewContentBounds')).toHaveClass(/hidden/);
    await page.locator('#toggleContentBoundsBtn').click();

    await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('Review hero stage is not visible.');
    const point = visiblePoint(box, viewport);
    const before = await page.locator('#reviewTransformLayer').getAttribute('style');
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, -260);
    await expect(page.locator('#reviewZoomResetBtn')).not.toHaveText('100%');
    const zoomed = await page.locator('#reviewTransformLayer').getAttribute('style');
    expect(zoomed).not.toBe(before);

    await page.mouse.down();
    await page.mouse.move(Math.min(viewport.width - 10, point.x + 60), Math.min(viewport.height - 10, point.y + 35), { steps: 6 });
    await page.mouse.up();
    const panned = await page.locator('#reviewTransformLayer').getAttribute('style');
    expect(panned).not.toBe(zoomed);

    await page.locator('#reviewZoomResetBtn').click();
    await expect(page.locator('#reviewZoomResetBtn')).toHaveText('100%');
    await expect(page.locator('#reviewTransformLayer')).toHaveAttribute('style', /translate\(0px, 0px\).*scale\(1\)/);
  });

  test('batch selection, filtering, approval progress and Package gate work together', async ({ page }) => {
    await importArtwork(page, fourPanelSvg(), '2x2', 'four-panel.svg');
    const cards = page.locator('[data-review-card="true"]');

    await page.locator('#reviewSelectNoneBtn').click();
    await expect(cards.filter({ has: page.locator('.export-check:checked') })).toHaveCount(0);
    await page.locator('#reviewInvertBtn').click();
    await expect(page.locator('[data-review-card="true"] .export-check:checked')).toHaveCount(4);

    await page.locator('#reviewApproveCleanBtn').click();
    await expect(page.locator('[data-review-card="true"][data-review-approved="true"]')).toHaveCount(4);
    await expect(page.locator('#reviewProgressBar')).toContainText('已核准 4/4');
    await expect(page.locator('#reviewGateStatus')).toContainText('Review 完成');
    await expect(page.locator('#exportZipBtn')).toBeEnabled();

    await page.locator('#reviewFilterInput').selectOption('approved');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);
    await page.locator('#reviewSearchInput').fill('four-panel');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);
    await page.locator('#reviewSearchInput').fill('not-found');
    await expect(page.locator('#reviewGrid')).toContainText('沒有符合篩選條件');
    await page.locator('#reviewSearchInput').fill('');
    await page.locator('#reviewSortInput').selectOption('file-size-desc');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);

    await page.locator('#reviewRevokeCurrentBtn').click();
    await expect(page.locator('#exportZipBtn')).toBeDisabled();
    await expect(page.locator('#reviewGateStatus')).toContainText('尚未通過品質門檻');
  });

  test('blank output becomes a blocking error and issue navigation selects it', async ({ page }) => {
    await importArtwork(page, blankSvg(), '1x1', 'blank.svg');
    const card = page.locator('[data-review-card="true"]');
    await expect(card).toHaveAttribute('data-review-severity', 'error');
    await expect(page.locator('#reviewIssueList')).toContainText('空白或全透明');
    await expect(page.locator('#exportZipBtn')).toBeDisabled();

    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    await page.locator('#reviewApproveCurrentBtn').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('仍有錯誤');
    await expect(card).toHaveAttribute('data-review-approved', 'false');

    await page.locator('#reviewFilterInput').selectOption('errors');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(1);
    await page.locator('#reviewNextIssueBtn').click();
    await expect(page.locator('#reviewHeroMeta')).toContainText('blank');
  });

  test('warning filter, drag reorder and Review keyboard shortcuts work in Chromium', async ({ page }) => {
    await importArtwork(page, fourPanelSvg(), '2x2', 'four-panel.svg');
    const originalIds = await page.locator('[data-review-card="true"]').evaluateAll(cards => cards.map(card => card.dataset.frameId));
    await page.locator('[data-review-card="true"]').nth(0).dragTo(page.locator('[data-review-card="true"]').nth(2));
    const reorderedIds = await page.locator('[data-review-card="true"]').evaluateAll(cards => cards.map(card => card.dataset.frameId));
    expect(reorderedIds).not.toEqual(originalIds);

    await page.locator('[data-review-card="true"]').nth(0).locator('.preview').click();
    const before = await selectedHeroText(page);
    await page.keyboard.press('ArrowRight');
    const after = await selectedHeroText(page);
    expect(after).not.toBe(before);

    await page.keyboard.press('a');
    const selectedId = await page.locator('#reviewHeroImage').evaluate(() => {
      const approved = [...document.querySelectorAll('[data-review-card="true"]')].find(card => card.dataset.reviewApproved === 'true');
      return approved?.dataset.frameId || null;
    });
    expect(selectedId).not.toBeNull();
    await page.keyboard.press('x');
    await expect(page.locator(`[data-review-card="true"][data-frame-id="${selectedId}"]`)).toHaveAttribute('data-export-selected', 'false');

    await page.locator('#reviewFilterInput').selectOption('excluded');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(1);

    await page.locator('#reviewFilterInput').selectOption('all');
    await page.locator('#offsetXInput').fill('160');
    await page.locator('#offsetXInput').press('Enter');
    await page.locator('#reviewFilterInput').selectOption('warnings');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(1);
    await expect(page.locator('#reviewIssueList')).toContainText(/侵入安全留白|內容碰到輸出邊界/);
  });
});
