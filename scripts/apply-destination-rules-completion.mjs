import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/ui/stixio-workshop-app-v2.js';
const reviewEnginePath = 'src/core/review/review-engine.js';
const reviewWorkflowPath = 'src/core/review/review-workflow.js';
const projectWorkflowPath = 'src/core/project-workflow.js';
const packageControllerPath = 'src/ui/package-controller.js';

let app = await readFile(appPath, 'utf8');
let reviewEngine = await readFile(reviewEnginePath, 'utf8');
let reviewWorkflow = await readFile(reviewWorkflowPath, 'utf8');
let projectWorkflow = await readFile(projectWorkflowPath, 'utf8');
let packageController = await readFile(packageControllerPath, 'utf8');

if (app.includes('// DESTINATION_RULES_FULL_COMPLETION')) {
  console.log('Destination Rules completion already applied.');
  process.exit(0);
}

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing Destination Rules target: ${label}`);
  return source.replace(from, to);
}

function replaceFunction(source, startToken, nextToken, replacement, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(nextToken, start + startToken.length);
  if (start < 0 || end < 0) throw new Error(`Missing Destination Rules function: ${label}`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

app = replaceOnce(
  app,
  `  ReviewIssueSeverity,\n  createWorkshopProjectSnapshot\n} from '../core/index.js';`,
  `  ReviewIssueSeverity,\n  createWorkshopProjectSnapshot,\n  applyDestinationProfileToSettings,\n  normalizeFramesForDestination\n} from '../core/index.js';`,
  'core imports'
);
app = replaceOnce(
  app,
  `import { createProjectController } from './project-controller.js';`,
  `import { createProjectController } from './project-controller.js';\nimport { createDestinationController } from './destination-controller.js';`,
  'Destination controller import'
);
app = replaceOnce(
  app,
  `  maxFileSizeKB: DEFAULT_MAX_FILE_SIZE_KB\n}, StickerCategories.NORMAL, AssetRoles.STICKER);`,
  `  maxFileSizeKB: DEFAULT_MAX_FILE_SIZE_KB,\n  destinationProfileKey: 'workshop-flexible',\n  destinationProfileVersion: '1.0.0'\n}, StickerCategories.NORMAL, AssetRoles.STICKER);`,
  'default destination settings'
);
app = replaceOnce(
  app,
  `  packageController: null,\n  projectController: null\n};`,
  `  packageController: null,\n  projectController: null,\n  destinationController: null\n};`,
  'destination state'
);
app = replaceOnce(
  app,
  `  bindStaticEvents(root);\n  mountPackageController(root);\n  mountProjectController(root);`,
  `  bindStaticEvents(root);\n  mountDestinationController(root);\n  mountPackageController(root);\n  mountProjectController(root);`,
  'initial mount order'
);
app = replaceOnce(
  app,
  `<aside class="space-y-4">${'${renderImportPanel()}${renderDetectionPanel()}${renderOutputPanel()}${renderRefinePanel()}'}</aside>`,
  `<aside class="space-y-4">${'${renderImportPanel()}${renderDetectionPanel()}${renderDestinationPanel()}${renderOutputPanel()}${renderRefinePanel()}'}</aside>`,
  'Destination panel placement'
);

app = replaceFunction(
  app,
  'function renderOutputPanel() {',
  'function renderRefinePanel() {',
  `function renderDestinationPanel() {
  return '<div id="destinationRulesRoot"></div>';
}

function renderOutputPanel() {
  const frame=selectedFrame();
  const output=state.destinationController?.getFrameOutput?.(frame)||{role:state.settings.outputRole,width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin,maxFileSizeBytes:state.settings.maxFileSizeKB*1024};
  return \`<section id="package-rules-panel" class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Output · Active Role</p><h2 class="mt-1 text-xl font-black">角色輸出與對齊</h2><div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-2xl bg-slate-50 p-3"><div class="text-[10px] font-black uppercase text-slate-400">Role</div><div class="mt-1 text-sm font-black">\${roleLabel(output.role)}</div></div><div class="rounded-2xl bg-slate-50 p-3"><div class="text-[10px] font-black uppercase text-slate-400">File limit</div><div class="mt-1 text-sm font-black">≤\${Math.ceil(output.maxFileSizeBytes/1024)}KB</div></div></div><div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">\${output.width} × \${output.height}px · safe \${output.safeMargin}px</div><div class="mt-3"><div class="mb-2 text-xs font-black text-slate-500">圖案對齊</div><div class="grid grid-cols-2 gap-2">\${alignButton('center','絕對置中')}\${alignButton('bottom','靠下貼齊')}</div></div><p class="mt-3 text-[10px] font-bold text-slate-400">尺寸與數量由目前 Destination Profile 管理；需要自訂時請複製 Profile 後編輯 JSON。</p></section>\`;
}`,
  'renderOutputPanel'
);

