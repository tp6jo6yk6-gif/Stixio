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

async function installBrowserZip(page) {
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
    class BrowserZipFile {
      constructor(entry) {
        this.entry = entry;
        this.dir = false;
      }
      async async(type) {
        const bytes = this.entry.kind === 'text'
          ? new TextEncoder().encode(this.entry.value)
          : fromBase64(this.entry.value);
        if (type === 'string') return this.entry.kind === 'text' ? this.entry.value : new TextDecoder().decode(bytes);
        if (type === 'base64') return toBase64(bytes);
        if (type === 'uint8array') return bytes;
        return bytes.buffer;
      }
    }
    class BrowserZip {
      constructor() {
        this.entries = {};
        this.files = {};
      }
      file(path, value) {
        if (arguments.length === 1) return this.files[path] || null;
        const entry = typeof value === 'string'
          ? { kind: 'text', value }
          : { kind: 'base64', value: toBase64(value) };
        this.entries[path] = entry;
        this.files[path] = new BrowserZipFile(entry);
        return this;
      }
      async generateAsync(_options, onUpdate) {
        const paths = Object.keys(this.entries);
        onUpdate?.({ percent: 35, currentFile: paths[0] || null });
        await new Promise(resolve => setTimeout(resolve, 20));
        onUpdate?.({ percent: 100, currentFile: paths.at(-1) || null });
        return new Blob([JSON.stringify(this.entries)], { type: 'application/zip' });
      }
      async loadAsync(blob) {
        const entries = JSON.parse(await blob.text());
        const archive = new BrowserZip();
        archive.entries = entries;
        archive.files = Object.fromEntries(Object.entries(entries).map(([path, entry]) => [path, new BrowserZipFile(entry)]));
        return archive;
      }
    }
    window.JSZip = BrowserZip;
  });
}

async function openWorkshop(page) {
  await installBrowserZip(page);
  await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#projectNameInput', { state: 'attached' });
  await page.waitForSelector('#fileInput', { state: 'attached' });
}

async function importFourPanels(page) {
  await page.locator('[data-layout="2x2"]').click();
  await page.locator('#fileInput').setInputFiles({
    name: 'four-panel.svg',
    mimeType: 'image/svg+xml',
    buffer: fourPanelSvg()
  });
  await expect(page.locator('[data-review-card="true"]')).toHaveCount(4, { timeout: 20000 });
}

async function paintDeleteMask(page) {
  await page.locator('#chromaEnabledInput').uncheck();
  await page.locator('[data-mask-tool="delete"]').click();
  const canvas = page.locator('#refineCanvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Refine canvas is not visible.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.locator('#refineOutputCanvas').evaluate(output => {
    const x = Math.floor(output.width / 2);
    const y = Math.floor(output.height / 2);
    return output.getContext('2d').getImageData(x, y, 1, 1).data[3];
  })).toBe(0);
}

test.describe('Document and Project browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await openWorkshop(page);
  });

  test('autosave restores sources, masks, Review approval and Package settings after reload', async ({ page }) => {
    await importFourPanels(page);
    await page.locator('#projectNameInput').fill('Autosave Project');
    await paintDeleteMask(page);
    await page.locator('#reviewApproveCleanBtn').click();
    await page.locator('#packageRootFolderInput').fill('Delivery');
    await page.locator('#packageFolderModeInput').selectOption('source-role');
    await expect(page.locator('#projectAutosaveStatus')).toContainText('已自動保存', { timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#projectNameInput', { state: 'attached' });
    await expect(page.locator('#projectNameInput')).toHaveValue('Autosave Project', { timeout: 20000 });
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);
    await expect(page.locator('[data-review-card="true"][data-review-approved="true"]')).toHaveCount(4);
    await expect(page.locator('#packageRootFolderInput')).toHaveValue('Delivery');
    await expect(page.locator('#packageFolderModeInput')).toHaveValue('source-role');
    await expect.poll(() => page.locator('#refineOutputCanvas').evaluate(output => {
      const x = Math.floor(output.width / 2);
      const y = Math.floor(output.height / 2);
      return output.getContext('2d').getImageData(x, y, 1, 1).data[3];
    })).toBe(0);
    await expect(page.locator('#projectAutosaveStatus')).toContainText('已恢復自動保存');
  });

  test('.stixio export and import restores the complete editable project', async ({ page }) => {
    await importFourPanels(page);
    await page.locator('#projectNameInput').fill('Portable Project');
    await paintDeleteMask(page);
    await page.locator('#reviewApproveCleanBtn').click();
    await page.locator('#packageRootFolderInput').fill('Client Delivery');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#projectExportBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Portable Project.stixio');
    const path = await download.path();
    if (!path) throw new Error('Project download path is unavailable.');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#projectNewBtn').click();
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(0);

    await page.locator('#projectOpenInput').setInputFiles(path);
    await expect(page.locator('#projectNameInput')).toHaveValue('Portable Project', { timeout: 20000 });
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);
    await expect(page.locator('[data-review-card="true"][data-review-approved="true"]')).toHaveCount(4);
    await expect(page.locator('#packageRootFolderInput')).toHaveValue('Client Delivery');
    await expect(page.locator('#projectAutosaveStatus')).toContainText('專案已開啟');
    await expect.poll(() => page.locator('#refineOutputCanvas').evaluate(output => {
      const x = Math.floor(output.width / 2);
      const y = Math.floor(output.height / 2);
      return output.getContext('2d').getImageData(x, y, 1, 1).data[3];
    })).toBe(0);
  });

  test('recent projects support save, duplicate, reopen and delete', async ({ page }) => {
    await importFourPanels(page);
    await page.locator('#projectNameInput').fill('Library Project');
    await page.locator('#projectSaveBtn').click();
    await expect(page.locator('#projectAutosaveStatus')).toContainText('已儲存');

    await page.locator('#projectRecentBtn').click();
    await expect(page.locator('[data-project-open]')).toHaveCount(1);
    await page.locator('[data-project-duplicate]').click();
    await expect(page.locator('[data-project-open]')).toHaveCount(2);

    const duplicateCard = page.locator('article').filter({ hasText: 'Library Project Copy' });
    await duplicateCard.locator('[data-project-open]').click();
    await expect(page.locator('#projectNameInput')).toHaveValue('Library Project Copy');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);

    await page.locator('#projectRecentBtn').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('article').filter({ hasText: 'Library Project Copy' }).locator('[data-project-delete]').click();
    await expect(page.locator('[data-project-open]')).toHaveCount(1);
  });

  test('corrupted project files are blocked without destroying the current project', async ({ page }) => {
    await importFourPanels(page);
    await page.locator('#projectNameInput').fill('Safe Project');
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    await page.locator('#projectOpenInput').setInputFiles({
      name: 'broken.stixio',
      mimeType: 'application/zip',
      buffer: Buffer.from('not a project archive')
    });
    await expect.poll(() => dialogs.length).toBe(2);
    expect(dialogs.some(message => message.includes('尚未儲存'))).toBe(true);
    expect(dialogs.some(message => message.includes('valid .stixio'))).toBe(true);
    await expect(page.locator('#projectNameInput')).toHaveValue('Safe Project');
    await expect(page.locator('[data-review-card="true"]')).toHaveCount(4);
    await expect(page.locator('#projectProgress')).toContainText('無法開啟專案');
  });
});
