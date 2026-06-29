import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');

if (source.includes('REFINE_FULL_COMPLETION')) {
  console.log('Refine full completion already applied.');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing Refine migration target: ${label}`);
  source = source.replace(from, to);
}

function replaceSection(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing Refine section: ${label}`);
  source = source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

replaceOnce(
  `  mergeDetectedFrameStates,\n  getNextSourceId\n} from '../core/index.js';`,
  `  mergeDetectedFrameStates,\n  getNextSourceId,\n  clearMask,\n  getMaskStats,\n  createRefineViewState,\n  zoomRefineView,\n  panRefineView,\n  resetRefineView,\n  refineViewTransform\n} from '../core/index.js';`,
  'Core imports'
);

replaceOnce(
  `  maskTool: 'view',\n  maskSize: 15,`,
  `  maskTool: 'view',\n  maskSize: 15,\n  maskOverlayVisible: true,\n  maskOverlayOpacity: 42,\n  magicAction: MaskActions.DELETE,\n  magicContiguous: true,\n  refineViewMode: 'split',\n  despeckleMinSize: 30,`,
  'Refine defaults'
);

replaceOnce(
  `  frameHistory: createHistory({ frames: [], selectedFrameId: null })\n};`,
  `  frameHistory: createHistory({ frames: [], selectedFrameId: null }),\n  refineView: createRefineViewState(),\n  refinePan: null,\n  refinePointer: null,\n  activeEditor: 'layout',\n  globalEventsBound: false,\n  refineAppliedAt: new Map(),\n  refineRenderTimer: null\n};`,
  'Refine state'
);

replaceSection('function renderRefinePanel() {', 'function renderSourceEditor() {', `function renderRefinePanel() {
  return \`<section id="refine-settings-panel" class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Refine · Processing Engine</p><h2 class="mt-1 text-xl font-black">自動去背與邊緣品質</h2><label class="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>去除背景色</span><input id="chromaEnabledInput" type="checkbox" \${state.settings.chromaEnabled?'checked':''}></label><div class="mt-3 flex gap-2"><input id="chromaColorInput" type="color" value="\${rgbToHex(state.settings.chromaColor)}" class="h-10 w-14 rounded-xl"><button id="pickerBtn" class="flex-1 rounded-xl bg-slate-100 text-xs font-black">吸色器</button></div>\${rangeInput('toleranceInput','色差容忍度',state.settings.tolerance,5,120)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>僅移除外圍背景</span><input id="exteriorInput" type="checkbox" \${state.settings.exteriorOnly?'checked':''}></label><label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>自動清除透明孤島</span><input id="despeckleInput" type="checkbox" \${state.settings.autoDespeckle?'checked':''}></label>\${rangeInput('despeckleSizeInput','雜點最小保留面積',state.settings.despeckleMinSize,1,500)}\${rangeInput('shrinkInput','去白邊／侵蝕',state.settings.shrinkRadius,0,8)}\${rangeInput('featherInput','平滑羽化',state.settings.featherRadius,0,8)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>外框</span><input id="borderInput" type="checkbox" \${state.settings.whiteBorderEnabled?'checked':''}></label><div class="mt-3 flex items-end gap-3"><label class="text-xs font-black text-slate-500">外框顏色<input id="borderColorInput" type="color" value="\${state.settings.borderColor}" class="mt-1 h-10 w-14 rounded-xl"></label><div class="flex-1">\${rangeInput('borderSizeInput','外框粗細',state.settings.whiteBorderSize,0,25)}</div></div><div class="mt-4 grid grid-cols-2 gap-2"><button id="renderSelectedBtn" class="rounded-2xl bg-sky-50 py-3 text-xs font-black text-sky-800">重算本張</button><button id="renderAllBtn" class="rounded-2xl bg-emerald-300 py-3 text-xs font-black text-slate-950">重算全部</button></div><button id="resetRefineSettingsBtn" class="mt-2 w-full rounded-2xl bg-slate-100 py-3 text-xs font-black">恢復 Refine 預設值</button></section>\`;
}`, 'Refine settings panel');

