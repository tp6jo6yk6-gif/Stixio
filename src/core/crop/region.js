// Crop Region Model
// A region is the platform-neutral source of truth for manual crop.

export function createRegion({
  id = createId('region'),
  name = 'Sticker',
  bounds,
  rotation = 0,
  transform = null,
  locked = false,
  visible = true,
  selected = false,
  metadata = {}
} = {}) {
  if (!bounds) throw new Error('Region bounds are required.');
  return {
    id,
    name,
    bounds: normalizeRect(bounds),
    rotation,
    transform,
    locked,
    visible,
    selected,
    metadata
  };
}

export function normalizeRect(rect) {
  const x = Number(rect.x) || 0;
  const y = Number(rect.y) || 0;
  const width = Math.max(1, Number(rect.width ?? rect.w) || 1);
  const height = Math.max(1, Number(rect.height ?? rect.h) || 1);
  return { x, y, width, height };
}

export function cloneRegion(region, overrides = {}) {
  return {
    ...region,
    bounds: { ...region.bounds },
    metadata: { ...(region.metadata || {}) },
    ...overrides,
    bounds: overrides.bounds ? normalizeRect(overrides.bounds) : { ...region.bounds }
  };
}

export function regionFromGridBox(box, index = 0) {
  return createRegion({
    name: `Sticker ${String(index + 1).padStart(2, '0')}`,
    bounds: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    },
    metadata: {
      row: box.row,
      col: box.col,
      exportSelected: box.exportSelected !== false
    }
  });
}

export function regionToArtworkSlice(region) {
  return {
    x: region.bounds.x,
    y: region.bounds.y,
    width: region.bounds.width,
    height: region.bounds.height
  };
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
