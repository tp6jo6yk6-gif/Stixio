// Shared History Engine
// Generic undo/redo for command results.

export function createHistory(initialState = null) {
  return {
    past: [],
    present: initialState,
    future: []
  };
}

export function commitHistory(history, entry) {
  return {
    past: [...history.past, entry],
    present: entry.afterState,
    future: []
  };
}

export function undo(history) {
  if (!history.past.length) return history;
  const entry = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: entry.beforeState,
    future: [entry, ...history.future]
  };
}

export function redo(history) {
  if (!history.future.length) return history;
  const entry = history.future[0];
  return {
    past: [...history.past, entry],
    present: entry.afterState,
    future: history.future.slice(1)
  };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}
