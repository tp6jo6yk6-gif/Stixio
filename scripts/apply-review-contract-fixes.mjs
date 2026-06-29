import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');
source = source.replace('function layoutButton(\n\nfunction layoutButton(', 'function layoutButton(');
source = source.replaceAll('Review · Package</p><h2 class="text-xl font-black">大型預覽、排序與匯出', 'Review · Quality Gate</p><h2 class="text-xl font-black">大型預覽、品質檢查與核准');
await writeFile(path, source, 'utf8');
console.log('Review migration boundaries normalized.');
