export function createFrameHistory(initialFrames = []) {
  return {
    past: [],
    present: cloneFrames(initialFrames),
    future: []
  };
}

export function commitFrameHistory(history, nextFrames, label = 'Edit frame') {
  return {
    past: [...history.past, { label, frames: cloneFrames(history.present) }],
    present: cloneFrames(nextFrames),
    future: []
  };
}

export function undoFrameHistory(history) {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: cloneFrames(previous.frames),
    future: [{ label: 'Redo frame', frames: cloneFrames(history.present) }, ...history.future]
  };
}

export function redoFrameHistory(history) {
  if (!history.future.length) return history;
  const next = history.future[0];
  return {
    past: [...history.past, { label: 'Undo frame', frames: cloneFrames(history.present) }],
    present: cloneFrames(next.frames),
    future: history.future.slice(1)
  };
}

export function canUndoFrame(history) {
  return history.past.length > 0;
}

export function canRedoFrame(history) {
  return history.future.length > 0;
}

function cloneFrames(frames) {
  return frames.map(frame => ({
    ...frame,
    geometry: { ...frame.geometry },
    style: { ...(frame.style || {}) },
    state: { ...(frame.state || {}) },
    detection: frame.detection ? { ...frame.detection } : null,
    custom: { ...(frame.custom || {}) }
  }));
}
