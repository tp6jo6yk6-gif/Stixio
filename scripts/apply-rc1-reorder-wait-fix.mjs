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

await writeFile(testPath, source, 'utf8');
await mkdir('parity-results/patched-sources/tests/e2e', { recursive: true });
await copyFile(testPath, `parity-results/patched-sources/${testPath}`);
console.log('Legacy reorder wait fix applied.');
