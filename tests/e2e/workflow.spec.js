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

test('native Workspaces change active tab and render only the active stage', async ({ page }) => {
  await openWorkshop(page);
  const workspace = page.locator('[data-workflow-managed="true"]');
  const layout = page.locator('header [data-workflow-stage="layout"]');
  const refine = page.locator('header [data-workflow-stage="refine"]');

  await expect(workspace).toHaveAttribute('data-active-stage', 'layout');
  await expect(layout).toHaveClass(/workflow-tab-active/);
  await expect(page.locator('#stage-layout')).toHaveCount(1);
  await expect(page.locator('#stage-refine')).toHaveCount(0);

  await refine.click();
  await expect(workspace).toHaveAttribute('data-active-stage', 'refine');
  await expect(refine).toHaveClass(/workflow-tab-active/);
  await expect(layout).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#stage-layout')).toHaveCount(0);
  await expect(page.locator('[data-workflow-empty="refine"]')).toBeVisible();
});

test('mobile bottom navigation controls activeEditor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkshop(page);
  const mobile = page.locator('[data-mobile-workflow-nav]');
  await expect(mobile).toBeVisible();
  await mobile.locator('[data-workflow-stage="review"]').click();
  await expect(page.locator('[data-workflow-managed="true"]')).toHaveAttribute('data-active-stage', 'review');
  await expect(mobile.locator('[data-workflow-stage="review"]')).toHaveAttribute('aria-current', 'step');
});
