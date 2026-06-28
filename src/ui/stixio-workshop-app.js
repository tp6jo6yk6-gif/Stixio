import {
  BRAND,
  createDocument,
  addSourceRef,
  setDocumentFrames,
  createSourceImageRef,
  detectGrid,
  detectProjectionGrid,
  tightenFramesToContent,
  smartSnapFrameToContent,
  renderFrameToCanvas,
  reviewFrames,
  createMultiSourceZipExport,
  getRolePackageFilename,
  applyStickerPreset,
  getStickerPresets,
  StickerCategories,
  AssetRoles,
  createMaskCanvas,
  resizeMaskCanvas,
  paintMaskStroke,
  applyMagicMask,
  captureMaskSnapshot,
  restoreMaskSnapshot,
  MaskActions,
  createHistory,
  createCommand,
  executeCommand,
  commitHistory,
  undo,
  redo,
  canUndo,
  canRedo
} from '../core/index.js';

const HANDLE_SIZE = 14;
const MIN_FRAME_SIZE = 8;
const ROLE_OPTIONS = [AssetRoles.STICKER, AssetRoles.MAIN, AssetRoles.TAB];

const DEFAULT_SETTINGS = applyStickerPreset({
  layoutMode: 'auto',
  rows: 1,
  cols: 1,
  marginX: 0,
  marginY: 0,
  gapX: 0,
  gapY: 0,
  smartSnap: true,
  chromaEnabled: true,
  chromaColor: [255, 255, 255],
  tolerance: 30,
  exteriorOnly: true,
  autoDespeckle: true,
  shrinkRadius: 0,
  featherRadius: 1,
  whiteBorderEnabled: false,
  whiteBorderSize: 8,
  stickerCategory: StickerCategories.NORMAL,
  outputRole: AssetRoles.STICKER,
  reviewBackground: 'checker',
  refineZoom: 1,
  maskTool: 'view',
  maskSize: 15
}, StickerCategories.NORMAL, AssetRoles.STICKER);

const state = {
  document: createDocument({ name: 'Sticker Package Project' }),
  sources: new Map(),
  activeSourceId: null,
  selectedFrameId: null,
  rendered: new Map(),
  renderKeys: new Map(),
  reviewReport: null,
  settings: { ...DEFAULT_SETTINGS },
  frameDrag: null,
  maskStroke: null,
  maskHistories: new Map(),
  draggedReviewFrameId: null,
  frameHistory: createHistory({ frames: [], selectedFrameId: null })
};

export function initStixioWorkshop(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = `${BRAND.name} Workshop`;
  root.innerHTML = renderShell();
  bindStaticEvents(root);
  refresh();
}

function renderShell() {
  return `
    <div class="min-h-screen bg-[#f6f3ec] text-slate-950">
      <header class="sticky top-0 z-40 border-b border-slate-900/10 bg-[#f6f3ec]/95 backdrop-blur-xl">
        <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-xl font-black text-emerald-300">S</div>
            <div><h1 class="text-xl font-black">${BRAND.name} <span class="text-emerald-600">Workshop</span></h1><p class="text-xs font-bold text-slate-500">Stixio architecture · Sticker production workspace</p></div>
          </div>
          <div class="flex items-center gap-2"><button id="undoBtn" class="rounded-xl bg-white px-3 py-2 text-xs font-black">Undo</button><button id="redoBtn" class="rounded-xl bg-white px-3 py-2 text-xs font-black">Redo</button><button id="exportZipBtn" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Export ZIP</button></div>
        </div>
      </header>
      <main class="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[360px_1fr_340px]">
        <aside class="space-y-4">${renderImportPanel()}${renderDetectionPanel()}${renderOutputPanel()}${renderRefinePanel()}</aside>
        <section class="space-y-4">${renderSourceEditor()}${renderRefineEditor()}${renderReviewBoard()}</section>
        <aside class="space-y-4">${renderSourceListPanel()}${renderSelectedPanel()}${renderReviewPanel()}</aside>
      </main>
    </div>`;
}

function renderImportPanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Artwork Engine</p><h2 class="mt-1 text-xl font-black">多圖匯入</h2><p class="mt-2 text-sm text-slate-500">同一個 Document 可追加多張排版圖，Frame 保留各自的 sourceImageId。</p><label id="dropZone" class="mt-4 block cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-emerald-400"><input id="fileInput" type="file" accept="image/*" multiple class="hidden"><div class="text-3xl font-black text-emerald-500">＋</div><div class="mt-2 font-black">拖曳或選擇圖片</div><div class="text-xs text-slate-400">可一次多選並持續追加</div></label></section>`;
}

function renderDetectionPanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Detection Engine</p><h2 class="mt-1 text-xl font-black">切割與智能貼合</h2><div class="mt-4 grid grid-cols-3 gap-2">${layoutButton('auto','智能')}${layoutButton('1x1','單圖')}${layoutButton('2x2','2×2')}${layoutButton('3x3','3×3')}${layoutButton('custom','自訂')}</div><div class="mt-4 grid grid-cols-2 gap-3">${numberInput('rowsInput','Rows',state.settings.rows,1,12)}${numberInput('colsInput','Cols',state.settings.cols,1,12)}${numberInput('marginXInput','Margin X',state.settings.marginX,0,500)}${numberInput('marginYInput','Margin Y',state.settings.marginY,0,500)}${numberInput('gapXInput','Gap X',state.settings.gapX,0,500)}${numberInput('gapYInput','Gap Y',state.settings.gapY,0,500)}</div><label class="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>拖曳後智能貼合內容</span><input id="smartSnapInput" type="checkbox" ${state.settings.smartSnap?'checked':''}></label><button id="detectBtn" class="mt-4 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white">重新偵測目前原圖</button></section>`;
}

