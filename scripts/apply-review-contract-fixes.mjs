import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');
source = source.replace('function layoutButton(\n\nfunction layoutButton(', 'function layoutButton(');
source = source.replaceAll('Review · Package</p><h2 class="text-xl font-black">大型預覽、排序與匯出', 'Review · Quality Gate</p><h2 class="text-xl font-black">大型預覽、品質檢查與核准');
source = source.replace(
  'id="reviewHeroStage" class="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-200 touch-none"',
  'id="reviewHeroStage" class="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-200 touch-none" style="position:relative;min-height:360px;overflow:hidden;touch-action:none"'
);
source = source.replace(
  'id="reviewTransformLayer" class="absolute left-1/2 top-1/2 h-full w-full origin-center" style="transform:${refineViewTransform(state.reviewView)}"',
  'id="reviewTransformLayer" class="pointer-events-none absolute left-1/2 top-1/2 h-full w-full origin-center" style="position:absolute;left:50%;top:50%;width:100%;height:100%;pointer-events:none;transform-origin:center;transform:${refineViewTransform(state.reviewView)}"'
);
source = source.replace(
  'id="reviewTransformLayer" class="pointer-events-none absolute left-1/2 top-1/2 h-full w-full origin-center" style="transform:${refineViewTransform(state.reviewView)}"',
  'id="reviewTransformLayer" class="pointer-events-none absolute left-1/2 top-1/2 h-full w-full origin-center" style="position:absolute;left:50%;top:50%;width:100%;height:100%;pointer-events:none;transform-origin:center;transform:${refineViewTransform(state.reviewView)}"'
);
source = source.replace(
  'id="reviewHeroImage" class="absolute inset-0 h-full w-full object-contain"',
  'id="reviewHeroImage" class="absolute inset-0 h-full w-full object-contain" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none"'
);
source = source.replace(
  'id="reviewSafeGuide" class="pointer-events-none absolute border-2 border-rose-500 bg-rose-500/10"',
  'id="reviewSafeGuide" class="pointer-events-none absolute border-2 border-rose-500 bg-rose-500/10" style="position:absolute;pointer-events:none"'
);
source = source.replace(
  'id="reviewContentBounds" class="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/10"',
  'id="reviewContentBounds" class="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/10" style="position:absolute;pointer-events:none"'
);
source = source.replace(
  '<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(item?.fileName||frame.name)}</div>',
  '<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(frame.name)}</div><div class="mt-1 break-all font-mono text-xs text-slate-300">${escapeHtml(item?.fileName||"")}</div>'
);
source = source.replace(
  "card.dataset.frameId=frame.id;card.dataset.reviewCard='true';",
  "card.dataset.frameId=frame.id;card.dataset.sourceId=frame.sourceImageId;card.dataset.reviewCard='true';"
);
await writeFile(path, source, 'utf8');
console.log('Review migration boundaries, viewport mechanics and card identity normalized.');
