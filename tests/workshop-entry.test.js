import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('index.html is the only executable Workshop entry', async () => {
  const index = await text('index.html');
  assert.match(index, /initStixioWorkshop/);
  assert.match(index, /src\/ui\/stixio-workshop-app\.js/);
  assert.doesNotMatch(index, /initStixioApp/);
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
  await access(new URL('src/ui/stixio-workshop-app.js', root));
});
