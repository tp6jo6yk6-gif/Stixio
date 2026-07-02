import { test, expect } from '@playwright/test';

function fortyNinePanelSvg() {
  const cells = [];
  const palette = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#eab308'];
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const x = column * 100 + 12;
      const y = row * 100 + 12;
      const fill = palette[(row + column) % palette.length];
      cells.push(`<rect x="${x}" y="${y}" width="76" height="76" rx="12" fill="${fill}"/>`);
      cells.push(`<circle cx="${x + 38}" cy="${y + 38}" r="15" fill="#ffffff" fill-opacity="0.75"/>`);
    }
  }
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700">
      <rect width="700" height="700" fill="white"/>
      ${cells.join('\n')}
    </svg>
  `);
}

async function openWorkshop(page) {
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#fileInput', { state: 'attached' });
}

test('large Review Grid is virtualized and uses Blob-backed worker thumbnails', async ({ page }) => {
  await openWorkshop(page);
  await page.locator('[data-layout="custom"]').click();
  await page.locator('#rowsInput').fill('7');
  await page.locator('#colsInput').fill('7');
  await page.locator('#fileInput').setInputFiles({
    name: 'forty-nine.svg',
    mimeType: 'image/svg+xml',
    buffer: fortyNinePanelSvg()
  });

  await expect(page.locator('#reviewProgressBar')).toContainText('0/49', { timeout: 30_000 });
  await expect(page.locator('#sourceList img')).toHaveAttribute('src', /^blob:/);

  const cards = page.locator('[data-review-card="true"]');
  await expect.poll(() => cards.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  const initialCount = await cards.count();
  expect(initialCount).toBeLessThan(49);
  await expect(page.locator('[data-review-virtual-spacer="true"]')).toHaveCount(1);

  await expect.poll(async () => {
    const sources = await cards.locator('.preview img').evaluateAll(images => images.map(image => image.getAttribute('src')));
    return sources.some(source => source?.startsWith('blob:'));
  }, { timeout: 15_000 }).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-stixio-image-worker', 'active', { timeout: 15_000 });

  const firstWindowIds = await cards.evaluateAll(nodes => nodes.map(node => node.dataset.frameId));
  await page.locator('[data-review-virtual-spacer="true"]').last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const nextWindowIds = await cards.evaluateAll(nodes => nodes.map(node => node.dataset.frameId));
  expect(nextWindowIds).not.toEqual(firstWindowIds);
  expect(nextWindowIds.length).toBeLessThan(49);
});
