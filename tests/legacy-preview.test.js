import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('legacy preview loads the exact legacy restore pipeline', async () => {
  const html = await read('legacy-preview.html');
  assert.match(html, /src\/legacy\/restore\.js/);
  assert.match(html, /不是簡化重製版/);
  assert.doesNotMatch(html, /stixio-workshop-app-v2/);
});

test('legacy restore pipeline and all payload chunks exist', async () => {
  const restore = await read('src/legacy/restore.js');
  for (let index = 1; index <= 5; index += 1) {
    assert.match(restore, new RegExp(`payload-${index}\\.js`));
    await access(new URL(`../src/legacy/payload-${index}.js`, import.meta.url));
  }
  assert.match(restore, /DecompressionStream/);
  assert.match(restore, /document\.write\(html\)/);
});

test('static build includes the exact legacy preview', async () => {
  const build = await read('scripts/build-static.js');
  assert.match(build, /'legacy-preview\.html'/);
  assert.match(build, /'src'/);
});
