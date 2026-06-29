import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('package scripts expose source and built local preview commands', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['preview:local'], 'npx serve . -l 4173');
  assert.equal(pkg.scripts['preview:build'], 'npm run build && npx serve dist -l 4173');
});

test('local preview embeds the real Workshop and exposes clickable controls', async () => {
  const html = await read('local-preview.html');
  assert.match(html, /id="stixioFrame"/);
  assert.match(html, /src="\.\/index\.html\?local-preview=1"/);
  assert.match(html, /id="loadDemoBtn"/);
  assert.match(html, /id="runSmokeBtn"/);
  assert.match(html, /data-check="viewport"/);
  assert.match(html, /data-check="package"/);
  assert.match(html, /noindex,nofollow/);
});

test('local preview controller generates demo artwork and runs smoke tests', async () => {
  const source = await read('local-preview.js');
  for (const token of [
    'createDemoSheetBlob',
    'loadDemoSheet',
    'runSmokeTests',
    'testGridReset',
    'testViewportZoom',
    'testDarkMode',
    'testPackageControls',
    'DataTransfer',
    'WheelEvent'
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test('static build includes the local preview assets', async () => {
  const build = await read('scripts/build-static.js');
  assert.match(build, /'local-preview\.html'/);
  assert.match(build, /'local-preview\.js'/);
});

test('README documents the local preview URL and commands', async () => {
  const readme = await read('README.md');
  assert.match(readme, /npm run preview:local/);
  assert.match(readme, /npm run preview:build/);
  assert.match(readme, /http:\/\/localhost:4173\/local-preview\.html/);
});
