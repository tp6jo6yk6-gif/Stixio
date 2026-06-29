import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing Layout migration target: ${label}`);
  source = source.replace(from, to);
}

function replaceRegex(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Missing Layout migration pattern: ${label}`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  '  addSourceRef,\n  setDocumentFrames,',
  '  addSourceRef,\n  removeSourceRef,\n  setDocumentFrames,',
  'removeSourceRef import'
);

replaceOnce(
  '  renderWorkshopFrame,\n  estimateCanvasPngBytes\n} from',
  '  renderWorkshopFrame,\n  estimateCanvasPngBytes,\n  mergeDetectedFrameStates,\n  getNextSourceId\n} from',
  'Layout recovery imports'
);

replaceOnce(
  '  sourceLayouts: new Map(),\n  activeSourceId: null,',
  '  sourceLayouts: new Map(),\n  selectedFrameBySource: new Map(),\n  activeSourceId: null,',
  'per-source selected frame state'
);

replaceOnce(
  "function activateSource(sourceId){state.activeSourceId=sourceId;state.settings=applySourceLayoutSettings(state.settings,sourceLayout(sourceId));const first=frames().find(frame=>frame.sourceImageId===sourceId);if(first)state.selectedFrameId=first.id;rerenderShell();}",
  `function activateSource(sourceId){\n  if(!state.sources.has(sourceId))return;\n  if(state.activeSourceId&&state.selectedFrameId)state.selectedFrameBySource.set(state.activeSourceId,state.selectedFrameId);\n  state.activeSourceId=sourceId;\n  state.settings=applySourceLayoutSettings(state.settings,sourceLayout(sourceId));\n  const sourceFrames=frames().filter(frame=>frame.sourceImageId===sourceId);\n  const rememberedId=state.selectedFrameBySource.get(sourceId);\n  const selected=sourceFrames.find(frame=>frame.id===rememberedId)||sourceFrames[0]||null;\n  state.selectedFrameId=selected?.id||null;\n  if(selected)state.selectedFrameBySource.set(sourceId,selected.id);\n  rerenderShell();\n}\nfunction selectFrame(frameId){\n  const frame=frames().find(item=>item.id===frameId);\n  if(!frame)return;\n  if(state.activeSourceId&&state.selectedFrameId)state.selectedFrameBySource.set(state.activeSourceId,state.selectedFrameId);\n  state.activeSourceId=frame.sourceImageId;\n  state.settings=applySourceLayoutSettings(state.settings,sourceLayout(frame.sourceImageId));\n  state.selectedFrameId=frame.id;\n  state.selectedFrameBySource.set(frame.sourceImageId,frame.id);\n}`,
  'source activation'
);

replaceRegex(
  /function detectSource\(sourceId\) \{[\s\S]*?\n\}\n\nfunction frames\(\)/,
  `function detectSource(sourceId) {\n  const source = state.sources.get(sourceId); if(!source)return;\n  const layout = sourceLayout(sourceId);\n  const previousFrames=frames().filter(frame=>frame.sourceImageId===sourceId);\n  let report;\n  if(layout.layoutMode==='auto') report=detectProjectionGrid(source,{chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,tighten:true});\n  else {\n    report=detectGrid(source,{grid:{rows:layout.rows,cols:layout.cols,marginX:layout.marginX,marginY:layout.marginY,gapX:layout.gapX,gapY:layout.gapY,snapToPixels:true,minCellSize:8}});\n    report.frames=tightenFramesToContent(source,report.frames,{padding:4,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance});\n  }\n  const oldFrames=frames().filter(frame=>frame.sourceImageId!==sourceId);\n  const newFrames=mergeDetectedFrameStates(previousFrames,report.frames,{\n    defaultRole:AssetRoles.STICKER,\n    createName:(_,index)=>\`\${stripExtension(source.name)} \${String(index+1).padStart(2,'0')}\`,\n    resizeMask:(mask,width,height)=>resizeMaskCanvas(mask,width,height)\n  });\n  setFrames([...oldFrames,...newFrames]);\n  const rememberedId=state.selectedFrameBySource.get(sourceId);\n  const selected=newFrames.find(frame=>frame.id===rememberedId)||newFrames[0]||null;\n  state.selectedFrameId=selected?.id||state.selectedFrameId;\n  if(selected)state.selectedFrameBySource.set(sourceId,selected.id);\n  resetFrameHistory(); clearRenderCache(); renderAll();\n}\n\nfunction frames()`,
  'state-preserving redetection'
);