for (const line of [
  `  root.querySelector('#categoryInput').addEventListener('change', event => changeCategory(event.target.value));\n`,
  `  root.querySelector('#presetRoleInput').addEventListener('change', event => changePreset(event.target.value));\n`,
  `  root.querySelector('#targetWInput').addEventListener('change', event => updateOutputDimension('targetW',event.target.value));\n`,
  `  root.querySelector('#targetHInput').addEventListener('change', event => updateOutputDimension('targetH',event.target.value));\n`,
  `  root.querySelector('#safeMarginInput').addEventListener('input', event => updateSafeMargin(event.target.value));\n`
]) app = app.replace(line, '');

app = replaceOnce(
  app,
  `function mountPackageController(root){`,
  `// DESTINATION_RULES_FULL_COMPLETION
function mountDestinationController(root){
  if(!state.destinationController){
    state.destinationController=createDestinationController({
      applyDestinationProfile:(profile,role,options={})=>{
        state.settings=applyDestinationProfileToSettings(state.settings,profile,role);
        if(options.updateFrames!==false)setFrames(normalizeFramesForDestination(frames(),profile,{invalidateApproval:options.invalidateApproval!==false}));
        clearRenderCache();renderAll();
      },
      rerender:rerenderShell,
      downloadText:(text,name,type)=>downloadBlob(new Blob([text],{type}),name),
      alert:message=>window.alert(message),
      confirm:message=>window.confirm(message),
      prompt:(message,value)=>window.prompt(message,value)
    });
  }
  state.destinationController.mount(root);
}

function mountPackageController(root){`,
  'Destination mount adapter'
);

app = replaceOnce(
  app,
  `      getOutputMetadata:()=>({documentId:state.document.id,documentName:state.document.name,targetW:state.settings.targetW,targetH:state.settings.targetH,category:state.settings.stickerCategory,safeMargin:state.settings.safeMargin}),`,
  `      getOutputMetadata:()=>{const profile=state.destinationController?.getActiveProfile?.();return{documentId:state.document.id,documentName:state.document.name,targetW:state.settings.targetW,targetH:state.settings.targetH,category:state.settings.stickerCategory,safeMargin:state.settings.safeMargin,destinationKey:profile?.key||'workshop-flexible',destinationVersion:profile?.version||'1.0.0'};},`,
  'Package metadata'
);

const oldAssign = `      assignRoles:mode=>{
        const selected=exportFrames();
        if(mode==='auto'&&selected.length<3){window.alert('至少需要 3 張輸出，才能分配 Main、Tab 與 Sticker。');return false;}
        const selectedIds=new Set(selected.map(frame=>frame.id));
        setFrames(frames().map(frame=>{
          if(!selectedIds.has(frame.id))return frame;
          const index=selected.findIndex(item=>item.id===frame.id);
          const role=mode==='auto'?(index===0?AssetRoles.MAIN:index===1?AssetRoles.TAB:AssetRoles.STICKER):AssetRoles.STICKER;
          return{...frame,state:{...frame.state,packageRole:role},custom:{...frame.custom,outputRole:role}};
        }));
        runReview();refresh();return true;
      },`;
const newAssign = `      assignRoles:mode=>{
        const selected=exportFrames(),profile=state.destinationController?.getActiveProfile?.();
        if(!profile)return false;
        const fallback=profile.roles.find(role=>role.key===AssetRoles.STICKER)?.key||profile.roles[0].key;
        const required=[];
        profile.roles.filter(role=>role.key!==fallback).forEach(role=>{const count=role.exact??(role.required?1:0);for(let i=0;i<count;i++)required.push(role.key);});
        const minimumSticker=profile.roles.find(role=>role.key===fallback)?.min||1;
        if(mode==='auto'&&selected.length<required.length+minimumSticker){window.alert(\`此 Profile 至少需要 \${required.length+minimumSticker} 張輸出。\`);return false;}
        const selectedIds=new Set(selected.map(frame=>frame.id));
        setFrames(frames().map(frame=>{
          if(!selectedIds.has(frame.id))return frame;
          const index=selected.findIndex(item=>item.id===frame.id);
          const role=mode==='auto'?(required[index]||fallback):fallback;
          return{...frame,state:{...frame.state,packageRole:role,reviewApproved:false},custom:{...frame.custom,outputRole:role}};
        }));
        clearRenderCache();renderAll();refresh();return true;
      },`;
