import { cloneRegion } from './region.js';

export function selectRegion(regions, regionId, { multi = false } = {}) {
  return regions.map(region => cloneRegion(region, {
    selected: multi ? (region.id === regionId ? !region.selected : region.selected) : region.id === regionId
  }));
}

export function clearSelection(regions) {
  return regions.map(region => cloneRegion(region, { selected: false }));
}

export function getSelectedRegions(regions) {
  return regions.filter(region => region.selected);
}

export function getPrimarySelectedRegion(regions) {
  return getSelectedRegions(regions)[0] || null;
}

export function selectNextRegion(regions, currentId) {
  if (!regions.length) return regions;
  const currentIndex = Math.max(0, regions.findIndex(region => region.id === currentId));
  const next = regions[(currentIndex + 1) % regions.length];
  return selectRegion(regions, next.id);
}

export function selectPreviousRegion(regions, currentId) {
  if (!regions.length) return regions;
  const currentIndex = Math.max(0, regions.findIndex(region => region.id === currentId));
  const next = regions[(currentIndex - 1 + regions.length) % regions.length];
  return selectRegion(regions, next.id);
}