replaceSection('function renderRefineEditor() {', 'function renderReviewBoard() {', `function renderRefineEditor() {
  const mode = state.settings.refineViewMode;
  const showEditor = mode !== 'result';
  const showResult = mode !== 'mask';
  return \`<section id="stage-refine" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Refine · Manual Repair</p><h2 class="text-xl font-black">單張遮罩修補工作台</h2></div><div class="flex flex-wrap gap-2"><button data-mask-tool="view" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">檢視／平移</button><button data-mask-tool="magic" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">魔術</button><button data-mask-tool="keep" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">保留</button><button data-mask-tool="delete" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">強制去背</button><button data-mask-tool="clear" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">清除標記</button></div></div><div class="mt-4 grid gap-3 rounded-3xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4"><div><div class="text-xs font-black text-slate-500">魔術動作</div><div class="mt-2 grid grid-cols-2 gap-2"><button data-magic-action="delete" class="magic-action rounded-xl bg-white px-3 py-2 text-xs font-black">去背</button><button data-magic-action="keep" class="magic-action rounded-xl bg-white px-3 py-2 text-xs font-black">保留</button></div><label class="mt-2 flex items-center gap-2 text-xs font-black"><input id="magicContiguousInput" type="checkbox" \${state.settings.magicContiguous?'checked':''}>僅連續區域</label></div><div>\${rangeInput('maskSizeInput','筆刷大小',state.settings.maskSize,5,120)}</div><div><label class="flex items-center justify-between text-xs font-black text-slate-500"><span>顯示遮罩標記</span><input id="maskOverlayInput" type="checkbox" \${state.settings.maskOverlayVisible?'checked':''}></label>\${rangeInput('maskOverlayOpacityInput','遮罩透明度',state.settings.maskOverlayOpacity,5,100)}</div><div><div class="text-xs font-black text-slate-500">檢視模式</div><div class="mt-2 grid grid-cols-3 gap-1"><button data-refine-view="split" class="refine-view rounded-xl bg-white px-2 py-2 text-xs font-black">雙欄</button><button data-refine-view="mask" class="refine-view rounded-xl bg-white px-2 py-2 text-xs font-black">修補</button><button data-refine-view="result" class="refine-view rounded-xl bg-white px-2 py-2 text-xs font-black">成品</button></div></div></div><div class="mt-3 flex flex-wrap items-center gap-2"><button id="maskUndoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black disabled:opacity-30">遮罩 Undo</button><button id="maskRedoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black disabled:opacity-30">Redo</button><button id="maskClearBtn" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">清除全部標記</button><button id="resetSelectedRefineBtn" class="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">重設本張</button><button id="applyRefineBtn" class="rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white">套用修補結果</button><span class="ml-auto text-xs font-bold text-slate-400">滾輪縮放 · 拖曳平移 · 空白鍵暫時平移</span><button id="zoomOutBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">−</button><button id="zoomResetBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">\${Math.round(state.refineView.zoom*100)}%</button><button id="zoomInBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">＋</button></div><div id="refineWorkspace" class="mt-4 grid gap-4 \${showEditor&&showResult?'lg:grid-cols-2':'grid-cols-1'}"><div id="refineViewport" class="relative min-h-[430px] overflow-hidden rounded-3xl border border-slate-200 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:18px_18px] touch-none" style="\${showEditor?'':'display:none'};min-height:430px"><div id="refineTransformLayer" class="absolute left-1/2 top-1/2 origin-center" style="position:absolute;left:50%;top:50%;transform:\${refineViewTransform(state.refineView)}"><canvas id="refineCanvas" class="block max-h-[70vh] max-w-[70vw] rounded-lg shadow-lg" style="display:block;max-width:760px;max-height:680px"></canvas></div><div id="refineBrushCursor" class="pointer-events-none absolute hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.7)]"></div><div class="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-slate-950/75 px-3 py-2 text-[10px] font-black text-white">綠＝保留 · 紅＝刪除</div></div><div id="refineResultPane" class="grid min-h-[430px] place-items-center overflow-auto rounded-3xl border border-slate-200 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%)] bg-[length:18px_18px] p-5" style="\${showResult?'':'display:none'};min-height:430px"><canvas id="refineOutputCanvas" class="max-h-[70vh] max-w-full rounded-lg shadow-lg"></canvas></div></div><div id="refineStatus" class="mt-4 rounded-2xl bg-slate-950 p-4 text-xs font-bold text-slate-200">尚未選取 Frame</div></section>\`;
}`, 'Refine editor');

