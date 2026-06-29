export function mergeDetectedFrameStates(previousFrames = [], detectedFrames = [], options = {}) {
  const available = [...previousFrames];
  const createName = options.createName || ((_, index) => `Frame ${index + 1}`);
  const resizeMask = options.resizeMask || null;
  const defaultRole = options.defaultRole || 'sticker';

  return detectedFrames.map((detectedFrame, index) => {
    const matchIndex = findClosestFrameIndex(available, detectedFrame.geometry);
    const previous = matchIndex >= 0 ? available.splice(matchIndex, 1)[0] : null;
    const previousMask = previous?.custom?.protectMaskCanvas || null;
    const width = Math.max(1, Math.round(detectedFrame.geometry?.width || 1));
    const height = Math.max(1, Math.round(detectedFrame.geometry?.height || 1));
    let protectMaskCanvas = previousMask;

    if (previousMask && resizeMask && (previousMask.width !== width || previousMask.height !== height)) {
      protectMaskCanvas = resizeMask(previousMask, width, height);
    }

    return {
      ...detectedFrame,
      id: previous?.id || detectedFrame.id,
      name: previous?.name || createName(detectedFrame, index),
      custom: {
        ...(detectedFrame.custom || {}),
        outputRole: defaultRole,
        offsetX: 0,
        offsetY: 0,
        maskVersion: 0,
        ...(previous?.custom || {}),
        ...(previousMask ? {
          protectMaskCanvas,
          maskVersion: (previous?.custom?.maskVersion || 0) + (protectMaskCanvas === previousMask ? 0 : 1)
        } : {})
      },
      state: {
        exportSelected: true,
        packageRole: defaultRole,
        ...(detectedFrame.state || {}),
        ...(previous?.state || {})
      }
    };
  });
}

export function getNextSourceId(sourceIds = [], removedSourceId) {
  const ids = [...sourceIds];
  const removedIndex = ids.indexOf(removedSourceId);
  if (removedIndex < 0) return ids[0] || null;
  const remaining = ids.filter(id => id !== removedSourceId);
  if (!remaining.length) return null;
  return remaining[Math.min(removedIndex, remaining.length - 1)] || remaining[0];
}

export function findClosestFrameIndex(frames = [], geometry = {}) {
  if (!frames.length) return -1;
  const target = frameCenter(geometry);
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  frames.forEach((frame, index) => {
    const center = frameCenter(frame.geometry || {});
    const dx = center.x - target.x;
    const dy = center.y - target.y;
    const sizeDelta = Math.abs((frame.geometry?.width || 0) - (geometry.width || 0))
      + Math.abs((frame.geometry?.height || 0) - (geometry.height || 0));
    const distance = dx * dx + dy * dy + sizeDelta * sizeDelta * 0.05;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function frameCenter(geometry = {}) {
  return {
    x: Number(geometry.x || 0) + Number(geometry.width || 0) / 2,
    y: Number(geometry.y || 0) + Number(geometry.height || 0) / 2
  };
}