function renderOutputPanel() {
  const presets = getStickerPresets(state.settings.stickerCategory);
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Rules Engine</p><h2 class="mt-1 text-xl font-black">貼圖輸出規格</h2><label class="mt-4 block text-xs font-black text-slate-500">貼圖類型<select id="categoryInput" class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">${Object.values(StickerCategories).map(value=>`<option value="${value}" ${value===state.settings.stickerCategory?'selected':''}>${categoryLabel(value)}</option>`).join('')}</select></label><label class="mt-3 block text-xs font-black text-slate-500">輸出用途<select id="presetRoleInput" class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">${presets.map(item=>`<option value="${item.role}" ${item.role===state.settings.outputRole?'selected':''}>${item.name} · ${item.width}×${item.height}</option>`).join('')}</select></label><div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">${state.settings.targetW} × ${state.settings.targetH}px · safe ${state.settings.safeMargin}px</div></section>`;
}

function renderRefinePanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Refine Engine</p><h2 class="mt-1 text-xl font-black">去背與邊緣</h2><label class="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>去除背景色</span><input id="chromaEnabledInput" type="checkbox" ${state.settings.chromaEnabled?'checked':''}></label><div class="mt-3 flex gap-2"><input id="chromaColorInput" type="color" value="${rgbToHex(state.settings.chromaColor)}" class="h-10 w-14 rounded-xl"><button id="pickerBtn" class="flex-1 rounded-xl bg-slate-100 text-xs font-black">吸色器</button></div>${rangeInput('toleranceInput','色差容忍度',state.settings.tolerance,5,120)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>僅移除外圍背景</span><input id="exteriorInput" type="checkbox" ${state.settings.exteriorOnly?'checked':''}></label><label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>自動清除透明孤島</span><input id="despeckleInput" type="checkbox" ${state.settings.autoDespeckle?'checked':''}></label>${rangeInput('shrinkInput','去白邊',state.settings.shrinkRadius,0,8)}${rangeInput('featherInput','羽化',state.settings.featherRadius,0,8)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>白色外框</span><input id="borderInput" type="checkbox" ${state.settings.whiteBorderEnabled?'checked':''}></label>${rangeInput('borderSizeInput','外框粗細',state.settings.whiteBorderSize,0,25)}<button id="renderAllBtn" class="mt-4 w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950">重新渲染全部</button></section>`;
}

function renderSourceEditor() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="mb-4 flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Frame Editor</p><h2 class="text-xl font-black">原圖與九點裁切框</h2></div><div id="sourceStatus" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">尚未匯入</div></div><div class="grid min-h-[460px] place-items-center overflow-auto rounded-3xl border border-slate-200 bg-slate-100 p-4"><canvas id="sourceCanvas" class="max-h-[70vh] max-w-full cursor-crosshair rounded-xl shadow-xl"></canvas></div></section>`;
}

function renderRefineEditor() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Manual Refine</p><h2 class="text-xl font-black">魔術去背與保留筆刷</h2></div><div class="flex gap-2"><button data-mask-tool="view" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">檢視</button><button data-mask-tool="magic" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">魔術</button><button data-mask-tool="keep" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">保留</button><button data-mask-tool="delete" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">刪除</button></div></div><div class="mt-4 flex flex-wrap items-center gap-2">${rangeInput('maskSizeInput','筆刷',state.settings.maskSize,5,80)}<button id="maskUndoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">筆刷 Undo</button><button id="maskRedoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Redo</button><button id="maskClearBtn" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">清除</button><button id="zoomOutBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">−</button><button id="zoomResetBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">${Math.round(state.settings.refineZoom*100)}%</button><button id="zoomInBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">＋</button></div><div class="mt-4 grid min-h-[360px] place-items-center overflow-auto rounded-3xl bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:18px_18px] p-5"><canvas id="refineCanvas" class="max-w-full origin-center rounded-lg shadow-lg" style="transform:scale(${state.settings.refineZoom})"></canvas></div></section>`;
}

function renderReviewBoard() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Review + Package</p><h2 class="text-xl font-black">排序、角色與匯出</h2></div><div class="flex gap-2"><button data-review-bg="checker" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">透明</button><button data-review-bg="white" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">白</button><button data-review-bg="black" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">黑</button></div></div><div id="reviewGrid" class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"></div></section>`;
}

function renderSourceListPanel() { return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Document Engine</p><h2 class="mt-1 text-xl font-black">原圖清單</h2><div id="sourceList" class="mt-4 space-y-2"></div></section>`; }
function renderSelectedPanel() { return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Selected Frame</p><div id="selectedInfo" class="mt-4 text-sm text-slate-500">尚未選取</div><div class="mt-4 grid grid-cols-2 gap-2"><button id="duplicateBtn" class="rounded-xl bg-slate-100 py-2 text-xs font-black">複製</button><button id="deleteBtn" class="rounded-xl bg-rose-50 py-2 text-xs font-black text-rose-700">刪除</button></div></section>`; }
function renderReviewPanel() { return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-slate-950 p-5 text-white shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Review Engine</p><div id="reviewSummary" class="mt-4 space-y-2 text-sm"></div><button id="downloadSelectedBtn" class="mt-4 w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950">下載選取 PNG</button></section>`; }

