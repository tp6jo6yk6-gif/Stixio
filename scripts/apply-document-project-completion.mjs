import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/ui/stixio-workshop-app-v2.js';
const packagePath = 'src/ui/package-controller.js';

let app = await readFile(appPath, 'utf8');
let packageController = await readFile(packagePath, 'utf8');

if (!packageController.includes('function exportState()')) {
  packageController = packageController.replace(
    '  return { mount, refresh, exportPackage, cancelExport, getSnapshot: createSnapshot };',
    `  function exportState() {
    return {
      settings: cloneProjectValue(local.settings),
      history: cloneProjectValue(local.history)
    };
  }

  function importState(value = null) {
    const next = value || {};
    local.settings = createPackageDeliverySettings(next.settings || {});
    local.history = Array.isArray(next.history) ? cloneProjectValue(next.history).slice(0, 20) : [];
    local.job = createIdleJob();
    refresh();
  }

  return { mount, refresh, exportPackage, cancelExport, getSnapshot: createSnapshot, exportState, importState };`
  );
  packageController += `

function cloneProjectValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
`;
}

if (!app.includes('// DOCUMENT_PROJECT_FULL_COMPLETION')) {
  app = app.replace(
    `  ReviewIssueSeverity\n} from '../core/index.js';`,
    `  ReviewIssueSeverity,\n  createWorkshopProjectSnapshot\n} from '../core/index.js';`
  );
  app = app.replace(
    `import { createPackageController } from './package-controller.js';`,
    `import { createPackageController } from './package-controller.js';\nimport { createProjectController } from './project-controller.js';`
  );
  app = app.replace(
    `  packageController: null\n};`,
    `  packageController: null,\n  projectController: null\n};`
  );
  app = app.replace(
    `  mountPackageController(root);\n  refresh();`,
    `  mountPackageController(root);\n  mountProjectController(root);\n  refresh();`
  );
  app = app.replace(
    `          <div class="flex items-center gap-2"><button id="undoBtn"`,
    `          <div class="flex items-center gap-2"><button id="undoBtn"`
  );
  app = app.replace(
    `        </div>\n        <nav aria-label="Workshop workflow"`,
    `        </div>\n        <div id="projectToolbarRoot"></div>\n        <nav aria-label="Workshop workflow"`
  );
  app = app.replace(
    `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountPackageController(root);refresh();}`,
    `function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountPackageController(root);mountProjectController(root);refresh();}`
  );
  app = app.replace(
    `refreshReviewControls();state.packageController?.refresh();refreshMaskToolButtons();`,
    `refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();`
  );
  app = app.replace(
    `function rerenderShell(){`,
    `// DOCUMENT_PROJECT_FULL_COMPLETION
function mountProjectController(root){
  if(!state.projectController){
    state.projectController=createProjectController({
      captureProjectSnapshot,
      restoreProjectSnapshot,
      resetProject:resetProjectState,
      renameProject,
      getProjectInfo:()=>({id:state.document.id,name:state.document.name,updatedAt:state.document.updatedAt}),
      getProjectFingerprint,
      isProjectEmpty:()=>state.sources.size===0&&frames().length===0,
      getProjectPreviewDataUrl,
      getJSZipClass:()=>window.JSZip,
      downloadBlob,
      alert:message=>window.alert(message),
      confirm:message=>window.confirm(message),
      prompt:(message,value)=>window.prompt(message,value)
    });
  }
  state.projectController.mount(root);
}

async function captureProjectSnapshot(){
  return createWorkshopProjectSnapshot({
    document:state.document,
    settings:state.settings,
    sources:state.sources,
    sourceLayouts:state.sourceLayouts,
    selectedFrameBySource:state.selectedFrameBySource,
    activeSourceId:state.activeSourceId,
    selectedFrameId:state.selectedFrameId,
    packageState:state.packageController?.exportState?.()||null,
    metadata:{previewDataUrl:getProjectPreviewDataUrl()}
  });
}

async function restoreProjectSnapshot(snapshot){
  const restoredSources=new Map();
  for(const source of snapshot.sources||[]){
    if(!source.uri)throw new Error(\`來源圖片缺失：\${source.name||source.id}\`);
    const img=await loadImage(source.uri);
    restoredSources.set(source.id,{...source,img,fileName:source.fileName||source.name});
  }
  const restoredFrames=[];
  for(const frame of snapshot.document?.frames||[]){
    const custom={...(frame.custom||{})};
    const mask=custom.protectMask;
    delete custom.protectMask;
    if(mask?.dataUrl){
      const maskImage=await loadImage(mask.dataUrl);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Number(mask.width)||maskImage.width||Math.round(frame.geometry?.width)||1);
      canvas.height=Math.max(1,Number(mask.height)||maskImage.height||Math.round(frame.geometry?.height)||1);
      canvas.getContext('2d').drawImage(maskImage,0,0,canvas.width,canvas.height);
      custom.protectMaskCanvas=canvas;
    }
    restoredFrames.push({...frame,custom});
  }
  state.document={...snapshot.document,id:snapshot.id||snapshot.document.id,name:snapshot.name||snapshot.document.name,frames:restoredFrames,sourceRefs:(snapshot.sources||[]).map(source=>{const{img,...ref}=source;return ref;})};
  state.sources=restoredSources;
  state.sourceLayouts=new Map(snapshot.sourceLayouts||[]);
  state.selectedFrameBySource=new Map(snapshot.selectedFrameBySource||[]);
  state.settings={...cloneDefaultSettings(),...(snapshot.settings||{})};
  state.activeSourceId=snapshot.ui?.activeSourceId&&restoredSources.has(snapshot.ui.activeSourceId)?snapshot.ui.activeSourceId:[...restoredSources.keys()][0]||null;
  state.selectedFrameId=(snapshot.ui?.selectedFrameId&&restoredFrames.some(frame=>frame.id===snapshot.ui.selectedFrameId))?snapshot.ui.selectedFrameId:restoredFrames[0]?.id||null;
  state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;state.maskHistories.clear();state.refineAppliedAt.clear();
  resetFrameHistory();resetRefineViewport();resetReviewViewport();
  state.packageController?.importState?.(snapshot.packageState||null);
  renderAll();rerenderShell();
}

async function resetProjectState(){
  state.document=createDocument({name:'Sticker Package Project'});
  state.sources=new Map();state.sourceLayouts=new Map();state.selectedFrameBySource=new Map();state.activeSourceId=null;state.selectedFrameId=null;
  state.settings=cloneDefaultSettings();state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;state.maskHistories.clear();state.refineAppliedAt.clear();
  state.packageController?.importState?.(null);resetFrameHistory();resetRefineViewport();resetReviewViewport();rerenderShell();
}

function renameProject(name){state.document={...state.document,name:String(name||'Untitled Project'),updatedAt:new Date().toISOString()};}
function cloneDefaultSettings(){return typeof structuredClone==='function'?structuredClone(DEFAULT_SETTINGS):JSON.parse(JSON.stringify(DEFAULT_SETTINGS));}
function getProjectPreviewDataUrl(){const frame=selectedFrame()||frames()[0];const canvas=frame?renderFrame(frame):null;return canvas?.toDataURL?.('image/png')||activeSource()?.uri||null;}
async function getProjectFingerprint(){
  const frameState=frames().map(frame=>({id:frame.id,sourceImageId:frame.sourceImageId,geometry:frame.geometry,state:frame.state,custom:{offsetX:frame.custom?.offsetX||0,offsetY:frame.custom?.offsetY||0,maskVersion:frame.custom?.maskVersion||0,outputRole:frame.custom?.outputRole||null}}));
  return JSON.stringify({id:state.document.id,name:state.document.name,sources:[...state.sources.values()].map(source=>({id:source.id,name:source.name,width:source.width,height:source.height,uriLength:source.uri?.length||0})),layouts:[...state.sourceLayouts.entries()],frames:frameState,settings:state.settings,packageState:state.packageController?.exportState?.()||null});
}

function rerenderShell(){`
  );
}

await writeFile(packagePath, packageController, 'utf8');
await writeFile(appPath, app, 'utf8');
console.log('Document and Project completion bridge applied.');
