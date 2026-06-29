import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/e2e/layout.spec.js';
let source = await readFile(path, 'utf8');
source = source.replace(
  "await page.goto('/index.html', { waitUntil: 'commit' });",
  "await page.goto('/tests/fixtures/layout-harness.html', { waitUntil: 'domcontentloaded' });"
);
await writeFile(path, source, 'utf8');
console.log('Layout E2E harness enabled.');
