import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');

source = source.replace('function layoutButton(\n\nfunction layoutButton(', 'function layoutButton(');
source = source.replaceAll(
  'Review · Package</p><h2 class="text-xl font-black">大型預覽、排序與匯出',
  'Review · Quality Gate</p><h2 class="text-xl font-black">大型預覽、品質檢查與核准'
);

normalizeTag('div', 'reviewHeroStage', 'position:relative;min-height:360px;overflow:hidden;touch-action:none');
normalizeTag(
  'div',
  'reviewTransformLayer',
  'position:absolute;left:50%;top:50%;width:100%;height:100%;pointer-events:none;transform-origin:center;transform:${refineViewTransform(state.reviewView)}',
  className => className.includes('pointer-events-none') ? className : `pointer-events-none ${className}`
);
normalizeTag('img', 'reviewHeroImage', 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none');
normalizeTag('div', 'reviewSafeGuide', 'position:absolute;pointer-events:none');
normalizeTag('div', 'reviewContentBounds', 'position:absolute;pointer-events:none');

source = source.replace(
  '<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(item?.fileName||frame.name)}</div>',
  '<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(frame.name)}</div><div class="mt-1 break-all font-mono text-xs text-slate-300">${escapeHtml(item?.fileName||"")}</div>'
);
source = source.replace(
  "card.dataset.frameId=frame.id;card.dataset.reviewCard='true';",
  "card.dataset.frameId=frame.id;card.dataset.sourceId=frame.sourceImageId;card.dataset.reviewCard='true';"
);

await writeFile(path, source, 'utf8');
console.log('Review contracts normalized idempotently.');

function normalizeTag(tagName, id, style, normalizeClass = className => className) {
  const pattern = new RegExp(`<${tagName} id="${id}" class="([^"]*)"[^>]*>`);
  source = source.replace(pattern, (_match, className) => {
    const normalizedClass = normalizeClass(className).trim().replace(/\\s+/g, ' ');
    return `<${tagName} id="${id}" class="${normalizedClass}" style="${style}">`;
  });
}
