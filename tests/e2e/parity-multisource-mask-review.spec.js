import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const outputDir = new URL('../../parity-results/', import.meta.url);

function panelSvg(color = '#ef4444', accent = '#facc15') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="white"/><rect x="40" y="40" width="320" height="320" rx="48" fill="${color}"/><circle cx="200" cy="200" r="70" fill="${accent}"/></svg>`);
}

function fourPanelSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="white"/><rect x="35" y="35" width="330" height="330" rx="32" fill="#ef4444"/><circle cx="200" cy="200" r="65" fill="#facc15"/><rect x="435" y="35" width="330" height="330" rx="32" fill="#3b82f6"/><circle cx="600" cy="200" r="65" fill="#ffffff"/><rect x="35" y="435" width="330" height="330" rx="32" fill="#22c55e"/><path d="M100 650 L200 500 L300 650 Z" fill="#111827"/><rect x="435" y="435" width="330" height="330" rx="32" fill="#a855f7"/><path d="M500 520 H700 V700 H500 Z" fill="#f97316"/></svg>`);
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
        const entry = typeof value === 'string' && !options.base64 ? { kind: 'text', value } : { kind: 'base64', value: typeof value === 'string' ? value : toBase64(value) };
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
  await page.waitForSelector('#stage-package', { state: 'attached' });
  return { context, page };
}

async function exportWorkshopProject(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#projectExportBtn').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Project download path unavailable.');
  const archive = JSON.parse(await readFile(path, 'utf8'));
  return JSON.parse(archive['project.json'].value);
}

async function parseArchive(download) {
  const path = await download.path();
  if (!path) throw new Error('Archive download path unavailable.');
  return JSON.parse(await readFile(path, 'utf8'));
}

function pngNames(archive) {
  return Object.keys(archive).filter(name => name.toLowerCase().endsWith('.png')).map(name => name.split('/').pop()).sort();
}

async function alphaAtLegacy(page, x, y) {
  return page.evaluate(({ x, y }) => state.stickers[0].canvas.getContext('2d').getImageData(x, y, 1, 1).data[3], { x, y });
}

async function alphaAtWorkshop(page, x, y) {
  return page.locator('#refineOutputCanvas').evaluate((canvas, point) => canvas.getContext('2d').getImageData(point.x, point.y, 1, 1).data[3], { x, y });
}

