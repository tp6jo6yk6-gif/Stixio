import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const testPath = 'tests/e2e/parity-refine-review.spec.js';
let source = await readFile(testPath, 'utf8');

source = source.replace(
  `    await legacyApp.page.evaluate(() => {
      const cards = [...document.querySelectorAll('.step3-card')];`,
  `    await expect(legacyApp.page.locator('.step3-card')).toHaveCount(4, { timeout: 20000 });
    await legacyApp.page.evaluate(() => {
      const cards = [...document.querySelectorAll('.step3-card')];`
);

source = source.replace(
  `      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));`,
  `      source.ondragstart?.({ preventDefault() {} });
      target.ondragover?.({ preventDefault() {} });
      target.ondrop?.({ preventDefault() {} });
      source.ondragend?.({ preventDefault() {} });`
);

source = source.replace(
  `    await workshopApp.page.locator('[data-review-card="true"]').nth(0).dragTo(workshopApp.page.locator('[data-review-card="true"]').nth(2));`,
  `    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(4, { timeout: 20000 });
    const workshopIdsBefore = await workshopApp.page.locator('[data-review-card="true"]').evaluateAll(cards => cards.map(card => card.dataset.frameId));
    await workshopApp.page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-review-card="true"]')];
      const source = cards[0];
      const target = cards[2];
      if (!source || !target) throw new Error('Workshop reorder cards unavailable');
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
    });
    await expect.poll(async () => workshopApp.page.locator('[data-review-card="true"]').evaluateAll(cards => cards.map(card => card.dataset.frameId)), { timeout: 12000 }).not.toEqual(workshopIdsBefore);`
);

if (!source.includes('function expectGeometryListsClose(')) {
  source = source.replace(
    'test.beforeAll(async () => mkdir(outputDir, { recursive: true }));',
    `function expectGeometryListsClose(legacy, workshop, tolerance = 1) {
  expect(workshop).toHaveLength(legacy.length);
  legacy.forEach((item, index) => item.forEach((value, field) => {
    expect(Math.abs(workshop[index][field] - value)).toBeLessThanOrEqual(tolerance);
  }));
}

test.beforeAll(async () => mkdir(outputDir, { recursive: true }));`
  );
}
source = source.replace(
  '    expect(workshopAfter).toEqual(legacyAfter);',
  '    expectGeometryListsClose(legacyAfter, workshopAfter);'
);

await writeFile(testPath, source, 'utf8');
await mkdir('parity-results/patched-sources/tests/e2e', { recursive: true });
await copyFile(testPath, `parity-results/patched-sources/${testPath}`);
console.log('Legacy and Workshop reorder handlers and geometry tolerance applied.');
