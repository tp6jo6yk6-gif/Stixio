import { cloneFrame } from './frame.js';

export function snapFrame(frame, guides = {}, threshold = 8) {
  if (frame.state?.locked) return frame;
  const next = { ...frame.geometry };
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

  return cloneFrame(frame, { geometry: next });
}

export function createCanvasFrameGuides(width, height) {
  return {
    vertical: [0, width / 2, width],
    horizontal: [0, height / 2, height]
  };
}

export function createFrameGuides(frames, excludeId = null) {
  const vertical = [];
  const horizontal = [];
  frames.forEach(frame => {
    if (frame.id === excludeId || frame.state?.visible === false) return;
    vertical.push(frame.geometry.x, frame.geometry.x + frame.geometry.width / 2, frame.geometry.x + frame.geometry.width);
    horizontal.push(frame.geometry.y, frame.geometry.y + frame.geometry.height / 2, frame.geometry.y + frame.geometry.height);
  });
  return { vertical, horizontal };
}

export function mergeFrameGuides(...guideSets) {
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