async function drawAtCenter(page, canvasSelector) {
  const canvas = page.locator(canvasSelector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${canvasSelector} is not visible.`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test.beforeAll(async () => mkdir(outputDir, { recursive: true }));

test('multiple sources keep independent Layout settings in Legacy and Workshop', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await legacyApp.page.locator('#fileInput').setInputFiles({ name: 'source-a.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#ef4444') });
    await legacyApp.page.waitForFunction(() => state.sources.length === 1);
    await legacyApp.page.locator('[data-layout="2x2"]').click({ force: true });
    await legacyApp.page.locator('#fileInput').setInputFiles({ name: 'source-b.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#3b82f6') });
    await legacyApp.page.waitForFunction(() => state.sources.length === 2);
    await legacyApp.page.locator('[data-layout="1x1"]').click({ force: true });
    const legacy = await legacyApp.page.evaluate(() => ({
      activeSourceIdx: state.activeSourceIdx,
      sources: state.sources.map(source => ({ name: source.name, layout: source.layout, rows: source.rows, cols: source.cols, boxes: source.boxes.length })),
      frameCount: state.allBoxes.length
    }));

    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'source-a.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#ef4444') });
    await workshopApp.page.locator('[data-layout="2x2"]').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(4);
    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'source-b.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#3b82f6') });
    await workshopApp.page.locator('[data-layout="1x1"]').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(5);
    const project = await exportWorkshopProject(workshopApp.page);
    const layoutMap = new Map(project.sourceLayouts);
    const workshop = {
      activeSourceId: project.ui.activeSourceId,
      sources: project.sources.map(source => ({ id: source.id, name: source.name, layout: layoutMap.get(source.id)?.layoutMode, rows: layoutMap.get(source.id)?.rows, cols: layoutMap.get(source.id)?.cols, boxes: project.document.frames.filter(frame => frame.sourceImageId === source.id).length })),
      frameCount: project.document.frames.length
    };

    expect(legacy.sources.map(source => [source.layout, source.rows, source.cols, source.boxes])).toEqual([['2x2', 2, 2, 4], ['1x1', 1, 1, 1]]);
    expect(workshop.sources.map(source => [source.layout, source.rows, source.cols, source.boxes])).toEqual([['2x2', 2, 2, 4], ['1x1', 1, 1, 1]]);
    expect(workshop.frameCount).toBe(legacy.frameCount);
    await writeFile(new URL('multisource-layout-comparison.json', outputDir), JSON.stringify({ legacy, workshop }, null, 2));
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('manual delete brush and Undo Redo preserve the same alpha transitions', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await legacyApp.page.locator('#fileInput').setInputFiles({ name: 'single.svg', mimeType: 'image/svg+xml', buffer: panelSvg() });
    await legacyApp.page.waitForFunction(() => state.stickers.filter(Boolean).length === 1);
    await legacyApp.page.locator('[data-layout="1x1"]').click({ force: true });
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#sticker-thumb-0').click({ force: true });
    await legacyApp.page.locator('#brushRemoveBtn').click({ force: true });
    const legacyBefore = await alphaAtLegacy(legacyApp.page, 185, 160);
    await drawAtCenter(legacyApp.page, '#step5Canvas');
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await legacyApp.page.waitForFunction(() => state.stickers[0].canvas.getContext('2d').getImageData(185, 160, 1, 1).data[3] === 0);
    const legacyDeleted = await alphaAtLegacy(legacyApp.page, 185, 160);
    await legacyApp.page.locator('#undoBtn').click({ force: true });
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await legacyApp.page.waitForFunction(() => state.stickers[0].canvas.getContext('2d').getImageData(185, 160, 1, 1).data[3] > 0);
    const legacyUndone = await alphaAtLegacy(legacyApp.page, 185, 160);
    await legacyApp.page.locator('#redoBtn').click({ force: true });
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await legacyApp.page.waitForFunction(() => state.stickers[0].canvas.getContext('2d').getImageData(185, 160, 1, 1).data[3] === 0);
    const legacyRedone = await alphaAtLegacy(legacyApp.page, 185, 160);

    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'single.svg', mimeType: 'image/svg+xml', buffer: panelSvg() });
    await workshopApp.page.locator('[data-layout="1x1"]').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(1);
    await workshopApp.page.locator('[data-mask-tool="delete"]').click();
    const workshopBefore = await alphaAtWorkshop(workshopApp.page, 185, 160);
    await drawAtCenter(workshopApp.page, '#refineCanvas');
    await workshopApp.page.locator('#applyRefineBtn').click();
    await expect.poll(() => alphaAtWorkshop(workshopApp.page, 185, 160)).toBe(0);
    const workshopDeleted = await alphaAtWorkshop(workshopApp.page, 185, 160);
    await workshopApp.page.locator('#maskUndoBtn').click();
    await workshopApp.page.locator('#applyRefineBtn').click();
    await expect.poll(() => alphaAtWorkshop(workshopApp.page, 185, 160)).toBeGreaterThan(0);
    const workshopUndone = await alphaAtWorkshop(workshopApp.page, 185, 160);
    await workshopApp.page.locator('#maskRedoBtn').click();
    await workshopApp.page.locator('#applyRefineBtn').click();
    await expect.poll(() => alphaAtWorkshop(workshopApp.page, 185, 160)).toBe(0);
    const workshopRedone = await alphaAtWorkshop(workshopApp.page, 185, 160);

    expect(legacyBefore).toBeGreaterThan(0);
    expect(workshopBefore).toBeGreaterThan(0);
    expect([legacyDeleted, legacyRedone, workshopDeleted, workshopRedone]).toEqual([0, 0, 0, 0]);
    expect(legacyUndone).toBeGreaterThan(0);
    expect(workshopUndone).toBeGreaterThan(0);
    await writeFile(new URL('manual-mask-history-comparison.json', outputDir), JSON.stringify({ legacy: { before: legacyBefore, deleted: legacyDeleted, undone: legacyUndone, redone: legacyRedone }, workshop: { before: workshopBefore, deleted: workshopDeleted, undone: workshopUndone, redone: workshopRedone } }, null, 2));
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('excluded outputs preserve Legacy file identities instead of silently renumbering', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await legacyApp.page.locator('#fileInput').setInputFiles({ name: 'four.svg', mimeType: 'image/svg+xml', buffer: fourPanelSvg() });
    await legacyApp.page.waitForFunction(() => state.stickers.filter(Boolean).length === 4);
    await legacyApp.page.locator('[data-layout="2x2"]').click({ force: true });
    await legacyApp.page.locator('#lineNamingToggle').check({ force: true });
    await legacyApp.page.locator('#lineNamingToggle').dispatchEvent('change');
    await legacyApp.page.evaluate(() => toggleExport(2, false));
    const legacyDownload = legacyApp.page.waitForEvent('download');
    await legacyApp.page.locator('#downloadZipBtn').click({ force: true });
    const legacyNames = pngNames(await parseArchive(await legacyDownload));

    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'four.svg', mimeType: 'image/svg+xml', buffer: fourPanelSvg() });
    await workshopApp.page.locator('[data-layout="2x2"]').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(4);
    const roles = workshopApp.page.locator('.role-select');
    await roles.nth(0).selectOption('main');
    await roles.nth(1).selectOption('tab');
    await roles.nth(2).selectOption('sticker');
    await roles.nth(3).selectOption('sticker');
    await workshopApp.page.locator('[data-review-card="true"]').nth(2).locator('.export-check').uncheck();
    await workshopApp.page.locator('#reviewApproveCleanBtn').click();
    const workshopDownload = workshopApp.page.waitForEvent('download');
    await workshopApp.page.locator('#packageExportBtn').click();
    const workshopNames = pngNames(await parseArchive(await workshopDownload));

    await writeFile(new URL('excluded-file-identity-comparison.json', outputDir), JSON.stringify({ legacyNames, workshopNames }, null, 2));
    expect(workshopNames).toEqual(legacyNames);
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});
