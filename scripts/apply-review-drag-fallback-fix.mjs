import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// REVIEW_DRAG_FALLBACK_V1';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) return;

  const before = "card.addEventListener('dragend',()=>{state.draggedReviewFrameId=null;});grid.appendChild(card);";
  const after = `${marker}
    card.addEventListener('dragend',event=>{
      const fromId=state.draggedReviewFrameId;
      state.draggedReviewFrameId=null;
      if(!canReorder||!fromId)return;
      const element=document.elementFromPoint(event.clientX,event.clientY);
      const target=element&&element.closest('[data-review-card="true"]');
      const toId=target&&target.dataset.frameId;
      if(toId&&toId!==fromId)reorderFrame(fromId,toId);
    });grid.appendChild(card);`;

  if (!source.includes(before)) throw new Error('Review drag fallback target not found.');
  await writeFile(path, source.replace(before, after));
}

await main();
