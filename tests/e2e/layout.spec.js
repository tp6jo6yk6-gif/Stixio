import { test, expect } from '@playwright/test';

function sheetSvg(colorA = '#ef4444', colorB = '#3b82f6') {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="white"/>
      <rect x="35" y="35" width="330" height="330" rx="36" fill="${colorA}"/>
      <circle cx="600" cy="200" r="165" fill="${colorB}"/>
      <path d="M45 760 L200 440 L355 760 Z" fill="#22c55e"/>
      <rect x="450" y="450" width="310" height="310" rx="76" fill="#a855f7"/>
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
  await expect(page.locator('#fileInput')).toBeAttached();
  await expect(page.locator('#sourceCanvas')).toBeVisible();
}

async function chooseTwoByTwo(page) {
  await page.locator('[data-layout="2x2"]').click();
  await expect(page.locator('#rowsInput')).toHaveValue('2');
  await expect(page.locator('#colsInput')).toHaveValue('2');
}

async function importSheets(page, files) {
  await page.locator('#fileInput').setInputFiles(files.map((file, index) => ({
    name: file.name || `sheet-${index + 1}.svg`,
    mimeType: 'image/svg+xml',
    buffer: file.buffer
  })));
}

async function waitForFrames(page, count) {
  await expect(page.locator('#reviewGrid [data-frame-id]')).toHaveCount(count, { timeout: 20_000 });
}

async function setCustomGrid(page, rows, cols) {
  await page.locator('[data-layout="custom"]').click();
  await page.locator('#rowsInput').fill(String(rows));
  await page.locator('#colsInput').fill(String(cols));
  await page.locator('#detectBtn').click();
}

function parseGeometry(text) {
  const match = text.match(/x\s+(-?\d+)\s+·\s+y\s+(-?\d+)\s+·\s+(\d+)×(\d+)/);
  if (!match) throw new Error(`Cannot parse Frame geometry from: ${text}`);
  return { x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) };
}

