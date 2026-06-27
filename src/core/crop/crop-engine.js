import { cloneRegion, createRegion, normalizeRect } from './region.js';

export function moveRegion(region, deltaX = 0, deltaY = 0) {
  if (region.locked) return region;
  return cloneRegion(region, {
    bounds: {
      ...region.bounds,
      x: region.bounds.x + deltaX,
      y: region.bounds.y + deltaY
    }
  });
}

export function resizeRegion(region, nextBounds) {
  if (region.locked) return region;
  return cloneRegion(region, { bounds: normalizeRect(nextBounds) });
}

export function rotateRegion(region, rotation = 0) {
  if (region.locked) return region;
  return cloneRegion(region, { rotation });
}

export function duplicateRegion(region, offset = { x: 24, y: 24 }) {
  return createRegion({
    ...region,
    id: undefined,
    name: `${region.name} Copy`,
    bounds: {
      ...region.bounds,
      x: region.bounds.x + offset.x,
      y: region.bounds.y + offset.y
    },
    selected: true
  });
}

export function deleteRegion(regions, regionId) {
  return regions.filter(region => region.id !== regionId);
}

export function updateRegion(regions, regionId, updater) {
  return regions.map(region => region.id === regionId ? updater(region) : region);
}

export function mergeRegions(regions, regionIds, name = 'Merged Sticker') {
  const selected = regions.filter(region => regionIds.includes(region.id));
  if (selected.length < 2) return regions;

  const minX = Math.min(...selected.map(region => region.bounds.x));
  const minY = Math.min(...selected.map(region => region.bounds.y));
  const maxX = Math.max(...selected.map(region => region.bounds.x + region.bounds.width));
  const maxY = Math.max(...selected.map(region => region.bounds.y + region.bounds.height));

  const merged = createRegion({
    name,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    },
    selected: true,
    metadata: {
      mergedFrom: regionIds
    }
  });

  return [
    ...regions.filter(region => !regionIds.includes(region.id)),
    merged
  ];
}

export function splitRegion(region, direction = 'vertical') {
  const { x, y, width, height } = region.bounds;
  if (direction === 'horizontal') {
    return [
      createRegion({ ...region, id: undefined, name: `${region.name} A`, bounds: { x, y, width, height: height / 2 } }),
      createRegion({ ...region, id: undefined, name: `${region.name} B`, bounds: { x, y: y + height / 2, width, height: height / 2 } })
    ];
  }

  return [
    createRegion({ ...region, id: undefined, name: `${region.name} A`, bounds: { x, y, width: width / 2, height } }),
    createRegion({ ...region, id: undefined, name: `${region.name} B`, bounds: { x: x + width / 2, y, width: width / 2, height } })
  ];
}

export function replaceRegionWithSplit(regions, regionId, direction = 'vertical') {
  const region = regions.find(item => item.id === regionId);
  if (!region || region.locked) return regions;
  return [
    ...regions.filter(item => item.id !== regionId),
    ...splitRegion(region, direction)
  ];
}
