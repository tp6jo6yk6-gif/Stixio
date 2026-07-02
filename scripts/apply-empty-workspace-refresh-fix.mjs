import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const markerV1 = '// EMPTY_WORKSPACE_REFRESH_FIX';
const markerV2 = '// EMPTY_WORKSPACE_REFRESH_FIX_V2';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(markerV2)) {
    console.log('Empty workspace refresh V2 already present.');
    return;
  }

  const gridBefore = `function renderReviewGrid(){
  const grid=document.getElementById('reviewGrid');if(!grid)return;
  const items=visibleReviewItems();
  if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}`;
  const gridAfter = `function renderReviewGrid(){
  const grid=document.getElementById('reviewGrid');if(!grid)return;
  if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}
  const items=visibleReviewItems();`;

  const originalRefresh = "function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?`${source.name} · ${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}";

  const staleRefresh = `${markerV1}
function refresh(){
  drawSourceCanvas();
  drawRefineCanvas();
  renderSourceList();

  if(!frames().length){
    renderReviewGrid();
    renderLargeReview();
    renderSelectedInfo();
    renderEmptyReviewState();
    refreshReviewControls();
    refreshMaskToolButtons();
    refreshMaskHistoryButtons();
    updateRefineTransform();
    updateReviewTransform();
    refreshCommonControls();
    return;
  }

  renderReviewGrid();
  renderLargeReview();
  renderSelectedInfo();
  renderReviewSummary();
  renderReviewInspector();
  renderReviewProgress();
  refreshReviewControls();
  state.packageController?.refresh();
  state.projectController?.refresh();
  refreshMaskToolButtons();
  refreshMaskHistoryButtons();
  updateRefineTransform();
  updateReviewTransform();
  refreshCommonControls();
}`;

  const refreshV2 = `${markerV2}
function refresh(){
  if(state.sources.size===0){
    state.reviewReport={issues:[],summary:{total:0,errors:0,warnings:0,info:0},ready:false,canPackage:false,packagePlan:null};
    const sourceList=document.getElementById('sourceList');if(sourceList)sourceList.innerHTML='<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">尚無原圖</div>';
    const selected=document.getElementById('selectedInfo');if(selected)selected.textContent='尚未選取';
    const grid=document.getElementById('reviewGrid');if(grid)grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';
    renderEmptyReviewState();
    refreshCommonControls();
    const exportButton=document.getElementById('exportZipBtn');if(exportButton){exportButton.disabled=true;exportButton.classList.add('opacity-40');}
    document.documentElement.dataset.stixioBootStage='refresh-empty';
    return;
  }
  drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();refreshCommonControls();
}`;

  let next = source;
  if (next.includes(staleRefresh)) next = next.replace(staleRefresh, refreshV2);
  else if (next.includes(originalRefresh)) next = next.replace(originalRefresh, refreshV2);
  else throw new Error('Workshop refresh implementation is not recognized.');

  if (next.includes(gridBefore)) next = next.replace(gridBefore, gridAfter);
  await writeFile(path, next);
  console.log('Empty workspace refresh V2 installed.');
}

await main();
