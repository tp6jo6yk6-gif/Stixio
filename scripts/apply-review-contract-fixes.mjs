import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');
source = source.replace('function layoutButton(\n\nfunction layoutButton(', 'function layoutButton(');
source = source.replaceAll('Review · Package</p><h2 class="text-xl font-black">大型預覽、排序與匯出', 'Review · Quality Gate</p><h2 class="text-xl font-black">大型預覽、品質檢查與核准');
source = source.replace(
  'id="reviewTransformLayer" class="absolute left-1/2 top-1/2 h-full w-full origin-center"',
  'id="reviewTransformLayer" class="pointer-events-none absolute left-1/2 top-1/2 h-full w-full origin-center"'
);
source = source.replace(
  '<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(item?.fileName||frame.name)}</div>',
  '<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(frame.name)}</div><div class="mt-1 break-all font-mono text-xs text-slate-300">${escapeHtml(item?.fileName||"")}</div>'
);
await writeFile(path, source, 'utf8');
console.log('Review migration boundaries and preview containment normalized.');
