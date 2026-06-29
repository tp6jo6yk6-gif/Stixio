import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');
source = source.replaceAll('Refine · Manual Repair', 'Refine · Manual Tools');
await writeFile(path, source, 'utf8');
console.log('Refine architecture naming contract preserved.');
