import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const outputDir = new URL('../../parity-results/', import.meta.url);
const stressResults = [];

function gridSvg(rows, cols, cell = 120) {
  const width = cols * cell;
  const height = rows * cell;
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#eab308', '#ec4899'];
  const shapes = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * cell + 12;
      const y = row * cell + 12;
      shapes.push(`<rect x="${x}" y="${y}" width="${cell - 24}" height="${cell - 24}" rx="14" fill="${colors[index % colors.length]}"/>`);
      shapes.push(`<circle cx="${x + (cell - 24) / 2}" cy="${y + (cell - 24) / 2}" r="${Math.max(8, cell / 10)}" fill="white" fill-opacity=".45"/>`);
      index += 1;
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${shapes.join('')}</svg>`);
}

function singleSvg(index) {
  const hue = (index * 37) % 360;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="white"/><rect x="35" y="35" width="230" height="230" rx="35" fill="hsl(${hue} 75% 55%)"/><text x="150" y="170" text-anchor="middle" font-size="72" font-family="sans-serif" fill="white">${index + 1}</text></svg>`);
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
        onUpdate?.({ percent: 25, currentFile: paths[0] || null });
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

async function openWorkshop(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  await installRuntime(page);
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'commit' });
  await page.waitForSelector('#fileInput', { state: 'attached' });
  return { context, page };
}

async function importCustomGrid(page, rows, cols, name) {
  await page.locator('[data-layout="custom"]').click();
  await page.locator('#rowsInput').fill(String(rows));
  await page.locator('#colsInput').fill(String(cols));
  await page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/svg+xml', buffer: gridSvg(rows, cols) });
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(rows * cols, { timeout: 120000 });
  await page.waitForFunction(expected => [...document.querySelectorAll('[data-review-card="true"] img')].filter(image => image.complete && image.naturalWidth > 0).length === expected, rows * cols, { timeout: 120000 });
}

async function parseArchive(download) {
  const path = await download.path();
  if (!path) throw new Error('Download path unavailable.');
  return JSON.parse(await readFile(path, 'utf8'));
}

function pngNames(archive) {
  return Object.keys(archive).filter(name => name.toLowerCase().endsWith('.png')).map(name => name.split('/').pop()).sort();
}

function expectedLegacyNames(count) {
  return ['main.png', 'tab.png', ...Array.from({ length: count - 2 }, (_, index) => `${String(index + 1).padStart(2, '0')}.png`)].sort();
}

