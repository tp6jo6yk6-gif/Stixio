import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('index.html is the only executable Workshop entry', async () => {
  const index = await text('index.html');
  const entry = await text('src/ui/stixio-browser-entry.js');
  assert.match(index, /public\/app\/stixio-workshop-1\.0\.0\.js/);
  assert.doesNotMatch(index, /type="module"/);
  assert.doesNotMatch(index, /src\/ui\/stixio-workshop-app-v2\.js/);
  assert.match(entry, /initStixioWorkshop/);
  assert.match(entry, /stixioReady/);
  assert.doesNotMatch(entry, /initStixioApp/);
});

test('legacy entry URLs only redirect to index.html', async () => {
  for (const file of ['workshop.html', 'next.html']) {
    const content = await text(file);
    assert.match(content, /location\.replace\('\.\/index\.html'\)/);
    assert.doesNotMatch(content, /type="module"/);
    assert.doesNotMatch(content, /src\/ui\//);
  }
});

test('retired duplicate UI implementation is removed', async () => {
  await assert.rejects(access(new URL('src/ui/stixio-app.js', root)));
  await access(new URL('src/ui/stixio-workshop-app-v2.js', root));
  await access(new URL('src/ui/stixio-browser-entry.js', root));
});
