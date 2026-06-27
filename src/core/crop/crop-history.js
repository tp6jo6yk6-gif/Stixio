export function createCropHistory(initialRegions = []) {
  return {
    past: [],
    present: cloneRegions(initialRegions),
    future: []
  };
}

export function commitCropHistory(history, nextRegions, label = 'Edit crop') {
  return {
    past: [...history.past, { label, regions: cloneRegions(history.present) }],
    present: cloneRegions(nextRegions),
    future: []
  };
}

export function undoCropHistory(history) {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: cloneRegions(previous.regions),
    future: [{ label: 'Redo crop', regions: cloneRegions(history.present) }, ...history.future]
  };
}

export function redoCropHistory(history) {
  if (!history.future.length) return history;
  const next = history.future[0];
  return {
    past: [...history.past, { label: 'Undo crop', regions: cloneRegions(history.present) }],
    present: cloneRegions(next.regions),
    future: history.future.slice(1)
  };
}

export function canUndoCrop(history) {
  return history.past.length > 0;
}

export function canRedoCrop(history) {
  return history.future.length > 0;
}

function cloneRegions(regions) {
  return regions.map(region => ({
    ...region,
    bounds: { ...region.bounds },
    metadata: { ...(region.metadata || {}) }
  }));
}
