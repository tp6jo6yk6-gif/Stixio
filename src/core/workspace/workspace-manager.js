import { createWorkspaceManifest, assertWorkspaceManifest, touchWorkspace } from './workspace-schema.js';
import { createCollection } from './collection.js';

export function createWorkspace(options = {}) {
  return createWorkspaceManifest(options);
}

export function addCollection(workspace, collectionOptions = {}) {
  assertWorkspaceManifest(workspace);
  const collection = createCollection(collectionOptions);
  return {
    workspace: touchWorkspace({
      ...workspace,
      collections: [...workspace.collections, toCollectionSummary(collection)]
    }),
    collection
  };
}

export function removeCollection(workspace, collectionId) {
  assertWorkspaceManifest(workspace);
  return touchWorkspace({
    ...workspace,
    collections: workspace.collections.filter(item => item.id !== collectionId)
  });
}

export function updateCollectionSummary(workspace, collection) {
  assertWorkspaceManifest(workspace);
  const summary = toCollectionSummary(collection);
  const exists = workspace.collections.some(item => item.id === collection.id);
  return touchWorkspace({
    ...workspace,
    collections: exists
      ? workspace.collections.map(item => item.id === collection.id ? summary : item)
      : [...workspace.collections, summary]
  });
}

export function toCollectionSummary(collection) {
  return {
    id: collection.id,
    name: collection.name,
    status: collection.status,
    artworkCount: collection.artworkRefs?.length || 0,
    updatedAt: collection.updatedAt
  };
}
