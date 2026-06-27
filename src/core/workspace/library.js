import { createId } from './workspace-schema.js';

export function createAssetRecord({ name, provider = 'local', ref, mimeType = '', size = null, metadata = {} } = {}) {
  return {
    id: createId('asset'),
    name,
    provider,
    ref,
    mimeType,
    size,
    createdAt: new Date().toISOString(),
    metadata
  };
}

export function createTemplateRecord({ name, destinationKey = null, settings = {}, metadata = {} } = {}) {
  return {
    id: createId('template'),
    name,
    destinationKey,
    settings,
    createdAt: new Date().toISOString(),
    metadata
  };
}

export function createPresetRecord({ name, operations = [], settings = {}, metadata = {} } = {}) {
  return {
    id: createId('preset'),
    name,
    operations,
    settings,
    createdAt: new Date().toISOString(),
    metadata
  };
}

export function createPromptRecord({ name, prompt = '', negativePrompt = '', metadata = {} } = {}) {
  return {
    id: createId('prompt'),
    name,
    prompt,
    negativePrompt,
    createdAt: new Date().toISOString(),
    metadata
  };
}

export function addLibraryRecord(workspace, key, record) {
  if (!Array.isArray(workspace[key])) throw new Error(`Unknown workspace library: ${key}`);
  return {
    ...workspace,
    [key]: [...workspace[key], record],
    updatedAt: new Date().toISOString()
  };
}

export function removeLibraryRecord(workspace, key, id) {
  if (!Array.isArray(workspace[key])) throw new Error(`Unknown workspace library: ${key}`);
  return {
    ...workspace,
    [key]: workspace[key].filter(item => item.id !== id),
    updatedAt: new Date().toISOString()
  };
}
