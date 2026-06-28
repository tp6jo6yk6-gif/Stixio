import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/core/render.js';
let source = await readFile(path, 'utf8');

const oldRefineCall = `    : refineSourceCanvas(sourceCanvas, renderOptions.refine);`;
const newRefineCall = `    : refineSourceCanvas(sourceCanvas, {\n      ...renderOptions.refine,\n      protectMaskCanvas: frame.custom?.protectMaskCanvas || null\n    });`;
if (!source.includes(oldRefineCall)) throw new Error('Render refine call not found.');
source = source.replace(oldRefineCall, newRefineCall);

const oldOptions = `    featherRadius: refineOptions.featherRadius\n  });`;
const newOptions = `    featherRadius: refineOptions.featherRadius,\n    protectMaskCanvas: refineOptions.protectMaskCanvas || null\n  });`;
if (!source.includes(oldOptions)) throw new Error('Image processing options block not found.');
source = source.replace(oldOptions, newOptions);

await writeFile(path, source, 'utf8');
console.log('Connected Frame protect mask to shared Render Engine.');
