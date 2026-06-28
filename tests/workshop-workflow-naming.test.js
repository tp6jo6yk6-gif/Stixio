import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Workshop uses architecture stage names instead of numbered steps', async () => {
  const app = await read('src/ui/stixio-workshop-app-v2.js');
  assert.match(app, /Layout · Artwork Engine/);
  assert.match(app, /匯入與版面切割/);
  assert.match(app, /Refine · Manual Tools/);
  assert.match(app, /Review · Package/);
  assert.match(app, /Package · Rules Engine/);
  assert.doesNotMatch(app, /Step\s*1/i);
});

test('architecture book defines Layout as the renamed first stage', async () => {
  const files = await Promise.all([
    read('docs/architecture/ARCHITECTURE_V1.md'),
    read('docs/architecture/README.md'),
    read('docs/WORKSHOP-ARCHITECTURE.md')
  ]);
  for (const content of files) {
    assert.match(content, /Layout/);
    assert.match(content, /Refine/);
    assert.match(content, /Review/);
    assert.match(content, /Package/);
  }
});
