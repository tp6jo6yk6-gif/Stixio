// Source Image Model
// Source images are original assets. They are not modified by render or package operations.

export function createSourceImageRef({
  id = createId('source'),
  assetId = null,
  provider = 'local',
  uri = null,
  name = 'source image',
  width = null,
  height = null,
  mimeType = '',
  metadata = {}
} = {}) {
  return {
    id,
    assetId,
    provider,
    uri,
    name,
    width,
    height,
    mimeType,
    metadata
  };
}

export function assertSourceImageRef(sourceRef) {
  if (!sourceRef || typeof sourceRef !== 'object') throw new Error('Invalid source image reference.');
  if (!sourceRef.id) throw new Error('Source image id is required.');
  if (!sourceRef.provider) throw new Error('Source image provider is required.');
  return true;
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
