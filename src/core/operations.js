import { createId } from './project.js';

export const OperationTypes = Object.freeze({
  GRID_SLICE: 'grid.slice',
  CROP: 'image.crop',
  REMOVE_BACKGROUND: 'image.removeBackground',
  MASK: 'image.mask',
  BORDER: 'style.border',
  SHADOW: 'style.shadow',
  ALIGN: 'layout.align',
  SORT: 'package.sort',
  ROLE: 'package.role'
});

export function createOperation(type, target, params = {}) {
  if (!type) throw new Error('Operation type is required.');
  if (!target) throw new Error('Operation target is required.');
  return {
    id: createId('op'),
    type,
    target,
    params,
    createdAt: new Date().toISOString()
  };
}

export function addOperation(project, operation) {
  return {
    ...project,
    operations: [...project.operations, operation],
    updatedAt: new Date().toISOString()
  };
}

export function getOperationsForArtwork(project, artworkId) {
  return project.operations.filter(op => op.target === 'all' || op.target === artworkId);
}

export function getOperationsByType(project, type) {
  return project.operations.filter(op => op.type === type);
}
