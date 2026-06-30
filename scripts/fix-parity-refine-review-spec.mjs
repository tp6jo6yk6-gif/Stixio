import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/e2e/parity-refine-review.spec.js';
let source = await readFile(path, 'utf8');
const browserGeometry = `state.allBoxes.map(item => [Math.round(item.cropX), Math.round(item.cropY), Math.round(item.cropW), Math.round(item.cropH)])`;
source = source.replace(
  `legacyApp.page.evaluate(() => geometryListForParity(state.allBoxes))`,
  `legacyApp.page.evaluate(() => ${browserGeometry})`
);
await writeFile(path, source, 'utf8');
console.log('Review reorder parity browser scope fixed.');
