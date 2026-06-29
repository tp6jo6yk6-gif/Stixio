import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/e2e/layout.spec.js';
let source = await readFile(path, 'utf8');

if (!source.includes('const bootErrors = []')) {
  const marker = 'async function openWorkshop(page) {\n';
  if (!source.includes(marker)) throw new Error('Could not locate openWorkshop for diagnostics.');
  source = source.replace(marker, `${marker}  const bootErrors = [];\n  page.on('pageerror', error => bootErrors.push(\`pageerror: \${error.stack || error.message}\`));\n  page.on('console', message => {\n    if (message.type() === 'error') bootErrors.push(\`console: \${message.text()}\`);\n  });\n  page.on('requestfailed', request => bootErrors.push(\`requestfailed: \${request.url()} — \${request.failure()?.errorText || 'unknown'}\`));\n`);
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