app = replaceOnce(app, oldAssign, newAssign, 'Profile role assignment');

app = replaceOnce(
  app,
  `    packageState:state.packageController?.exportState?.()||null,\n    metadata:{previewDataUrl:getProjectPreviewDataUrl()}`,
  `    packageState:state.packageController?.exportState?.()||null,\n    destinationState:state.destinationController?.exportState?.()||null,\n    metadata:{previewDataUrl:getProjectPreviewDataUrl()}`,
  'Project capture destination state'
);
app = replaceOnce(
  app,
  `  state.packageController?.importState?.(snapshot.packageState||null);\n  renderAll();rerenderShell();`,
  `  state.destinationController?.importState?.(snapshot.destinationState||null);\n  state.packageController?.importState?.(snapshot.packageState||null);\n  clearRenderCache();renderAll();rerenderShell();`,
  'Project restore destination state'
);
app = replaceOnce(
  app,
  `  state.packageController?.importState?.(null);resetFrameHistory();resetRefineViewport();resetReviewViewport();rerenderShell();`,
  `  state.destinationController?.importState?.(null);state.packageController?.importState?.(null);resetFrameHistory();resetRefineViewport();resetReviewViewport();rerenderShell();`,
  'Project reset destination state'
);
app = replaceOnce(
  app,
  `return JSON.stringify({id:state.document.id,name:state.document.name,sources:[...state.sources.values()].map(source=>({id:source.id,name:source.name,width:source.width,height:source.height,uriLength:source.uri?.length||0})),layouts:[...state.sourceLayouts.entries()],frames:frameState,settings:state.settings,packageState:state.packageController?.exportState?.()||null});`,
  `return JSON.stringify({id:state.document.id,name:state.document.name,sources:[...state.sources.values()].map(source=>({id:source.id,name:source.name,width:source.width,height:source.height,uriLength:source.uri?.length||0})),layouts:[...state.sourceLayouts.entries()],frames:frameState,settings:state.settings,destinationState:state.destinationController?.exportState?.()||null,packageState:state.packageController?.exportState?.()||null});`,
  'Project fingerprint destination state'
);
app = replaceOnce(
  app,
  `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountPackageController(root);mountProjectController(root);refresh();}`,
  `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountDestinationController(root);mountPackageController(root);mountProjectController(root);refresh();}`,
  'rerender mount order'
);

app = replaceFunction(
  app,
  'function getRenderOptions()',
  'function renderAll()',
  `function getRenderOptions(frame=null){
  const output=state.destinationController?.getFrameOutput?.(frame)||{width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin};
  return{targetW:output.width,targetH:output.height,safeMargin:output.safeMargin,alignMode:state.settings.alignMode,highQuality:true,refine:{enabled:true,chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,exteriorOnly:state.settings.exteriorOnly,autoDespeckle:state.settings.autoDespeckle,despeckle:{minComponentSize:state.settings.despeckleMinSize},shrinkRadius:state.settings.shrinkRadius,featherRadius:state.settings.featherRadius,whiteBorder:{enabled:state.settings.whiteBorderEnabled,size:state.settings.whiteBorderSize,color:state.settings.borderColor},shadow:{enabled:false}}};
}
function renderFrame(frame,force=false){const source=sourceForFrame(frame);if(!source)return null;const options=getRenderOptions(frame);const key=JSON.stringify({source:source.id,geometry:frame.geometry,offsetX:frame.custom?.offsetX||0,offsetY:frame.custom?.offsetY||0,maskVersion:frame.custom?.maskVersion||0,options});if(!force&&state.rendered.has(frame.id)&&state.renderKeys.get(frame.id)===key)return state.rendered.get(frame.id);const canvas=renderWorkshopFrame(source,frame,options).canvas;state.rendered.set(frame.id,canvas);state.renderKeys.set(frame.id,key);return canvas;}`,
  'role-specific render options'
);

