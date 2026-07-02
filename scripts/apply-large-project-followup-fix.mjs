import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// LARGE_PROJECT_FOLLOWUP_FIX_V1';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found.`);
  return source.replace(before, after);
}

async function main() {
  let source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Large project follow-up fix already present.');
    return;
  }

  source = replaceOnce(
    source,
    `  reviewThumbnailPromises: new Map(),\n  renderLru: new Map(),`,
    `  reviewThumbnailPromises: new Map(),\n  thumbnailLru: new Map(),\n  renderLru: new Map(),`,
    'Thumbnail LRU state'
  );

  source = replaceOnce(
    source,
    `function enforceThumbnailCacheLimit(extraProtected=[]){const protectedIds=renderCacheProtectedIds(extraProtected);while(state.reviewThumbnails.size>state.thumbnailCacheLimit){const oldest=[...state.reviewThumbnails.keys()].find(frameId=>!protectedIds.has(frameId));if(!oldest)break;revokeReviewThumbnail(oldest);}}`,
    `function enforceThumbnailCacheLimit(extraProtected=[]){const protectedIds=renderCacheProtectedIds(extraProtected);while(state.reviewThumbnails.size>state.thumbnailCacheLimit){const oldest=[...state.thumbnailLru.keys()].find(frameId=>!protectedIds.has(frameId));if(!oldest)break;revokeReviewThumbnail(oldest);}}`,
    'Thumbnail eviction order'
  );

  source = replaceOnce(
    source,
    `function revokeReviewThumbnail(frameId){const cached=state.reviewThumbnails.get(frameId);if(cached?.url)URL.revokeObjectURL(cached.url);state.reviewThumbnails.delete(frameId);state.reviewThumbnailPromises.delete(frameId);state.workerAnalysis.delete(frameId);}`,
    `function revokeReviewThumbnail(frameId){const cached=state.reviewThumbnails.get(frameId);if(cached?.url)URL.revokeObjectURL(cached.url);state.reviewThumbnails.delete(frameId);state.reviewThumbnailPromises.delete(frameId);state.thumbnailLru.delete(frameId);state.workerAnalysis.delete(frameId);}`,
    'Thumbnail LRU revoke'
  );

  source = replaceOnce(
    source,
    `function clearReviewThumbnailCache(){for(const cached of state.reviewThumbnails.values())if(cached?.url)URL.revokeObjectURL(cached.url);state.reviewThumbnails.clear();state.reviewThumbnailPromises.clear();state.workerAnalysis.clear();}`,
    `function clearReviewThumbnailCache(){for(const cached of state.reviewThumbnails.values())if(cached?.url)URL.revokeObjectURL(cached.url);state.reviewThumbnails.clear();state.reviewThumbnailPromises.clear();state.thumbnailLru.clear();state.workerAnalysis.clear();}`,
    'Thumbnail LRU clear'
  );

  source = source.replaceAll(
    `touchLru(state.reviewThumbnails,frame.id)`,
    `touchLru(state.thumbnailLru,frame.id)`
  );

  source = replaceOnce(
    source,
    `if(result.analysis)state.workerAnalysis.set(frame.id,result.analysis);enforceThumbnailCacheLimit([frame.id]);`,
    `if(result.analysis){state.workerAnalysis.set(frame.id,result.analysis);document.documentElement.dataset.stixioImageWorker='active';}enforceThumbnailCacheLimit([frame.id]);`,
    'Worker activation signal'
  );

  const dragBefore = `card.addEventListener('dragstart',()=>state.draggedReviewFrameId=frame.id);card.addEventListener('dragover',event=>{if(canReorder)event.preventDefault();});card.addEventListener('drop',()=>{if(canReorder)reorderFrame(state.draggedReviewFrameId,frame.id);});grid.appendChild(card);`;
  const dragAfter = `${marker}\n    card.addEventListener('dragstart',event=>{state.draggedReviewFrameId=frame.id;if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',frame.id);}});card.addEventListener('dragenter',event=>{if(canReorder)event.preventDefault();});card.addEventListener('dragover',event=>{if(canReorder){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});card.addEventListener('drop',event=>{if(!canReorder)return;event.preventDefault();const fromId=event.dataTransfer?.getData('text/plain')||state.draggedReviewFrameId;reorderFrame(fromId,frame.id);});card.addEventListener('dragend',()=>{state.draggedReviewFrameId=null;});grid.appendChild(card);`;
  source = replaceOnce(source, dragBefore, dragAfter, 'Stable Review drag reorder');

  await writeFile(path, source);
  console.log('Large project follow-up fix installed.');
}

await main();
