import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// WORKSHOP_INTERACTION_PERFORMANCE_V1';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found.`);
  return source.replace(before, after);
}

async function main() {
  let source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Workshop interaction performance V1 already present.');
    return;
  }

  source = replaceOnce(
    source,
    `  refineRenderTimer: null,\n  reviewView: createRefineViewState({ minZoom: 0.25, maxZoom: 4 }),`,
    `  refineRenderTimer: null,\n  fullQualityJobToken: 0,\n  fullQualityIdleHandle: null,\n  previewMasks: new Map(),\n  previewInteractionActive: false,\n  reviewView: createRefineViewState({ minZoom: 0.25, maxZoom: 4 }),`,
    'Interaction state'
  );

  source = replaceOnce(
    source,
    `<div class="mt-1 text-sm font-black">\${roleLabel(output.role)}</div>`,
    `<div id="outputRoleLabel" class="mt-1 text-sm font-black">\${roleLabel(output.role)}</div>`,
    'Output role label'
  );
  source = replaceOnce(
    source,
    `<div class="mt-1 text-sm font-black">≤\${Math.ceil(output.maxFileSizeBytes/1024)}KB</div>`,
    `<div id="outputFileLimitLabel" class="mt-1 text-sm font-black">≤\${Math.ceil(output.maxFileSizeBytes/1024)}KB</div>`,
    'Output file limit label'
  );
  source = replaceOnce(
    source,
    `<div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">\${output.width} × \${output.height}px · safe \${output.safeMargin}px</div>`,
    `<div id="outputRuleSummary" class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">\${output.width} × \${output.height}px · safe \${output.safeMargin}px</div>`,
    'Output summary label'
  );

  source = replaceOnce(
    source,
    `  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;clearRenderCache();renderAll();rerenderShell(); }));`,
    `  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;syncShellControls();scheduleRenderAll(0); }));`,
    'Align interaction'
  );
  source = replaceOnce(
    source,
    `  root.querySelectorAll('.refine-view').forEach(button=>button.addEventListener('click',()=>{state.settings.refineViewMode=button.dataset.refineView;rerenderShell();}));`,
    `  root.querySelectorAll('.refine-view').forEach(button=>button.addEventListener('click',()=>{state.settings.refineViewMode=button.dataset.refineView;applyRefineViewMode();refreshMaskToolButtons();}));`,
    'Refine view interaction'
  );

  const oldRefreshBody = `  runReview();drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();refreshCommonControls();`;
  const newRefreshBody = `  refreshLayoutSection();\n  refreshRefineSection();\n  refreshReviewSection();\n  refreshPackageSection();\n  refreshProjectSection();`;
  source = replaceOnce(source, oldRefreshBody, newRefreshBody, 'Split refresh body');

  source = replaceOnce(
    source,
    `function renderEmptyReviewState(){`,
    `${marker}\nfunction refreshLayoutSection(){drawSourceCanvas();renderSourceList();refreshCommonControls();}\nfunction refreshRefineSection({updateOutput=true}={}){drawRefineCanvas(updateOutput);refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();}\nfunction refreshReviewSection({ensureReview=true}={}){if(ensureReview)runReview();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();updateReviewTransform();}\nfunction refreshPackageSection(){state.packageController?.refresh();}\nfunction refreshProjectSection(){state.projectController?.refresh();}\nfunction refreshSelectionSections(){syncShellControls();refreshLayoutSection();refreshRefineSection();refreshReviewSection({ensureReview:false});refreshProjectSection();}\nfunction renderEmptyReviewState(){`,
    'Refresh section helpers'
  );

  const oldInteractionHelpers = `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountDestinationController(root);mountPackageController(root);mountProjectController(root);refresh();}\nfunction bindRange(root,id,key,render=true,afterChange=null){root.querySelector(\`#\${id}\`).addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(\`#\${id}Value\`);if(label)label.textContent=event.target.value;if(render){clearRenderCache();renderSelectedRefineNow(false);scheduleRenderAll();}if(afterChange)afterChange();});}\nfunction updateRefineSetting(key,value){state.settings[key]=value;clearRenderCache();renderSelectedRefineNow(false);scheduleRenderAll();}\nfunction scheduleRenderAll(delay=90){if(state.refineRenderTimer)clearTimeout(state.refineRenderTimer);state.refineRenderTimer=setTimeout(()=>{state.refineRenderTimer=null;clearRenderCache();renderAll();refresh();},delay);}`;

  const newInteractionHelpers = `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountDestinationController(root);mountPackageController(root);mountProjectController(root);refresh();}\nfunction bindRange(root,id,key,render=true,afterChange=null){const input=root.querySelector(\`#\${id}\`);input.addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(\`#\${id}Value\`);if(label)label.textContent=event.target.value;if(render){renderSelectedLowQualityPreview();scheduleRenderAll();}if(afterChange)afterChange();});if(render)input.addEventListener('change',()=>scheduleRenderAll(20));}\nfunction updateRefineSetting(key,value){state.settings[key]=value;renderSelectedLowQualityPreview();scheduleRenderAll();}\nfunction setPreviewInteractionActive(active){state.previewInteractionActive=active;const button=document.getElementById('exportZipBtn');if(button){button.disabled=active;button.classList.toggle('opacity-40',active);button.title=active?'正在更新正式品質…':'';}}\nfunction previewMaskFor(frame,width,height){const mask=frame.custom?.protectMaskCanvas;if(!mask)return null;const key=\`\${frame.id}:\${frame.custom?.maskVersion||0}:\${width}x\${height}\`;if(state.previewMasks.has(key))return state.previewMasks.get(key);state.previewMasks.clear();const preview=resizeMaskCanvas(mask,width,height);state.previewMasks.set(key,preview);return preview;}\nfunction renderSelectedLowQualityPreview(){const frame=selectedFrame(),source=sourceForFrame(frame);if(!frame||!source)return;cancelScheduledFullQuality();setPreviewInteractionActive(true);const geometry=frame.geometry,maxSide=480,scale=Math.min(1,maxSide/Math.max(geometry.width,geometry.height)),width=Math.max(1,Math.round(geometry.width*scale)),height=Math.max(1,Math.round(geometry.height*scale)),crop=document.createElement('canvas');crop.width=width;crop.height=height;crop.getContext('2d').drawImage(source.img,geometry.x,geometry.y,geometry.width,geometry.height,0,0,width,height);const previewSource={...source,id:\`\${source.id}:preview\`,img:crop,width,height},previewFrame={...frame,geometry:{x:0,y:0,width,height},custom:{...frame.custom,protectMaskCanvas:previewMaskFor(frame,width,height)}},base=getRenderOptions(frame),preview=renderWorkshopFrame(previewSource,previewFrame,{...base,highQuality:false,refine:{...base.refine,autoDespeckle:false,despeckle:{minComponentSize:Math.min(12,state.settings.despeckleMinSize)},featherRadius:Math.min(2,state.settings.featherRadius)}}).canvas,output=document.getElementById('refineOutputCanvas');drawRefineCanvas(false);if(output){output.width=preview.width;output.height=preview.height;const context=output.getContext('2d');context.clearRect(0,0,output.width,output.height);context.drawImage(preview,0,0);}const status=document.getElementById('refineStatus');if(status)status.dataset.previewQuality='low';}\nfunction cancelScheduledFullQuality(){if(state.refineRenderTimer)clearTimeout(state.refineRenderTimer);state.refineRenderTimer=null;state.fullQualityJobToken+=1;if(state.fullQualityIdleHandle!=null&&globalThis.cancelIdleCallback)cancelIdleCallback(state.fullQualityIdleHandle);state.fullQualityIdleHandle=null;}\nfunction scheduleRenderAll(delay=320){cancelScheduledFullQuality();const token=state.fullQualityJobToken;state.refineRenderTimer=setTimeout(()=>{state.refineRenderTimer=null;startFullQualityRender(token);},delay);}\nfunction startFullQualityRender(token){if(token!==state.fullQualityJobToken)return;clearRenderCache();const ordered=[...frames()],selected=selectedFrame(),queue=selected?[selected,...ordered.filter(frame=>frame.id!==selected.id)]:ordered;const runBatch=deadline=>{if(token!==state.fullQualityJobToken)return;let processed=0;while(queue.length&&(processed<2||deadline?.timeRemaining?.()>5)){renderFrame(queue.shift(),true);processed+=1;}if(queue.length){state.fullQualityIdleHandle=globalThis.requestIdleCallback?requestIdleCallback(runBatch,{timeout:120}):setTimeout(()=>runBatch({timeRemaining:()=>8}),0);return;}state.fullQualityIdleHandle=null;runReview(true);setPreviewInteractionActive(false);refreshRefineSection();refreshReviewSection({ensureReview:false});refreshPackageSection();refreshProjectSection();};runBatch({timeRemaining:()=>8});}\nfunction syncShellControls(){const setValue=(id,value)=>{const node=document.getElementById(id);if(node&&document.activeElement!==node)node.value=value;};const setChecked=(id,value)=>{const node=document.getElementById(id);if(node)node.checked=Boolean(value);};[['rowsInput','rows'],['colsInput','cols'],['marginXInput','marginX'],['marginYInput','marginY'],['gapXInput','gapX'],['gapYInput','gapY'],['toleranceInput','tolerance'],['despeckleSizeInput','despeckleMinSize'],['shrinkInput','shrinkRadius'],['featherInput','featherRadius'],['borderSizeInput','whiteBorderSize'],['maskSizeInput','maskSize'],['maskOverlayOpacityInput','maskOverlayOpacity']].forEach(([id,key])=>{setValue(id,state.settings[key]);const label=document.getElementById(\`\${id}Value\`);if(label)label.textContent=state.settings[key];});setChecked('smartSnapInput',state.settings.smartSnap);setChecked('chromaEnabledInput',state.settings.chromaEnabled);setChecked('exteriorInput',state.settings.exteriorOnly);setChecked('despeckleInput',state.settings.autoDespeckle);setChecked('borderInput',state.settings.whiteBorderEnabled);setChecked('maskOverlayInput',state.settings.maskOverlayVisible);setValue('chromaColorInput',rgbToHex(state.settings.chromaColor));setValue('borderColorInput',state.settings.borderColor);document.querySelectorAll('.layout-btn').forEach(button=>{const active=button.dataset.layout===state.settings.layoutMode;button.classList.toggle('bg-slate-950',active);button.classList.toggle('text-white',active);button.classList.toggle('bg-slate-100',!active);});document.querySelectorAll('.align-btn').forEach(button=>{const active=button.dataset.align===state.settings.alignMode;button.classList.toggle('bg-slate-950',active);button.classList.toggle('text-white',active);button.classList.toggle('bg-slate-100',!active);});const frame=selectedFrame(),output=state.destinationController?.getFrameOutput?.(frame)||{role:state.settings.outputRole,width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin,maxFileSizeBytes:state.settings.maxFileSizeKB*1024};setValue('targetWInput',output.width);setValue('targetHInput',output.height);setValue('safeMarginInput',output.safeMargin);const safeLabel=document.getElementById('safeMarginInputValue');if(safeLabel)safeLabel.textContent=output.safeMargin;const roleLabelNode=document.getElementById('outputRoleLabel');if(roleLabelNode)roleLabelNode.textContent=roleLabel(output.role);const limit=document.getElementById('outputFileLimitLabel');if(limit)limit.textContent=\`≤\${Math.ceil(output.maxFileSizeBytes/1024)}KB\`;const summary=document.getElementById('outputRuleSummary');if(summary)summary.textContent=\`\${output.width} × \${output.height}px · safe \${output.safeMargin}px\`;applyRefineViewMode();}\nfunction applyRefineViewMode(){const mode=state.settings.refineViewMode,workspace=document.getElementById('refineWorkspace'),viewport=document.getElementById('refineViewport'),result=document.getElementById('refineResultPane'),split=mode==='split';if(workspace){workspace.classList.toggle('lg:grid-cols-2',split);workspace.classList.toggle('grid-cols-1',!split);}if(viewport)viewport.style.display=mode==='result'?'none':'';if(result)result.style.display=mode==='mask'?'none':'';document.querySelectorAll('.refine-view').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.refineView===mode));}`;
  source = replaceOnce(source, oldInteractionHelpers, newInteractionHelpers, 'Interaction helpers');

  source = replaceOnce(
    source,
    `function setLayoutMode(mode){state.settings.layoutMode=mode;if(mode==='1x1'){state.settings.rows=1;state.settings.cols=1;}if(mode==='2x2'){state.settings.rows=2;state.settings.cols=2;}if(mode==='3x3'){state.settings.rows=3;state.settings.cols=3;}saveActiveSourceLayout();rerenderShell();}`,
    `function setLayoutMode(mode){state.settings.layoutMode=mode;if(mode==='1x1'){state.settings.rows=1;state.settings.cols=1;}if(mode==='2x2'){state.settings.rows=2;state.settings.cols=2;}if(mode==='3x3'){state.settings.rows=3;state.settings.cols=3;}saveActiveSourceLayout();syncShellControls();refreshLayoutSection();}`,
    'Layout mode regional refresh'
  );
  source = replaceOnce(
    source,
    `  rerenderShell();\n}\nfunction selectFrame(frameId){`,
    `  refreshSelectionSections();\n}\nfunction selectFrame(frameId){`,
    'Source activation regional refresh'
  );
  source = replaceOnce(
    source,
    `function changeCategory(category){state.settings.stickerCategory=category;const role=getStickerPresets(category)[0].role;state.settings=applyStickerPreset(state.settings,category,role);state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);normalizeFrameRolesForCategory();clearRenderCache();renderAll();rerenderShell();}`,
    `function changeCategory(category){state.settings.stickerCategory=category;const role=getStickerPresets(category)[0].role;state.settings=applyStickerPreset(state.settings,category,role);state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);normalizeFrameRolesForCategory();syncShellControls();scheduleRenderAll(0);}`,
    'Category regional refresh'
  );
  source = replaceOnce(
    source,
    `function changePreset(role){state.settings=applyStickerPreset(state.settings,state.settings.stickerCategory,role);state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);clearRenderCache();renderAll();rerenderShell();}`,
    `function changePreset(role){state.settings=applyStickerPreset(state.settings,state.settings.stickerCategory,role);state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);syncShellControls();scheduleRenderAll(0);}`,
    'Preset regional refresh'
  );
  source = replaceOnce(
    source,
    `function updateOutputDimension(key,value){state.settings[key]=Math.max(1,Math.min(8192,Math.round(Number(value)||1)));state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);clearRenderCache();renderAll();rerenderShell();}`,
    `function updateOutputDimension(key,value){state.settings[key]=Math.max(1,Math.min(8192,Math.round(Number(value)||1)));state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);syncShellControls();scheduleRenderAll(0);}`,
    'Output dimension regional refresh'
  );
  source = replaceOnce(
    source,
    `function resetRefineSettings(){['chromaEnabled','chromaColor','tolerance','exteriorOnly','autoDespeckle','despeckleMinSize','shrinkRadius','featherRadius','whiteBorderEnabled','whiteBorderSize','borderColor'].forEach(key=>state.settings[key]=Array.isArray(DEFAULT_SETTINGS[key])?[...DEFAULT_SETTINGS[key]]:DEFAULT_SETTINGS[key]);clearRenderCache();renderAll();rerenderShell();}`,
    `function resetRefineSettings(){['chromaEnabled','chromaColor','tolerance','exteriorOnly','autoDespeckle','despeckleMinSize','shrinkRadius','featherRadius','whiteBorderEnabled','whiteBorderSize','borderColor'].forEach(key=>state.settings[key]=Array.isArray(DEFAULT_SETTINGS[key])?[...DEFAULT_SETTINGS[key]]:DEFAULT_SETTINGS[key]);syncShellControls();renderSelectedLowQualityPreview();scheduleRenderAll(0);}`,
    'Reset Refine regional refresh'
  );
  source = replaceOnce(
    source,
    `  rerenderShell();\n}\n\nfunction deleteSource(sourceId){`,
    `  syncShellControls();refresh();\n}\n\nfunction deleteSource(sourceId){`,
    'Import regional refresh'
  );
  source = replaceOnce(
    source,
    `  resetFrameHistory();clearRenderCache();renderAll();rerenderShell();\n}\n\nfunction detectActiveSource()`,
    `  resetFrameHistory();clearRenderCache();renderAll();syncShellControls();refresh();\n}\n\nfunction detectActiveSource()`,
    'Delete source regional refresh'
  );

  await writeFile(path, source);
  console.log('Workshop interaction performance V1 installed.');
}

await main();