replaceOnce(
  `function rangeInput(id,label,value,min,max){return \`<label class="mt-3 block text-xs font-black text-slate-500"><span class="flex justify-between"><span>\${label}</span><span id="\${id}Value">\${value}</span></span><input id="\${id}" type="range" min="\${min}" max="\${max}" value="\${value}" class="mt-2 w-full accent-emerald-500"></label>\`;}`,
  `function rangeInput(id,label,value,min,max){return \`<label class="mt-3 block text-xs font-black text-slate-500"><span class="flex justify-between"><span>\${label}</span><span id="\${id}Value">\${value}</span></span><input id="\${id}" type="range" min="\${min}" max="\${max}" value="\${value}" class="mt-2 w-full accent-emerald-500"></label>\`;}\n\n// REFINE_FULL_COMPLETION`,
  'Refine completion marker'
);

replaceSection('function bindStaticEvents(root) {', 'function rerenderShell()', `function bindStaticEvents(root) {
  const fileInput = root.querySelector('#fileInput');
  fileInput.addEventListener('change', event => importFiles(event.target.files));
  const dropZone = root.querySelector('#dropZone');
  dropZone.addEventListener('dragover', event => event.preventDefault());
  dropZone.addEventListener('drop', event => { event.preventDefault(); importFiles(event.dataTransfer.files); });
  root.querySelectorAll('.layout-btn').forEach(button => button.addEventListener('click', () => setLayoutMode(button.dataset.layout)));
  root.querySelector('#detectBtn').addEventListener('click', detectActiveSource);
  ['rowsInput','colsInput','marginXInput','marginYInput','gapXInput','gapYInput'].forEach(id => root.querySelector(\`#\${id}\`).addEventListener('input', readGridSettings));
  root.querySelector('#smartSnapInput').addEventListener('change', event => { state.settings.smartSnap = event.target.checked; saveActiveSourceLayout(); });
  root.querySelector('#categoryInput').addEventListener('change', event => changeCategory(event.target.value));
  root.querySelector('#presetRoleInput').addEventListener('change', event => changePreset(event.target.value));
  root.querySelector('#targetWInput').addEventListener('change', event => updateOutputDimension('targetW',event.target.value));
  root.querySelector('#targetHInput').addEventListener('change', event => updateOutputDimension('targetH',event.target.value));
  root.querySelector('#safeMarginInput').addEventListener('input', event => updateSafeMargin(event.target.value));
  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;clearRenderCache();renderAll();rerenderShell(); }));
  root.querySelector('#chromaEnabledInput').addEventListener('change', event => updateRefineSetting('chromaEnabled',event.target.checked));
  root.querySelector('#chromaColorInput').addEventListener('input', event => updateRefineSetting('chromaColor',hexToRgb(event.target.value)));
  root.querySelector('#pickerBtn').addEventListener('click', () => { state.settings.maskTool = 'picker'; state.activeEditor='refine'; refreshMaskToolButtons(); });
  root.querySelector('#exteriorInput').addEventListener('change', event => updateRefineSetting('exteriorOnly',event.target.checked));
  root.querySelector('#despeckleInput').addEventListener('change', event => updateRefineSetting('autoDespeckle',event.target.checked));
  bindRange(root,'toleranceInput','tolerance');
  bindRange(root,'despeckleSizeInput','despeckleMinSize');
  bindRange(root,'shrinkInput','shrinkRadius');
  bindRange(root,'featherInput','featherRadius');
  bindRange(root,'borderSizeInput','whiteBorderSize');
  bindRange(root,'maskSizeInput','maskSize',false);
  bindRange(root,'maskOverlayOpacityInput','maskOverlayOpacity',false,drawRefineCanvas);
  root.querySelector('#borderInput').addEventListener('change', event => updateRefineSetting('whiteBorderEnabled',event.target.checked));
  root.querySelector('#borderColorInput').addEventListener('input', event => updateRefineSetting('borderColor',event.target.value));
  root.querySelector('#renderSelectedBtn').addEventListener('click', renderSelectedRefineNow);
  root.querySelector('#renderAllBtn').addEventListener('click', () => { clearRenderCache(); renderAll(); refresh(); });
  root.querySelector('#resetRefineSettingsBtn').addEventListener('click', resetRefineSettings);
  root.querySelectorAll('.mask-tool').forEach(button => button.addEventListener('click', () => { state.settings.maskTool = button.dataset.maskTool; state.activeEditor='refine'; refreshMaskToolButtons(); updateBrushCursor(); }));
  root.querySelectorAll('.magic-action').forEach(button=>button.addEventListener('click',()=>{state.settings.magicAction=button.dataset.magicAction;refreshMaskToolButtons();}));
  root.querySelector('#magicContiguousInput').addEventListener('change',event=>state.settings.magicContiguous=event.target.checked);
  root.querySelector('#maskOverlayInput').addEventListener('change',event=>{state.settings.maskOverlayVisible=event.target.checked;drawRefineCanvas();});
  root.querySelectorAll('.refine-view').forEach(button=>button.addEventListener('click',()=>{state.settings.refineViewMode=button.dataset.refineView;rerenderShell();}));
  root.querySelector('#maskUndoBtn').addEventListener('click', () => stepMaskHistory(-1));
  root.querySelector('#maskRedoBtn').addEventListener('click', () => stepMaskHistory(1));
  root.querySelector('#maskClearBtn').addEventListener('click', clearSelectedMask);
  root.querySelector('#resetSelectedRefineBtn').addEventListener('click', resetSelectedRefine);
  root.querySelector('#applyRefineBtn').addEventListener('click', applySelectedRefine);
  root.querySelector('#zoomOutBtn').addEventListener('click', () => setRefineZoom(state.refineView.zoom / 1.2));
  root.querySelector('#zoomResetBtn').addEventListener('click', () => resetRefineViewport());
  root.querySelector('#zoomInBtn').addEventListener('click', () => setRefineZoom(state.refineView.zoom * 1.2));
  root.querySelectorAll('.review-bg').forEach(button => button.addEventListener('click', () => { state.settings.reviewBackground = button.dataset.reviewBg; renderReviewGrid(); renderLargeReview(); }));
  root.querySelector('#toggleSafeGuideBtn').addEventListener('click',()=>{state.settings.showSafeGuide=!state.settings.showSafeGuide;rerenderShell();});
  root.querySelector('#duplicateBtn').addEventListener('click', duplicateSelectedFrame);
  root.querySelector('#deleteBtn').addEventListener('click', deleteSelectedFrame);
  root.querySelector('#offsetXInput').addEventListener('change',event=>setSelectedOffset('offsetX',event.target.value));
  root.querySelector('#offsetYInput').addEventListener('change',event=>setSelectedOffset('offsetY',event.target.value));
  root.querySelectorAll('.nudge-btn').forEach(button=>button.addEventListener('click',()=>nudgeSelectedOffset(Number(button.dataset.nudgeX||0),Number(button.dataset.nudgeY||0))));
  root.querySelector('#resetOffsetBtn').addEventListener('click',resetSelectedOffset);
  root.querySelector('#packageNamingModeInput').addEventListener('change',event=>{state.settings.packageNamingMode=event.target.value;refresh();});
  root.querySelector('#filenamePrefixInput').addEventListener('input',event=>{state.settings.filenamePrefix=event.target.value;renderReviewGrid();renderLargeReview();});
  root.querySelector('#filenameSuffixInput').addEventListener('input',event=>{state.settings.filenameSuffix=event.target.value;renderReviewGrid();renderLargeReview();});
  root.querySelector('#maxFileSizeKBInput').addEventListener('change',event=>{state.settings.maxFileSizeKB=Math.max(1,Number(event.target.value)||DEFAULT_MAX_FILE_SIZE_KB);refresh();});
  root.querySelector('#downloadSelectedBtn').addEventListener('click', downloadSelectedPng);
  root.querySelector('#exportZipBtn').addEventListener('click', downloadZip);
  root.querySelector('#undoBtn').addEventListener('click', undoFrames);
  root.querySelector('#redoBtn').addEventListener('click', redoFrames);
  bindSourceCanvas(root.querySelector('#sourceCanvas'));
  bindRefineCanvas(root.querySelector('#refineCanvas'));
  bindRefineViewport(root.querySelector('#refineViewport'));
  bindGlobalEvents();
}`, 'Static event binding');

