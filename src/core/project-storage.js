import { migrateWorkshopProject, projectSummary } from './project-workflow.js';

export const PROJECT_DATABASE_NAME = 'stixio-workspace';
export const PROJECT_DATABASE_VERSION = 1;
export const PROJECT_STORE = 'projects';
export const PROJECT_AUTOSAVE_STORE = 'autosaves';

export class MemoryProjectStorage {
  constructor() {
    this.projects = new Map();
    this.autosaves = new Map();
  }

  async saveProject(snapshot) {
    const project = stampProject(snapshot);
    this.projects.set(project.id, clone(project));
    return clone(project);
  }

  async loadProject(id) {
    const value = this.projects.get(id);
    return value ? clone(value) : null;
  }

  async listProjects() {
    return [...this.projects.values()]
      .map(projectSummary)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async deleteProject(id) {
    return this.projects.delete(id);
  }

  async duplicateProject(id, { name = null } = {}) {
    const source = await this.loadProject(id);
    if (!source) return null;
    const duplicate = stampProject({
      ...source,
      id: createId('project'),
      name: name || `${source.name} Copy`,
      createdAt: new Date().toISOString()
    });
    this.projects.set(duplicate.id, clone(duplicate));
    return clone(duplicate);
  }

  async saveAutosave(snapshot) {
    const project = stampProject(snapshot);
    this.autosaves.set(project.id, clone(project));
    return clone(project);
  }

  async loadAutosave(id) {
    const value = this.autosaves.get(id);
    return value ? clone(value) : null;
  }

  async getLatestAutosave() {
    const values = [...this.autosaves.values()]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return values.length ? clone(values[0]) : null;
  }

  async clearAutosave(id) {
    return this.autosaves.delete(id);
  }

  async clearAll() {
    this.projects.clear();
    this.autosaves.clear();
  }
}

export class IndexedDbProjectStorage {
  constructor({
    indexedDBImpl = globalThis.indexedDB,
    databaseName = PROJECT_DATABASE_NAME,
    databaseVersion = PROJECT_DATABASE_VERSION
  } = {}) {
    if (!indexedDBImpl) throw new Error('IndexedDB is not available.');
    this.indexedDB = indexedDBImpl;
    this.databaseName = databaseName;
    this.databaseVersion = databaseVersion;
    this.databasePromise = null;
  }

  async open() {
    if (!this.databasePromise) this.databasePromise = openDatabase(this.indexedDB, this.databaseName, this.databaseVersion);
    return this.databasePromise;
  }

  async saveProject(snapshot) {
    const project = stampProject(snapshot);
    const db = await this.open();
    await requestTransaction(db, PROJECT_STORE, 'readwrite', store => store.put(project));
    return clone(project);
  }

  async loadProject(id) {
    const db = await this.open();
    const value = await requestTransaction(db, PROJECT_STORE, 'readonly', store => store.get(id));
    return value ? migrateWorkshopProject(value) : null;
  }

  async listProjects() {
    const db = await this.open();
    const values = await requestTransaction(db, PROJECT_STORE, 'readonly', store => store.getAll());
    return (values || [])
      .map(projectSummary)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async deleteProject(id) {
    const db = await this.open();
    await requestTransaction(db, PROJECT_STORE, 'readwrite', store => store.delete(id));
    return true;
  }

  async duplicateProject(id, { name = null } = {}) {
    const source = await this.loadProject(id);
    if (!source) return null;
    const duplicate = stampProject({
      ...source,
      id: createId('project'),
      name: name || `${source.name} Copy`,
      createdAt: new Date().toISOString()
    });
    await this.saveProject(duplicate);
    return duplicate;
  }

  async saveAutosave(snapshot) {
    const project = stampProject(snapshot);
    const db = await this.open();
    await requestTransaction(db, PROJECT_AUTOSAVE_STORE, 'readwrite', store => store.put(project));
    return clone(project);
  }

  async loadAutosave(id) {
    const db = await this.open();
    const value = await requestTransaction(db, PROJECT_AUTOSAVE_STORE, 'readonly', store => store.get(id));
    return value ? migrateWorkshopProject(value) : null;
  }

  async getLatestAutosave() {
    const db = await this.open();
    const values = await requestTransaction(db, PROJECT_AUTOSAVE_STORE, 'readonly', store => store.getAll());
    const latest = (values || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    return latest ? migrateWorkshopProject(latest) : null;
  }

  async clearAutosave(id) {
    const db = await this.open();
    await requestTransaction(db, PROJECT_AUTOSAVE_STORE, 'readwrite', store => store.delete(id));
    return true;
  }

  async clearAll() {
    const db = await this.open();
    await Promise.all([
      requestTransaction(db, PROJECT_STORE, 'readwrite', store => store.clear()),
      requestTransaction(db, PROJECT_AUTOSAVE_STORE, 'readwrite', store => store.clear())
    ]);
  }
}

export function createProjectStorage(options = {}) {
  if (options.provider === 'memory' || !options.indexedDBImpl && !globalThis.indexedDB) return new MemoryProjectStorage();
  return new IndexedDbProjectStorage(options);
}

function openDatabase(indexedDBImpl, name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(PROJECT_AUTOSAVE_STORE)) {
        const store = db.createObjectStore(PROJECT_AUTOSAVE_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open project database.'));
    request.onblocked = () => reject(new Error('Project database upgrade is blocked by another tab.'));
  });
}

function requestTransaction(db, storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('Project storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Project storage transaction was aborted.'));
  });
}

function stampProject(snapshot) {
  const migrated = migrateWorkshopProject(snapshot);
  return {
    ...migrated,
    updatedAt: new Date().toISOString()
  };
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
