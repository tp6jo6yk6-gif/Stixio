import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/ui/stixio-workshop-app-v2.js';
const projectPath = 'src/ui/project-controller.js';
const appMarker = '// WORKSHOP_PERFORMANCE_OPTIMIZATIONS_V1';
const projectMarker = '// PROJECT_EVENT_DRIVEN_AUTOSAVE_V1';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found.`);
  return source.replace(before, after);
}

async function patchWorkshopApp() {
  let source = await readFile(appPath, 'utf8');
  if (source.includes(appMarker)) {
    console.log('Workshop performance optimizations already present.');
    return;
  }

  source = replaceOnce(
    source,
    `  reviewReport: null,\n  settings: { ...DEFAULT_SETTINGS },`,
    `  reviewReport: null,\n  reviewItemsCache: null,\n  reviewThumbnails: new Map(),\n  reviewThumbnailPromises: new Map(),\n  settings: { ...DEFAULT_SETTINGS },`,
    'Workshop state cache'
  );

  source = replaceOnce(
    source,
    `function frames(){return state.document.frames;}\nfunction setFrames(next){state.document=setDocumentFrames(state.document,next);}`,
    `${appMarker}\nfunction frames(){return state.document.frames;}\nfunction invalidateReviewCaches(){state.reviewReport=null;state.reviewItemsCache=null;}\nfunction setFrames(next){state.document=setDocumentFrames(state.document,next);invalidateReviewCaches();state.projectController?.markDirty('自動保存排程中');}`,
    'Frame state invalidation'
  );

  source = replaceOnce(
    source,
    `function renderAll(){frames().forEach(frame=>renderFrame(frame));runReview();}\nfunction clearRenderCache(invalidateApprovals=true){state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;if(invalidateApprovals)invalidateAllReviewApprovals();}\nfunction runReview(){\n  const selected=exportFrames();selected.forEach(frame=>renderFrame(frame));\n  const plan=packagePlan(selected);\n  const outputRulesByFrame=new Map(plan.items.map(item=>[item.artworkId,{targetW:item.expectedWidth,targetH:item.expectedHeight,safeMargin:item.safeMargin,maxFileSizeBytes:item.maxFileSizeBytes}]));\n  const report=runFullReview(frames(),state.rendered,{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,safeAreaMargin:state.settings.safeMargin,maxFileSizeKB:state.settings.maxFileSizeKB,outputRulesByFrame,packageItems:plan.items,requireTransparency:true});\n  const packageIssues=[...plan.validation.errors,...plan.validation.warnings].map(issue=>({...issue,id:issue.id||createId('issue'),frameId:issue.frameId||null,metadata:issue.metadata||{}}));\n  const issues=[...report.issues,...packageIssues];\n  const summary={total:issues.length,errors:issues.filter(issue=>issue.severity==='error').length,warnings:issues.filter(issue=>issue.severity==='warning').length,info:issues.filter(issue=>issue.severity==='info').length};\n  state.reviewReport={...report,issues,summary,ready:report.allSelectedApproved&&summary.errors===0&&plan.ready,canPackage:report.allSelectedApproved&&summary.errors===0&&plan.ready,packagePlan:plan};\n}`,
    `function renderAll(){frames().forEach(frame=>renderFrame(frame));runReview();}\nfunction revokeReviewThumbnail(frameId){const cached=state.reviewThumbnails.get(frameId);if(cached?.url)URL.revokeObjectURL(cached.url);state.reviewThumbnails.delete(frameId);state.reviewThumbnailPromises.delete(frameId);}\nfunction clearReviewThumbnailCache(){for(const cached of state.reviewThumbnails.values())if(cached?.url)URL.revokeObjectURL(cached.url);state.reviewThumbnails.clear();state.reviewThumbnailPromises.clear();}\nfunction clearRenderCache(invalidateApprovals=true){state.rendered.clear();state.renderKeys.clear();clearReviewThumbnailCache();invalidateReviewCaches();if(invalidateApprovals)invalidateAllReviewApprovals();}\nfunction runReview(force=false){\n  if(!force&&state.reviewReport)return state.reviewReport;\n  const selected=exportFrames();selected.forEach(frame=>renderFrame(frame));\n  const plan=packagePlan(selected);\n  const outputRulesByFrame=new Map(plan.items.map(item=>[item.artworkId,{targetW:item.expectedWidth,targetH:item.expectedHeight,safeMargin:item.safeMargin,maxFileSizeBytes:item.maxFileSizeBytes}]));\n  const report=runFullReview(frames(),state.rendered,{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,safeAreaMargin:state.settings.safeMargin,maxFileSizeKB:state.settings.maxFileSizeKB,outputRulesByFrame,packageItems:plan.items,requireTransparency:true});\n  const packageIssues=[...plan.validation.errors,...plan.validation.warnings].map(issue=>({...issue,id:issue.id||createId('issue'),frameId:issue.frameId||null,metadata:issue.metadata||{}}));\n  const issues=[...report.issues,...packageIssues];\n  const summary={total:issues.length,errors:issues.filter(issue=>issue.severity==='error').length,warnings:issues.filter(issue=>issue.severity==='warning').length,info:issues.filter(issue=>issue.severity==='info').length};\n  state.reviewReport={...report,issues,summary,ready:report.allSelectedApproved&&summary.errors===0&&plan.ready,canPackage:report.allSelectedApproved&&summary.errors===0&&plan.ready,packagePlan:plan};\n  state.reviewItemsCache=null;\n  return state.reviewReport;\n}`,
    'Review cache and thumbnail cleanup'
  );

  source = replaceOnce(
    source,
    `  drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();refreshCommonControls();`,
    `  runReview();drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();refreshCommonControls();`,
    'Single Review per refresh'
  );

  source = replaceOnce(
    source,
    `function allReviewItems(){runReview();const plan=state.reviewReport?.packagePlan||packagePlan(exportFrames());return buildReviewItems({frames:frames(),renderedMap:state.rendered,issues:state.reviewReport?.issues||[],packageItems:plan.items,sourceNames:reviewSourceNames()});}`,
    `function allReviewItems(){if(state.reviewItemsCache)return state.reviewItemsCache;const report=runReview();const plan=report?.packagePlan||packagePlan(exportFrames());state.reviewItemsCache=buildReviewItems({frames:frames(),renderedMap:state.rendered,issues:report?.issues||[],packageItems:plan.items,sourceNames:reviewSourceNames()});return state.reviewItemsCache;}`,
    'Review item cache'
  );

  source = replaceOnce(
    source,
    `function renderReviewSummary(){const holder=document.getElementById('reviewSummary');if(!holder)return;runReview();const report=state.reviewReport,plan=packagePlan(exportFrames());if(!report){holder.innerHTML='<div class="text-slate-400">尚未檢查</div>';return;}holder.innerHTML=\`<div class="rounded-2xl bg-white/10 p-3"><div class="text-2xl font-black">\${exportFrames().length}</div><div class="text-xs text-slate-400">selected exports</div></div><div class="rounded-2xl bg-white/10 p-3 text-xs">\${report.ready&&plan.ready?'✓ Review ready':\`\${report.summary.errors+plan.validation.errors.length} errors · \${report.summary.warnings} warnings\`}</div>\`;}`,
    `function renderReviewSummary(){const holder=document.getElementById('reviewSummary');if(!holder)return;const report=runReview(),plan=report?.packagePlan||packagePlan(exportFrames());if(!report){holder.innerHTML='<div class="text-slate-400">尚未檢查</div>';return;}holder.innerHTML=\`<div class="rounded-2xl bg-white/10 p-3"><div class="text-2xl font-black">\${exportFrames().length}</div><div class="text-xs text-slate-400">selected exports</div></div><div class="rounded-2xl bg-white/10 p-3 text-xs">\${report.ready&&plan.ready?'✓ Review ready':\`\${report.summary.errors+plan.validation.errors.length} errors · \${report.summary.warnings} warnings\`}</div>\`;}`,
    'Review summary cache'
  );

  source = replaceOnce(
    source,
    `function renderReviewGrid(){`,
    `const EMPTY_REVIEW_THUMBNAIL='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';\nfunction reviewThumbnailKey(frame){return state.renderKeys.get(frame.id)||frameReviewSignature(frame);}\nfunction getReviewThumbnailUrl(frame,canvas){const key=reviewThumbnailKey(frame),cached=state.reviewThumbnails.get(frame.id);if(cached?.key===key)return Promise.resolve(cached.url);const pending=state.reviewThumbnailPromises.get(frame.id);if(pending?.key===key)return pending.promise;const promise=new Promise(resolve=>{canvas.toBlob(blob=>{state.reviewThumbnailPromises.delete(frame.id);if(!blob||reviewThumbnailKey(frame)!==key){resolve(EMPTY_REVIEW_THUMBNAIL);return;}const previous=state.reviewThumbnails.get(frame.id);if(previous?.url)URL.revokeObjectURL(previous.url);const url=URL.createObjectURL(blob);state.reviewThumbnails.set(frame.id,{key,url});resolve(url);},'image/png');});state.reviewThumbnailPromises.set(frame.id,{key,promise});return promise;}\nfunction attachReviewThumbnail(image,frame,canvas){if(!image)return;const key=reviewThumbnailKey(frame);image.src=EMPTY_REVIEW_THUMBNAIL;void getReviewThumbnailUrl(frame,canvas).then(url=>{if(image.isConnected&&reviewThumbnailKey(frame)===key)image.src=url;});}\nfunction renderReviewGrid(){`,
    'Review Blob URL helpers'
  );

  source = replaceOnce(
    source,
    `const dataUrl=canvas.toDataURL('image/png');const badge=`,
    `const badge=`,
    'Remove synchronous thumbnail encoding'
  );

  source = replaceOnce(
    source,
    `<img src="\${dataUrl}" class="h-full w-full object-contain">`,
    `<img class="h-full w-full object-contain" alt="">`,
    'Review thumbnail image'
  );

  source = replaceOnce(
    source,
    `    applyReviewBackground(card.querySelector('.preview'));`,
    `    applyReviewBackground(card.querySelector('.preview'));attachReviewThumbnail(card.querySelector('.preview img'),frame,canvas);`,
    'Attach cached thumbnail'
  );

  source = replaceOnce(
    source,
    `function clearFrameRender(frameId){state.rendered.delete(frameId);state.renderKeys.delete(frameId);invalidateFrameReviewApproval(frameId);}`,
    `function clearFrameRender(frameId){state.rendered.delete(frameId);state.renderKeys.delete(frameId);revokeReviewThumbnail(frameId);invalidateReviewCaches();invalidateFrameReviewApproval(frameId);}\nfunction renderSingleFrameChange(frameId){clearFrameRender(frameId);const frame=frames().find(item=>item.id===frameId);if(frame)renderFrame(frame,true);runReview();refresh();}`,
    'Single-frame render helper'
  );

  source = replaceOnce(
    source,
    `function setSelectedOffset(key,value){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,[key]:Math.max(-4096,Math.min(4096,Number(value)||0))}});commitFrameChange('Set Output Offset',before,frameSnapshot());clearRenderCache();renderAll();refresh();}`,
    `function setSelectedOffset(key,value){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,[key]:Math.max(-4096,Math.min(4096,Number(value)||0))}});commitFrameChange('Set Output Offset',before,frameSnapshot());renderSingleFrameChange(frame.id);}`,
    'Single-frame offset render'
  );

  source = replaceOnce(
    source,
    `function nudgeSelectedOffset(dx,dy){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,offsetX:(frame.custom?.offsetX||0)+dx,offsetY:(frame.custom?.offsetY||0)+dy}});commitFrameChange('Nudge Output Offset',before,frameSnapshot());clearRenderCache();renderAll();refresh();}`,
    `function nudgeSelectedOffset(dx,dy){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,offsetX:(frame.custom?.offsetX||0)+dx,offsetY:(frame.custom?.offsetY||0)+dy}});commitFrameChange('Nudge Output Offset',before,frameSnapshot());renderSingleFrameChange(frame.id);}`,
    'Single-frame nudge render'
  );

  source = replaceOnce(
    source,
    `function resetSelectedOffset(){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,offsetX:0,offsetY:0}});commitFrameChange('Reset Output Offset',before,frameSnapshot());clearRenderCache();renderAll();refresh();}`,
    `function resetSelectedOffset(){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,offsetX:0,offsetY:0}});commitFrameChange('Reset Output Offset',before,frameSnapshot());renderSingleFrameChange(frame.id);}`,
    'Single-frame reset render'
  );

  source = replaceOnce(
    source,
    `commitFrameChange(drag.handle==='move'?'Move Frame':'Resize Frame',drag.before,frameSnapshot());clearRenderCache();renderAll();refresh();}`,
    `commitFrameChange(drag.handle==='move'?'Move Frame':'Resize Frame',drag.before,frameSnapshot());renderSingleFrameChange(drag.frameId);}`,
    'Single-frame geometry render'
  );

  const listChangeBefore = `function applyFrameListChange(label,nextFrames,nextSelected,sourceId=state.activeSourceId){\n  const before=frameSnapshot();\n  setFrames(nextFrames);\n  state.activeSourceId=sourceId||state.activeSourceId;\n  const selected=nextFrames.find(frame=>frame.id===nextSelected)||null;\n  state.selectedFrameId=selected?.id||null;\n  if(state.activeSourceId){\n    if(selected)state.selectedFrameBySource.set(state.activeSourceId,selected.id);\n    else state.selectedFrameBySource.delete(state.activeSourceId);\n    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(state.activeSourceId));\n  }\n  const after=frameSnapshot();commitFrameChange(label,before,after);clearRenderCache();renderAll();refresh();\n}`;
  const listChangeAfter = `function applyFrameListChange(label,nextFrames,nextSelected,sourceId=state.activeSourceId){\n  const before=frameSnapshot(),beforeIds=new Set(before.frames.map(frame=>frame.id));\n  setFrames(nextFrames);\n  state.activeSourceId=sourceId||state.activeSourceId;\n  const selected=nextFrames.find(frame=>frame.id===nextSelected)||null;\n  state.selectedFrameId=selected?.id||null;\n  if(state.activeSourceId){\n    if(selected)state.selectedFrameBySource.set(state.activeSourceId,selected.id);\n    else state.selectedFrameBySource.delete(state.activeSourceId);\n    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(state.activeSourceId));\n  }\n  const after=frameSnapshot();commitFrameChange(label,before,after);\n  const nextIds=new Set(nextFrames.map(frame=>frame.id));\n  for(const frameId of [...state.rendered.keys()])if(!nextIds.has(frameId)){state.rendered.delete(frameId);state.renderKeys.delete(frameId);revokeReviewThumbnail(frameId);}\n  nextFrames.filter(frame=>!beforeIds.has(frame.id)).forEach(frame=>renderFrame(frame,true));\n  invalidateReviewCaches();runReview();refresh();\n}`;
  source = replaceOnce(source, listChangeBefore, listChangeAfter, 'Frame-list incremental render');

  await writeFile(appPath, source);
  console.log('Workshop performance optimizations installed.');
}