replaceOnce(
  `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);refresh();}\nfunction bindRange(root,id,key,render=true){root.querySelector(\`#\${id}\`).addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(\`#\${id}Value\`);if(label)label.textContent=event.target.value;if(render){clearRenderCache();renderAll();refresh();}});}\nfunction updateRefineSetting(key,value){state.settings[key]=value;clearRenderCache();renderAll();refresh();}`,
  `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);refresh();}\nfunction bindRange(root,id,key,render=true,afterChange=null){root.querySelector(\`#\${id}\`).addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(\`#\${id}Value\`);if(label)label.textContent=event.target.value;if(render){clearRenderCache();renderSelectedRefineNow(false);scheduleRenderAll();}if(afterChange)afterChange();});}\nfunction updateRefineSetting(key,value){state.settings[key]=value;clearRenderCache();renderSelectedRefineNow(false);scheduleRenderAll();}\nfunction scheduleRenderAll(delay=90){if(state.refineRenderTimer)clearTimeout(state.refineRenderTimer);state.refineRenderTimer=setTimeout(()=>{state.refineRenderTimer=null;clearRenderCache();renderAll();refresh();},delay);}`,
  'Refine render scheduling'
);

replaceOnce(
  `  if(selected)state.selectedFrameBySource.set(sourceId,selected.id);\n  resetFrameHistory(); clearRenderCache(); renderAll();`,
  `  if(selected)state.selectedFrameBySource.set(sourceId,selected.id);\n  previousFrames.forEach(frame=>state.maskHistories.delete(frame.id));\n  resetFrameHistory(); clearRenderCache(); renderAll();`,
  'Detection mask history reset'
);

