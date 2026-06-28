export const RECOVERY_VERSION = 1;
export const DEFAULT_RECOVERY_KEY = 'stixio.localRecovery.v1';

export function createRecoverySnapshot({ source = null, frames = [], settings = {}, metadata = {} } = {}) {
  return {
    version: RECOVERY_VERSION,
    savedAt: new Date().toISOString(),
    source: source ? serializeSource(source) : null,
    frames: serializeFrames(frames),
    settings: serializeSettings(settings),
    metadata
  };
}

export function saveRecoverySnapshot(snapshot, storage = globalThis.localStorage, key = DEFAULT_RECOVERY_KEY) {
  if (!storage) return false;
  storage.setItem(key, JSON.stringify(snapshot));
  return true;
}

export function loadRecoverySnapshot(storage = globalThis.localStorage, key = DEFAULT_RECOVERY_KEY) {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw);
    return validateRecoverySnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

export function clearRecoverySnapshot(storage = globalThis.localStorage, key = DEFAULT_RECOVERY_KEY) {
  if (!storage) return false;
  storage.removeItem(key);
  return true;
}

export function validateRecoverySnapshot(snapshot) {
  return Boolean(
    snapshot &&
    snapshot.version === RECOVERY_VERSION &&
    Array.isArray(snapshot.frames) &&
    snapshot.settings &&
    typeof snapshot.settings === 'object'
  );
}

export function serializeSource(source) {
  return {
    id: source.id,
    fileName: source.fileName,
    name: source.name,
    provider: source.provider,
    width: source.width,
    height: source.height,
    mimeType: source.mimeType,
    dataUrl: source.dataUrl || null
  };
}

export function serializeFrames(frames = []) {
  return frames.map(frame => ({
    ...frame,
    geometry: { ...(frame.geometry || {}) },
    state: { ...(frame.state || {}) },
    detection: frame.detection ? { ...frame.detection } : frame.detection
  }));
}

export function serializeSettings(settings = {}) {
  return JSON.parse(JSON.stringify(settings));
}