async function pointerAtCenter(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${selector} is not visible.`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

async function exportProject(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#projectExportBtn').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Project path unavailable.');
  const archive = JSON.parse(await readFile(path, 'utf8'));
  return { path, archive, snapshot: JSON.parse(archive['project.json'].value) };
}

function heapSample(page) {
  return page.evaluate(() => performance.memory ? {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
  } : null);
}

test.beforeAll(async () => mkdir(outputDir, { recursive: true }));

test.afterAll(async () => {
  await writeFile(new URL('stress-report.json', outputDir), JSON.stringify({ generatedAt: new Date().toISOString(), results: stressResults }, null, 2));
});

for (const scenario of [
  { count: 40, rows: 5, cols: 8 },
  { count: 100, rows: 10, cols: 10 }
]) {
  test(`Workshop renders, approves and packages ${scenario.count} outputs`, async ({ browser }) => {
    test.setTimeout(300000);
    const app = await openWorkshop(browser);
    const startedAt = Date.now();
    try {
      const heapBefore = await heapSample(app.page);
      await importCustomGrid(app.page, scenario.rows, scenario.cols, `stress-${scenario.count}.svg`);
      const renderedAt = Date.now();
      await app.page.locator('#packageAutoRolesBtn').click();
      await app.page.locator('#reviewApproveCleanBtn').click();
      await expect(app.page.locator('[data-review-card="true"][data-review-approved="true"]')).toHaveCount(scenario.count, { timeout: 120000 });
      await expect(app.page.locator('#packageExportBtn')).toBeEnabled({ timeout: 120000 });
      const downloadPromise = app.page.waitForEvent('download');
      await app.page.locator('#packageExportBtn').click();
      const archive = await parseArchive(await downloadPromise);
      const names = pngNames(archive);
      const packagedAt = Date.now();
      const heapAfter = await heapSample(app.page);

      expect(names).toEqual(expectedLegacyNames(scenario.count));
      expect(new Set(names).size).toBe(scenario.count);
      stressResults.push({
        scenario: `${scenario.count}-output-package`,
        count: scenario.count,
        renderMs: renderedAt - startedAt,
        packageMs: packagedAt - renderedAt,
        totalMs: packagedAt - startedAt,
        heapBefore,
        heapAfter,
        pngCount: names.length
      });
    } finally {
      await app.context.close();
    }
  });
}

test('ten source images survive project export and re-import', async ({ browser }) => {
  test.setTimeout(240000);
  const app = await openWorkshop(browser);
  const startedAt = Date.now();
  try {
    await app.page.locator('[data-layout="1x1"]').click();
    await app.page.locator('#fileInput').setInputFiles(Array.from({ length: 10 }, (_, index) => ({
      name: `source-${index + 1}.svg`,
      mimeType: 'image/svg+xml',
      buffer: singleSvg(index)
    })));
    await expect(app.page.locator('[data-review-card="true"]')).toHaveCount(10, { timeout: 120000 });
    const exported = await exportProject(app.page);
    expect(exported.snapshot.sources).toHaveLength(10);
    expect(exported.snapshot.document.frames).toHaveLength(10);

    app.page.once('dialog', dialog => dialog.accept());
    await app.page.locator('#projectNewBtn').click();
    await expect(app.page.locator('[data-review-card="true"]')).toHaveCount(0);
    await app.page.locator('#projectOpenInput').setInputFiles(exported.path);
    await expect(app.page.locator('[data-review-card="true"]')).toHaveCount(10, { timeout: 120000 });
    await expect(app.page.locator('#sourceList [data-source-id]')).toHaveCount(10);

    stressResults.push({
      scenario: 'ten-source-project-roundtrip',
      sourceCount: 10,
      frameCount: 10,
      totalMs: Date.now() - startedAt
    });
  } finally {
    await app.context.close();
  }
});

test('forty manual masks remain isolated and serializable', async ({ browser }) => {
  test.setTimeout(300000);
  const app = await openWorkshop(browser);
  const startedAt = Date.now();
  try {
    await importCustomGrid(app.page, 5, 8, 'forty-masks.svg');
    await app.page.locator('#chromaEnabledInput').uncheck();
    const cards = app.page.locator('[data-review-card="true"]');
    for (let index = 0; index < 40; index += 1) {
      await cards.nth(index).locator('.preview').click();
      await app.page.locator('[data-mask-tool="delete"]').click();
      await pointerAtCenter(app.page, '#refineCanvas');
    }
    const exported = await exportProject(app.page);
    const manifestMaskCount = exported.snapshot.document.frames.filter(frame => frame.custom?.protectMask?.assetPath).length;
    const archiveMaskCount = Object.keys(exported.archive).filter(path => path.startsWith('masks/') && path.endsWith('.png')).length;
    expect(manifestMaskCount).toBe(40);
    expect(archiveMaskCount).toBe(40);
    stressResults.push({ scenario: 'forty-isolated-masks', manifestMaskCount, archiveMaskCount, totalMs: Date.now() - startedAt });
  } finally {
    await app.context.close();
  }
});

test('fifty Destination Profile switches never leave stale output dimensions', async ({ browser }) => {
  test.setTimeout(240000);
  const app = await openWorkshop(browser);
  const startedAt = Date.now();
  try {
    await app.page.locator('[data-layout="1x1"]').click();
    await app.page.locator('#fileInput').setInputFiles({ name: 'profile.svg', mimeType: 'image/svg+xml', buffer: singleSvg(0) });
    await expect(app.page.locator('[data-review-card="true"]')).toHaveCount(1);
    const observed = [];
    for (let index = 0; index < 50; index += 1) {
      const key = index % 2 === 0 ? 'messaging-big' : 'workshop-flexible';
      const expected = key === 'messaging-big' ? [396, 660] : [370, 320];
      await app.page.locator('#destinationProfileInput').selectOption(key);
      await expect.poll(() => app.page.locator('[data-review-card="true"] img').evaluate(image => [image.naturalWidth, image.naturalHeight]), { timeout: 20000 }).toEqual(expected);
      observed.push(`${expected[0]}x${expected[1]}`);
    }
    expect(new Set(observed)).toEqual(new Set(['396x660', '370x320']));
    stressResults.push({ scenario: 'fifty-profile-switches', switches: 50, finalDimensions: observed.at(-1), totalMs: Date.now() - startedAt });
  } finally {
    await app.context.close();
  }
});
