import { readFile, writeFile } from 'node:fs/promises';

const appPath = 'src/ui/stixio-workshop-app-v2.js';
const workflowPath = 'src/core/project-workflow.js';
const appMarker = '// PROJECT_BLOB_ASSETS_V1';
const workflowMarker = '// PROJECT_ARCHIVE_BLOB_ASSETS_V1';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found.`);
  return source.replace(before, after);
}

async function patchProjectWorkflow() {
  let source = await readFile(workflowPath, 'utf8');
  if (source.includes(workflowMarker)) {
    console.log('Project Blob archive support already present.');
    return;
  }

  const archiveBefore = `  archiveSnapshot.sources = archiveSnapshot.sources.map(source => {
    const extension = extensionForMime(source.mimeType || mimeFromDataUrl(source.uri));
    const assetPath = \`assets/\${sanitizeArchiveId(source.id)}.\${extension}\`;
    const bytes = dataUrlBytes(source.uri);
    if (!bytes.length) throw new Error(\`Source asset is missing: \${source.name || source.id}.\`);
    zip.file(assetPath, bytes);
    checksumInputs.push({ path: assetPath, bytes });
    requiredPaths.push(assetPath);
    const next = { ...source, uri: null, assetPath };
    return next;
  });`;

  const archiveAfter = `  ${workflowMarker}
  archiveSnapshot.sources = await Promise.all(archiveSnapshot.sources.map(async source => {
    const sourceBlob = source.blob instanceof Blob ? source.blob : null;
    const mimeType = source.mimeType || sourceBlob?.type || mimeFromDataUrl(source.uri);
    const extension = extensionForMime(mimeType);
    const assetPath = \`assets/\${sanitizeArchiveId(source.id)}.\${extension}\`;
    const bytes = sourceBlob
      ? new Uint8Array(await sourceBlob.arrayBuffer())
      : dataUrlBytes(source.uri);
    if (!bytes.length) throw new Error(\`Source asset is missing: \${source.name || source.id}.\`);
    zip.file(assetPath, bytes);
    checksumInputs.push({ path: assetPath, bytes });
    requiredPaths.push(assetPath);
    const next = { ...source, mimeType, uri: null, assetPath };
    delete next.blob;
    delete next.objectUrl;
    return next;
  }));`;
  source = replaceOnce(source, archiveBefore, archiveAfter, 'Blob archive source write');

  const parseBefore = `  for (const source of snapshot.sources) {
    if (!source.assetPath) continue;
    const file = archive.file?.(source.assetPath) || archive.files?.[source.assetPath];
    if (!file) throw new Error(\`Project archive is missing source asset \${source.assetPath}.\`);
    const base64 = await file.async('base64');
    source.uri = \`data:\${source.mimeType || mimeForExtension(source.assetPath)};base64,\${base64}\`;
  }`;
  const parseAfter = `  for (const source of snapshot.sources) {
    if (!source.assetPath) continue;
    const file = archive.file?.(source.assetPath) || archive.files?.[source.assetPath];
    if (!file) throw new Error(\`Project archive is missing source asset \${source.assetPath}.\`);
    const bytes = await file.async('uint8array');
    source.mimeType = source.mimeType || mimeForExtension(source.assetPath);
    source.blob = new Blob([bytes], { type: source.mimeType });
    source.uri = null;
  }`;
  source = replaceOnce(source, parseBefore, parseAfter, 'Blob archive source read');

  const stripBefore = `function stripRuntimeSourceFields(source) {
  const { img: _img, bitmap: _bitmap, canvas: _canvas, ...rest } = source || {};
  return cloneSerializable(rest);
}`;
  const stripAfter = `function stripRuntimeSourceFields(source) {
  const { img: _img, bitmap: _bitmap, canvas: _canvas, objectUrl: _objectUrl, ...rest } = source || {};
  const cloned = cloneSerializable(rest);
  if (cloned?.blob && String(cloned.uri || '').startsWith('blob:')) cloned.uri = null;
  return cloned;
}`;
  source = replaceOnce(source, stripBefore, stripAfter, 'Runtime source field stripping');

  await writeFile(workflowPath, source);
  console.log('Project Blob archive support installed.');
}

async function patchWorkshopApp() {
  let source = await readFile(appPath, 'utf8');
  if (source.includes(appMarker)) {
    console.log('Workshop Blob source support already present.');
    return;
  }

  const captureBefore = `async function captureProjectSnapshot(){
  return createWorkshopProjectSnapshot({
    document:state.document,
    settings:state.settings,
    sources:state.sources,
    sourceLayouts:state.sourceLayouts,
    selectedFrameBySource:state.selectedFrameBySource,
    activeSourceId:state.activeSourceId,
    selectedFrameId:state.selectedFrameId,
    packageState:state.packageController?.exportState?.()||null,
    destinationState:state.destinationController?.exportState?.()||null,
    metadata:{previewDataUrl:getProjectPreviewDataUrl()}
  });
}`;
  const captureAfter = `${appMarker}
async function captureProjectSnapshot(){
  const snapshotSources=[...state.sources.values()].map(source=>{
    const{img:ignoredImage,objectUrl:ignoredObjectUrl,...runtimeSource}=source;
    return{...runtimeSource,uri:String(runtimeSource.uri||'').startsWith('blob:')?null:runtimeSource.uri};
  });
  const documentSourceRefs=snapshotSources.map(source=>{const{blob:ignoredBlob,...ref}=source;return ref;});
  return createWorkshopProjectSnapshot({
    document:{...state.document,sourceRefs:documentSourceRefs},
    settings:state.settings,
    sources:snapshotSources,
    sourceLayouts:state.sourceLayouts,
    selectedFrameBySource:state.selectedFrameBySource,
    activeSourceId:state.activeSourceId,
    selectedFrameId:state.selectedFrameId,
    packageState:state.packageController?.exportState?.()||null,
    destinationState:state.destinationController?.exportState?.()||null,
    metadata:{previewDataUrl:getProjectPreviewDataUrl()}
  });
}`;
  source = replaceOnce(source, captureBefore, captureAfter, 'Blob project snapshot capture');

  const restoreBefore = `  const restoredSources=new Map();
  for(const source of snapshot.sources||[]){
    if(!source.uri)throw new Error(\`來源圖片缺失：\${source.name||source.id}\`);
    const img=await loadImage(source.uri);
    restoredSources.set(source.id,{...source,img,fileName:source.fileName||source.name});
  }`;
  const restoreAfter = `  const restoredSources=new Map();
  for(const source of snapshot.sources||[]){
    const runtimeSource=await createRuntimeSource(source);
    restoredSources.set(source.id,runtimeSource);
  }`;
  source = replaceOnce(source, restoreBefore, restoreAfter, 'Blob project restore');

  source = replaceOnce(
    source,
    `  state.sources=restoredSources;`,
    `  releaseAllSourceObjectUrls();
  state.sources=restoredSources;`,
    'Restored source URL release'
  );

  source = replaceOnce(
    source,
    `async function resetProjectState(){
  state.document=createDocument({name:'Sticker Package Project'});`,
    `async function resetProjectState(){
  releaseAllSourceObjectUrls();
  state.document=createDocument({name:'Sticker Package Project'});`,
    'Project reset URL release'
  );

  const importBefore = `  for (const file of files) {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const ref = createSourceImageRef({ name:file.name,width:img.width,height:img.height,mimeType:file.type,uri:dataUrl });
    state.sources.set(ref.id,{ ...ref, fileName:file.name, img });`;
  const importAfter = `  for (const file of files) {
    const objectUrl=URL.createObjectURL(file);
    let img;
    try{img=await loadImage(objectUrl);}catch(error){URL.revokeObjectURL(objectUrl);throw error;}
    const ref = createSourceImageRef({ name:file.name,width:img.width,height:img.height,mimeType:file.type,uri:objectUrl });
    state.sources.set(ref.id,{ ...ref, fileName:file.name, img, blob:file, objectUrl });`;
  source = replaceOnce(source, importBefore, importAfter, 'Blob image import');

  source = replaceOnce(
    source,
    `  state.sources.delete(sourceId);`,
    `  releaseSourceObjectUrl(source);
  state.sources.delete(sourceId);`,
    'Deleted source URL release'
  );

  source = replaceOnce(
    source,
    `function getProjectPreviewDataUrl(){const frame=selectedFrame()||frames()[0];const canvas=frame?renderFrame(frame):null;return canvas?.toDataURL?.('image/png')||activeSource()?.uri||null;}`,
    `function getProjectPreviewDataUrl(){const frame=selectedFrame()||frames()[0];const canvas=frame?renderFrame(frame):null;return canvas?.toDataURL?.('image/png')||null;}`,
    'Project preview Blob safety'
  );

  source = replaceOnce(
    source,
    `sources:[...state.sources.values()].map(source=>({id:source.id,name:source.name,width:source.width,height:source.height,uriLength:source.uri?.length||0}))`,
    `sources:[...state.sources.values()].map(source=>({id:source.id,name:source.name,width:source.width,height:source.height,assetBytes:source.blob?.size||source.uri?.length||0}))`,
    'Project fingerprint Blob size'
  );

  const helperBefore = `function readFileAsDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}`;
  const helperAfter = `async function createRuntimeSource(source){
  let blob=source.blob instanceof Blob?source.blob:null;
  if(!blob&&source.uri)blob=dataUrlToBlob(source.uri,source.mimeType);
  if(!blob)throw new Error(\`來源圖片缺失：\${source.name||source.id}\`);
  const objectUrl=URL.createObjectURL(blob);
  try{
    const img=await loadImage(objectUrl);
    return{...source,uri:objectUrl,blob,objectUrl,img,fileName:source.fileName||source.name};
  }catch(error){URL.revokeObjectURL(objectUrl);throw error;}
}
function dataUrlToBlob(dataUrl,fallbackType='application/octet-stream'){
  const match=String(dataUrl||'').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if(!match)return new Blob([String(dataUrl||'')],{type:fallbackType});
  const mimeType=match[1]||fallbackType,payload=match[3]||'';
  if(match[2]){const binary=atob(payload),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));return new Blob([bytes],{type:mimeType});}
  return new Blob([decodeURIComponent(payload)],{type:mimeType});
}
function releaseSourceObjectUrl(source){const url=source?.objectUrl||source?.uri;if(typeof url==='string'&&url.startsWith('blob:'))URL.revokeObjectURL(url);}
function releaseAllSourceObjectUrls(){state.sources.forEach(releaseSourceObjectUrl);}
function readFileAsDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}`;
  source = replaceOnce(source, helperBefore, helperAfter, 'Blob runtime source helpers');

  await writeFile(appPath, source);
  console.log('Workshop Blob source support installed.');
}

await patchProjectWorkflow();
await patchWorkshopApp();
