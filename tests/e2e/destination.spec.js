import { test, expect } from '@playwright/test';

function panelSvg(rows, cols, size = 180) {
  const width = cols * size;
  const height = rows * size;
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#eab308', '#ec4899', '#6366f1', '#84cc16', '#06b6d4', '#f43f5e'];
  const cells = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * size + 18;
      const y = row * size + 18;
      cells.push(`<rect x="${x}" y="${y}" width="${size - 36}" height="${size - 36}" rx="24" fill="${colors[index % colors.length]}"/>`);
      cells.push(`<circle cx="${x + (size - 36) / 2}" cy="${y + (size - 36) / 2}" r="24" fill="white" fill-opacity=".55"/>`);
      index += 1;
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${cells.join('')}</svg>`);
}

function squareProfile(key = 'client-square') {
  return {
    schema: 'https://stixio.app/schemas/destination-profile/v1',
    schemaVersion: '1.0.0',
    key,
    name: 'Client Square',
    version: '2.1.0',
    description: 'Exactly four square stickers.',
    category: 'normal',
    builtIn: false,
    output: { mimeType: 'image/png', extension: 'png', transparency: 'required' },
    package: { folderMode: 'flat', rootFolder: '', namingVersion: 1 },
    roles: [{
      key: 'sticker',
      label: 'Square Sticker',
      required: true,
      exact: 4,
      min: null,
      max: null,
      allowedCounts: [],
      width: 512,
      height: 512,
      safeMargin: 24,
      maxFileSizeBytes: 2 * 1024 * 1024,
      naming: { fileName: null, sequence: 3, prefix: '', suffix: '' }
    }]
  };
}

async function openWorkshop(page) {
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#destinationProfileInput', { state: 'attached' });
  await page.waitForSelector('#fileInput', { state: 'attached' });
}

async function importGrid(page, rows, cols, name = 'panels.svg') {
  await page.locator('[data-layout="custom"]').click();
  await page.locator('#rowsInput').fill(String(rows));
  await page.locator('#colsInput').fill(String(cols));
  await page.locator('#fileInput').setInputFiles({
    name,
    mimeType: 'image/svg+xml',
    buffer: panelSvg(rows, cols)
  });
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(rows * cols, { timeout: 20000 });
}

async function importProfile(page, profile) {
  await page.locator('#destinationImportInput').setInputFiles({
    name: `${profile.key}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(profile))
  });
  await expect(page.locator('#destinationProfileInput')).toHaveValue(profile.key);
}

test.describe('Destination Rules browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await openWorkshop(page);
  });

  test('standard Profile assigns role-specific dimensions and produces a valid package', async ({ page }) => {
    await importGrid(page, 2, 5, 'ten-panels.svg');
    await page.locator('#destinationProfileInput').selectOption('messaging-standard');
    await expect(page.locator('#destinationRoleSummary')).toContainText('370×320');
    await expect(page.locator('#destinationRoleSummary')).toContainText('240×240');
    await expect(page.locator('#destinationRoleSummary')).toContainText('96×74');

    await page.locator('#packageAutoRolesBtn').click();
    await expect(page.locator('.role-select').nth(0)).toHaveValue('main');
    await expect(page.locator('.role-select').nth(1)).toHaveValue('tab');
    await expect(page.locator('.role-select').nth(2)).toHaveValue('sticker');

    await expect.poll(() => page.locator('[data-review-card="true"] img').nth(0).evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([240, 240]);
    await expect.poll(() => page.locator('[data-review-card="true"] img').nth(1).evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([96, 74]);
    await expect.poll(() => page.locator('[data-review-card="true"] img').nth(2).evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([370, 320]);

    await page.locator('#reviewApproveCleanBtn').click();
    await expect(page.locator('#packagePreflight')).toContainText('Package 已通過預檢', { timeout: 20000 });
    await expect(page.locator('#packageFileCount')).toContainText('10 files');
  });

  test('Profile quantity rules block invalid sticker counts', async ({ page }) => {
    await importGrid(page, 2, 2, 'four-panels.svg');
    await page.locator('#destinationProfileInput').selectOption('messaging-standard');

    await page.locator('.role-select').nth(0).selectOption('main');
    await page.locator('.role-select').nth(1).selectOption('tab');
    await expect(page.locator('.role-select').nth(2)).toHaveValue('sticker');
    await expect(page.locator('.role-select').nth(3)).toHaveValue('sticker');

    await page.locator('#reviewApproveCleanBtn').click();
    await expect(page.locator('#packagePreflight')).toContainText('Package 尚未就緒');
    await expect(page.locator('#packagePreflight')).toContainText('must be one of');
    await expect(page.locator('#packageExportBtn')).toBeDisabled();
  });

  test('custom Profile import, duplicate and export work', async ({ page }) => {
    await importGrid(page, 2, 2, 'square-panels.svg');
    const profile = squareProfile();
    await importProfile(page, profile);

    await expect(page.locator('#destinationRoleSummary')).toContainText('Square Sticker · 512×512');
    await expect(page.locator('#destinationRoleSummary')).toContainText('exact 4');
    await expect.poll(() => page.locator('[data-review-card="true"] img').first().evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([512, 512]);

    page.once('dialog', dialog => dialog.accept('Client Square Copy'));
    await page.locator('#destinationDuplicateBtn').click();
    await expect(page.locator('#destinationProfileInput option:checked')).toContainText('Client Square Copy');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#destinationExportBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.stixio-profile\.json$/);
  });

  test('active custom Profile survives project autosave and reload', async ({ page }) => {
    await importGrid(page, 2, 2, 'autosave-panels.svg');
    const profile = squareProfile('autosave-square');
    await importProfile(page, profile);
    await page.locator('#projectNameInput').fill('Destination Autosave');
    await expect(page.locator('#projectAutosaveStatus')).toContainText('已自動保存', { timeout: 12000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#destinationProfileInput', { state: 'attached' });
    await expect(page.locator('#destinationProfileInput')).toHaveValue('autosave-square', { timeout: 20000 });
    await expect(page.locator('#destinationRoleSummary')).toContainText('Square Sticker · 512×512');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);
  });
});