function layoutButton(mode,label){return `<button data-layout="${mode}" class="layout-btn rounded-xl px-2 py-2 text-xs font-black ${state.settings.layoutMode===mode?'bg-slate-950 text-white':'bg-slate-100'}">${label}</button>`;}
function numberInput(id,label,value,min,max){return `<label class="text-xs font-black text-slate-500">${label}<input id="${id}" type="number" min="${min}" max="${max}" value="${value}" class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950"></label>`;}
function rangeInput(id,label,value,min,max){return `<label class="mt-3 block text-xs font-black text-slate-500"><span class="flex justify-between"><span>${label}</span><span id="${id}Value">${value}</span></span><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" class="mt-2 w-full accent-emerald-500"></label>`;}

function bindStaticEvents(root) {
  const fileInput = root.querySelector('#fileInput');
  fileInput.addEventListener('change', event => importFiles(event.target.files));
  const dropZone = root.querySelector('#dropZone');
  dropZone.addEventListener('dragover', event => event.preventDefault());
  dropZone.addEventListener('drop', event => { event.preventDefault(); importFiles(event.dataTransfer.files); });
  root.querySelectorAll('.layout-btn').forEach(button => button.addEventListener('click', () => setLayoutMode(button.dataset.layout)));
  root.querySelector('#detectBtn').addEventListener('click', detectActiveSource);
  ['rowsInput','colsInput','marginXInput','marginYInput','gapXInput','gapYInput'].forEach(id => root.querySelector(`#${id}`).addEventListener('input', readGridSettings));
  root.querySelector('#smartSnapInput').addEventListener('change', event => state.settings.smartSnap = event.target.checked);
  root.querySelector('#categoryInput').addEventListener('change', event => { state.settings.stickerCategory = event.target.value; const role = getStickerPresets(event.target.value)[0].role; state.settings = applyStickerPreset(state.settings,event.target.value,role); rerenderShell(); });
  root.querySelector('#presetRoleInput').addEventListener('change', event => { state.settings = applyStickerPreset(state.settings,state.settings.stickerCategory,event.target.value); clearRenderCache(); renderAll(); refresh(); });
  root.querySelector('#chromaEnabledInput').addEventListener('change', event => updateRefineSetting('chromaEnabled',event.target.checked));
  root.querySelector('#chromaColorInput').addEventListener('input', event => updateRefineSetting('chromaColor',hexToRgb(event.target.value)));
  root.querySelector('#pickerBtn').addEventListener('click', () => { state.settings.maskTool = 'picker'; refreshMaskToolButtons(); });
  root.querySelector('#exteriorInput').addEventListener('change', event => updateRefineSetting('exteriorOnly',event.target.checked));
  root.querySelector('#despeckleInput').addEventListener('change', event => updateRefineSetting('autoDespeckle',event.target.checked));
  bindRange(root,'toleranceInput','tolerance'); bindRange(root,'shrinkInput','shrinkRadius'); bindRange(root,'featherInput','featherRadius'); bindRange(root,'borderSizeInput','whiteBorderSize'); bindRange(root,'maskSizeInput','maskSize',false);
  root.querySelector('#borderInput').addEventListener('change', event => updateRefineSetting('whiteBorderEnabled',event.target.checked));
  root.querySelector('#renderAllBtn').addEventListener('click', () => { clearRenderCache(); renderAll(); refresh(); });
  root.querySelectorAll('.mask-tool').forEach(button => button.addEventListener('click', () => { state.settings.maskTool = button.dataset.maskTool; refreshMaskToolButtons(); }));
  root.querySelector('#maskUndoBtn').addEventListener('click', () => stepMaskHistory(-1));
  root.querySelector('#maskRedoBtn').addEventListener('click', () => stepMaskHistory(1));
  root.querySelector('#maskClearBtn').addEventListener('click', clearSelectedMask);
  root.querySelector('#zoomOutBtn').addEventListener('click', () => setRefineZoom(state.settings.refineZoom - .25));
  root.querySelector('#zoomResetBtn').addEventListener('click', () => setRefineZoom(1));
  root.querySelector('#zoomInBtn').addEventListener('click', () => setRefineZoom(state.settings.refineZoom + .25));
  root.querySelectorAll('.review-bg').forEach(button => button.addEventListener('click', () => { state.settings.reviewBackground = button.dataset.reviewBg; renderReviewGrid(); }));
  root.querySelector('#duplicateBtn').addEventListener('click', duplicateSelectedFrame);
  root.querySelector('#deleteBtn').addEventListener('click', deleteSelectedFrame);
  root.querySelector('#downloadSelectedBtn').addEventListener('click', downloadSelectedPng);
  root.querySelector('#exportZipBtn').addEventListener('click', downloadZip);
  root.querySelector('#undoBtn').addEventListener('click', undoFrames);
  root.querySelector('#redoBtn').addEventListener('click', redoFrames);
  bindSourceCanvas(root.querySelector('#sourceCanvas'));
  bindRefineCanvas(root.querySelector('#refineCanvas'));
}

