import { cloneRegion } from './region.js';

export function snapRegion(region, guides = {}, threshold = 8) {
  if (region.locked) return region;
  const next = { ...region.bounds };
  const verticalGuides = guides.vertical || [];
  const horizontalGuides = guides.horizontal || [];

  const leftSnap = findClosestGuide(next.x, verticalGuides, threshold);
  if (leftSnap !== null) next.x = leftSnap;

  const rightSnap = findClosestGuide(next.x + next.width, verticalGuides, threshold);
  if (rightSnap !== null) next.x = rightSnap - next.width;

  const topSnap = findClosestGuide(next.y, horizontalGuides, threshold);
  if (topSnap !== null) next.y = topSnap;

  const bottomSnap = findClosestGuide(next.y + next.height, horizontalGuides, threshold);
  if (bottomSnap !== null) next.y = bottomSnap - next.height;

  return cloneRegion(region, { bounds: next });
}

export function createCanvasGuides(width, height) {
  return {
    vertical: [0, width / 2, width],
    horizontal: [0, height / 2, height]
  };
}

export function createRegionGuides(regions, excludeId = null) {
  const vertical = [];
  const horizontal = [];
  regions.forEach(region => {
    if (region.id === excludeId || !region.visible) return;
    vertical.push(region.bounds.x, region.bounds.x + region.bounds.width / 2, region.bounds.x + region.bounds.width);
    horizontal.push(region.bounds.y, region.bounds.y + region.bounds.height / 2, region.bounds.y + region.bounds.height);
  });
  return { vertical, horizontal };
}

export function mergeGuides(...guideSets) {
  return {
    vertical: uniqueSorted(guideSets.flatMap(guides => guides.vertical || [])),
    horizontal: uniqueSorted(guideSets.flatMap(guides => guides.horizontal || []))
  };
}

function findClosestGuide(value, guides, threshold) {
  let best = null;
  let bestDistance = Infinity;
  guides.forEach(guide => {
    const distance = Math.abs(value - guide);
    if (distance <= threshold && distance < bestDistance) {
      best = guide;
      bestDistance = distance;
    }
  });
  return best;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(value => Math.round(value * 1000) / 1000))).sort((a, b) => a - b);
}
