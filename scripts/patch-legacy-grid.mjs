import { readFile, writeFile } from 'node:fs/promises';

const path = 'index.html';
let html = await readFile(path, 'utf8');

const oldListener = `      ['preRows', 'preCols', 'gridMarginX', 'gridMarginY', 'gridGapX', 'gridGapY'].forEach(id => getEl(id)?.addEventListener('input', e => { if(state.activeSourceIdx===null) return; if(id.startsWith('grid')) getEl(id.replace('grid','').toLowerCase()+'Val'+(id.endsWith('X')?'X':'Y').replace('margin','margin').replace('gap','gap')).textContent=\\`${'${e.target.value}'}px\\`; applyGridChange(); }));`;

const newListener = `      const gridValueLabels = { gridMarginX: 'marginValX', gridMarginY: 'marginValY', gridGapX: 'gapValX', gridGapY: 'gapValY' };
      ['preRows', 'preCols', 'gridMarginX', 'gridMarginY', 'gridGapX', 'gridGapY'].forEach(id => getEl(id)?.addEventListener('input', e => {
          if(state.activeSourceIdx===null) return;
          const labelId = gridValueLabels[id];
          if(labelId) getEl(labelId).textContent = \\`${'${e.target.value}'}px\\`;
          applyGridChange();
      }));`;

if (!html.includes(oldListener)) {
  throw new Error('Expected grid input listener was not found; refusing an unsafe patch.');
}
html = html.replace(oldListener, newListener);

const duplicatedLayoutLogic = `       if (src.layout === '1x1') { src.rows=1; src.cols=1; } 
       if (state.layout === '1x1') { src.rows=1; src.cols=1; } 
       if (state.layout === '1x1') { src.rows=1; src.cols=1; } 
       else if (src.layout === '2x2') { src.rows=2; src.cols=2; }`;
const correctedLayoutLogic = `       if (src.layout === '1x1') { src.rows=1; src.cols=1; } 
       else if (src.layout === '2x2') { src.rows=2; src.cols=2; }`;

if (!html.includes(duplicatedLayoutLogic)) {
  throw new Error('Expected duplicated layout logic was not found; refusing an unsafe patch.');
}
html = html.replace(duplicatedLayoutLogic, correctedLayoutLogic);

await writeFile(path, html, 'utf8');
console.log('Patched legacy grid controls safely.');