async function patchProjectController() {
  let source = await readFile(projectPath, 'utf8');
  if (source.includes(projectMarker)) {
    console.log('Event-driven project autosave already present.');
    return;
  }

  source = replaceOnce(source, `    pollTimer: null,\n`, ``, 'Project poll timer state');
  source = replaceOnce(
    source,
    `      local.lastFingerprint = await adapter.getProjectFingerprint();\n      startChangePolling();`,
    `      local.lastFingerprint = await adapter.getProjectFingerprint();\n      ${projectMarker}`,
    'Project initialize polling'
  );

  const pollingBlock = `  function startChangePolling() {\n    clearInterval(local.pollTimer);\n    local.pollTimer = setInterval(async () => {\n      try {\n        const fingerprint = await adapter.getProjectFingerprint();\n        if (local.lastFingerprint == null) {\n          local.lastFingerprint = fingerprint;\n          return;\n        }\n        if (fingerprint !== local.lastFingerprint) {\n          local.lastFingerprint = fingerprint;\n          markDirty('自動保存排程中');\n        }\n      } catch {\n        // Avoid interrupting editing when a transient canvas is unavailable.\n      }\n    }, Math.max(400, Math.floor(autosaveDelay / 2)));\n  }\n\n`;
  source = replaceOnce(source, pollingBlock, ``, 'Project fingerprint polling block');

  await writeFile(projectPath, source);
  console.log('Project autosave changed to event-driven dirty tracking.');
}

await patchWorkshopApp();
await patchProjectController();
