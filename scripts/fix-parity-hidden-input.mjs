import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/e2e/parity-layout-refine-package.spec.js';
let source = await readFile(path, 'utf8');
source = source.replace(
  "await page.waitForSelector('#fileInput');\n  await page.waitForSelector('#stage-package');",
  "await page.waitForSelector('#fileInput', { state: 'attached' });\n  await page.waitForSelector('#stage-package', { state: 'attached' });"
);
await writeFile(path, source, 'utf8');
console.log('Parity hidden input readiness fixed.');
