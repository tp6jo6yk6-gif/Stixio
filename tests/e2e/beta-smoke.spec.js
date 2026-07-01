import { expect, test } from '@playwright/test';

const REMOTE_RUNTIME_HOSTS = /cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/i;

async function openWorkshop(page) {
  const remoteRequests = [];
  page.on('request', request => {
    if (REMOTE_RUNTIME_HOSTS.test(request.url())) remoteRequests.push(request.url());
  });
  await page.goto('/index.html', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toContainText('Stixio');
  await expect(page.locator('#stixioDiagnosticsButton')).toBeVisible();
  return remoteRequests;
}

test('loads the complete Workshop from local runtime assets', async ({ page }) => {
  const remoteRequests = await openWorkshop(page);
  expect(remoteRequests).toEqual([]);

  const runtime = await page.evaluate(() => ({
    jszipVersion: globalThis.JSZip?.version || null,
    scriptSources: [...document.scripts].map(script => script.src).filter(Boolean),
    headerPosition: getComputedStyle(document.querySelector('header')).position,
    headingWeight: getComputedStyle(document.querySelector('h1')).fontWeight,
    diagnostics: globalThis.StixioDiagnostics?.snapshot?.()
  }));

  expect(runtime.jszipVersion).toBe('3.10.1');
  expect(runtime.scriptSources.some(source => source.includes('/public/vendor/tailwindcss-browser-4.3.2.js'))).toBe(true);
  expect(runtime.scriptSources.some(source => source.includes('/public/vendor/jszip-3.10.1.min.js'))).toBe(true);
  expect(runtime.scriptSources.some(source => REMOTE_RUNTIME_HOSTS.test(source))).toBe(false);
  expect(runtime.headerPosition).toBe('sticky');
  expect(Number(runtime.headingWeight)).toBeGreaterThanOrEqual(700);
  expect(runtime.diagnostics.app.version).toBe('1.0.0-rc.1');
  expect(runtime.diagnostics.runtime.features.jszip).toBe(true);
});

test('serves an installable manifest and local PWA icons', async ({ page, request }) => {
  await openWorkshop(page);
  const manifestResponse = await request.get('/manifest.json');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Stixio Workshop');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: './public/icons/stixio-icon.svg', purpose: 'any' }),
    expect.objectContaining({ src: './public/icons/stixio-maskable.svg', purpose: 'maskable' })
  ]));

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src.replace('./', '/'));
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/svg+xml');
  }
});

test('blocks unsupported artwork before it reaches the editor', async ({ page }) => {
  await openWorkshop(page);
  await page.locator('#fileInput').setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image')
  });

  const banner = page.locator('#stixioErrorBanner');
  await expect(banner).toBeVisible();
  await expect(banner.locator('[data-error-title]')).toHaveText('圖片無法讀取');
  await expect(banner.locator('[data-error-message]')).toContainText('不受支援');
  await expect(page.locator('#sourceStatus')).toHaveText('尚未匯入');

  const errors = await page.evaluate(() => globalThis.StixioDiagnostics.getErrors());
  expect(errors.at(-1)).toMatchObject({ code: 'IMAGE_UNSUPPORTED', source: 'image-import' });
});

test('blocks a damaged .stixio archive before project restoration', async ({ page }) => {
  await openWorkshop(page);
  await page.locator('#projectOpenInput').setInputFiles({
    name: 'damaged.stixio',
    mimeType: 'application/x-stixio-project',
    buffer: Buffer.from('this is not a zip archive')
  });

  const banner = page.locator('#stixioErrorBanner');
  await expect(banner).toBeVisible();
  await expect(banner.locator('[data-error-title]')).toHaveText('專案檔案可能已損壞');
  await expect(banner.locator('[data-error-recovery]')).toContainText('不要覆蓋原檔');
  await expect(page.locator('#projectAutosaveStatus')).not.toContainText('專案已開啟');

  const errors = await page.evaluate(() => globalThis.StixioDiagnostics.getErrors());
  expect(errors.at(-1)).toMatchObject({ code: 'PROJECT_DAMAGED', source: 'project-open-preflight' });
});

test('shows storage recovery guidance and exports anonymous diagnostics', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 98_000_000, quota: 100_000_000 }) }
    });
  });
  await openWorkshop(page);

  const banner = page.locator('#stixioErrorBanner');
  await expect(banner).toBeVisible();
  await expect(banner.locator('[data-error-title]')).toHaveText('瀏覽器儲存空間不足');
  await page.locator('#stixioDiagnosticsButton').click();
  await expect(page.locator('#stixioDiagnosticsPanel')).toBeVisible();
  await expect(page.locator('#stixioDiagnosticsSummary')).toContainText('93.5 MB / 95.4 MB');

  const report = await page.evaluate(() => globalThis.StixioDiagnostics.snapshot());
  expect(report.schema).toBe('stixio-diagnostics/v1');
  expect(report.storage).toMatchObject({ usage: 98_000_000, quota: 100_000_000, remaining: 2_000_000 });
  expect(report.recentErrors.at(-1)).toMatchObject({ code: 'STORAGE_UNAVAILABLE', source: 'storage-estimate' });
  expect(JSON.stringify(report)).not.toContain('data:image');
  expect(JSON.stringify(report)).not.toContain('project.json');
});