replaceOnce(
  `function getRenderOptions(){return{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,alignMode:state.settings.alignMode,highQuality:true,refine:{enabled:true,chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,exteriorOnly:state.settings.exteriorOnly,autoDespeckle:state.settings.autoDespeckle,shrinkRadius:state.settings.shrinkRadius,featherRadius:state.settings.featherRadius,whiteBorder:{enabled:state.settings.whiteBorderEnabled,size:state.settings.whiteBorderSize,color:state.settings.borderColor},shadow:{enabled:false}}};}`,
  `function getRenderOptions(){return{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,alignMode:state.settings.alignMode,highQuality:true,refine:{enabled:true,chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,exteriorOnly:state.settings.exteriorOnly,autoDespeckle:state.settings.autoDespeckle,despeckle:{minComponentSize:state.settings.despeckleMinSize},shrinkRadius:state.settings.shrinkRadius,featherRadius:state.settings.featherRadius,whiteBorder:{enabled:state.settings.whiteBorderEnabled,size:state.settings.whiteBorderSize,color:state.settings.borderColor},shadow:{enabled:false}}};}`,
  'Render options'
);

replaceOnce(
  `function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();refreshMaskToolButtons();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?\`\${source.name} · \${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames\`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}`,
  `function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?\`\${source.name} · \${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames\`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}`,
  'Refresh pipeline'
);

replaceOnce(
  `function sourcePointerDown(event){const source=activeSource();if(!source)return;`,
  `function sourcePointerDown(event){state.activeEditor='layout';const source=activeSource();if(!source)return;`,
  'Layout editor focus'
);

