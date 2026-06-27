import { createId } from './workspace-schema.js';

export function createCollection({ name = 'Untitled Collection', maxArtwork = null } = {}) {
  const now = new Date().toISOString();
  return {
    id: createId('collection'),
    name,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    maxArtwork,
    assetRefs: [],
    artworkRefs: [],
    operations: [],
    metadata: {},
    packagePlans: []
  };
}

export function assertCollectionLimit(collection, nextArtworkCount) {
  if (collection.maxArtwork !== null && nextArtworkCount > collection.maxArtwork) {
    throw new Error(`Collection artwork limit exceeded: ${nextArtworkCount}/${collection.maxArtwork}`);
  }
  return true;
}

export function touchCollection(collection) {
  return {
    ...collection,
    updatedAt: new Date().toISOString()
  };
}

export function addArtworkRef(collection, artworkRef) {
  assertCollectionLimit(collection, collection.artworkRefs.length + 1);
  return touchCollection({
    ...collection,
    artworkRefs: [...collection.artworkRefs, artworkRef]
  });
}
