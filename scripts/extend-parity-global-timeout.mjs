import { readFile, writeFile } from 'node:fs/promises';
const path='playwright.parity.config.js';
let source=await readFile(path,'utf8');
source=source.replace('globalTimeout: 600000','globalTimeout: 1200000');
await writeFile(path,source,'utf8');
console.log('Parity global timeout extended.');
