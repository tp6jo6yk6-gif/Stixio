import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// REVIEW_DRAG_TARGET_V1';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found.`);
  return source.replace(before, after);
}

async function main() {
  let source = await readFile(path, 'utf8');
  if (source.includes(marker)) return;

  source = replaceOnce(
    source,
    `  draggedReviewFrameId: null,\n  frameHistory:`,
    `  draggedReviewFrameId: null,\n  reviewDragTargetId: null,\n  frameHistory:`,
    'Review drag target state'
  );

  const oldHandlers = `card.addEventListener('dragstart',event=>{state.draggedReviewFrameId=frame.id;if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',frame.id);}});card.addEventListener('dragenter',event=>{if(canReorder)event.preventDefault();});card.addEventListener('dragover',event=>{if(canReorder){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});card.addEventListener('drop',event=>{if(!canReorder)return;event.preventDefault();const fromId=event.dataTransfer?.getData('text/plain')||state.draggedReviewFrameId;reorderFrame(fromId,frame.id);});// REVIEW_DRAG_FALLBACK_V1
    card.addEventListener('dragend',event=>{
      const fromId=state.draggedReviewFrameId;
      state.draggedReviewFrameId=null;
      if(!canReorder||!fromId)return;
      const element=document.elementFromPoint(event.clientX,event.clientY);
      const target=element&&element.closest('[data-review-card="true"]');
      const toId=target&&target.dataset.frameId;
      if(toId&&toId!==fromId)reorderFrame(fromId,toId);
    });grid.appendChild(card);`;

  const newHandlers = `${marker}
    card.addEventListener('dragstart',event=>{state.draggedReviewFrameId=frame.id;state.reviewDragTargetId=null;if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',frame.id);}});card.addEventListener('dragenter',event=>{if(canReorder){state.reviewDragTargetId=frame.id;event.preventDefault();}});card.addEventListener('dragover',event=>{if(canReorder){state.reviewDragTargetId=frame.id;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});card.addEventListener('drop',event=>{if(!canReorder)return;event.preventDefault();const fromId=event.dataTransfer?.getData('text/plain')||state.draggedReviewFrameId;state.reviewDragTargetId=null;reorderFrame(fromId,frame.id);});
    card.addEventListener('dragend',()=>{
      const fromId=state.draggedReviewFrameId;
      const toId=state.reviewDragTargetId;
      state.draggedReviewFrameId=null;
      state.reviewDragTargetId=null;
      if(canReorder&&fromId&&toId&&toId!==fromId)reorderFrame(fromId,toId);
    });grid.appendChild(card);`;

  source = replaceOnce(source, oldHandlers, newHandlers, 'Review drag target handlers');
  await writeFile(path, source);
}

await main();