replaceRegex(
  /function renderSourceList\(\)\{[\s\S]*?\}\n\nfunction drawSourceCanvas/,
  `function renderSourceList(){\n  const holder=document.getElementById('sourceList');if(!holder)return;\n  if(!state.sources.size){holder.innerHTML='<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">尚無原圖</div>';return;}\n  holder.innerHTML='';\n  state.sources.forEach(source=>{\n    const layout=sourceLayout(source.id);\n    const row=document.createElement('div');\n    row.className=\`grid grid-cols-[1fr_auto] gap-2 rounded-2xl border p-2 \${source.id===state.activeSourceId?'border-emerald-400 bg-emerald-50':'border-slate-200'}\`;\n    const button=document.createElement('button');\n    button.className='flex min-w-0 items-center gap-3 text-left';\n    button.innerHTML=\`<img src="\${source.uri}" class="h-12 w-12 rounded-xl object-cover"><div class="min-w-0"><div class="truncate text-xs font-black">\${escapeHtml(source.name)}</div><div class="text-[10px] text-slate-400">\${source.width}×\${source.height} · \${layout.layoutMode} · \${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames</div></div>\`;\n    button.addEventListener('click',()=>activateSource(source.id));\n    const remove=document.createElement('button');\n    remove.type='button';\n    remove.title='刪除此原圖與其 Frames';\n    remove.className='rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-700';\n    remove.textContent='刪除';\n    remove.addEventListener('click',event=>{event.stopPropagation();deleteSource(source.id);});\n    row.append(button,remove);holder.appendChild(row);\n  });\n}\n\nfunction drawSourceCanvas`,
  'source list delete controls'
);

replaceOnce(
  "function sourcePointerDown(event){const source=activeSource();if(!source)return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromSource(point);return;}const hit=hitTestFrame(point);if(!hit)return;state.selectedFrameId=hit.frame.id;state.frameDrag={frameId:hit.frame.id,handle:hit.handle,start:point,startGeometry:{...hit.frame.geometry},before:frameSnapshot()};event.currentTarget.setPointerCapture?.(event.pointerId);refresh();}",
  "function sourcePointerDown(event){const source=activeSource();if(!source)return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromSource(point);return;}const hit=hitTestFrame(point);if(!hit)return;selectFrame(hit.frame.id);state.frameDrag={frameId:hit.frame.id,handle:hit.handle,start:point,startGeometry:{...hit.frame.geometry},before:frameSnapshot()};event.currentTarget.setPointerCapture?.(event.pointerId);refresh();}",
  'frame selection sync'
);

source = source.replace(
  "card.querySelector('.preview').addEventListener('click',()=>{state.selectedFrameId=frame.id;state.activeSourceId=frame.sourceImageId;state.settings=applySourceLayoutSettings(state.settings,sourceLayout(frame.sourceImageId));refresh();});",
  "card.querySelector('.preview').addEventListener('click',()=>{selectFrame(frame.id);refresh();});"
);

replaceOnce(
  'function detectActiveSource(){if(!state.activeSourceId)return;readGridSettings();detectSource(state.activeSourceId);refresh();}',
  `function deleteSource(sourceId){\n  const source=state.sources.get(sourceId);if(!source)return;\n  if(!window.confirm(\`確定刪除「\${source.name}」及其所有 Frames？\`))return;\n  const sourceIds=[...state.sources.keys()];\n  const nextSourceId=getNextSourceId(sourceIds,sourceId);\n  const removedFrames=frames().filter(frame=>frame.sourceImageId===sourceId);\n  removedFrames.forEach(frame=>{state.rendered.delete(frame.id);state.renderKeys.delete(frame.id);state.maskHistories.delete(frame.id);});\n  state.sources.delete(sourceId);\n  state.sourceLayouts.delete(sourceId);\n  state.selectedFrameBySource.delete(sourceId);\n  state.document=removeSourceRef(state.document,sourceId);\n  state.activeSourceId=nextSourceId;\n  if(nextSourceId){\n    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(nextSourceId));\n    const sourceFrames=frames().filter(frame=>frame.sourceImageId===nextSourceId);\n    const remembered=state.selectedFrameBySource.get(nextSourceId);\n    const selected=sourceFrames.find(frame=>frame.id===remembered)||sourceFrames[0]||null;\n    state.selectedFrameId=selected?.id||null;\n  }else{\n    state.selectedFrameId=null;\n  }\n  resetFrameHistory();clearRenderCache();renderAll();rerenderShell();\n}\n\nfunction detectActiveSource(){if(!state.activeSourceId)return;readGridSettings();detectSource(state.activeSourceId);refresh();}`,
  'delete source workflow'
);

await writeFile(path, source, 'utf8');
console.log('Layout recovery migration applied.');