function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);refresh();}
function bindRange(root,id,key,render=true){root.querySelector(`#${id}`).addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(`#${id}Value`);if(label)label.textContent=event.target.value;if(render){clearRenderCache();renderAll();refresh();}});}
function updateRefineSetting(key,value){state.settings[key]=value;clearRenderCache();renderAll();refresh();}
function readGridSettings(){state.settings.rows=valueOf('rowsInput',1);state.settings.cols=valueOf('colsInput',1);state.settings.marginX=valueOf('marginXInput',0);state.settings.marginY=valueOf('marginYInput',0);state.settings.gapX=valueOf('gapXInput',0);state.settings.gapY=valueOf('gapYInput',0);}
function valueOf(id,fallback){const value=Number(document.getElementById(id)?.value);return Number.isFinite(value)?value:fallback;}
function setLayoutMode(mode){state.settings.layoutMode=mode;if(mode==='1x1'){state.settings.rows=1;state.settings.cols=1;}if(mode==='2x2'){state.settings.rows=2;state.settings.cols=2;}if(mode==='3x3'){state.settings.rows=3;state.settings.cols=3;}rerenderShell();}

async function importFiles(fileList) {
  const files = [...(fileList || [])].filter(file => file.type?.startsWith('image/'));
  for (const file of files) {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const ref = createSourceImageRef({ name:file.name,width:img.width,height:img.height,mimeType:file.type,uri:dataUrl });
    const runtime = { ...ref, fileName:file.name, img };
    state.sources.set(ref.id,runtime);
    state.document = addSourceRef(state.document,ref);
    state.activeSourceId = ref.id;
    detectSource(ref.id);
  }
  refresh();
}

function detectActiveSource(){if(!state.activeSourceId)return;readGridSettings();detectSource(state.activeSourceId);refresh();}
function detectSource(sourceId) {
  const source = state.sources.get(sourceId); if(!source)return;
  let report;
  if(state.settings.layoutMode==='auto') report=detectProjectionGrid(source,{chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,tighten:true});
  else {
    report=detectGrid(source,{grid:{rows:state.settings.rows,cols:state.settings.cols,marginX:state.settings.marginX,marginY:state.settings.marginY,gapX:state.settings.gapX,gapY:state.settings.gapY,snapToPixels:true,minCellSize:8}});
    report.frames=tightenFramesToContent(source,report.frames,{padding:4,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance});
  }
  const oldFrames=frames().filter(frame=>frame.sourceImageId!==sourceId);
  const newFrames=report.frames.map((frame,index)=>({...frame,name:`${stripExtension(source.name)} ${String(index+1).padStart(2,'0')}`,custom:{...(frame.custom||{}),outputRole:AssetRoles.STICKER,maskVersion:0},state:{...(frame.state||{}),exportSelected:true,packageRole:'sticker'}}));
  setFrames([...oldFrames,...newFrames]); state.selectedFrameId=newFrames[0]?.id||state.selectedFrameId; resetFrameHistory(); clearRenderCache(); renderAll();
}

function frames(){return state.document.frames;}
function setFrames(next){state.document=setDocumentFrames(state.document,next);}
function activeSource(){return state.sources.get(state.activeSourceId)||null;}
function selectedFrame(){return frames().find(frame=>frame.id===state.selectedFrameId)||null;}
function sourceForFrame(frame){return frame?state.sources.get(frame.sourceImageId)||null:null;}

function getRenderOptions(){return{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,alignMode:'center',highQuality:true,refine:{enabled:true,chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,exteriorOnly:state.settings.exteriorOnly,autoDespeckle:state.settings.autoDespeckle,shrinkRadius:state.settings.shrinkRadius,featherRadius:state.settings.featherRadius,whiteBorder:{enabled:state.settings.whiteBorderEnabled,size:state.settings.whiteBorderSize,color:'#ffffff'},shadow:{enabled:false}}};}
function renderFrame(frame,force=false){const source=sourceForFrame(frame);if(!source)return null;const key=JSON.stringify({source:source.id,geometry:frame.geometry,maskVersion:frame.custom?.maskVersion||0,options:getRenderOptions()});if(!force&&state.rendered.has(frame.id)&&state.renderKeys.get(frame.id)===key)return state.rendered.get(frame.id);const canvas=renderFrameToCanvas(source,frame,getRenderOptions()).canvas;state.rendered.set(frame.id,canvas);state.renderKeys.set(frame.id,key);return canvas;}
function renderAll(){frames().forEach(frame=>renderFrame(frame));runReview();}
function clearRenderCache(){state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;}
function runReview(){state.reviewReport=reviewFrames(frames(),state.rendered,{targetW:state.settings.targetW,targetH:state.settings.targetH});}

