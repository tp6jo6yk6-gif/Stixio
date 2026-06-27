import { cloneFrame, createFrame, normalizeGeometry } from './frame.js';

export function moveFrame(frame, deltaX = 0, deltaY = 0) {
  if (frame.state?.locked) return frame;
  return cloneFrame(frame, {
    geometry: {
      ...frame.geometry,
      x: frame.geometry.x + deltaX,
      y: frame.geometry.y + deltaY
    }
  });
}

export function resizeFrame(frame, nextGeometry) {
  if (frame.state?.locked) return frame;
  return cloneFrame(frame, { geometry: normalizeGeometry(nextGeometry) });
}

export function rotateFrame(frame, rotation = 0) {
  if (frame.state?.locked) return frame;
  return cloneFrame(frame, {
    geometry: {
      ...frame.geometry,
      rotation
    }
  });
}

export function setFrameLocked(frame, locked = true) {
  return cloneFrame(frame, {
    state: {
      ...frame.state,
      locked
    }
  });
}

export function setFrameVisible(frame, visible = true) {
  return cloneFrame(frame, {
    state: {
      ...frame.state,
      visible
    }
  });
}

export function duplicateFrame(frame, offset = { x: 24, y: 24 }) {
  return createFrame({
    ...frame,
    id: undefined,
    name: `${frame.name} Copy`,
    geometry: {
      ...frame.geometry,
      x: frame.geometry.x + offset.x,
      y: frame.geometry.y + offset.y
    },
    state: {
      ...frame.state,
      selected: true,
      locked: false
    }
  });
}

export function deleteFrame(frames, frameId) {
  return frames.filter(frame => frame.id !== frameId);
}

export function updateFrame(frames, frameId, updater) {
  return frames.map(frame => frame.id === frameId ? updater(frame) : frame);
}

export function mergeFrames(frames, frameIds, name = 'Merged Frame') {
  const selected = frames.filter(frame => frameIds.includes(frame.id));
  if (selected.length < 2) return frames;

  const minX = Math.min(...selected.map(frame => frame.geometry.x));
  const minY = Math.min(...selected.map(frame => frame.geometry.y));
  const maxX = Math.max(...selected.map(frame => frame.geometry.x + frame.geometry.width));
  const maxY = Math.max(...selected.map(frame => frame.geometry.y + frame.geometry.height));

  const merged = createFrame({
    name,
    sourceImageId: selected[0]?.sourceImageId || null,
    geometry: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    },
    state: { selected: true },
    custom: { mergedFrom: frameIds }
  });

  return [
    ...frames.filter(frame => !frameIds.includes(frame.id)),
    merged
  ];
}

export function splitFrame(frame, direction = 'vertical') {
  const { x, y, width, height } = frame.geometry;
  if (direction === 'horizontal') {
    return [
      createFrame({ ...frame, id: undefined, name: `${frame.name} A`, geometry: { x, y, width, height: height / 2 } }),
      createFrame({ ...frame, id: undefined, name: `${frame.name} B`, geometry: { x, y: y + height / 2, width, height: height / 2 } })
    ];
  }

  return [
    createFrame({ ...frame, id: undefined, name: `${frame.name} A`, geometry: { x, y, width: width / 2, height } }),
    createFrame({ ...frame, id: undefined, name: `${frame.name} B`, geometry: { x: x + width / 2, y, width: width / 2, height } })
  ];
}

export function replaceFrameWithSplit(frames, frameId, direction = 'vertical') {
  const frame = frames.find(item => item.id === frameId);
  if (!frame || frame.state?.locked) return frames;
  return [
    ...frames.filter(item => item.id !== frameId),
    ...splitFrame(frame, direction)
  ];
}
