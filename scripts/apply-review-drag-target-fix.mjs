import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// REVIEW_DRAG_TARGET_V1';

async function main() {
  let source = await readFile(path, 'utf8');
  if (source.includes(marker)) return;

  if (!source.includes('reviewDragTargetId: null')) {
    const stateTarget = '  draggedReviewFrameId: null,\n';
    if (!source.includes(stateTarget)) throw new Error('Review drag state target not found.');
    source = source.replace(stateTarget, `${stateTarget}  reviewDragTargetId: null,\n`);
  }

  const startToken = "card.addEventListener('dragstart'";
  const endToken = '});grid.appendChild(card);';
  const start = source.indexOf(startToken);
  const end = start < 0 ? -1 : source.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error('Review drag handlers were not found.');

  const replacement = `${marker}
    card.addEventListener('dragstart',event=>{state.draggedReviewFrameId=frame.id;state.reviewDragTargetId=null;if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',frame.id);}});
    card.addEventListener('dragenter',event=>{if(canReorder){state.reviewDragTargetId=frame.id;event.preventDefault();}});
    card.addEventListener('dragover',event=>{if(canReorder){state.reviewDragTargetId=frame.id;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});
    card.addEventListener('drop',event=>{if(!canReorder)return;event.preventDefault();const fromId=event.dataTransfer?.getData('text/plain')||state.draggedReviewFrameId;state.reviewDragTargetId=null;reorderFrame(fromId,frame.id);});
    card.addEventListener('dragend',()=>{const fromId=state.draggedReviewFrameId;const toId=state.reviewDragTargetId;state.draggedReviewFrameId=null;state.reviewDragTargetId=null;if(canReorder&&fromId&&toId&&toId!==fromId)reorderFrame(fromId,toId);});grid.appendChild(card);`;

  source = source.slice(0, start) + replacement + source.slice(end + endToken.length);
  await writeFile(path, source);
}

await main();
