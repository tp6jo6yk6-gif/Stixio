import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');

if (source.includes('// PACKAGE_FULL_COMPLETION')) {
  console.log('Package full completion already applied.');
  process.exit(0);
}

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing Package migration target: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  `} from '../core/index.js';\n\nconst HANDLE_SIZE`,
  `} from '../core/index.js';\nimport { createPackageController } from './package-controller.js';\n\nconst HANDLE_SIZE`,
  'Package controller import'
);

replaceOnce(
  `  reviewPan: null,\n  reviewPointerActive: false\n};`,
  `  reviewPan: null,\n  reviewPointerActive: false,\n  packageController: null\n};`,
  'Package controller state'
);

replaceOnce(
  `${'${renderSourceEditor()}${renderRefineEditor()}${renderReviewBoard()}'}`,
  `${'${renderSourceEditor()}${renderRefineEditor()}${renderReviewBoard()}${renderPackageBoard()}'}`,
  'Package workspace shell'
);

source = source.replace(
  '<section id="stage-package" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Rules Engine',
  '<section id="package-rules-panel" class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Rules Engine'
);

replaceOnce(
  `function renderSourceListPanel() {`,
  `function renderPackageBoard() {\n  return '<div id="packageWorkspaceRoot"></div>';\n}\n\nfunction renderSourceListPanel() {`,
  'Package workspace root'
);

const panelStart = source.indexOf('function renderPackagePanel() {');
const panelEnd = source.indexOf('\n\nfunction layoutButton(', panelStart);
if (panelStart < 0 || panelEnd < 0) throw new Error('Missing Package panel section.');
source = source.slice(0, panelStart)
  + `function renderPackagePanel() {\n  return '<div id="packageSettingsRoot"></div>';\n}`
  + source.slice(panelEnd);

replaceOnce(
  `// REVIEW_FULL_COMPLETION`,
  `// REVIEW_FULL_COMPLETION\n// PACKAGE_FULL_COMPLETION`,
  'Package marker'
);

replaceOnce(
  `  root.querySelector('#packageNamingModeInput').addEventListener('change',event=>{state.settings.packageNamingMode=event.target.value;refresh();});\n  root.querySelector('#filenamePrefixInput').addEventListener('input',event=>{state.settings.filenamePrefix=event.target.value;renderReviewGrid();renderLargeReview();});\n  root.querySelector('#filenameSuffixInput').addEventListener('input',event=>{state.settings.filenameSuffix=event.target.value;renderReviewGrid();renderLargeReview();});\n  root.querySelector('#maxFileSizeKBInput').addEventListener('change',event=>{state.settings.maxFileSizeKB=Math.max(1,Number(event.target.value)||DEFAULT_MAX_FILE_SIZE_KB);refresh();});\n  root.querySelector('#downloadSelectedBtn').addEventListener('click', downloadSelectedPng);\n  root.querySelector('#exportZipBtn').addEventListener('click', downloadZip);`,
  `  root.querySelector('#exportZipBtn').addEventListener('click', () => state.packageController?.exportPackage());`,
  'Legacy Package event bindings'
);

replaceOnce(
  `  root.innerHTML = renderShell();\n  bindStaticEvents(root);\n  refresh();`,
  `  root.innerHTML = renderShell();\n  bindStaticEvents(root);\n  mountPackageController(root);\n  refresh();`,
  'Initial Package mount'
);

replaceOnce(
  `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);refresh();}`,
  `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountPackageController(root);refresh();}`,
  'Package rerender mount'
);

replaceOnce(
  `refreshReviewControls();refreshMaskToolButtons();`,
  `refreshReviewControls();state.packageController?.refresh();refreshMaskToolButtons();`,
  'Package refresh bridge'
);

replaceOnce(
  `function rerenderShell(){`,
  `function mountPackageController(root){\n  if(!state.packageController){\n    state.packageController=createPackageController({\n      getExportFrames:exportFrames,\n      ensureRendered:frame=>renderFrame(frame),\n      getPackagePlan:list=>packagePlan(list),\n      getRenderedMap:()=>state.rendered,\n      getSourceNames:reviewSourceNames,\n      getReviewReport:()=>{runReview();return state.reviewReport;},\n      getOutputMetadata:()=>({documentId:state.document.id,documentName:state.document.name,targetW:state.settings.targetW,targetH:state.settings.targetH,category:state.settings.stickerCategory,safeMargin:state.settings.safeMargin}),\n      getNamingSettings:()=>({mode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,maxFileSizeKB:state.settings.maxFileSizeKB}),\n      updateNamingSetting:(key,value)=>{\n        if(key==='mode')state.settings.packageNamingMode=value;\n        if(key==='prefix')state.settings.filenamePrefix=value;\n        if(key==='suffix')state.settings.filenameSuffix=value;\n        if(key==='maxFileSizeKB')state.settings.maxFileSizeKB=Math.max(1,Number(value)||DEFAULT_MAX_FILE_SIZE_KB);\n        runReview();refresh();\n      },\n      assignRoles:mode=>{\n        const selected=exportFrames();\n        if(mode==='auto'&&selected.length<3){window.alert('至少需要 3 張輸出，才能分配 Main、Tab 與 Sticker。');return false;}\n        const selectedIds=new Set(selected.map(frame=>frame.id));\n        setFrames(frames().map(frame=>{\n          if(!selectedIds.has(frame.id))return frame;\n          const index=selected.findIndex(item=>item.id===frame.id);\n          const role=mode==='auto'?(index===0?AssetRoles.MAIN:index===1?AssetRoles.TAB:AssetRoles.STICKER):AssetRoles.STICKER;\n          return{...frame,state:{...frame.state,packageRole:role},custom:{...frame.custom,outputRole:role}};\n        }));\n        runReview();refresh();return true;\n      },\n      downloadSelectedPng,\n      openFrame:frameId=>{selectFrame(frameId);state.activeEditor='review';refresh();document.getElementById('stage-review')?.scrollIntoView({behavior:'smooth',block:'start'});},\n      getJSZipClass:()=>window.JSZip,\n      downloadBlob,\n      downloadDataUrl,\n      downloadText:(text,name,type)=>downloadBlob(new Blob([text],{type}),name),\n      alert:message=>window.alert(message)\n    });\n  }\n  state.packageController.mount(root);\n}\n\nfunction rerenderShell(){`,
  'Package adapter bridge'
);

const downloadStart = source.indexOf('async function downloadZip(){');
const downloadEnd = source.indexOf('\nfunction downloadDataUrl', downloadStart);
if (downloadStart < 0 || downloadEnd < 0) throw new Error('Missing legacy ZIP function.');
source = source.slice(0, downloadStart)
  + `async function downloadZip(){return state.packageController?.exportPackage();}`
  + source.slice(downloadEnd);

await writeFile(path, source, 'utf8');
console.log('Package controller bridge applied.');
