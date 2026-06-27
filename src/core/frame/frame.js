// Frame Model
// Frame is the single source of truth for one sticker area.

export function createFrame({
  id = createId('frame'),
  name = 'Frame',
  geometry,
  bounds = null,
  rotation = 0,
  transform = null,
  style = {},
  state = {},
  sourceImageId = null,
  detection = null,
  custom = {}
} = {}) {
  const normalizedGeometry = normalizeGeometry(geometry || { ...bounds, rotation, transform });
  return {
    id,
    name,
    sourceImageId,
    geometry: normalizedGeometry,
    style: {
      whiteBorder: null,
      shadow: null,
      trim: null,
      ...style
    },
    state: {
      locked: false,
      visible: true,
      selected: false,
      exportSelected: true,
      ...state
    },
    detection,
    custom
  };
}

export function normalizeGeometry(geometry = {}) {
  const x = Number(geometry.x) || 0;
  const y = Number(geometry.y) || 0;
  const width = Math.max(1, Number(geometry.width ?? geometry.w) || 1);
  const height = Math.max(1, Number(geometry.height ?? geometry.h) || 1);
  const rotation = Number(geometry.rotation) || 0;
  const transform = geometry.transform || null;
  return { x, y, width, height, rotation, transform };
}

export function cloneFrame(frame, overrides = {}) {
  return {
    ...frame,
    geometry: { ...frame.geometry },
    style: { ...(frame.style || {}) },
    state: { ...(frame.state || {}) },
    detection: frame.detection ? { ...frame.detection } : null,
    custom: { ...(frame.custom || {}) },
    ...overrides,
    geometry: overrides.geometry ? normalizeGeometry(overrides.geometry) : { ...frame.geometry },
    style: overrides.style ? { ...(overrides.style || {}) } : { ...(frame.style || {}) },
    state: overrides.state ? { ...(overrides.state || {}) } : { ...(frame.state || {}) },
    custom: overrides.custom ? { ...(overrides.custom || {}) } : { ...(frame.custom || {}) }
  };
}

export function frameFromGridBox(box, index = 0, sourceImageId = null) {
  return createFrame({
    name: `Frame ${String(index + 1).padStart(2, '0')}`,
    sourceImageId,
    geometry: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    },
    state: {
      exportSelected: box.exportSelected !== false
    },
    custom: {
      row: box.row,
      col: box.col
    }
  });
}

export function frameToArtworkSlice(frame) {
  return {
    x: frame.geometry.x,
    y: frame.geometry.y,
    width: frame.geometry.width,
    height: frame.geometry.height
  };
}

export function frameToLegacyRegion(frame) {
  return {
    id: frame.id,
    name: frame.name,
    bounds: {
      x: frame.geometry.x,
      y: frame.geometry.y,
      width: frame.geometry.width,
      height: frame.geometry.height
    },
    rotation: frame.geometry.rotation,
    transform: frame.geometry.transform,
    locked: frame.state.locked,
    visible: frame.state.visible,
    selected: frame.state.selected,
    metadata: {
      ...(frame.custom || {}),
      style: frame.style,
      detection: frame.detection,
      sourceImageId: frame.sourceImageId,
      exportSelected: frame.state.exportSelected
    }
  };
}

export function legacyRegionToFrame(region) {
  return createFrame({
    id: region.id?.startsWith('frame_') ? region.id : undefined,
    name: region.name || 'Frame',
    sourceImageId: region.sourceImageId || region.metadata?.sourceImageId || null,
    geometry: {
      x: region.bounds?.x,
      y: region.bounds?.y,
      width: region.bounds?.width,
      height: region.bounds?.height,
      rotation: region.rotation || 0,
      transform: region.transform || null
    },
    style: region.metadata?.style || {},
    state: {
      locked: Boolean(region.locked),
      visible: region.visible !== false,
      selected: Boolean(region.selected),
      exportSelected: region.metadata?.exportSelected !== false
    },
    detection: region.metadata?.detection || null,
    custom: region.metadata || {}
  });
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
