import { test, expect } from '@playwright/test';

async function openWorkshop(page) {
  await page.route(/cdn\.tailwindcss\.com/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route(/cdnjs\.cloudflare\.com/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.JSZip = class JSZip {}' }));
  await page.goto('/index.html', { waitUntil: 'commit' });
  await expect(page.locator('[data-native-workflow="true"]')).toBeAttached();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('native workflow tabs are flow cards with strong active state and next reason', async ({ page }) => {
  await openWorkshop(page);
  const workspace = page.locator('[data-workflow-managed="true"]');
  const layout = page.locator('header [data-workflow-stage="layout"]');
  const refine = page.locator('header [data-workflow-stage="refine"]');

  await expect(workspace).toHaveAttribute('data-active-stage', 'layout');
  await expect(layout).toHaveClass(/workflow-tab-card/);
  await expect(layout).toHaveClass(/workflow-tab-active/);
  await expect(layout).toHaveAttribute('data-tone', /idle|active|complete/);
  await expect(layout.locator('[data-workflow-progress-label="layout"]')).toBeVisible();
  await expect(layout.locator('[data-workflow-progress-reason="layout"]')).toContainText('請先匯入圖片');
  await expect(page.locator('[data-workflow-next-reason]')).toContainText('請先完成匯入與切割');
  await expect(page.locator('#stage-layout')).toHaveCount(1);
  await expect(page.locator('#stage-refine')).toHaveCount(0);

  await refine.click();
  await expect(workspace).toHaveAttribute('data-active-stage', 'refine');
  await expect(refine).toHaveClass(/workflow-tab-active/);
  await expect(layout).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#stage-layout')).toHaveCount(0);
  await expect(page.locator('[data-workflow-empty="refine"]')).toBeVisible();
});

test('mobile bottom navigation shows state colour data and controls activeEditor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkshop(page);
  const mobile = page.locator('[data-mobile-workflow-nav]');
  const review = mobile.locator('[data-workflow-stage="review"]');
  await expect(mobile).toBeVisible();
  await expect(review).toHaveAttribute('data-tone', /idle|active|complete|warning|error/);
  await review.click();
  await expect(page.locator('[data-workflow-managed="true"]')).toHaveAttribute('data-active-stage', 'review');
  await expect(review).toHaveAttribute('aria-current', 'step');
  await expect(review).toHaveAttribute('data-active', 'true');
});
