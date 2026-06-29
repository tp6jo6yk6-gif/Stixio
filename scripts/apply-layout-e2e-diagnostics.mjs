import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/e2e/layout.spec.js';
let source = await readFile(path, 'utf8');
const from = `async function openWorkshop(page) {
  await page.route(/https:\/\/cdn\\.tailwindcss\\.com(?:\\/.*)?/, route => route.fulfill({`;
const to = `async function openWorkshop(page) {
  const bootErrors = [];
  page.on('pageerror', error => bootErrors.push(\`pageerror: \${error.stack || error.message}\`));
  page.on('console', message => {
    if (message.type() === 'error') bootErrors.push(\`console: \${message.text()}\`);
  });
  page.on('requestfailed', request => bootErrors.push(\`requestfailed: \${request.url()} — \${request.failure()?.errorText || 'unknown'}\`));
  await page.route(/https:\/\/cdn\\.tailwindcss\\.com(?:\\/.*)?/, route => route.fulfill({`;

if (!source.includes('const bootErrors = []')) {
  if (!source.includes(from)) throw new Error('Could not locate openWorkshop for diagnostics.');
  source = source.replace(from, to);
}

const oldExpect = `  await expect(page.locator('#fileInput')).toBeAttached();
  await expect(page.locator('#sourceCanvas')).toBeVisible();`;
const newExpect = `  try {
    await expect(page.locator('#fileInput')).toBeAttached({ timeout: 8000 });
    await expect(page.locator('#sourceCanvas')).toBeVisible();
  } catch (error) {
    const body = await page.locator('body').innerHTML().catch(() => '<body unavailable>');
    throw new Error(\`Workshop boot failed.\\n\${bootErrors.join('\\n') || 'No pageerror captured.'}\\nBODY: \${body.slice(0, 1500)}\\nORIGINAL: \${error.message}\`);
  }`;

if (!source.includes('Workshop boot failed.')) {
  if (!source.includes(oldExpect)) throw new Error('Could not locate boot expectations for diagnostics.');
  source = source.replace(oldExpect, newExpect);
}

await writeFile(path, source, 'utf8');
console.log('Layout E2E boot diagnostics applied.');
