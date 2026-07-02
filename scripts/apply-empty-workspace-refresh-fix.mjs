import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// EMPTY_WORKSPACE_REFRESH_FIX';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Empty workspace refresh fix already present.');
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

  const refreshBefore = "function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?`${source.name} · ${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}";

  const refreshAfter = `${marker}
function refresh(){
  if(state.sources.size===0){
    state.reviewReport={issues:[],summary:{total:0,errors:0,warnings:0,info:0},ready:false,canPackage:false,packagePlan:null};
    const values=[
      ['sourceList','<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">尚無原圖</div>'],
      ['selectedInfo','尚未選取'],
      ['reviewGrid','<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>'],
      ['reviewHeroMeta','<div class="text-slate-400">尚無預覽</div>'],
      ['reviewSummary','<div class="rounded-2xl bg-white/10 p-3 text-xs text-slate-400">尚無可檢查貼圖</div>'],
      ['reviewGateStatus','<div class="rounded-2xl bg-white/10 p-3"><div class="text-2xl font-black">0/0</div><div class="text-xs">尚未匯入貼圖</div></div>'],
      ['reviewIssueList','<div class="rounded-xl bg-white/10 p-3 text-xs text-slate-300">沒有檢查項目</div>'],
      ['reviewProgressBar','<div class="text-xs font-black">已核准 0/0 · 0%</div>']
    ];
    values.forEach(([id,html])=>{const node=document.getElementById(id);if(node)node.innerHTML=html;});
    const image=document.getElementById('reviewHeroImage');if(image)image.removeAttribute('src');
    document.getElementById('reviewSafeGuide')?.classList.add('hidden');
    document.getElementById('reviewContentBounds')?.classList.add('hidden');
    const status=document.getElementById('sourceStatus');if(status)status.textContent='尚未匯入';
    ['undoBtn','redoBtn','exportZipBtn'].forEach(id=>{const button=document.getElementById(id);if(button)button.disabled=true;});
    document.documentElement.dataset.stixioBootStage='refresh-empty';
    return;
  }
  drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?\`${'${source.name}'} · ${'${frames().filter(frame=>frame.sourceImageId===source.id).length}'} Frames\`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);
}`;

  if (!source.includes(gridBefore)) throw new Error('Review grid target not found.');
  if (!source.includes(refreshBefore)) throw new Error('Exact Workshop refresh target not found.');
  await writeFile(path, source.replace(gridBefore, gridAfter).replace(refreshBefore, refreshAfter));
  console.log('Empty workspace refresh fix installed.');
}

await main();
