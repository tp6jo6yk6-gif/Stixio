import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url);
const SELF = 'tests/workshop-naming.test.js';
const REPORT = new URL('../docs/workshop-naming-violations.txt', import.meta.url);
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.json', '.md', '.html', '.yml', '.yaml', '.txt', '.css']);
const BANNED = [
  /\bLINE\b/,
  /LineSticker/,
  /LineAsset/,
  /getLine/,
  /applyLine/,
  /lineNamingMode/,
  /lineCategory/,
  /stixio-line/,
  /line-sticker/,
  /line-integration/,
  /line-presets/
];

test('Workshop product files do not retain the old platform-first naming', async () => {
  const files = await walk(new URL('.', ROOT));
  const violations = [];

  for (const file of files) {
    const relative = path.relative(new URL('.', ROOT).pathname, file).replaceAll('\\', '/');
    if (relative === SELF || relative === 'docs/workshop-naming-violations.txt') continue;
    if (!TEXT_EXTENSIONS.has(path.extname(relative))) continue;
    const content = await readFile(file, 'utf8');
    for (const pattern of BANNED) {
      if (pattern.test(content) || pattern.test(relative)) violations.push(`${relative}: ${pattern}`);
    }
  }

  await writeFile(REPORT, violations.join('\n'), 'utf8');
  assert.deepEqual(violations, []);
});

async function walk(directoryUrl) {
  const directoryPath = directoryUrl.pathname;
  const entries = await readdir(directoryPath);
  const output = [];
  for (const entry of entries) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist') continue;
    const fullPath = path.join(directoryPath, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) output.push(...await walk(new URL(`${entry}/`, directoryUrl)));
    else output.push(fullPath);
  }
  return output;
}
