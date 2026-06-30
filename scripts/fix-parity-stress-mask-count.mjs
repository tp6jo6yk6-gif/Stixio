import { readFile, writeFile } from 'node:fs/promises';
const path='tests/e2e/parity-stress.spec.js';
let source=await readFile(path,'utf8');
source=source.replace(
  "frame.custom?.protectMask?.dataUrl).length",
  "(frame.custom?.protectMask?.dataUrl || frame.custom?.protectMask?.assetPath)).length"
);
await writeFile(path,source,'utf8');
console.log('Stress mask archive count fixed.');
