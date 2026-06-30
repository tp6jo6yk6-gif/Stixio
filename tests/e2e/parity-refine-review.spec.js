import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const outputDir = new URL('../../parity-results/', import.meta.url);

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

async function installRuntime(page) {
  await page.addInitScript(() => {
    const toBase64 = bytes => {
      let binary = '';
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      for (const byte of view) binary += String.fromCharCode(byte);
      return btoa(binary);
    };
    const fromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
    class RuntimeZipFile {
      constructor(entry) { this.entry = entry; this.dir = false; }
      async async(type) {
        const bytes = this.entry.kind === 'text' ? new TextEncoder().encode(this.entry.value) : fromBase64(this.entry.value);
        if (type === 'string') return this.entry.kind === 'text' ? this.entry.value : new TextDecoder().decode(bytes);
        if (type === 'base64') return toBase64(bytes);
        if (type === 'uint8array') return bytes;
        return bytes.buffer;
      }
    }
    class RuntimeZip {
      constructor() { this.entries = {}; this.files = {}; }
      file(path, value, options = {}) {
        if (arguments.length === 1) return this.files[path] || null;
        const entry = typeof value === 'string' && !options.base64
          ? { kind: 'text', value }
          : { kind: 'base64', value: typeof value === 'string' ? value : toBase64(value) };
        this.entries[path] = entry;
        this.files[path] = new RuntimeZipFile(entry);
        return this;
      }
      async generateAsync(_options, onUpdate) {
        const paths = Object.keys(this.entries);
        onUpdate?.({ percent: 50, currentFile: paths[0] || null });
        onUpdate?.({ percent: 100, currentFile: paths.at(-1) || null });
        return new Blob([JSON.stringify(this.entries)], { type: 'application/zip' });
      }
      async loadAsync(blob) {
        const entries = JSON.parse(await blob.text());
        const archive = new RuntimeZip();
        archive.entries = entries;
        archive.files = Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, new RuntimeZipFile(entry)]));
        return archive;
      }
    }
    window.JSZip = RuntimeZip;
    window.lucide = { createIcons() {} };
  });
  await page.route(/cdn\.tailwindcss\.com/, route => route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind={};' }));
  await page.route(/unpkg\.com\/lucide/, route => route.fulfill({ contentType: 'application/javascript', body: 'window.lucide={createIcons(){}};' }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip/, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
}

async function openLegacy(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  await installRuntime(page);
  await page.goto('/legacy-preview.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof state !== 'undefined' && Boolean(document.querySelector('#fileInput')));
  return { context, page };
}

async function openWorkshop(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  await installRuntime(page);
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'commit' });
  await page.waitForSelector('#fileInput', { state: 'attached' });
  await page.waitForSelector('#stage-review', { state: 'attached' });
  return { context, page };
}

async function importLegacy(page, buffer, layout = '1x1', name = 'repair.svg') {
  await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/svg+xml', buffer });
  await page.waitForFunction(() => state.sources.length === 1 && state.stickers.filter(Boolean).length > 0);
  await page.locator(`[data-layout="${layout}"]`).click({ force: true });
  const expected = layout === '2x2' ? 4 : 1;
  await page.waitForFunction(count => state.allBoxes.length === count && state.stickers.filter(Boolean).length === count, expected);
}

async function importWorkshop(page, buffer, layout = '1x1', name = 'repair.svg') {
  await page.locator(`[data-layout="${layout}"]`).click();
  await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/svg+xml', buffer });
  const expected = layout === '2x2' ? 4 : 1;
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(expected, { timeout: 20000 });
  await expect.poll(() => page.locator('#refineOutputCanvas').evaluate(canvas => canvas.width)).toBeGreaterThan(1);
}

async function pointerAtCanvas(page, selector, xRatio, yRatio) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${selector} is not visible.`);
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height * yRatio;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

async function legacyAlpha(page, xRatio, yRatio) {
  return page.evaluate(({ xRatio, yRatio }) => {
    const canvas = state.stickers[0].canvas;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(canvas.width * xRatio)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(canvas.height * yRatio)));
    return canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
  }, { xRatio, yRatio });
}

async function workshopAlpha(page, xRatio, yRatio) {
  return page.locator('#refineOutputCanvas').evaluate((canvas, point) => {
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(canvas.width * point.xRatio)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(canvas.height * point.yRatio)));
    return canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
  }, { xRatio, yRatio });
}

async function parseArchive(download) {
  const path = await download.path();
  if (!path) throw new Error('Archive path unavailable.');
  return JSON.parse(await readFile(path, 'utf8'));
}

function pngNames(archive) {
  return Object.keys(archive).filter(name => name.toLowerCase().endsWith('.png')).map(name => name.split('/').pop()).sort();
}

function geometryList(items) {
  return items.map(item => {
    const geometry = item.geometry || item;
    return [Math.round(geometry.x), Math.round(geometry.y), Math.round(geometry.width), Math.round(geometry.height)];
  });
}

test.beforeAll(async () => mkdir(outputDir, { recursive: true }));

test('Keep brush restores an automatically removed interior area', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page, repairSvg());
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#exteriorOnlyChroma').uncheck({ force: true });
    await legacyApp.page.locator('#exteriorOnlyChroma').dispatchEvent('change');
    await expect.poll(() => legacyAlpha(legacyApp.page, 0.5, 0.5)).toBe(0);
    await legacyApp.page.locator('#brushProtectBtn').click({ force: true });
    await pointerAtCanvas(legacyApp.page, '#step5Canvas', 0.5, 0.5);
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await expect.poll(() => legacyAlpha(legacyApp.page, 0.5, 0.5)).toBeGreaterThan(0);
    const legacyKept = await legacyAlpha(legacyApp.page, 0.5, 0.5);

    await importWorkshop(workshopApp.page, repairSvg());
    await workshopApp.page.locator('#exteriorInput').uncheck();
    await expect.poll(() => workshopAlpha(workshopApp.page, 0.5, 0.5)).toBe(0);
    await workshopApp.page.locator('[data-mask-tool="keep"]').click();
    await pointerAtCanvas(workshopApp.page, '#refineCanvas', 0.5, 0.5);
    await expect.poll(() => workshopAlpha(workshopApp.page, 0.5, 0.5)).toBeGreaterThan(0);
    const workshopKept = await workshopAlpha(workshopApp.page, 0.5, 0.5);

    await writeFile(new URL('keep-brush-comparison.json', outputDir), JSON.stringify({ legacyKept, workshopKept }, null, 2));
    expect(legacyKept).toBe(255);
    expect(workshopKept).toBe(255);
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('Magic Delete removes the selected connected color without removing nearby artwork', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page, repairSvg());
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#enableChroma').uncheck({ force: true });
    await legacyApp.page.locator('#enableChroma').dispatchEvent('change');
    await expect.poll(() => legacyAlpha(legacyApp.page, 0.29, 0.26)).toBeGreaterThan(0);
    await legacyApp.page.locator('#brushMagicBtn').click({ force: true });
    await pointerAtCanvas(legacyApp.page, '#step5Canvas', 0.29, 0.26);
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await expect.poll(() => legacyAlpha(legacyApp.page, 0.29, 0.26)).toBe(0);
    const legacy = {
      target: await legacyAlpha(legacyApp.page, 0.29, 0.26),
      neighbor: await legacyAlpha(legacyApp.page, 0.55, 0.3)
    };

    await importWorkshop(workshopApp.page, repairSvg());
    await workshopApp.page.locator('#chromaEnabledInput').uncheck();
    await workshopApp.page.locator('[data-mask-tool="magic"]').click();
    await workshopApp.page.locator('[data-magic-action="delete"]').click();
    await pointerAtCanvas(workshopApp.page, '#refineCanvas', 0.23, 0.23);
    await expect.poll(() => workshopAlpha(workshopApp.page, 0.29, 0.26)).toBe(0);
    const workshop = {
      target: await workshopAlpha(workshopApp.page, 0.29, 0.26),
      neighbor: await workshopAlpha(workshopApp.page, 0.55, 0.3)
    };

    await writeFile(new URL('magic-delete-comparison.json', outputDir), JSON.stringify({ legacy, workshop }, null, 2));
    expect(legacy).toEqual({ target: 0, neighbor: 255 });
    expect(workshop).toEqual({ target: 0, neighbor: 255 });
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('Review backgrounds and safe guides preserve common Legacy behavior', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page, repairSvg());
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#step2To3Btn').click({ force: true });
    const legacyBackgrounds = [];
    for (const value of ['#ffffff', '#111111', 'checkerboard']) {
      await legacyApp.page.locator(`.step3-bg-btn[data-bg="${value}"]`).click({ force: true });
      legacyBackgrounds.push(await legacyApp.page.evaluate(() => state.step3Bg));
    }
    const legacyGuideBefore = await legacyApp.page.evaluate(() => state.showSafeGuide);
    await legacyApp.page.locator('#toggleGuideBtn').click({ force: true });
    const legacyGuideAfter = await legacyApp.page.evaluate(() => state.showSafeGuide);

    await importWorkshop(workshopApp.page, repairSvg());
    const workshopBackgrounds = [];
    for (const value of ['white', 'black', 'checker']) {
      await workshopApp.page.locator(`[data-review-bg="${value}"]`).click();
      workshopBackgrounds.push(await workshopApp.page.locator('#reviewHeroStage').getAttribute('data-review-background'));
    }
    const workshopGuideBefore = !(await workshopApp.page.locator('#reviewSafeGuide').getAttribute('class')).includes('hidden');
    await workshopApp.page.locator('#toggleSafeGuideBtn').click();
    const workshopGuideAfter = !(await workshopApp.page.locator('#reviewSafeGuide').getAttribute('class')).includes('hidden');

    const result = { legacyBackgrounds, workshopBackgrounds, legacyGuideBefore, legacyGuideAfter, workshopGuideBefore, workshopGuideAfter };
    await writeFile(new URL('review-background-guide-comparison.json', outputDir), JSON.stringify(result, null, 2));
    expect(legacyBackgrounds).toEqual(['#ffffff', '#111111', 'checkerboard']);
    expect(workshopBackgrounds).toEqual(['white', 'black', 'checker']);
    expect(legacyGuideAfter).toBe(!legacyGuideBefore);
    expect(workshopGuideAfter).toBe(!workshopGuideBefore);
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('drag reorder changes geometry order and positional package names consistently', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page, fourPanelSvg(), '2x2', 'four.svg');
    await legacyApp.page.locator('#lineNamingToggle').check({ force: true });
    await legacyApp.page.locator('#lineNamingToggle').dispatchEvent('change');
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#step2To3Btn').click({ force: true });
    const legacyBefore = await legacyApp.page.evaluate(() => geometryListForParity(state.allBoxes));
    await legacyApp.page.locator('.step3-card').nth(0).dragTo(legacyApp.page.locator('.step3-card').nth(2));
    const legacyAfter = await legacyApp.page.evaluate(() => geometryListForParity(state.allBoxes));
    const legacyDownload = legacyApp.page.waitForEvent('download');
    await legacyApp.page.locator('#downloadZipBtn').click({ force: true });
    const legacyNames = pngNames(await parseArchive(await legacyDownload));

    await importWorkshop(workshopApp.page, fourPanelSvg(), '2x2', 'four.svg');
    const workshopBeforeProject = await exportWorkshopProject(workshopApp.page);
    const workshopBefore = geometryList(workshopBeforeProject.document.frames);
    await workshopApp.page.locator('[data-review-card="true"]').nth(0).dragTo(workshopApp.page.locator('[data-review-card="true"]').nth(2));
    await workshopApp.page.locator('#packageAutoRolesBtn').click();
    await workshopApp.page.locator('#reviewApproveCleanBtn').click();
    const workshopAfterProject = await exportWorkshopProject(workshopApp.page);
    const workshopAfter = geometryList(workshopAfterProject.document.frames);
    const workshopDownload = workshopApp.page.waitForEvent('download');
    await workshopApp.page.locator('#packageExportBtn').click();
    const workshopNames = pngNames(await parseArchive(await workshopDownload));

    await writeFile(new URL('review-reorder-comparison.json', outputDir), JSON.stringify({ legacyBefore, legacyAfter, workshopBefore, workshopAfter, legacyNames, workshopNames }, null, 2));
    expect(legacyAfter).not.toEqual(legacyBefore);
    expect(workshopAfter).not.toEqual(workshopBefore);
    expect(workshopAfter).toEqual(legacyAfter);
    expect(workshopNames).toEqual(legacyNames);
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

async function exportWorkshopProject(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#projectExportBtn').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Project path unavailable.');
  const archive = JSON.parse(await readFile(path, 'utf8'));
  return JSON.parse(archive['project.json'].value);
}
