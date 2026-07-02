import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import http from 'node:http';

const output = {
  generatedAt: new Date().toISOString(),
  console: [],
  pageErrors: [],
  requestFailures: [],
  paused: null,
  state: null
};

const server = spawn('npx', ['serve', 'dist', '-l', '4173', '--no-clipboard'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NO_UPDATE_NOTIFIER: '1' }
});
server.stdout.on('data', chunk => process.stdout.write(chunk));
server.stderr.on('data', chunk => process.stderr.write(chunk));

try {
  await waitForServer('http://127.0.0.1:4173/', 20_000);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const scripts = new Map();

  page.on('console', message => output.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => output.pageErrors.push({ name: error.name, message: error.message, stack: error.stack }));
  page.on('requestfailed', request => output.requestFailures.push({ url: request.url(), failure: request.failure() }));

  cdp.on('Debugger.scriptParsed', event => scripts.set(event.scriptId, event));
  cdp.on('Debugger.paused', async event => {
    const frames = [];
    for (const frame of event.callFrames.slice(0, 20)) {
      const parsed = scripts.get(frame.location.scriptId) || {};
      let snippet = null;
      try {
        const source = await cdp.send('Debugger.getScriptSource', { scriptId: frame.location.scriptId });
        const text = source.scriptSource || '';
        const lines = text.split('\n');
        const line = lines[frame.location.lineNumber] || '';
        const column = frame.location.columnNumber || 0;
        snippet = line.slice(Math.max(0, column - 240), column + 500);
      } catch {}
      frames.push({
        functionName: frame.functionName,
        url: frame.url || parsed.url || '',
        lineNumber: frame.location.lineNumber,
        columnNumber: frame.location.columnNumber,
        snippet
      });
    }
    output.paused = { reason: event.reason, frames };
    await writeFile('debug-bootstrap-stack.json', JSON.stringify(output, null, 2));
    try { await cdp.send('Debugger.resume'); } catch {}
  });

  await cdp.send('Debugger.enable');
  await cdp.send('Runtime.enable');
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'commit', timeout: 15_000 });
  await delay(5_000);

  try {
    output.state = await Promise.race([
      page.evaluate(() => ({
        readyState: document.readyState,
        title: document.title,
        stage: document.documentElement.dataset.stixioBootStage || null,
        ready: document.documentElement.dataset.stixioReady || null,
        error: document.documentElement.dataset.stixioBootError || null,
        fileInput: Boolean(document.querySelector('#fileInput')),
        diagnostics: Boolean(document.querySelector('#stixioDiagnosticsButton')),
        bodyText: document.body.innerText.slice(0, 500)
      })),
      delay(2_000).then(() => ({ evaluationTimedOut: true }))
    ]);
  } catch (error) {
    output.state = { evaluationError: error.message };
  }

  await writeFile('debug-bootstrap-stack.json', JSON.stringify(output, null, 2));
  if (!output.state?.ready) {
    try { await cdp.send('Debugger.pause'); } catch (error) {
      output.pauseError = error.message;
      await writeFile('debug-bootstrap-stack.json', JSON.stringify(output, null, 2));
    }
    await delay(5_000);
  }

  await writeFile('debug-bootstrap-stack.json', JSON.stringify(output, null, 2));
  await browser.close();
} finally {
  server.kill('SIGTERM');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForServer(url, timeout) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, response => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.on('error', retry);
      request.setTimeout(1_000, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - started >= timeout) reject(new Error('Preview server did not start.'));
      else setTimeout(check, 250);
    };
    check();
  });
}
