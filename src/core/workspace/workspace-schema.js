export const WORKSPACE_SCHEMA_VERSION = '1.0.0';

export const WORKSPACE_FOLDERS = Object.freeze({
  collections: 'Collections',
  assets: 'Assets',
  templates: 'Templates',
  presets: 'Presets',
  prompts: 'Prompts',
  exports: 'Exports',
  trash: 'Trash'
});

export function createWorkspaceManifest({
  id = createId('workspace'),
  name = 'Stixio Workspace',
  storageProvider = 'local',
  rootRef = null
} = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    id,
    name,
    storageProvider,
    rootRef,
    createdAt: now,
    updatedAt: now,
    folders: { ...WORKSPACE_FOLDERS },
    collections: [],
    assets: [],
    templates: [],
    presets: [],
    prompts: [],
    metadata: {}
  };
}

export function assertWorkspaceManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid workspace manifest.');
  if (!manifest.schemaVersion) throw new Error('Workspace schemaVersion is required.');
  if (!manifest.id) throw new Error('Workspace id is required.');
  if (!manifest.folders) throw new Error('Workspace folders are required.');
  return true;
}

export function touchWorkspace(manifest) {
  return {
    ...manifest,
    updatedAt: new Date().toISOString()
  };
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
