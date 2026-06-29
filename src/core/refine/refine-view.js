// Pure Refine viewport helpers. UI code owns pointer events; this module owns stable math.

export function createRefineViewState({
  zoom = 1,
  panX = 0,
  panY = 0,
  minZoom = 0.2,
  maxZoom = 5
} = {}) {
  const safeMin = Math.max(0.05, Number(minZoom) || 0.2);
  const safeMax = Math.max(safeMin, Number(maxZoom) || 5);
  return {
    zoom: clamp(Number(zoom) || 1, safeMin, safeMax),
    panX: Number(panX) || 0,
    panY: Number(panY) || 0,
    minZoom: safeMin,
    maxZoom: safeMax
  };
}

export function zoomRefineView(view, nextZoom, anchor = { x: 0, y: 0 }) {
  const current = createRefineViewState(view);
  const zoom = clamp(Number(nextZoom) || current.zoom, current.minZoom, current.maxZoom);
  const ratio = zoom / current.zoom;
  const anchorX = Number(anchor.x) || 0;
  const anchorY = Number(anchor.y) || 0;
  return {
    ...current,
    zoom,
    panX: anchorX - (anchorX - current.panX) * ratio,
    panY: anchorY - (anchorY - current.panY) * ratio
  };
}

export function panRefineView(view, deltaX = 0, deltaY = 0) {
  const current = createRefineViewState(view);
  return {
    ...current,
    panX: current.panX + (Number(deltaX) || 0),
    panY: current.panY + (Number(deltaY) || 0)
  };
}

export function resetRefineView(view = {}) {
  const current = createRefineViewState(view);
  return { ...current, zoom: 1, panX: 0, panY: 0 };
}

export function refineViewTransform(view = {}) {
  const current = createRefineViewState(view);
  return `translate(-50%, -50%) translate(${current.panX}px, ${current.panY}px) scale(${current.zoom})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
