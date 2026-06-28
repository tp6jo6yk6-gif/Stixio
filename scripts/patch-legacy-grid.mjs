import { readFile, writeFile } from 'node:fs/promises';

const path = 'index.html';
let html = await readFile(path, 'utf8');

const listenerPattern = /^      \['preRows', 'preCols', 'gridMarginX', 'gridMarginY', 'gridGapX', 'gridGapY'\]\.forEach\(id => getEl\(id\)\?\.addEventListener\('input',[\s\S]*?applyGridChange\(\); \}\)\);$/m;
const listenerReplacement = [
  "      const gridValueLabels = { gridMarginX: 'marginValX', gridMarginY: 'marginValY', gridGapX: 'gapValX', gridGapY: 'gapValY' };",
  "      ['preRows', 'preCols', 'gridMarginX', 'gridMarginY', 'gridGapX', 'gridGapY'].forEach(id => getEl(id)?.addEventListener('input', e => {",
  "          if(state.activeSourceIdx===null) return;",
  "          const labelId = gridValueLabels[id];",
  "          if(labelId) getEl(labelId).textContent = `${e.target.value}px`;",
  "          applyGridChange();",
  "      }));"
].join('\n');

if (!listenerPattern.test(html)) {
  throw new Error('Expected grid input listener was not found; refusing an unsafe patch.');
}
html = html.replace(listenerPattern, listenerReplacement);

const duplicatedLayoutPattern = /       if \(src\.layout === '1x1'\) \{ src\.rows=1; src\.cols=1; \} \n       if \(state\.layout === '1x1'\) \{ src\.rows=1; src\.cols=1; \} \n       if \(state\.layout === '1x1'\) \{ src\.rows=1; src\.cols=1; \} \n       else if \(src\.layout === '2x2'\) \{ src\.rows=2; src\.cols=2; \}/;
const correctedLayoutLogic = "       if (src.layout === '1x1') { src.rows=1; src.cols=1; } \n       else if (src.layout === '2x2') { src.rows=2; src.cols=2; }";

if (!duplicatedLayoutPattern.test(html)) {
  throw new Error('Expected duplicated layout logic was not found; refusing an unsafe patch.');
}
html = html.replace(duplicatedLayoutPattern, correctedLayoutLogic);

await writeFile(path, html, 'utf8');
console.log('Patched legacy grid controls safely.');
