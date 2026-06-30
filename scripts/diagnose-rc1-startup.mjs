import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const serveEntry = fileURLToPath(new URL('../node_modules/serve/build/main.js', import.meta.url));
const server = spawn(process.execPath, [serveEntry, '.', '-l', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

let browser;
try {
  await waitForServer('http://127.0.0.1:4173/index.html');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push({ name: error.name, message: error.message, stack: error.stack }));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || null }));
  page.on('response', response => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });

  await page.route(/https:\/\/cdn\.tailwindcss\.com(?:\/.*)?/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: ''
  }));
  await page.route(/https:\/\/cdnjs\.cloudflare\.com(?:\/.*)?/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.JSZip = class JSZip {}'
  }));

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    readyState: document.readyState,
    appHtmlLength: document.querySelector('#app')?.innerHTML.length || 0,
    fileInputCount: document.querySelectorAll('#fileInput').length,
    sourceCanvasCount: document.querySelectorAll('#sourceCanvas').length,
    bodyText: (document.body?.innerText || '').slice(0, 2000)
  }));

  const report = {
    result,
    pageErrors,
    consoleMessages,
    failedRequests,
    badResponses,
    serverOutput
  };
  await writeFile('rc1-startup-diagnostic.json', JSON.stringify(report, null, 2));
  await page.screenshot({ path: 'rc1-startup-diagnostic.png', fullPage: true });
  console.log(JSON.stringify(report, null, 2));

  if (result.fileInputCount !== 1 || result.sourceCanvasCount !== 1) {
    throw new Error(`RC1 Workshop failed to initialize: fileInput=${result.fileInputCount}, sourceCanvas=${result.sourceCanvasCount}`);
  }
} finally {
  await browser?.close();
  await stopServer(server);
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 400) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start.\n${serverOutput}`);
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode == null) child.kill('SIGKILL');
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}
