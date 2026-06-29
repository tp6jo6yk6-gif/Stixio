import { test, expect } from '@playwright/test';

function repairSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="white"/>
      <rect x="40" y="40" width="320" height="320" rx="28" fill="#ef4444"/>
      <circle cx="200" cy="200" r="55" fill="white"/>
      <rect x="85" y="85" width="58" height="58" rx="12" fill="#2563eb"/>
    </svg>
  `);
}

function fourPanelSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="white"/>
      <rect x="35" y="35" width="330" height="330" rx="32" fill="#ef4444"/>
      <rect x="435" y="35" width="330" height="330" rx="32" fill="#3b82f6"/>
      <rect x="35" y="435" width="330" height="330" rx="32" fill="#22c55e"/>
      <rect x="435" y="435" width="330" height="330" rx="32" fill="#a855f7"/>
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
    await page.waitForSelector('#refineCanvas', { state: 'attached', timeout: 10_000 });
  } catch (error) {
    throw new Error(`Workshop boot failed.\n${errors.join('\n') || 'No browser error captured.'}\n${error.message}`);
  }
}

async function importArtwork(page, buffer, layout = '1x1', name = 'repair.svg') {
  await page.locator(`[data-layout="${layout}"]`).click();
  await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/svg+xml', buffer });
  const expected = layout === '2x2' ? 4 : 1;
  await expect(page.locator('#reviewGrid [data-frame-id]')).toHaveCount(expected, { timeout: 20_000 });
  await expect(page.locator('#refineCanvas')).toHaveJSProperty('width', expect.any(Number));
  await page.locator('#refineCanvas').scrollIntoViewIfNeeded();
}

async function canvasAlpha(page, selector, xRatio = 0.5, yRatio = 0.5) {
  return page.locator(selector).evaluate((canvas, ratios) => {
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(canvas.width * ratios.x)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(canvas.height * ratios.y)));
    return canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
  }, { x: xRatio, y: yRatio });
}

async function pointerAtCanvas(page, selector, xRatio = 0.5, yRatio = 0.5, delta = null) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${selector} is not visible.`);
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height * yRatio;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (delta) await page.mouse.move(x + delta.x, y + delta.y, { steps: 6 });
  await page.mouse.up();
}

async function outputAlphaEventually(page, expected, xRatio = 0.5, yRatio = 0.5) {
  await expect.poll(() => canvasAlpha(page, '#refineOutputCanvas', xRatio, yRatio), { timeout: 12_000 }).toBe(expected);
}

