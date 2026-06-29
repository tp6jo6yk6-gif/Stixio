// Document Engine
// A Document is the active editable unit inside a Collection.
// Workspace > Collection > Document > Source Image > Frame

export const DOCUMENT_SCHEMA_VERSION = '1.0.0';

export function createDocument({
  id = createId('doc'),
  name = 'Untitled Document',
  sourceRefs = [],
  frames = [],
  operations = [],
  packagePlans = [],
  metadata = {}
} = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    sourceRefs,
    frames,
    operations,
    packagePlans,
    metadata
  };
}

export function assertDocument(document) {
  if (!document || typeof document !== 'object') throw new Error('Invalid document.');
  if (!document.schemaVersion) throw new Error('Document schemaVersion is required.');
  if (!document.id) throw new Error('Document id is required.');
  if (!Array.isArray(document.sourceRefs)) throw new Error('Document sourceRefs must be an array.');
  if (!Array.isArray(document.frames)) throw new Error('Document frames must be an array.');
  return true;
}

export function touchDocument(document) {
  return {
    ...document,
    updatedAt: new Date().toISOString()
  };
}

export function addSourceRef(document, sourceRef) {
  assertDocument(document);
  return touchDocument({
    ...document,
    sourceRefs: [...document.sourceRefs, sourceRef]
  });
}

export function removeSourceRef(document, sourceId) {
  assertDocument(document);
  return touchDocument({
    ...document,
    sourceRefs: document.sourceRefs.filter(source => source.id !== sourceId),
    frames: document.frames.filter(frame => frame.sourceImageId !== sourceId)
  });
}

export function setDocumentFrames(document, frames) {
  assertDocument(document);
  return touchDocument({
    ...document,
    frames
  });
}

export function updateDocumentFrame(document, frameId, updater) {
  assertDocument(document);
  return touchDocument({
    ...document,
    frames: document.frames.map(frame => frame.id === frameId ? updater(frame) : frame)
  });
}

export function addPackagePlan(document, packagePlan) {
  assertDocument(document);
  return touchDocument({
    ...document,
    packagePlans: [...document.packagePlans, packagePlan]
  });
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