test.describe('Layout browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await openWorkshop(page);
  });

  test('multi-source add, switch, independent Layout settings and delete', async ({ page }) => {
    await chooseTwoByTwo(page);
    await importSheets(page, [
      { name: 'red-blue.svg', buffer: sheetSvg('#ef4444', '#3b82f6') },
      { name: 'orange-cyan.svg', buffer: sheetSvg('#f97316', '#06b6d4') }
    ]);

    await expect(page.locator('#sourceList [data-source-id]')).toHaveCount(2);
    await waitForFrames(page, 8);

    const firstSource = page.locator('#sourceList [data-source-id]').nth(0);
    const secondSource = page.locator('#sourceList [data-source-id]').nth(1);

    await firstSource.locator('button').first().click();
    await setCustomGrid(page, 3, 3);
    await expect(page.locator('#sourceStatus')).toContainText('9 Frames');
    await waitForFrames(page, 13);

    await secondSource.locator('button').first().click();
    await expect(page.locator('#rowsInput')).toHaveValue('2');
    await expect(page.locator('#colsInput')).toHaveValue('2');
    await expect(page.locator('#sourceStatus')).toContainText('4 Frames');

    await page.locator('#sourceList [data-source-id]').nth(0).locator('button').first().click();
    await expect(page.locator('#rowsInput')).toHaveValue('3');
    await expect(page.locator('#colsInput')).toHaveValue('3');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#sourceList [data-source-id]').nth(1).locator('button').last().click();
    await expect(page.locator('#sourceList [data-source-id]')).toHaveCount(1);
    await waitForFrames(page, 9);
    await expect(page.locator('#sourceStatus')).toContainText('9 Frames');
  });

  test('redetection preserves Frame role, export selection and offsets', async ({ page }) => {
    await chooseTwoByTwo(page);
    await importSheets(page, [{ name: 'state-sheet.svg', buffer: sheetSvg() }]);
    await waitForFrames(page, 4);

    const firstCard = page.locator('#reviewGrid [data-frame-id]').first();
    await firstCard.locator('.preview').click();
    await firstCard.locator('.role-select').selectOption('main');
    await firstCard.locator('.export-check').uncheck();
    await page.locator('#offsetXInput').fill('12');
    await page.locator('#offsetXInput').press('Enter');
    await page.locator('#offsetYInput').fill('-5');
    await page.locator('#offsetYInput').press('Enter');

    await page.locator('#detectBtn').click();
    await waitForFrames(page, 4);

    const restoredCard = page.locator('#reviewGrid [data-frame-id]').first();
    await expect(restoredCard.locator('.role-select')).toHaveValue('main');
    await expect(restoredCard.locator('.export-check')).not.toBeChecked();
    await restoredCard.locator('.preview').click();
    await expect(page.locator('#offsetXInput')).toHaveValue('12');
    await expect(page.locator('#offsetYInput')).toHaveValue('-5');
    await expect(page.locator('#selectedInfo')).toContainText('role: Main');
  });

  test('nine-point move and resize update Review output in the browser', async ({ page }) => {
    await chooseTwoByTwo(page);
    await importSheets(page, [{ name: 'drag-sheet.svg', buffer: sheetSvg() }]);
    await waitForFrames(page, 4);

    await page.locator('#reviewGrid [data-frame-id]').first().locator('.preview').click();
    await page.locator('#smartSnapInput').uncheck();

    const canvas = page.locator('#sourceCanvas');
    const box = await canvas.boundingBox();
    const canvasSize = await canvas.evaluate(element => ({ width: element.width, height: element.height }));
    if (!box) throw new Error('Source canvas is not visible.');

    const beforeText = await page.locator('#selectedInfo').innerText();
    const before = parseGeometry(beforeText);
    const beforeHero = await page.locator('#reviewHeroImage').getAttribute('src');

    const centerX = box.x + ((before.x + before.width / 2) / canvasSize.width) * box.width;
    const centerY = box.y + ((before.y + before.height / 2) / canvasSize.height) * box.height;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 30, centerY + 20, { steps: 5 });
    await page.mouse.up();

    await expect.poll(async () => page.locator('#selectedInfo').innerText()).not.toBe(beforeText);
    const movedText = await page.locator('#selectedInfo').innerText();
    const moved = parseGeometry(movedText);
    expect(moved.x).not.toBe(before.x);
    expect(moved.y).not.toBe(before.y);
    await expect.poll(async () => page.locator('#reviewHeroImage').getAttribute('src')).not.toBe(beforeHero);

    const resizeX = box.x + ((moved.x + moved.width) / canvasSize.width) * box.width;
    const resizeY = box.y + ((moved.y + moved.height) / canvasSize.height) * box.height;
    await page.mouse.move(resizeX, resizeY);
    await page.mouse.down();
    await page.mouse.move(resizeX + 28, resizeY + 24, { steps: 5 });
    await page.mouse.up();

    await expect.poll(async () => parseGeometry(await page.locator('#selectedInfo').innerText()).width).toBeGreaterThan(moved.width);
    await expect.poll(async () => parseGeometry(await page.locator('#selectedInfo').innerText()).height).toBeGreaterThan(moved.height);
  });

  test('duplicate, delete, undo and redo keep the active source context', async ({ page }) => {
    await chooseTwoByTwo(page);
    await importSheets(page, [
      { name: 'first.svg', buffer: sheetSvg('#dc2626', '#2563eb') },
      { name: 'second.svg', buffer: sheetSvg('#ea580c', '#0891b2') }
    ]);
    await waitForFrames(page, 8);

    const secondSource = page.locator('#sourceList [data-source-id]').nth(1);
    await secondSource.locator('button').first().click();
    const activeSourceId = await page.locator('#sourceList [data-source-active="true"]').getAttribute('data-source-id');

    await page.locator('#reviewGrid [data-source-id="' + activeSourceId + '"]').first().locator('.preview').click();
    await page.locator('#duplicateBtn').click();
    await expect(page.locator(`#reviewGrid [data-source-id="${activeSourceId}"]`)).toHaveCount(5);
    await expect(page.locator('#sourceList [data-source-active="true"]')).toHaveAttribute('data-source-id', activeSourceId);

    await page.locator('#deleteBtn').click();
    await expect(page.locator(`#reviewGrid [data-source-id="${activeSourceId}"]`)).toHaveCount(4);
    await expect(page.locator('#sourceList [data-source-active="true"]')).toHaveAttribute('data-source-id', activeSourceId);

    await page.locator('#undoBtn').click();
    await expect(page.locator(`#reviewGrid [data-source-id="${activeSourceId}"]`)).toHaveCount(5);
    await expect(page.locator('#sourceList [data-source-active="true"]')).toHaveAttribute('data-source-id', activeSourceId);

    await page.locator('#redoBtn').click();
    await expect(page.locator(`#reviewGrid [data-source-id="${activeSourceId}"]`)).toHaveCount(4);
    await expect(page.locator('#sourceList [data-source-active="true"]')).toHaveAttribute('data-source-id', activeSourceId);
  });
});