app = replaceFunction(
  app,
  'function runReview()',
  'function refresh()',
  `function runReview(){
  const selected=exportFrames();selected.forEach(frame=>renderFrame(frame));
  const plan=packagePlan(selected);
  const outputRulesByFrame=new Map(plan.items.map(item=>[item.artworkId,{targetW:item.expectedWidth,targetH:item.expectedHeight,safeMargin:item.safeMargin,maxFileSizeBytes:item.maxFileSizeBytes}]));
  const report=runFullReview(frames(),state.rendered,{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,safeAreaMargin:state.settings.safeMargin,maxFileSizeKB:state.settings.maxFileSizeKB,outputRulesByFrame,packageItems:plan.items,requireTransparency:true});
  const packageIssues=[...plan.validation.errors,...plan.validation.warnings].map(issue=>({...issue,id:issue.id||createId('issue'),frameId:issue.frameId||null,metadata:issue.metadata||{}}));
  const issues=[...report.issues,...packageIssues];
  const summary={total:issues.length,errors:issues.filter(issue=>issue.severity==='error').length,warnings:issues.filter(issue=>issue.severity==='warning').length,info:issues.filter(issue=>issue.severity==='info').length};
  state.reviewReport={...report,issues,summary,ready:report.allSelectedApproved&&summary.errors===0&&plan.ready,canPackage:report.allSelectedApproved&&summary.errors===0&&plan.ready,packagePlan:plan};
}`,
  'destination-aware Review'
);

app = replaceOnce(
  app,
  `function availableRoleOptions(){return getAvailableAssetRoles(state.settings.stickerCategory);}\nfunction packageRole(frame){return frame.state?.packageRole||frame.custom?.outputRole||AssetRoles.STICKER;}\nfunction roleLabel(role){return({sticker:'Sticker',main:'Main',tab:'Tab',background:'全螢幕背景','effect-background':'特效背景'})[role]||role;}\nfunction currentRules(){return createPlatformNeutralRules({category:state.settings.stickerCategory,targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,maxFileSizeKB:state.settings.maxFileSizeKB});}\nfunction packagePlan(list=frames()){return buildWorkshopPackagePlan(list,{category:state.settings.stickerCategory,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,destinationKey:'workshop'});}`,
  `function availableRoleOptions(){return state.destinationController?.getActiveProfile?.().roles.map(role=>role.key)||getAvailableAssetRoles(state.settings.stickerCategory);}\nfunction packageRole(frame){return frame.state?.packageRole||frame.custom?.outputRole||AssetRoles.STICKER;}\nfunction roleLabel(role){const profile=state.destinationController?.getActiveProfile?.();return profile?.roles.find(item=>item.key===role)?.label||({sticker:'Sticker',main:'Main',tab:'Tab',background:'全螢幕背景','effect-background':'特效背景'})[role]||role;}\nfunction currentRules(){return state.destinationController?.getActiveProfile?.()||createPlatformNeutralRules({category:state.settings.stickerCategory,targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,maxFileSizeKB:state.settings.maxFileSizeKB});}\nfunction packagePlan(list=frames()){return state.destinationController?.buildPlan?.(list,{namingMode:state.settings.packageNamingMode==='sequential'?'sequential':'profile',prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,renderedMap:state.rendered})||buildWorkshopPackagePlan(list,{category:state.settings.stickerCategory,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,destinationKey:'workshop'});}`,
  'destination package helpers'
);
app = app.replace(
  `card.querySelector('.role-select').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,packageRole:event.target.value},custom:{...frame.custom,outputRole:event.target.value}},{preserveReview:true});runReview();refresh();});`,
  `card.querySelector('.role-select').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,packageRole:event.target.value,reviewApproved:false},custom:{...frame.custom,outputRole:event.target.value}});clearFrameRender(frame.id);renderFrame(frame,true);runReview();refresh();});`
);

