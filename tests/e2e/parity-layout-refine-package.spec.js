import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const outputDir = new URL('../../parity-results/', import.meta.url);

const CANVAS_SUMMARY_BODY = `
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let nonTransparent = 0, alphaTotal = 0;
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  let hash = 2166136261;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const alpha = image.data[offset + 3];
      alphaTotal += alpha;
      hash ^= image.data[offset]; hash = Math.imul(hash, 16777619);
      hash ^= image.data[offset + 1]; hash = Math.imul(hash, 16777619);
      hash ^= image.data[offset + 2]; hash = Math.imul(hash, 16777619);
      hash ^= alpha; hash = Math.imul(hash, 16777619);
      if (alpha > 0) {
        nonTransparent += 1;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    index,
    width: canvas.width,
    height: canvas.height,
    coverage: nonTransparent / Math.max(1, canvas.width * canvas.height),
    alphaMean: alphaTotal / Math.max(1, canvas.width * canvas.height),
    bounds: maxX >= minX ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    rgbaHash: (hash >>> 0).toString(16).padStart(8, '0')
  };
`;

function fourPanelSvg() {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="white"/>
      <rect x="110" y="125" width="180" height="150" rx="20" fill="#ef4444"/>
      <circle cx="200" cy="200" r="38" fill="#facc15"/>
      <rect x="510" y="125" width="180" height="150" rx="20" fill="#3b82f6"/>
      <circle cx="600" cy="200" r="38" fill="#ffffff" fill-opacity=".45"/>
      <rect x="110" y="525" width="180" height="150" rx="20" fill="#22c55e"/>
      <path d="M150 640 L200 555 L250 640 Z" fill="#111827"/>
      <rect x="510" y="525" width="180" height="150" rx="20" fill="#a855f7"/>
      <path d="M550 560 H650 V640 H550 Z" fill="#f97316"/>
    </svg>
  `);
}

async function installDeterministicRuntime(page) {
  await page.addInitScript(() => {
    const toBase64 = bytes => {
      let binary = '';
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      for (const byte of view) binary += String.fromCharCode(byte);
      return btoa(binary);
    };
    const fromBase64 = value => {
      const binary = atob(value);
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    };
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
  await installDeterministicRuntime(page);
  await page.goto('/legacy-preview.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof state !== 'undefined' && Boolean(document.querySelector('#fileInput')));
  return { context, page };
}

async function openWorkshop(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  await installDeterministicRuntime(page);
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'commit' });
  await page.waitForSelector('#fileInput');
  await page.waitForSelector('#stage-package');
  return { context, page };
}

async function importLegacy(page) {
  await page.locator('#fileInput').setInputFiles({ name: 'four-panel.svg', mimeType: 'image/svg+xml', buffer: fourPanelSvg() });
  await page.waitForFunction(() => state.sources.length === 1 && state.allBoxes.length > 0);
  await page.locator('[data-layout="2x2"]').click({ force: true });
  await page.waitForFunction(() => state.allBoxes.length === 4 && state.stickers.filter(Boolean).length === 4);
}

async function importWorkshop(page) {
  await page.locator('#fileInput').setInputFiles({ name: 'four-panel.svg', mimeType: 'image/svg+xml', buffer: fourPanelSvg() });
  await page.locator('[data-layout="2x2"]').click();
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(4, { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-review-card="true"] img')].every(image => image.complete && image.naturalWidth > 0));
}

async function legacySnapshot(page) {
  return page.evaluate(({ summaryBody }) => {
    const summarize = new Function('canvas', 'index', summaryBody);
    return {
      source: { width: state.sources[0].img.width, height: state.sources[0].img.height, rows: state.sources[0].rows, cols: state.sources[0].cols },
      frames: state.allBoxes.map((box, index) => ({ index, x: box.cropX, y: box.cropY, width: box.cropW, height: box.cropH, offsetX: box.offsetX, offsetY: box.offsetY })),
      outputs: state.stickers.map((sticker, index) => summarize(sticker.canvas, index)),
      names: state.stickers.map((_sticker, index) => getStickerFilename(index))
    };
  }, { summaryBody: CANVAS_SUMMARY_BODY });
}

async function workshopProjectSnapshot(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#projectExportBtn').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Workshop project download path unavailable.');
  const archive = JSON.parse(await readFile(path, 'utf8'));
  const manifestEntry = archive['project.json'];
  if (!manifestEntry || manifestEntry.kind !== 'text') throw new Error('Workshop project.json missing.');
  return JSON.parse(manifestEntry.value);
}

async function workshopOutputSummaries(page) {
  return page.locator('[data-review-card="true"] img').evaluateAll((images, summaryBody) => {
    const summarize = new Function('canvas', 'index', summaryBody);
    return images.map((image, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return summarize(canvas, index);
    });
  }, CANVAS_SUMMARY_BODY);
}

function normalizedGeometry(frame) {
  const geometry = frame.geometry || frame;
  return { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height };
}

function assertGeometryClose(legacy, workshop, tolerance = 2) {
  for (const key of ['x', 'y', 'width', 'height']) {
    expect(Math.abs(Number(legacy[key]) - Number(workshop[key])), `${key} differs: Legacy=${legacy[key]}, Workshop=${workshop[key]}`).toBeLessThanOrEqual(tolerance);
  }
}

function assertOutputClose(legacy, workshop) {
  expect(workshop.width).toBe(legacy.width);
  expect(workshop.height).toBe(legacy.height);
  expect(Math.abs(workshop.coverage - legacy.coverage), 'Alpha coverage difference').toBeLessThanOrEqual(0.035);
  expect(Math.abs(workshop.alphaMean - legacy.alphaMean), 'Alpha mean difference').toBeLessThanOrEqual(12);
  if (legacy.bounds && workshop.bounds) {
    expect(Math.abs(workshop.bounds.width - legacy.bounds.width), 'Content width difference').toBeLessThanOrEqual(5);
    expect(Math.abs(workshop.bounds.height - legacy.bounds.height), 'Content height difference').toBeLessThanOrEqual(5);
  }
}

async function parseDownloadedArchive(download) {
  const path = await download.path();
  if (!path) throw new Error('Download path unavailable.');
  return JSON.parse(await readFile(path, 'utf8'));
}

function pngPaths(entries) {
  return Object.keys(entries).filter(path => path.toLowerCase().endsWith('.png')).sort();
}

test.beforeAll(async () => mkdir(outputDir, { recursive: true }));

test('Layout 2x2 geometry matches Legacy within two pixels', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page);
    await importWorkshop(workshopApp.page);
    const legacy = await legacySnapshot(legacyApp.page);
    const project = await workshopProjectSnapshot(workshopApp.page);
    const workshopFrames = project.document.frames.map(normalizedGeometry);
    expect(legacy.source).toEqual({ width: 800, height: 800, rows: 2, cols: 2 });
    expect(workshopFrames).toHaveLength(4);
    legacy.frames.forEach((frame, index) => assertGeometryClose(frame, workshopFrames[index]));
    await writeFile(new URL('layout-2x2-comparison.json', outputDir), JSON.stringify({ legacy: legacy.frames, workshop: workshopFrames }, null, 2));
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('default Refine output dimensions and alpha stay within RC tolerance', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page);
    await importWorkshop(workshopApp.page);
    const legacy = await legacySnapshot(legacyApp.page);
    const workshop = await workshopOutputSummaries(workshopApp.page);
    expect(workshop).toHaveLength(legacy.outputs.length);
    legacy.outputs.forEach((output, index) => assertOutputClose(output, workshop[index]));
    await writeFile(new URL('refine-default-comparison.json', outputDir), JSON.stringify({ legacy: legacy.outputs, workshop }, null, 2));
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});

test('Legacy PNG names remain present in Workshop ZIP', async ({ browser }) => {
  const legacyApp = await openLegacy(browser);
  const workshopApp = await openWorkshop(browser);
  try {
    await importLegacy(legacyApp.page);
    await importWorkshop(workshopApp.page);
    await legacyApp.page.locator('#lineNamingToggle').check({ force: true });
    await legacyApp.page.locator('#lineNamingToggle').dispatchEvent('change');
    const legacyNames = await legacyApp.page.evaluate(() => state.stickers.map((_item, index) => getStickerFilename(index)));
    expect(legacyNames).toEqual(['main.png', 'tab.png', '01.png', '02.png']);

    const roleSelects = workshopApp.page.locator('.role-select');
    await roleSelects.nth(0).selectOption('main');
    await roleSelects.nth(1).selectOption('tab');
    await roleSelects.nth(2).selectOption('sticker');
    await roleSelects.nth(3).selectOption('sticker');
    await workshopApp.page.locator('#reviewApproveCleanBtn').click();

    const legacyDownloadPromise = legacyApp.page.waitForEvent('download');
    await legacyApp.page.locator('#downloadZipBtn').click({ force: true });
    const legacyArchive = await parseDownloadedArchive(await legacyDownloadPromise);

    await expect(workshopApp.page.locator('#packageExportBtn')).toBeEnabled();
    const workshopDownloadPromise = workshopApp.page.waitForEvent('download');
    await workshopApp.page.locator('#packageExportBtn').click();
    const workshopArchive = await parseDownloadedArchive(await workshopDownloadPromise);

    const legacyPngs = pngPaths(legacyArchive);
    const workshopPngs = pngPaths(workshopArchive).map(path => path.split('/').pop()).sort();
    expect(legacyPngs).toEqual(legacyNames.slice().sort());
    for (const name of legacyNames) expect(workshopPngs).toContain(name);
    await writeFile(new URL('package-name-comparison.json', outputDir), JSON.stringify({ legacyPngs, workshopPngs, workshopEntries: Object.keys(workshopArchive).sort() }, null, 2));
  } finally {
    await legacyApp.context.close();
    await workshopApp.context.close();
  }
});
