export class WorkspaceStorageAdapter {
  constructor({ provider = 'memory' } = {}) {
    this.provider = provider;
  }

  async initializeWorkspace(_workspace) {
    throw new Error('initializeWorkspace() must be implemented by a storage adapter.');
  }

  async readManifest(_workspaceRef) {
    throw new Error('readManifest() must be implemented by a storage adapter.');
  }

  async writeManifest(_workspace) {
    throw new Error('writeManifest() must be implemented by a storage adapter.');
  }

  async readCollection(_collectionRef) {
    throw new Error('readCollection() must be implemented by a storage adapter.');
  }

  async writeCollection(_workspace, _collection) {
    throw new Error('writeCollection() must be implemented by a storage adapter.');
  }

  async writeReadme(_workspace) {
    throw new Error('writeReadme() must be implemented by a storage adapter.');
  }
}

export class MemoryWorkspaceStorageAdapter extends WorkspaceStorageAdapter {
  constructor() {
    super({ provider: 'memory' });
    this.manifest = null;
    this.collections = new Map();
    this.files = new Map();
  }

  async initializeWorkspace(workspace) {
    this.manifest = workspace;
    this.files.set('README.txt', createWorkspaceReadme(workspace));
    return workspace;
  }

  async readManifest() {
    return this.manifest;
  }

  async writeManifest(workspace) {
    this.manifest = workspace;
    return workspace;
  }

  async readCollection(collectionRef) {
    return this.collections.get(collectionRef.id || collectionRef) || null;
  }

  async writeCollection(_workspace, collection) {
    this.collections.set(collection.id, collection);
    return collection;
  }

  async writeReadme(workspace) {
    const readme = createWorkspaceReadme(workspace);
    this.files.set('README.txt', readme);
    return readme;
  }
}

export function createWorkspaceReadme(workspace) {
  return `This folder is managed by Stixio.\n\nWorkspace: ${workspace.name}\nSchema: ${workspace.schemaVersion}\n\nDo not rename internal folders unless you know what you are doing.\n`;
}