app = replaceFunction(
  app,
  'function renderLargeReview()',
  'function reviewIssueText(issue)',
  `function renderLargeReview(){
  const stage=document.getElementById('reviewHeroStage'),image=document.getElementById('reviewHeroImage'),guide=document.getElementById('reviewSafeGuide'),bounds=document.getElementById('reviewContentBounds'),meta=document.getElementById('reviewHeroMeta');if(!stage||!image||!guide||!bounds||!meta)return;
  const frame=selectedFrame()||frames()[0],output=state.destinationController?.getFrameOutput?.(frame)||{width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin};applyReviewBackground(stage);stage.style.aspectRatio=\`\${output.width}/\${output.height}\`;
  if(!frame){image.removeAttribute('src');guide.classList.add('hidden');bounds.classList.add('hidden');meta.innerHTML='<div class="text-slate-400">尚無預覽</div>';return;}
  const canvas=renderFrame(frame),item=allReviewItems().find(entry=>entry.frameId===frame.id),analysis=analyzeRenderedCanvas(canvas);image.src=canvas.toDataURL('image/png');
  const top=output.safeMargin/output.height*100,left=output.safeMargin/output.width*100;guide.style.top=\`\${top}%\`;guide.style.bottom=\`\${top}%\`;guide.style.left=\`\${left}%\`;guide.style.right=\`\${left}%\`;guide.classList.toggle('hidden',!state.settings.showSafeGuide);
  if(analysis.bounds){bounds.style.left=\`\${analysis.bounds.x/analysis.width*100}%\`;bounds.style.top=\`\${analysis.bounds.y/analysis.height*100}%\`;bounds.style.width=\`\${analysis.bounds.width/analysis.width*100}%\`;bounds.style.height=\`\${analysis.bounds.height/analysis.height*100}%\`;bounds.classList.toggle('hidden',!state.settings.showContentBounds);}else bounds.classList.add('hidden');
  const issueBadges=(item?.issues||[]).filter(issue=>issue.code!=='review.pendingApproval').map(issue=>\`<div class="mt-2 rounded-xl \${issue.severity==='error'?'bg-rose-500/20 text-rose-200':issue.severity==='warning'?'bg-amber-500/20 text-amber-100':'bg-white/10'} p-2 text-xs">\${escapeHtml(reviewIssueText(issue))}</div>\`).join('');
  meta.innerHTML=\`<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">\${escapeHtml(frame.name)}</div><div class="mt-1 break-all font-mono text-xs text-slate-300">\${escapeHtml(item?.fileName||'')}</div><div class="mt-3 rounded-2xl bg-white/10 p-3">\${roleLabel(packageRole(frame))}<br>\${output.width}×\${output.height}px<br>safe \${output.safeMargin}px<br>內容 \${analysis.bounds?analysis.bounds.width+'×'+analysis.bounds.height:'無'}<br>透明 \${Math.round((analysis.transparentRatio||0)*100)}%<br>\${item?.kb||0}KB</div><button id="reviewHeroApproveBtn" class="mt-3 w-full rounded-xl \${item?.approved?'bg-emerald-500':'bg-emerald-300 text-slate-950'} py-2 text-xs font-black">\${item?.approved?'已核准｜點擊撤銷':'核准目前 Frame'}</button><label class="mt-2 flex items-center justify-between rounded-xl bg-white/10 p-2 text-xs font-black"><span>加入匯出</span><input id="reviewHeroExportInput" type="checkbox" \${item?.exportSelected?'checked':''}></label>\${issueBadges||'<div class="mt-3 rounded-xl bg-emerald-500/20 p-2 text-xs text-emerald-200">沒有像素錯誤</div>'}\`;
  document.getElementById('reviewHeroApproveBtn')?.addEventListener('click',()=>toggleFrameReviewApproval(frame.id));document.getElementById('reviewHeroExportInput')?.addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,exportSelected:event.target.checked}},{preserveReview:true});runReview();refresh();});updateReviewTransform();
}`,
  'destination Review preview'
);
app = app.replace(
  `'render.missing':'尚未渲染'`,
  `'render.missing':'尚未渲染','destination.role.exact':'角色數量不符','destination.role.min':'角色數量不足','destination.role.max':'角色數量過多','destination.role.allowedCount':'貼圖數量不符合 Profile','destination.output.size':'角色輸出尺寸不符','destination.output.fileSize':'檔案超過 Profile 上限','destination.package.empty':'沒有可輸出檔案'`
);