replaceSection('function drawRefineCanvas()', 'function availableRoleOptions()', `function drawRefineCanvas(updateOutput=true){
  const canvas=document.getElementById('refineCanvas');if(!canvas)return;
  const outputCanvas=document.getElementById('refineOutputCanvas');
  const status=document.getElementById('refineStatus');
  const frame=selectedFrame(),source=sourceForFrame(frame),ctx=canvas.getContext('2d');
  if(!frame||!source){canvas.width=1;canvas.height=1;ctx.clearRect(0,0,1,1);if(outputCanvas){outputCanvas.width=1;outputCanvas.height=1;outputCanvas.getContext('2d').clearRect(0,0,1,1);}if(status)status.textContent='尚未選取 Frame';return;}
  canvas.dataset.frameId=frame.id;
  canvas.width=Math.max(1,Math.round(frame.geometry.width));canvas.height=Math.max(1,Math.round(frame.geometry.height));
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);
  const mask=frame.custom?.protectMaskCanvas;
  if(mask&&state.settings.maskOverlayVisible){ctx.save();ctx.globalAlpha=state.settings.maskOverlayOpacity/100;ctx.drawImage(mask,0,0,canvas.width,canvas.height);ctx.restore();}
  const rendered=updateOutput?renderFrame(frame):state.rendered.get(frame.id);
  if(outputCanvas&&rendered){outputCanvas.width=rendered.width;outputCanvas.height=rendered.height;const outCtx=outputCanvas.getContext('2d');outCtx.clearRect(0,0,outputCanvas.width,outputCanvas.height);outCtx.drawImage(rendered,0,0);}
  const stats=mask?getMaskStats(mask):{total:canvas.width*canvas.height,keep:0,delete:0,marked:0,coverage:0,hasEdits:false};
  const kb=rendered?Math.ceil(estimateCanvasPngBytes(rendered)/1024):0;
  const applied=state.refineAppliedAt.get(frame.id);
  if(status)status.innerHTML=\`<span class="text-emerald-300">\${escapeHtml(frame.name)}</span> · 保留 \${stats.keep}px · 刪除 \${stats.delete}px · 標記 \${(stats.coverage*100).toFixed(1)}% · 成品 \${kb}KB\${applied?\` · 已套用 \${new Date(applied).toLocaleTimeString()}\`:''}\`;
}
function bindRefineCanvas(canvas){canvas.addEventListener('pointerdown',refinePointerDown);canvas.addEventListener('pointermove',refinePointerMove);canvas.addEventListener('pointerup',refinePointerUp);canvas.addEventListener('pointercancel',refinePointerUp);canvas.addEventListener('pointerleave',event=>{updateBrushCursor();if(!state.maskStroke)state.refinePointer=null;});}
function refinePointerDown(event){
  state.activeEditor='refine';
  const frame=selectedFrame();if(!frame||state.settings.maskTool==='view'||state.isSpaceDown||event.button===1)return;
  const point=canvasPoint(event);state.refinePointer={clientX:event.clientX,clientY:event.clientY};updateBrushCursor(event);
  if(state.settings.maskTool==='picker'){pickColorFromRefine(point);return;}
  const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);
  if(state.settings.maskTool==='magic'){
    const raw=createRawCropCanvas(frame);
    applyMagicMask(raw,mask,point.x,point.y,{action:state.settings.magicAction,tolerance:state.settings.tolerance,contiguous:state.settings.magicContiguous});
    touchMask(frame,mask,true);commitMaskHistory(frame.id,mask);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();return;
  }
  const action=state.settings.maskTool==='keep'?MaskActions.KEEP:state.settings.maskTool==='clear'?MaskActions.CLEAR:MaskActions.DELETE;
  state.maskStroke={frameId:frame.id,last:point,action};
  event.currentTarget.setPointerCapture?.(event.pointerId);
  paintMaskStroke(mask,point,point,{action,size:state.settings.maskSize});touchMask(frame,mask,false);drawRefineCanvas(false);
}
function refinePointerMove(event){state.refinePointer={clientX:event.clientX,clientY:event.clientY};updateBrushCursor(event);if(!state.maskStroke)return;const frame=selectedFrame();if(!frame||frame.id!==state.maskStroke.frameId)return;const point=canvasPoint(event),mask=ensureFrameMask(frame);paintMaskStroke(mask,state.maskStroke.last,point,{action:state.maskStroke.action,size:state.settings.maskSize});state.maskStroke.last=point;touchMask(frame,mask,false);drawRefineCanvas(false);}
function refinePointerUp(){if(!state.maskStroke)return;const frame=frames().find(item=>item.id===state.maskStroke.frameId),mask=frame?.custom?.protectMaskCanvas;state.maskStroke=null;if(frame&&mask){touchMask(frame,mask,true);commitMaskHistory(frame.id,mask);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();}}
function ensureFrameMask(frame){let mask=frame.custom?.protectMaskCanvas;if(!mask)mask=createMaskCanvas(frame.geometry.width,frame.geometry.height);else if(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height))mask=resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height);touchMask(frame,mask,false);return mask;}
function touchMask(frame,mask,increment=true){replaceFrame({...frame,custom:{...frame.custom,protectMaskCanvas:mask,maskVersion:(frame.custom?.maskVersion||0)+(increment?1:0)}});}
function createRawCropCanvas(frame){const source=sourceForFrame(frame),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(frame.geometry.width));canvas.height=Math.max(1,Math.round(frame.geometry.height));canvas.getContext('2d').drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);return canvas;}
function ensureMaskHistory(frameId,mask){if(!state.maskHistories.has(frameId))state.maskHistories.set(frameId,{items:[captureMaskSnapshot(mask)],index:0});}
function commitMaskHistory(frameId,mask){ensureMaskHistory(frameId,mask);const history=state.maskHistories.get(frameId);history.items=history.items.slice(0,history.index+1);history.items.push(captureMaskSnapshot(mask));if(history.items.length>30)history.items.shift();history.index=history.items.length-1;refreshMaskHistoryButtons();}
function canStepMaskHistory(direction){const frame=selectedFrame(),history=frame&&state.maskHistories.get(frame.id);if(!history)return false;return direction<0?history.index>0:history.index<history.items.length-1;}
function stepMaskHistory(direction){const frame=selectedFrame();if(!frame||!canStepMaskHistory(direction))return false;const mask=ensureFrameMask(frame),history=state.maskHistories.get(frame.id);history.index+=direction;restoreMaskSnapshot(mask,history.items[history.index]);touchMask(frame,mask,true);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();return true;}
function clearSelectedMask(){const frame=selectedFrame();if(!frame)return;const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);clearMask(mask);touchMask(frame,mask,true);commitMaskHistory(frame.id,mask);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();}
function resetSelectedRefine(){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot(),mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);clearMask(mask);const next={...frame,custom:{...frame.custom,protectMaskCanvas:mask,maskVersion:(frame.custom?.maskVersion||0)+1,offsetX:0,offsetY:0}};replaceFrame(next);commitMaskHistory(frame.id,mask);commitFrameChange('Reset Selected Refine',before,frameSnapshot());state.refineAppliedAt.delete(frame.id);resetRefineViewport();clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();}
function resetRefineSettings(){['chromaEnabled','chromaColor','tolerance','exteriorOnly','autoDespeckle','despeckleMinSize','shrinkRadius','featherRadius','whiteBorderEnabled','whiteBorderSize','borderColor'].forEach(key=>state.settings[key]=Array.isArray(DEFAULT_SETTINGS[key])?[...DEFAULT_SETTINGS[key]]:DEFAULT_SETTINGS[key]);clearRenderCache();renderAll();rerenderShell();}
function renderSelectedRefineNow(refreshUi=true){const frame=selectedFrame();if(!frame)return;clearFrameRender(frame.id);renderFrame(frame,true);runReview();if(refreshUi)refresh();else{drawRefineCanvas();renderLargeReview();renderReviewSummary();}}
function applySelectedRefine(){const frame=selectedFrame();if(!frame)return;renderSelectedRefineNow(false);state.refineAppliedAt.set(frame.id,Date.now());refresh();}
function clearFrameRender(frameId){state.rendered.delete(frameId);state.renderKeys.delete(frameId);}
function setRefineZoom(value,anchor={x:0,y:0}){state.refineView=zoomRefineView(state.refineView,value,anchor);state.settings.refineZoom=state.refineView.zoom;updateRefineTransform();}
function resetRefineViewport(){state.refineView=resetRefineView(state.refineView);state.settings.refineZoom=1;updateRefineTransform();}
function updateRefineTransform(){const layer=document.getElementById('refineTransformLayer');if(layer)layer.style.transform=refineViewTransform(state.refineView);const button=document.getElementById('zoomResetBtn');if(button)button.textContent=\`\${Math.round(state.refineView.zoom*100)}%\`;}
function bindRefineViewport(viewport){if(!viewport)return;viewport.addEventListener('wheel',refineWheel,{passive:false});viewport.addEventListener('pointerdown',refineViewportPointerDown,true);viewport.addEventListener('pointermove',refineViewportPointerMove,true);viewport.addEventListener('pointerup',refineViewportPointerUp,true);viewport.addEventListener('pointercancel',refineViewportPointerUp,true);viewport.addEventListener('pointerleave',event=>{if(state.refinePan)refineViewportPointerUp(event);state.refinePointer=null;updateBrushCursor();},true);}
function refineWheel(event){event.preventDefault();state.activeEditor='refine';const rect=event.currentTarget.getBoundingClientRect(),anchor={x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2};setRefineZoom(state.refineView.zoom*(event.deltaY>0?.9:1.1),anchor);}
function refineViewportPointerDown(event){const shouldPan=state.settings.maskTool==='view'||state.isSpaceDown||event.button===1;if(!shouldPan)return;event.preventDefault();event.stopPropagation();state.activeEditor='refine';state.refinePan={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originX:state.refineView.panX,originY:state.refineView.panY};event.currentTarget.setPointerCapture?.(event.pointerId);event.currentTarget.style.cursor='grabbing';}
function refineViewportPointerMove(event){state.refinePointer={clientX:event.clientX,clientY:event.clientY};if(state.refinePan){event.preventDefault();event.stopPropagation();state.refineView={...state.refineView,panX:state.refinePan.originX+event.clientX-state.refinePan.startX,panY:state.refinePan.originY+event.clientY-state.refinePan.startY};updateRefineTransform();}else updateBrushCursor(event);}
function refineViewportPointerUp(event){if(!state.refinePan)return;event.preventDefault?.();event.stopPropagation?.();state.refinePan=null;const viewport=document.getElementById('refineViewport');if(viewport)viewport.style.cursor=state.settings.maskTool==='view'?'grab':'';}
function updateBrushCursor(event=null){const cursor=document.getElementById('refineBrushCursor'),viewport=document.getElementById('refineViewport');if(!cursor||!viewport)return;if(event)state.refinePointer={clientX:event.clientX,clientY:event.clientY};const pointer=state.refinePointer,tool=state.settings.maskTool;if(!pointer||tool==='view'||tool==='picker'||state.refinePan){cursor.classList.add('hidden');return;}const rect=viewport.getBoundingClientRect(),size=tool==='magic'?18:Math.max(6,state.settings.maskSize*state.refineView.zoom);cursor.classList.remove('hidden');cursor.style.width=\`\${size}px\`;cursor.style.height=\`\${size}px\`;cursor.style.left=\`\${pointer.clientX-rect.left-size/2}px\`;cursor.style.top=\`\${pointer.clientY-rect.top-size/2}px\`;cursor.style.borderColor=tool==='keep'?'#22c55e':tool==='clear'?'#f8fafc':'#ef4444';}
function refreshMaskToolButtons(){document.querySelectorAll('.mask-tool').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.maskTool===state.settings.maskTool));document.querySelectorAll('.magic-action').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.magicAction===state.settings.magicAction));document.querySelectorAll('.refine-view').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.refineView===state.settings.refineViewMode));}
function refreshMaskHistoryButtons(){const undoButton=document.getElementById('maskUndoBtn'),redoButton=document.getElementById('maskRedoBtn');if(undoButton)undoButton.disabled=!canStepMaskHistory(-1);if(redoButton)redoButton.disabled=!canStepMaskHistory(1);}
function pickColorFromSource(point){const source=activeSource();if(!source)return;const canvas=document.getElementById('sourceCanvas'),pixel=canvas.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function pickColorFromRefine(point){const frame=selectedFrame();if(!frame)return;const raw=createRawCropCanvas(frame),pixel=raw.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function setPickedColor(pixel){state.settings.chromaColor=[pixel[0],pixel[1],pixel[2]];state.settings.maskTool='view';const input=document.getElementById('chromaColorInput');if(input)input.value=rgbToHex(state.settings.chromaColor);clearRenderCache();renderAll();refresh();}
function bindGlobalEvents(){if(state.globalEventsBound)return;state.globalEventsBound=true;window.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(state.activeEditor==='refine'&&stepMaskHistory(event.shiftKey?1:-1))return;event.shiftKey?redoFrames():undoFrames();return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();if(state.activeEditor==='refine'&&stepMaskHistory(1))return;redoFrames();return;}if(event.code==='Space'&&state.activeEditor==='refine'){state.isSpaceDown=true;event.preventDefault();const viewport=document.getElementById('refineViewport');if(viewport)viewport.style.cursor='grab';}if(state.activeEditor==='refine'&&event.key==='0'){event.preventDefault();resetRefineViewport();}if(state.activeEditor==='refine'&&event.key==='Escape'){state.settings.maskTool='view';refreshMaskToolButtons();}if(state.activeEditor==='refine'&&(event.key==='['||event.key===']')){event.preventDefault();state.settings.maskSize=Math.max(5,Math.min(120,state.settings.maskSize+(event.key===']'?5:-5)));const input=document.getElementById('maskSizeInput');if(input)input.value=state.settings.maskSize;const label=document.getElementById('maskSizeInputValue');if(label)label.textContent=state.settings.maskSize;updateBrushCursor();}});window.addEventListener('keyup',event=>{if(event.code==='Space'){state.isSpaceDown=false;state.refinePan=null;const viewport=document.getElementById('refineViewport');if(viewport)viewport.style.cursor=state.settings.maskTool==='view'?'grab':'';}});}
`, 'Refine canvas and mask engine UI');

replaceOnce(
  `function activateSource(sourceId){\n  if(!state.sources.has(sourceId))return;`,
  `function activateSource(sourceId){\n  if(!state.sources.has(sourceId))return;\n  resetRefineViewport();`,
  'Source activation view reset'
);

replaceOnce(
  `function selectFrame(frameId){\n  const frame=frames().find(item=>item.id===frameId);\n  if(!frame)return;`,
  `function selectFrame(frameId){\n  const frame=frames().find(item=>item.id===frameId);\n  if(!frame)return;\n  if(state.selectedFrameId!==frame.id)resetRefineViewport();`,
  'Frame selection view reset'
);

await writeFile(path, source, 'utf8');
console.log('Refine full completion applied.');
