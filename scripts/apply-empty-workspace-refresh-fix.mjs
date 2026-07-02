import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// EMPTY_WORKSPACE_REFRESH_FIX';
const source = await readFile(path, 'utf8');

if (source.includes(marker)) {
  console.log('Empty workspace refresh fix already present.');
  process.exit(0);
}

const gridPrefix = `function renderReviewGrid(){
  const grid=document.getElementById('reviewGrid');if(!grid)return;
  const items=visibleReviewItems();
  if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}`;

const safeGridPrefix = `function renderReviewGrid(){
  const grid=document.getElementById('reviewGrid');if(!grid)return;
  if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}
  const items=visibleReviewItems();`;

if (!source.includes(gridPrefix)) {
  throw new Error('Unable to locate Review grid empty-state path.');
}

const refreshPattern = /function refresh\(\)\{[^\n]*\}\n\nfunction renderSourceList/;
if (!refreshPattern.test(source)) {
  throw new Error('Unable to locate Workshop refresh function.');
}

const safeRefresh = `${marker}
function refresh(){
  if(!frames().length){
    document.documentElement.dataset.stixioBootStage='refresh-empty';
    renderEmptyWorkspace();
    return;
  }

  document.documentElement.dataset.stixioBootStage='refresh-full';
  drawSourceCanvas();
  drawRefineCanvas();
  renderSourceList();
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
}

function renderEmptyWorkspace(){
  state.reviewReport={
    issues:[],
    summary:{total:0,errors:0,warnings:0,info:0},
    ready:false,
    canPackage:false,
    packagePlan:null
  };

  const sourceList=document.getElementById('sourceList');
  if(sourceList)sourceList.innerHTML='<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">尚無原圖</div>';

  const selectedInfo=document.getElementById('selectedInfo');
  if(selectedInfo)selectedInfo.textContent='尚未選取';

  const reviewGrid=document.getElementById('reviewGrid');
  if(reviewGrid)reviewGrid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';

  const reviewImage=document.getElementById('reviewHeroImage');
  if(reviewImage)reviewImage.removeAttribute('src');

  const reviewGuide=document.getElementById('reviewSafeGuide');
  if(reviewGuide)reviewGuide.classList.add('hidden');

  const reviewBounds=document.getElementById('reviewContentBounds');
  if(reviewBounds)reviewBounds.classList.add('hidden');

  const reviewMeta=document.getElementById('reviewHeroMeta');
  if(reviewMeta)reviewMeta.innerHTML='<div class="text-slate-400">尚無預覽</div>';

  const summary=document.getElementById('reviewSummary');
  if(summary)summary.innerHTML='<div class="rounded-2xl bg-white/10 p-3 text-xs text-slate-400">尚無可檢查貼圖</div>';

  const gate=document.getElementById('reviewGateStatus');
  if(gate)gate.innerHTML='<div class="rounded-2xl bg-white/10 p-3"><div class="text-2xl font-black">0/0</div><div class="text-xs">尚未匯入貼圖</div></div>';

  const issues=document.getElementById('reviewIssueList');
  if(issues)issues.innerHTML='<div class="rounded-xl bg-white/10 p-3 text-xs text-slate-300">沒有檢查項目</div>';

  const progress=document.getElementById('reviewProgressBar');
  if(progress)progress.innerHTML='<div class="flex items-center justify-between text-xs font-black"><span>已核准 0/0</span><span>0%</span></div><div class="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"></div>';

  const sourceStatus=document.getElementById('sourceStatus');
  if(sourceStatus)sourceStatus.textContent='尚未匯入';

  const undoBtn=document.getElementById('undoBtn');
  const redoBtn=document.getElementById('redoBtn');
  const exportBtn=document.getElementById('exportZipBtn');
  if(undoBtn)undoBtn.disabled=true;
  if(redoBtn)redoBtn.disabled=true;
  if(exportBtn){
    exportBtn.disabled=true;
    exportBtn.classList.add('opacity-40');
    exportBtn.title='尚未匯入貼圖';
  }
}

function refreshCommonControls(){
  const status=document.getElementById('sourceStatus');
  if(status){
    const source=activeSource();
    status.textContent=source?\`${'${source.name}'} · ${'${frames().filter(frame=>frame.sourceImageId===source.id).length}'} Frames\`:'尚未匯入';
  }
  const undoBtn=document.getElementById('undoBtn');
  const redoBtn=document.getElementById('redoBtn');
  if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);
  if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);
}

function renderSourceList`;

const next = source
  .replace(gridPrefix, safeGridPrefix)
  .replace(refreshPattern, safeRefresh);

await writeFile(path, next);
console.log('Empty workspace refresh fix installed.');