test.describe('Refine browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await openWorkshop(page);
  });

  test('automatic removal and keep/delete masks obey final-authority rules', async ({ page }) => {
    await importArtwork(page, repairSvg());

    await page.locator('#exteriorInput').uncheck();
    await outputAlphaEventually(page, 0);

    await page.locator('[data-mask-tool="keep"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.5, 0.5);
    await outputAlphaEventually(page, 255);
    await expect(page.locator('#refineStatus')).toContainText('保留');

    await page.locator('[data-mask-tool="delete"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.5, 0.5);
    await outputAlphaEventually(page, 0);

    await page.locator('#maskUndoBtn').click();
    await outputAlphaEventually(page, 255);
    await page.locator('#maskRedoBtn').click();
    await outputAlphaEventually(page, 0);

    await page.locator('#chromaEnabledInput').uncheck();
    await page.locator('#maskClearBtn').click();
    await outputAlphaEventually(page, 255);
    await page.locator('[data-mask-tool="delete"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.5, 0.5);
    await outputAlphaEventually(page, 0);
  });

  test('magic keep/delete, clear brush and clear-all remain undoable', async ({ page }) => {
    await importArtwork(page, repairSvg());
    await page.locator('#exteriorInput').uncheck();
    await outputAlphaEventually(page, 0);

    await page.locator('[data-mask-tool="magic"]').click();
    await page.locator('[data-magic-action="keep"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.5, 0.5);
    await outputAlphaEventually(page, 255);

    await page.locator('[data-mask-tool="clear"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.5, 0.5);
    await outputAlphaEventually(page, 0);
    await page.locator('#maskUndoBtn').click();
    await outputAlphaEventually(page, 255);

    await page.locator('#maskClearBtn').click();
    await outputAlphaEventually(page, 0);
    await page.locator('#maskUndoBtn').click();
    await outputAlphaEventually(page, 255);

    await page.locator('[data-mask-tool="magic"]').click();
    await page.locator('[data-magic-action="delete"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.28, 0.28);
    await expect(page.locator('#refineStatus')).toContainText('刪除');
    await page.locator('#applyRefineBtn').click();
    await expect(page.locator('#refineStatus')).toContainText('已套用');
  });

  test('wheel zoom, drag pan, Space pan and view modes work in Chromium', async ({ page }) => {
    await importArtwork(page, repairSvg());
    const viewport = page.locator('#refineViewport');
    await viewport.scrollIntoViewIfNeeded();
    const box = await viewport.boundingBox();
    if (!box) throw new Error('Refine viewport is not visible.');

    await page.locator('[data-mask-tool="view"]').click();
    const before = await page.locator('#refineTransformLayer').getAttribute('style');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -240);
    await expect(page.locator('#zoomResetBtn')).not.toHaveText('100%');
    const zoomed = await page.locator('#refineTransformLayer').getAttribute('style');
    expect(zoomed).not.toBe(before);

    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 35, { steps: 6 });
    await page.mouse.up();
    const panned = await page.locator('#refineTransformLayer').getAttribute('style');
    expect(panned).not.toBe(zoomed);

    await page.locator('[data-mask-tool="keep"]').click();
    await page.keyboard.down('Space');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 + 25, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const spacePanned = await page.locator('#refineTransformLayer').getAttribute('style');
    expect(spacePanned).not.toBe(panned);

    await page.keyboard.press('0');
    await expect(page.locator('#zoomResetBtn')).toHaveText('100%');
    await expect(page.locator('#refineTransformLayer')).toHaveAttribute('style', /translate\(0px, 0px\).*scale\(1\)/);

    await page.locator('[data-refine-view="result"]').click();
    await expect(page.locator('#refineViewport')).toHaveCSS('display', 'none');
    await expect(page.locator('#refineResultPane')).not.toHaveCSS('display', 'none');
    await page.locator('[data-refine-view="mask"]').click();
    await expect(page.locator('#refineResultPane')).toHaveCSS('display', 'none');
    await page.locator('[data-refine-view="split"]').click();
    await expect(page.locator('#refineViewport')).not.toHaveCSS('display', 'none');
    await expect(page.locator('#refineResultPane')).not.toHaveCSS('display', 'none');
  });

  test('manual masks stay isolated per Frame and reset selected clears only that Frame', async ({ page }) => {
    await importArtwork(page, fourPanelSvg(), '2x2', 'four-panel.svg');
    const cards = page.locator('#reviewGrid [data-frame-id]');
    const firstId = await cards.nth(0).getAttribute('data-frame-id');
    const secondId = await cards.nth(1).getAttribute('data-frame-id');

    await cards.nth(0).locator('.preview').click();
    await page.locator('#chromaEnabledInput').uncheck();
    await page.locator('[data-mask-tool="delete"]').click();
    await pointerAtCanvas(page, '#refineCanvas', 0.5, 0.5);
    await outputAlphaEventually(page, 0);

    await page.locator(`#reviewGrid [data-frame-id="${secondId}"] .preview`).click();
    await outputAlphaEventually(page, 255);
    await expect(page.locator('#refineStatus')).toContainText('標記 0.0%');

    await page.locator(`#reviewGrid [data-frame-id="${firstId}"] .preview`).click();
    await outputAlphaEventually(page, 0);
    await page.locator('#offsetXInput').fill('12');
    await page.locator('#offsetXInput').press('Enter');
    await page.locator('#resetSelectedRefineBtn').click();
    await outputAlphaEventually(page, 255);
    await expect(page.locator('#offsetXInput')).toHaveValue('0');

    await page.locator(`#reviewGrid [data-frame-id="${secondId}"] .preview`).click();
    await outputAlphaEventually(page, 255);
  });
});
