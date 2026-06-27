import { STICKIO_SCHEMA_VERSION } from './types.js';

export function createProject({ name = 'Untitled Project' } = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: STICKIO_SCHEMA_VERSION,
    id: createId('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
    artworks: [],
    operations: [],
    destinations: [],
    packages: [],
    metadata: {}
  };
}

export function touchProject(project) {
  return {
    ...project,
    updatedAt: new Date().toISOString()
  };
}

export function assertProject(project) {
  if (!project || typeof project !== 'object') throw new Error('Invalid project document.');
  if (!project.schemaVersion) throw new Error('Project schemaVersion is required.');
  if (!Array.isArray(project.assets)) throw new Error('Project assets must be an array.');
  if (!Array.isArray(project.artworks)) throw new Error('Project artworks must be an array.');
  if (!Array.isArray(project.operations)) throw new Error('Project operations must be an array.');
  return true;
}

export function serializeProject(project) {
  assertProject(project);
  return JSON.stringify(touchProject(project), null, 2);
}

export function parseProject(json) {
  const project = typeof json === 'string' ? JSON.parse(json) : json;
  assertProject(project);
  return project;
}

export function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