function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderSelectedInfo();renderReviewSummary();refreshMaskToolButtons();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?`${source.name} · ${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}

function renderSourceList(){const holder=document.getElementById('sourceList');if(!holder)return;if(!state.sources.size){holder.innerHTML='<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">尚無原圖</div>';return;}holder.innerHTML='';state.sources.forEach(source=>{const button=document.createElement('button');button.className=`flex w-full items-center gap-3 rounded-2xl border p-2 text-left ${source.id===state.activeSourceId?'border-emerald-400 bg-emerald-50':'border-slate-200'}`;button.innerHTML=`<img src="${source.uri}" class="h-12 w-12 rounded-xl object-cover"><div class="min-w-0"><div class="truncate text-xs font-black">${escapeHtml(source.name)}</div><div class="text-[10px] text-slate-400">${source.width}×${source.height}</div></div>`;button.addEventListener('click',()=>{state.activeSourceId=source.id;const first=frames().find(frame=>frame.sourceImageId===source.id);if(first)state.selectedFrameId=first.id;refresh();});holder.appendChild(button);});}

function drawSourceCanvas(){const canvas=document.getElementById('sourceCanvas');if(!canvas)return;const source=activeSource();const ctx=canvas.getContext('2d');if(!source){canvas.width=1;canvas.height=1;ctx.clearRect(0,0,1,1);return;}canvas.width=source.width;canvas.height=source.height;ctx.drawImage(source.img,0,0);frames().filter(frame=>frame.sourceImageId===source.id).forEach(frame=>drawFrameOverlay(ctx,frame,frame.id===state.selectedFrameId));}
function drawFrameOverlay(ctx,frame,selected){const g=frame.geometry;ctx.save();ctx.strokeStyle=selected?'#10b981':'#ef4444';ctx.lineWidth=selected?Math.max(4,ctx.canvas.width/240):Math.max(2,ctx.canvas.width/400);ctx.strokeRect(g.x,g.y,g.width,g.height);if(selected)handlePoints(g).forEach(point=>{ctx.fillStyle='#10b981';ctx.fillRect(point.x-HANDLE_SIZE/2,point.y-HANDLE_SIZE/2,HANDLE_SIZE,HANDLE_SIZE);});ctx.restore();}
function bindSourceCanvas(canvas){canvas.addEventListener('pointerdown',sourcePointerDown);canvas.addEventListener('pointermove',sourcePointerMove);canvas.addEventListener('pointerup',sourcePointerUp);canvas.addEventListener('pointerleave',sourcePointerUp);}
function sourcePointerDown(event){const source=activeSource();if(!source)return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromSource(point);return;}const hit=hitTestFrame(point);if(!hit)return;state.selectedFrameId=hit.frame.id;state.frameDrag={frameId:hit.frame.id,handle:hit.handle,start:point,startGeometry:{...hit.frame.geometry},before:frameSnapshot()};event.currentTarget.setPointerCapture?.(event.pointerId);refresh();}
function sourcePointerMove(event){if(!state.frameDrag)return;const point=canvasPoint(event);const drag=state.frameDrag;const frame=frames().find(item=>item.id===drag.frameId);if(!frame)return;const dx=point.x-drag.start.x,dy=point.y-drag.start.y;const geometry=resizeGeometry(drag.startGeometry,drag.handle,dx,dy);replaceFrame({...frame,geometry:clampGeometry(geometry,activeSource())});drawSourceCanvas();}
function sourcePointerUp(){if(!state.frameDrag)return;const drag=state.frameDrag;state.frameDrag=null;let frame=frames().find(item=>item.id===drag.frameId);if(frame&&state.settings.smartSnap)frame=smartSnapFrameToContent(sourceForFrame(frame),frame,{searchPadding:12,padding:4,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance});if(frame){const mask=frame.custom?.protectMaskCanvas;if(mask&&(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height)))frame={...frame,custom:{...frame.custom,protectMaskCanvas:resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height),maskVersion:(frame.custom.maskVersion||0)+1}};replaceFrame(frame);}commitFrameChange(drag.handle==='move'?'Move Frame':'Resize Frame',drag.before,frameSnapshot());clearRenderCache();renderAll();refresh();}
function canvasPoint(event){const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
function hitTestFrame(point){const list=frames().filter(frame=>frame.sourceImageId===state.activeSourceId);const selected=selectedFrame();if(selected&&selected.sourceImageId===state.activeSourceId){const handle=hitHandle(point,selected.geometry);if(handle)return{frame:selected,handle};}for(let index=list.length-1;index>=0;index--){const frame=list[index],g=frame.geometry;if(point.x>=g.x&&point.x<=g.x+g.width&&point.y>=g.y&&point.y<=g.y+g.height)return{frame,handle:'move'};}return null;}
function handlePoints(g){return[{name:'nw',x:g.x,y:g.y},{name:'n',x:g.x+g.width/2,y:g.y},{name:'ne',x:g.x+g.width,y:g.y},{name:'e',x:g.x+g.width,y:g.y+g.height/2},{name:'se',x:g.x+g.width,y:g.y+g.height},{name:'s',x:g.x+g.width/2,y:g.y+g.height},{name:'sw',x:g.x,y:g.y+g.height},{name:'w',x:g.x,y:g.y+g.height/2}];}
function hitHandle(point,g){return handlePoints(g).find(item=>Math.abs(point.x-item.x)<=HANDLE_SIZE&&Math.abs(point.y-item.y)<=HANDLE_SIZE)?.name||null;}
function resizeGeometry(start,handle,dx,dy){let{x,y,width,height}=start;if(handle==='move')return{x:x+dx,y:y+dy,width,height};if(handle.includes('e'))width+=dx;if(handle.includes('s'))height+=dy;if(handle.includes('w')){x+=dx;width-=dx;}if(handle.includes('n')){y+=dy;height-=dy;}if(width<MIN_FRAME_SIZE){if(handle.includes('w'))x-=MIN_FRAME_SIZE-width;width=MIN_FRAME_SIZE;}if(height<MIN_FRAME_SIZE){if(handle.includes('n'))y-=MIN_FRAME_SIZE-height;height=MIN_FRAME_SIZE;}return{x,y,width,height};}
function clampGeometry(g,source){const width=Math.min(g.width,source.width),height=Math.min(g.height,source.height);return{x:Math.max(0,Math.min(g.x,source.width-width)),y:Math.max(0,Math.min(g.y,source.height-height)),width,height};}
function replaceFrame(next){setFrames(frames().map(frame=>frame.id===next.id?next:frame));}

function drawRefineCanvas(){const canvas=document.getElementById('refineCanvas');if(!canvas)return;const frame=selectedFrame(),source=sourceForFrame(frame),ctx=canvas.getContext('2d');if(!frame||!source){canvas.width=1;canvas.height=1;ctx.clearRect(0,0,1,1);return;}canvas.width=Math.max(1,Math.round(frame.geometry.width));canvas.height=Math.max(1,Math.round(frame.geometry.height));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);const mask=frame.custom?.protectMaskCanvas;if(mask){ctx.save();ctx.globalAlpha=.35;ctx.drawImage(mask,0,0,canvas.width,canvas.height);ctx.restore();}}
function bindRefineCanvas(canvas){canvas.addEventListener('pointerdown',refinePointerDown);canvas.addEventListener('pointermove',refinePointerMove);canvas.addEventListener('pointerup',refinePointerUp);canvas.addEventListener('pointerleave',refinePointerUp);}
function refinePointerDown(event){const frame=selectedFrame();if(!frame||state.settings.maskTool==='view')return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromRefine(point);return;}const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);if(state.settings.maskTool==='magic'){const raw=createRawCropCanvas(frame);applyMagicMask(raw,mask,point.x,point.y,{action:MaskActions.DELETE,tolerance:state.settings.tolerance});touchMask(frame,mask);commitMaskHistory(frame.id,mask);clearRenderCache();renderAll();refresh();return;}state.maskStroke={frameId:frame.id,last:point,action:state.settings.maskTool==='keep'?MaskActions.KEEP:MaskActions.DELETE};paintMaskStroke(mask,point,point,{action:state.maskStroke.action,size:state.settings.maskSize});touchMask(frame,mask);drawRefineCanvas();}
function refinePointerMove(event){if(!state.maskStroke)return;const frame=selectedFrame();if(!frame||frame.id!==state.maskStroke.frameId)return;const point=canvasPoint(event),mask=ensureFrameMask(frame);paintMaskStroke(mask,state.maskStroke.last,point,{action:state.maskStroke.action,size:state.settings.maskSize});state.maskStroke.last=point;touchMask(frame,mask);drawRefineCanvas();}
function refinePointerUp(){if(!state.maskStroke)return;const frame=selectedFrame(),mask=frame?.custom?.protectMaskCanvas;state.maskStroke=null;if(frame&&mask){commitMaskHistory(frame.id,mask);clearRenderCache();renderAll();refresh();}}
function ensureFrameMask(frame){let mask=frame.custom?.protectMaskCanvas;if(!mask)mask=createMaskCanvas(frame.geometry.width,frame.geometry.height);else if(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height))mask=resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height);touchMask(frame,mask,false);return mask;}
function touchMask(frame,mask,increment=true){replaceFrame({...frame,custom:{...frame.custom,protectMaskCanvas:mask,maskVersion:(frame.custom?.maskVersion||0)+(increment?1:0)}});}
function createRawCropCanvas(frame){const source=sourceForFrame(frame),canvas=document.createElement('canvas');canvas.width=Math.round(frame.geometry.width);canvas.height=Math.round(frame.geometry.height);canvas.getContext('2d').drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);return canvas;}
function ensureMaskHistory(frameId,mask){if(!state.maskHistories.has(frameId))state.maskHistories.set(frameId,{items:[captureMaskSnapshot(mask)],index:0});}
function commitMaskHistory(frameId,mask){ensureMaskHistory(frameId,mask);const history=state.maskHistories.get(frameId);history.items=history.items.slice(0,history.index+1);history.items.push(captureMaskSnapshot(mask));if(history.items.length>12)history.items.shift();history.index=history.items.length-1;}
function stepMaskHistory(direction){const frame=selectedFrame();if(!frame)return;const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);const history=state.maskHistories.get(frame.id),next=Math.max(0,Math.min(history.items.length-1,history.index+direction));if(next===history.index)return;history.index=next;restoreMaskSnapshot(mask,history.items[next]);touchMask(frame,mask);clearRenderCache();renderAll();refresh();}
function clearSelectedMask(){const frame=selectedFrame();if(!frame)return;const mask=createMaskCanvas(frame.geometry.width,frame.geometry.height);touchMask(frame,mask);state.maskHistories.delete(frame.id);ensureMaskHistory(frame.id,mask);clearRenderCache();renderAll();refresh();}
function setRefineZoom(value){state.settings.refineZoom=Math.max(.5,Math.min(4,value));const canvas=document.getElementById('refineCanvas');if(canvas)canvas.style.transform=`scale(${state.settings.refineZoom})`;const button=document.getElementById('zoomResetBtn');if(button)button.textContent=`${Math.round(state.settings.refineZoom*100)}%`;}
function refreshMaskToolButtons(){document.querySelectorAll('.mask-tool').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.maskTool===state.settings.maskTool));}
function pickColorFromSource(point){const source=activeSource();if(!source)return;const canvas=document.getElementById('sourceCanvas'),pixel=canvas.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function pickColorFromRefine(point){const canvas=document.getElementById('refineCanvas'),pixel=canvas.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function setPickedColor(pixel){state.settings.chromaColor=[pixel[0],pixel[1],pixel[2]];state.settings.maskTool='view';const input=document.getElementById('chromaColorInput');if(input)input.value=rgbToHex(state.settings.chromaColor);clearRenderCache();renderAll();refresh();}

function renderReviewGrid(){const grid=document.getElementById('reviewGrid');if(!grid)return;if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}grid.innerHTML='';frames().forEach((frame,index)=>{const canvas=renderFrame(frame),card=document.createElement('div');card.draggable=true;card.className=`rounded-3xl border p-2 ${frame.id===state.selectedFrameId?'border-emerald-400 bg-emerald-50':'border-slate-200 bg-white'}`;const dataUrl=canvas.toDataURL('image/png'),kb=Math.round(dataUrl.length*.75/1024);card.innerHTML=`<button class="preview block aspect-[370/320] w-full overflow-hidden rounded-2xl ${reviewBackgroundClass()}"><img src="${dataUrl}" class="h-full w-full object-contain"></button><div class="mt-2 flex items-center justify-between gap-2"><span class="text-[10px] font-black">#${index+1} · ${kb}KB</span><input class="export-check" type="checkbox" ${frame.state?.exportSelected!==false?'checked':''}></div><select class="role-select mt-2 w-full rounded-xl bg-slate-100 px-2 py-1 text-xs font-black">${ROLE_OPTIONS.map(role=>`<option value="${role}" ${packageRole(frame)===role?'selected':''}>${role}</option>`).join('')}</select><button class="single-download mt-2 w-full rounded-xl bg-slate-950 py-2 text-xs font-black text-white">PNG</button>`;card.querySelector('.preview').addEventListener('click',()=>{state.selectedFrameId=frame.id;state.activeSourceId=frame.sourceImageId;refresh();});card.querySelector('.export-check').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,exportSelected:event.target.checked}});runReview();renderReviewSummary();});card.querySelector('.role-select').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,packageRole:event.target.value},custom:{...frame.custom,outputRole:event.target.value}});renderReviewGrid();});card.querySelector('.single-download').addEventListener('click',()=>downloadFramePng(frame));card.addEventListener('dragstart',()=>state.draggedReviewFrameId=frame.id);card.addEventListener('dragover',event=>event.preventDefault());card.addEventListener('drop',()=>reorderFrame(state.draggedReviewFrameId,frame.id));grid.appendChild(card);});}
function reviewBackgroundClass(){if(state.settings.reviewBackground==='white')return'bg-white';if(state.settings.reviewBackground==='black')return'bg-slate-950';return'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%)] bg-[length:16px_16px]';}
function reorderFrame(fromId,toId){if(!fromId||fromId===toId)return;const list=[...frames()],from=list.findIndex(frame=>frame.id===fromId),to=list.findIndex(frame=>frame.id===toId);if(from<0||to<0)return;const[item]=list.splice(from,1);list.splice(to,0,item);setFrames(list);state.draggedReviewFrameId=null;resetFrameHistory();renderReviewGrid();}
function packageRole(frame){return frame.state?.packageRole||frame.custom?.outputRole||'sticker';}

