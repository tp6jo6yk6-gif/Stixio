import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = new URL('../../parity-results/', import.meta.url);

const signalGroups = {
  import: ['import', 'upload', 'open', '匯入', '上傳', '選擇圖片', '拖放'],
  multiSource: ['source', 'append', 'remove', '來源', '追加', '刪除圖片'],
  layout: ['layout', 'grid', 'smart', 'detect', '切割', '網格', '智能', '偵測'],
  frame: ['frame', 'crop', 'fit', '裁切', '調框', '貼合'],
  refine: ['refine', 'background', 'chroma', 'mask', '去背', '遮罩', '羽化', '去雜點'],
  manualMask: ['keep', 'delete', 'magic', 'brush', '保留', '去背筆刷', '魔術'],
  review: ['review', 'approve', 'warning', '核准', '檢查', '警告'],
  package: ['package', 'zip', 'manifest', 'checksum', '下載', '封裝'],
  history: ['undo', 'redo', '復原', '重做'],
  viewport: ['zoom', 'pan', '100%', '縮放', '平移'],
  project: ['project', 'save', 'autosave', '專案', '儲存'],
  destination: ['destination', 'profile', '規格', '目的地']
};

test.beforeAll(async () => {
  await mkdir(outputDir, { recursive: true });
});

test('capture legacy and Workshop runtime inventories', async ({ browser }) => {
  const legacy = await captureRuntime(browser, '/legacy-preview.html', 'legacy', page =>
    page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      const controls = document.querySelectorAll('button,input,select,textarea,canvas').length;
      return !text.includes('正在還原 Stixio') && controls > 0;
    }, null, { timeout: 30000 })
  );
  await writeFile(new URL('legacy-runtime-inventory.json', outputDir), JSON.stringify(legacy, null, 2));

  const workshop = await captureRuntime(browser, '/tests/fixtures/layout-harness.html', 'workshop', async page => {
    await page.waitForSelector('#app', { state: 'attached', timeout: 20000 });
    await page.waitForSelector('#fileInput', { state: 'attached', timeout: 20000 });
    await page.waitForSelector('#stage-review', { state: 'attached', timeout: 20000 });
    await page.waitForSelector('#stage-package', { state: 'attached', timeout: 20000 });
  });
  await writeFile(new URL('workshop-runtime-inventory.json', outputDir), JSON.stringify(workshop, null, 2));

  const matrix = Object.fromEntries(Object.keys(signalGroups).map(key => [key, {
    legacy: legacy.signals[key],
    workshop: workshop.signals[key],
    status: legacy.signals[key].length === 0 || workshop.signals[key].length > 0 ? 'covered' : 'investigate'
  }]));
  await writeFile(new URL('runtime-feature-matrix.json', outputDir), JSON.stringify(matrix, null, 2));

  expect(legacy.counts.controls, 'Legacy app must expose interactive controls').toBeGreaterThan(0);
  expect(legacy.counts.canvases, 'Legacy app must expose at least one canvas').toBeGreaterThan(0);
  expect(workshop.counts.controls, 'Workshop must expose interactive controls').toBeGreaterThan(0);
  expect(workshop.counts.canvases, 'Workshop must expose at least one canvas').toBeGreaterThan(0);
  expect(workshop.ids).toContain('fileInput');
  expect(workshop.ids).toContain('stage-review');
  expect(workshop.ids).toContain('stage-package');
});

async function captureRuntime(browser, path, name, ready) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(path, { waitUntil: 'commit', timeout: 30000 });
  await ready(page);
  await page.waitForTimeout(750);
  await page.screenshot({ path: new URL(`${name}-initial.png`, outputDir).pathname, fullPage: true });

  const inventory = await page.evaluate(groups => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const text = normalize(document.body?.innerText || '');
    const lower = text.toLowerCase();
    const controls = [...document.querySelectorAll('button,input,select,textarea,[role="button"]')];
    const entries = controls.slice(0, 500).map((element, index) => ({
      index,
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: element.getAttribute('name'),
      type: element.getAttribute('type'),
      role: element.getAttribute('role'),
      text: normalize(element.innerText || element.value || element.getAttribute('aria-label') || element.getAttribute('title')).slice(0, 180),
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      disabled: Boolean(element.disabled),
      hidden: Boolean(element.hidden || element.offsetParent === null)
    }));
    const signals = Object.fromEntries(Object.entries(groups).map(([key, words]) => [key, words.filter(word => lower.includes(word.toLowerCase()))]));
    return {
      url: location.href,
      title: document.title,
      language: document.documentElement.lang || null,
      textSample: text.slice(0, 5000),
      ids: [...new Set([...document.querySelectorAll('[id]')].map(element => element.id).filter(Boolean))].sort(),
      counts: {
        controls: controls.length,
        buttons: document.querySelectorAll('button,[role="button"]').length,
        inputs: document.querySelectorAll('input').length,
        fileInputs: document.querySelectorAll('input[type="file"]').length,
        selects: document.querySelectorAll('select').length,
        textareas: document.querySelectorAll('textarea').length,
        canvases: document.querySelectorAll('canvas').length,
        images: document.querySelectorAll('img').length
      },
      controls: entries,
      signals
    };
  }, signalGroups);

  inventory.pageErrors = pageErrors;
  inventory.consoleErrors = consoleErrors;
  await context.close();
  return inventory;
}
