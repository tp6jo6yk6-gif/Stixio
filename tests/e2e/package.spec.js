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

async function installFakeZip(page) {
  await page.addInitScript(() => {
    class FakeZip {
      constructor() {
        this.files = {};
      }
      file(path, data, options = {}) {
        this.files[path] = { data, options, dir: false };
        return this;
      }
      async generateAsync(_options, onUpdate) {
        const names = Object.keys(this.files);
        window.__packageFiles = names;
        onUpdate?.({ percent: 20, currentFile: names[0] || null });
        await new Promise(resolve => setTimeout(resolve, 30));
        onUpdate?.({ percent: 65, currentFile: names[Math.floor(names.length / 2)] || null });
        await new Promise(resolve => setTimeout(resolve, 30));
        onUpdate?.({ percent: 100, currentFile: names.at(-1) || null });
        return new Blob([JSON.stringify(names)], { type: 'application/zip' });
      }
      async loadAsync(blob) {
        const names = JSON.parse(await blob.text());
        return { files: Object.fromEntries(names.map(name => [name, { dir: false }])) };
      }
    }
    window.JSZip = FakeZip;
  });
}

async function openWorkshop(page, context) {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  await installFakeZip(page);
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#fileInput', { state: 'attached', timeout: 10_000 });
    await page.waitForSelector('#stage-package', { state: 'attached', timeout: 10_000 });
    await page.waitForSelector('#packageFolderModeInput', { state: 'attached', timeout: 10_000 });
  } catch (error) {
    throw new Error(`Workshop boot failed.\n${errors.join('\n') || 'No browser error captured.'}\n${error.message}`);
  }
}

async function importAndApprove(page) {
  await page.locator('[data-layout="2x2"]').click();
  await page.locator('#fileInput').setInputFiles({
    name: 'four-panel.svg',
    mimeType: 'image/svg+xml',
    buffer: fourPanelSvg()
  });
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(4, { timeout: 20_000 });
  await page.locator('#reviewApproveCleanBtn').click();
  await expect(page.locator('[data-review-card="true"][data-review-approved="true"]')).toHaveCount(4);
  await page.locator('#stage-package').scrollIntoViewIfNeeded();
}

test.describe('Package browser acceptance', () => {
  test.beforeEach(async ({ page, context }) => {
    await openWorkshop(page, context);
  });

  test('Package preflight lists all approved files and blocks before Review', async ({ page }) => {
    await page.locator('[data-layout="2x2"]').click();
    await page.locator('#fileInput').setInputFiles({
      name: 'four-panel.svg',
      mimeType: 'image/svg+xml',
      buffer: fourPanelSvg()
    });
    await expect(page.locator('#packageFileList [data-package-frame]')).toHaveCount(4, { timeout: 20_000 });
    await expect(page.locator('#packagePreflight')).toContainText('Package 尚未就緒');
    await expect(page.locator('#packageExportBtn')).toBeDisabled();

    await page.locator('#reviewApproveCleanBtn').click();
    await expect(page.locator('#packagePreflight')).toContainText('Package 已通過預檢');
    await expect(page.locator('#packageExportBtn')).toBeEnabled();
    await expect(page.locator('#packageFileCount')).toContainText('4 files');
  });

  test('folder structure and naming settings update final ZIP paths', async ({ page }) => {
    await importAndApprove(page);
    await page.locator('#packageRootFolderInput').fill('Delivery');
    await page.locator('#packageFolderModeInput').selectOption('source-role');
    await expect(page.locator('#packageFileList')).toContainText('Delivery/four-panel.svg/sticker/01.png');

    await page.locator('#packageNamingModeInput').selectOption('sequential');
    await page.locator('#filenamePrefixInput').fill('demo');
    await page.locator('#filenameSuffixInput').fill('ready');
    await page.locator('#packageFolderModeInput').selectOption('role');
    await expect(page.locator('#packageFileList')).toContainText('Delivery/sticker/demo_1_ready.png');

    await page.locator('#packageZipBaseNameInput').fill('Client / Release');
    await expect(page.locator('#packagePreflight')).toContainText('Package 已通過預檢');
  });

  test('role assignment, manifest download and clipboard export work', async ({ page }) => {
    await importAndApprove(page);
    await page.locator('#packageAutoRolesBtn').click();
    await expect(page.locator('#packageFileList')).toContainText('main.png');
    await expect(page.locator('#packageFileList')).toContainText('tab.png');
    await expect(page.locator('#packageFileList')).toContainText('01.png');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#packageManifestJsonBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('stixio-package.json');

    await page.locator('#packageCopyManifestBtn').click();
    await expect(page.locator('#packageCopyManifestBtn')).toHaveText('已複製');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const manifest = JSON.parse(clipboard);
    expect(manifest.files).toHaveLength(4);
    expect(manifest.output.width).toBe(370);
    expect(manifest.files.map(file => file.role)).toEqual(['main', 'tab', 'sticker', 'sticker']);
  });

  test('ZIP export reports progress, verifies contents and records history', async ({ page }) => {
    await importAndApprove(page);
    await page.locator('#packageManifestCsvInput').check();
    await page.locator('#packageCompressionInput').selectOption('deflate');
    await page.locator('#packageCompressionLevelInput').fill('7');
    await page.locator('#packageZipBaseNameInput').fill('Release 01');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#packageExportBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Release 01.zip');

    await expect(page.locator('#packageProgress')).toContainText('封裝完成');
    await expect(page.locator('#packageProgress')).toContainText('100%');
    await expect(page.locator('#packageHistory')).toContainText('Release 01.zip');
    await expect(page.locator('#packageHistory')).toContainText('ZIP verified');

    const files = await page.evaluate(() => window.__packageFiles);
    expect(files.filter(file => file.endsWith('.png'))).toHaveLength(4);
    expect(files).toContain('stixio-package.json');
    expect(files).toContain('stixio-package.csv');
    expect(files).toContain('checksums.sha256');
    expect(files).toContain('README.txt');
  });
});
