import { test, expect } from '@playwright/test';

function singleStickerSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
      <rect width="420" height="420" fill="white"/>
      <circle cx="210" cy="210" r="140" fill="#34d399"/>
    </svg>
  `);
}

async function openWorkshop(page) {
  await page.route(/https:\/\/cdn\.tailwindcss\.com(?:\/.*)?/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: ''
  }));
  await page.route(/https:\/\/cdnjs\.cloudflare\.com(?:\/.*)?/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.JSZip = class JSZip {}'
  }));
  await page.goto('/index.html', { waitUntil: 'commit' });
  await expect(page.locator('[data-workflow-managed="true"]')).toBeAttached();
}

async function importSingleSticker(page) {
  await page.locator('#fileInput').setInputFiles({
    name: 'single-sticker.svg',
    mimeType: 'image/svg+xml',
    buffer: singleStickerSvg()
  });
  await expect(page.locator('#sourceList [data-source-id]')).toHaveCount(1, { timeout: 20_000 });
}

test.describe('Workflow tabs v4', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('changes active tab colour and shows only the selected stage', async ({ page }) => {
    await openWorkshop(page);

    const workspace = page.locator('[data-workflow-managed="true"]');
    const layoutTab = page.locator('nav[aria-label="貼圖製作流程"] [data-workflow-stage="layout"]');
    const refineTab = page.locator('nav[aria-label="貼圖製作流程"] [data-workflow-stage="refine"]');

    await expect(workspace).toHaveAttribute('data-active-stage', 'layout');
    await expect(layoutTab).toHaveAttribute('aria-selected', 'true');
    await expect(layoutTab).toHaveClass(/workflow-tab-active/);
    await expect(refineTab).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#stage-layout')).toBeVisible();
    await expect(page.locator('#stage-refine')).toBeHidden();
    await expect(page.locator('[data-workflow-empty="layout"]')).toContainText('尚未匯入圖片');

    await refineTab.click();
    await expect(workspace).toHaveAttribute('data-active-stage', 'refine');
    await expect(refineTab).toHaveAttribute('aria-selected', 'true');
    await expect(refineTab).toHaveClass(/workflow-tab-active/);
    await expect(layoutTab).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#stage-layout')).toBeHidden();
    await expect(page.locator('#stage-refine')).toBeHidden();
    await expect(page.locator('[data-workflow-empty="refine"]')).toContainText('尚無貼圖可修整');

    await page.locator('[data-workflow-direction="next"]').click();
    await expect(workspace).toHaveAttribute('data-active-stage', 'review');
    await expect(page.locator('[data-workflow-empty="review"]')).toContainText('尚無貼圖可檢查');

    await page.locator('[data-workflow-direction="previous"]').click();
    await expect(workspace).toHaveAttribute('data-active-stage', 'refine');
  });

  test('keeps the desktop document in a single-screen workspace', async ({ page }) => {
    await openWorkshop(page);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerHeight,
      documentHeight: document.scrollingElement?.scrollHeight || 0,
      bodyOverflow: getComputedStyle(document.body).overflow
    }));
    expect(dimensions.bodyOverflow).toBe('hidden');
    expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewport + 2);
  });

  test('collapses both desktop sidebars and saves the preference', async ({ page }) => {
    await openWorkshop(page);
    await importSingleSticker(page);

    const workspace = page.locator('[data-workflow-managed="true"]');
    const leftToggle = page.locator('[data-workflow-collapse="left"]');
    const rightToggle = page.locator('[data-workflow-collapse="right"]');

    await expect(leftToggle).toBeVisible();
    await expect(rightToggle).toBeVisible();

    await leftToggle.click();
    await expect(workspace).toHaveAttribute('data-collapse-left', 'true');
    await expect(page.locator('[data-workflow-column="left"]')).toHaveAttribute('data-collapsed', 'true');

    await rightToggle.click();
    await expect(workspace).toHaveAttribute('data-collapse-right', 'true');
    await expect(page.locator('[data-workflow-column="right"]')).toHaveAttribute('data-collapsed', 'true');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('stixio-workflow-collapsed-columns-v4') || '{}'));
    expect(saved).toEqual({ left: true, right: true });
  });

  test('shows the mobile bottom workflow navigation and changes stage', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWorkshop(page);

    const mobileNav = page.locator('[data-mobile-workflow-nav]');
    await expect(mobileNav).toBeVisible();
    await expect(page.locator('header nav[aria-label="貼圖製作流程"]')).toBeHidden();
    await expect(page.locator('[data-workflow-footer]')).toBeHidden();

    await mobileNav.locator('[data-workflow-stage="review"]').click();
    await expect(page.locator('[data-workflow-managed="true"]')).toHaveAttribute('data-active-stage', 'review');
    await expect(mobileNav.locator('[data-workflow-stage="review"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-workflow-empty="review"]')).toBeVisible();
  });

  test('removes the empty guide after importing artwork', async ({ page }) => {
    await openWorkshop(page);
    await expect(page.locator('[data-workflow-empty="layout"]')).toBeVisible();

    await importSingleSticker(page);
    await expect(page.locator('[data-workflow-empty]')).toHaveCount(0);
    await expect(page.locator('#sourceCanvas')).toBeVisible();
  });
});