function renderSelectedInfo(){const holder=document.getElementById('selectedInfo'),frame=selectedFrame();if(!holder)return;if(!frame){holder.textContent='尚未選取';return;}const g=frame.geometry;holder.innerHTML=`<div class="rounded-2xl bg-emerald-50 p-3 font-black text-emerald-800">${escapeHtml(frame.name)}<br><span class="text-xs">x ${Math.round(g.x)} · y ${Math.round(g.y)} · ${Math.round(g.width)}×${Math.round(g.height)}<br>role: ${packageRole(frame)}</span></div>`;}
function renderReviewSummary(){const holder=document.getElementById('reviewSummary');if(!holder)return;runReview();const report=state.reviewReport;if(!report){holder.innerHTML='<div class="text-slate-400">尚未檢查</div>';return;}holder.innerHTML=`<div class="rounded-2xl bg-white/10 p-3"><div class="text-2xl font-black">${frames().filter(frame=>frame.state?.exportSelected!==false).length}</div><div class="text-xs text-slate-400">selected exports</div></div><div class="rounded-2xl bg-white/10 p-3 text-xs">${report.ready?'✓ Review ready':`${report.summary.errors} errors · ${report.summary.warnings} warnings`}</div>`;}

function duplicateSelectedFrame(){const frame=selectedFrame();if(!frame)return;const copy={...frame,id:createId('frame'),name:`${frame.name} Copy`,geometry:clampGeometry({...frame.geometry,x:frame.geometry.x+20,y:frame.geometry.y+20},sourceForFrame(frame)),custom:{...frame.custom,protectMaskCanvas:null,maskVersion:0},state:{...frame.state,packageRole:'sticker'}};applyFrameListChange('Duplicate Frame',[...frames(),copy],copy.id);}
function deleteSelectedFrame(){const frame=selectedFrame();if(!frame)return;const list=frames().filter(item=>item.id!==frame.id);applyFrameListChange('Delete Frame',list,list[0]?.id||null);}
function frameSnapshot(){return{frames:cloneFrames(frames()),selectedFrameId:state.selectedFrameId};}
function cloneFrames(list){return list.map(frame=>({...frame,geometry:{...frame.geometry},state:{...frame.state},custom:{...frame.custom}}));}
function commitFrameChange(label,before,after){if(JSON.stringify(serializableSnapshot(before))===JSON.stringify(serializableSnapshot(after)))return;const command=createCommand({type:'frames.update',label,target:after.selectedFrameId,payload:{after},apply:()=>after});const executed=executeCommand(before,command);state.frameHistory=commitHistory(state.frameHistory,executed.entry);}
function serializableSnapshot(snapshot){return{selectedFrameId:snapshot.selectedFrameId,frames:snapshot.frames.map(frame=>({...frame,custom:{...frame.custom,protectMaskCanvas:frame.custom?.protectMaskCanvas?'[mask]':null}}))};}
function applyFrameSnapshot(snapshot){if(!snapshot)return;setFrames(cloneFrames(snapshot.frames));state.selectedFrameId=snapshot.selectedFrameId;clearRenderCache();renderAll();refresh();}
function resetFrameHistory(){state.frameHistory=createHistory(frameSnapshot());}
function undoFrames(){if(!canUndo(state.frameHistory))return;state.frameHistory=undo(state.frameHistory);applyFrameSnapshot(state.frameHistory.present);}
function redoFrames(){if(!canRedo(state.frameHistory))return;state.frameHistory=redo(state.frameHistory);applyFrameSnapshot(state.frameHistory.present);}
function applyFrameListChange(label,nextFrames,nextSelected){const before=frameSnapshot();setFrames(nextFrames);state.selectedFrameId=nextSelected;const after=frameSnapshot();commitFrameChange(label,before,after);clearRenderCache();renderAll();refresh();}

