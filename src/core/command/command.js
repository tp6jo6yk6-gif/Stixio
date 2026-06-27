// Command Engine
// UI should call commands instead of directly mutating data.

export function createCommand({
  type,
  label = type,
  target = null,
  payload = {},
  apply,
  revert = null
} = {}) {
  if (!type) throw new Error('Command type is required.');
  if (typeof apply !== 'function') throw new Error('Command apply function is required.');
  return {
    id: createId('cmd'),
    type,
    label,
    target,
    payload,
    createdAt: new Date().toISOString(),
    apply,
    revert
  };
}

export function executeCommand(state, command) {
  const nextState = command.apply(state, command.payload);
  return {
    state: nextState,
    entry: toHistoryEntry(command, state, nextState)
  };
}

export function toHistoryEntry(command, beforeState, afterState) {
  return {
    id: command.id,
    type: command.type,
    label: command.label,
    target: command.target,
    payload: command.payload,
    createdAt: command.createdAt,
    beforeState,
    afterState
  };
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
