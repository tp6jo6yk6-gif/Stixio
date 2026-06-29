import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing Layout detail target: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  "    row.className=`grid grid-cols-[1fr_auto] gap-2 rounded-2xl border p-2 ${source.id===state.activeSourceId?'border-emerald-400 bg-emerald-50':'border-slate-200'}`;",
  "    row.className=`grid grid-cols-[1fr_auto] gap-2 rounded-2xl border p-2 ${source.id===state.activeSourceId?'border-emerald-400 bg-emerald-50':'border-slate-200'}`;\n    row.dataset.sourceId=source.id;\n    row.dataset.sourceActive=String(source.id===state.activeSourceId);",
  'source row acceptance attributes'
);

replaceOnce(
  "card.draggable=true;const kb=",
  "card.draggable=true;card.dataset.frameId=frame.id;card.dataset.sourceId=frame.sourceImageId;const kb=",
  'review frame acceptance attributes'
);

replaceOnce(
  "function duplicateSelectedFrame(){const frame=selectedFrame();if(!frame)return;const copy={...frame,id:createId('frame'),name:`${frame.name} Copy`,geometry:clampGeometry({...frame.geometry,x:frame.geometry.x+20,y:frame.geometry.y+20},sourceForFrame(frame)),custom:{...frame.custom,protectMaskCanvas:null,maskVersion:0},state:{...frame.state,packageRole:AssetRoles.STICKER}};applyFrameListChange('Duplicate Frame',[...frames(),copy],copy.id);}",
  `function duplicateSelectedFrame(){\n  const frame=selectedFrame();if(!frame)return;\n  const copy={...frame,id:createId('frame'),name:\`${'${frame.name}'} Copy\`,geometry:clampGeometry({...frame.geometry,x:frame.geometry.x+20,y:frame.geometry.y+20},sourceForFrame(frame)),custom:{...frame.custom,outputRole:AssetRoles.STICKER,protectMaskCanvas:null,maskVersion:0},state:{...frame.state,packageRole:AssetRoles.STICKER}};\n  const list=[...frames()];\n  const index=list.findIndex(item=>item.id===frame.id);\n  list.splice(index+1,0,copy);\n  applyFrameListChange('Duplicate Frame',list,copy.id,frame.sourceImageId);\n}`,
  'source-local duplicate'
);

replaceOnce(
  "function deleteSelectedFrame(){const frame=selectedFrame();if(!frame)return;const list=frames().filter(item=>item.id!==frame.id);applyFrameListChange('Delete Frame',list,list[0]?.id||null);}",
  `function deleteSelectedFrame(){\n  const frame=selectedFrame();if(!frame)return;\n  const before=frames();\n  const sourceFrames=before.filter(item=>item.sourceImageId===frame.sourceImageId);\n  const sourceIndex=sourceFrames.findIndex(item=>item.id===frame.id);\n  const list=before.filter(item=>item.id!==frame.id);\n  const remainingSourceFrames=list.filter(item=>item.sourceImageId===frame.sourceImageId);\n  const next=remainingSourceFrames[Math.min(sourceIndex,remainingSourceFrames.length-1)]||remainingSourceFrames[sourceIndex-1]||null;\n  applyFrameListChange('Delete Frame',list,next?.id||null,frame.sourceImageId);\n}`,
  'source-local delete'
);

replaceOnce(
  "function applyFrameSnapshot(snapshot){if(!snapshot)return;setFrames(cloneFrames(snapshot.frames));state.selectedFrameId=snapshot.selectedFrameId;clearRenderCache();renderAll();refresh();}",
  `function applyFrameSnapshot(snapshot){\n  if(!snapshot)return;\n  setFrames(cloneFrames(snapshot.frames));\n  const restored=frames().find(frame=>frame.id===snapshot.selectedFrameId)||null;\n  state.selectedFrameId=restored?.id||null;\n  if(restored){\n    state.activeSourceId=restored.sourceImageId;\n    state.selectedFrameBySource.set(restored.sourceImageId,restored.id);\n    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(restored.sourceImageId));\n  }\n  clearRenderCache();renderAll();refresh();\n}`,
  'history source context restore'
);

replaceOnce(
  "function applyFrameListChange(label,nextFrames,nextSelected){const before=frameSnapshot();setFrames(nextFrames);state.selectedFrameId=nextSelected;const after=frameSnapshot();commitFrameChange(label,before,after);clearRenderCache();renderAll();refresh();}",
  `function applyFrameListChange(label,nextFrames,nextSelected,sourceId=state.activeSourceId){\n  const before=frameSnapshot();\n  setFrames(nextFrames);\n  state.activeSourceId=sourceId||state.activeSourceId;\n  const selected=nextFrames.find(frame=>frame.id===nextSelected)||null;\n  state.selectedFrameId=selected?.id||null;\n  if(state.activeSourceId){\n    if(selected)state.selectedFrameBySource.set(state.activeSourceId,selected.id);\n    else state.selectedFrameBySource.delete(state.activeSourceId);\n    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(state.activeSourceId));\n  }\n  const after=frameSnapshot();commitFrameChange(label,before,after);clearRenderCache();renderAll();refresh();\n}`,
  'frame list context synchronization'
);

await writeFile(path, source, 'utf8');
console.log('Remaining Layout details applied.');