function downloadSelectedPng(){const frame=selectedFrame();if(frame)downloadFramePng(frame);}
function downloadFramePng(frame){const canvas=renderFrame(frame,true),role=packageRole(frame),stickerFrames=frames().filter(item=>packageRole(item)==='sticker'&&item.state?.exportSelected!==false),stickerIndex=Math.max(0,stickerFrames.findIndex(item=>item.id===frame.id));downloadDataUrl(canvas.toDataURL('image/png'),getRolePackageFilename(role,stickerIndex));}
async function downloadZip(){if(!frames().length)return alert('請先匯入圖片。');try{const roleMap=Object.fromEntries(frames().map(frame=>[frame.id,packageRole(frame)]));const result=await createMultiSourceZipExport({sourceImages:state.sources,frames:frames(),renderOptions:getRenderOptions(),renderedMap:state.rendered,exportOptions:{prefix:'stixio-workshop',allowWarnings:true,roleMap,order:frames().map(frame=>frame.id),rules:{key:'line',name:'Sticker',version:'1.0.0',canvas:{width:state.settings.targetW,height:state.settings.targetH},package:{naming:'sticker-package',roles:[],requiresMain:false,requiresTab:false,minStickers:1}}},JSZipClass:window.JSZip});state.rendered=result.renderedMap;downloadBlob(result.blob,result.fileName);refresh();}catch(error){alert(error.message||'ZIP 匯出失敗');}}
function downloadDataUrl(url,name){const link=document.createElement('a');link.href=url;link.download=name;link.click();}
function downloadBlob(blob,name){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}

function readFileAsDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});}
function rgbToHex([r,g,b]){return`#${[r,g,b].map(value=>Math.max(0,Math.min(255,value)).toString(16).padStart(2,'0')).join('')}`;}
function hexToRgb(hex){const value=hex.replace('#','');return[parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)];}
function stripExtension(name){return String(name||'source').replace(/\.[^.]+$/,'');}
function categoryLabel(value){return({normal:'一般貼圖',animated:'動態貼圖',big:'大貼圖',fullscreen:'全螢幕貼圖',effect:'特效貼圖'})[value]||value;}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function createId(prefix){return`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