reviewEngine = replaceOnce(
  reviewEngine,
  `  const maxFrames = options.maxFrames || null;`,
  `  const maxFrames = options.maxFrames || null;\n  const outputRulesByFrame = options.outputRulesByFrame instanceof Map ? options.outputRulesByFrame : new Map();`,
  'Review output rules map'
);
reviewEngine = replaceOnce(
  reviewEngine,
  `    if (rendered.width !== targetW || rendered.height !== targetH) {\n      issues.push(createIssue({\n        code: 'render.sizeMismatch',\n        message: \`${'${frame.name || `Frame ${index + 1}`}'} render size is ${'${rendered.width}'}×${'${rendered.height}'}, expected ${'${targetW}'}×${'${targetH}'}.\`,`,
  `    const outputRule = outputRulesByFrame.get(frame.id) || {};\n    const expectedW = outputRule.targetW || targetW;\n    const expectedH = outputRule.targetH || targetH;\n    if (rendered.width !== expectedW || rendered.height !== expectedH) {\n      issues.push(createIssue({\n        code: 'render.sizeMismatch',\n        message: \`${'${frame.name || `Frame ${index + 1}`}'} render size is ${'${rendered.width}'}×${'${rendered.height}'}, expected ${'${expectedW}'}×${'${expectedH}'}.\`,`,
  'Review role dimensions'
);

reviewWorkflow = replaceOnce(
  reviewWorkflow,
  `  const packageItemByFrame = new Map(packageItems.map(item => [item.artworkId, item]));`,
  `  const packageItemByFrame = new Map(packageItems.map(item => [item.artworkId, item]));\n  const outputRulesByFrame = options.outputRulesByFrame instanceof Map ? options.outputRulesByFrame : new Map();`,
  'Full Review output rules map'
);
reviewWorkflow = replaceOnce(
  reviewWorkflow,
  `    issues.push(...reviewRenderedPixels(rendered, frame, frame.name || \`Frame ${'${index + 1}'}\`, {\n      safeAreaMargin: options.safeAreaMargin ?? options.safeMargin ?? 0,`,
  `    const outputRule = outputRulesByFrame.get(frame.id) || {};\n    issues.push(...reviewRenderedPixels(rendered, frame, frame.name || \`Frame ${'${index + 1}'}\`, {\n      safeAreaMargin: outputRule.safeMargin ?? options.safeAreaMargin ?? options.safeMargin ?? 0,`,
  'Full Review role safe margin'
);
reviewWorkflow = replaceOnce(
  reviewWorkflow,
  `    const bytes = estimateRenderedBytes(rendered);\n    if (maxBytes > 0 && bytes > maxBytes) {`,
  `    const bytes = estimateRenderedBytes(rendered);\n    const frameMaxBytes = Number(outputRule.maxFileSizeBytes || maxBytes);\n    if (frameMaxBytes > 0 && bytes > frameMaxBytes) {`,
  'Full Review role file limit'
);
reviewWorkflow = reviewWorkflow.replace(
  `above the ${'${options.maxFileSizeKB}'}KB warning limit.`,
  `above the ${'${Math.ceil(frameMaxBytes / 1024)}'}KB limit.`
).replace(
  `metadata: { bytes, maxBytes }`,
  `metadata: { bytes, maxBytes: frameMaxBytes }`
);

projectWorkflow = replaceOnce(
  projectWorkflow,
  `  packageState = null,\n  metadata = {},`,
  `  packageState = null,\n  destinationState = null,\n  metadata = {},`,
  'Project destination parameter'
);
projectWorkflow = replaceOnce(
  projectWorkflow,
  `    packageState: cloneSerializable(packageState),\n    metadata: {`,
  `    packageState: cloneSerializable(packageState),\n    destinationState: cloneSerializable(destinationState),\n    metadata: {`,
  'Project destination snapshot'
);
projectWorkflow = replaceOnce(
  projectWorkflow,
  `      packageState: source.packageState || null,\n      metadata:`,
  `      packageState: source.packageState || null,\n      destinationState: source.destinationState || null,\n      metadata:`,
  'Legacy destination migration'
);
projectWorkflow = replaceOnce(
  projectWorkflow,
  `    selectedFrameBySource: normalizeEntries(source.selectedFrameBySource || []),\n    ui: {`,
  `    selectedFrameBySource: normalizeEntries(source.selectedFrameBySource || []),\n    packageState: cloneSerializable(source.packageState || null),\n    destinationState: cloneSerializable(source.destinationState || null),\n    ui: {`,
  'Current destination migration'
);

packageController = packageController.replace('快速分配 Main／Tab', '按 Profile 快速分配');

await Promise.all([
  writeFile(appPath, app, 'utf8'),
  writeFile(reviewEnginePath, reviewEngine, 'utf8'),
  writeFile(reviewWorkflowPath, reviewWorkflow, 'utf8'),
  writeFile(projectWorkflowPath, projectWorkflow, 'utf8'),
  writeFile(packageControllerPath, packageController, 'utf8')
]);
console.log('Destination Rules full completion applied.');
