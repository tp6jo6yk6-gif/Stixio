import { sanitizePackageSegment, sha256Hex } from './package-workflow.js';

export const WORKSHOP_PROJECT_SCHEMA_VERSION = '2.0.0';
export const WORKSHOP_PROJECT_MIME = 'application/x-stixio-project';
export const WORKSHOP_PROJECT_EXTENSION = '.stixio';

export function createWorkshopProjectSnapshot({
  document,
  settings = {},
  sources = [],
  sourceLayouts = [],
  selectedFrameBySource = [],
  activeSourceId = null,
  selectedFrameId = null,
  packageState = null,
  destinationState = null,
  metadata = {},
  now = new Date()
} = {}) {
  if (!document || typeof document !== 'object') throw new Error('Workshop project requires a document.');
  const createdAt = document.createdAt || toIso(now);
  const updatedAt = toIso(now);
  const normalizedSources = normalizeSources(sources);
  const normalizedDocument = serializeDocument(document);
  return {
    schema: 'https://stixio.app/schemas/workshop-project/v2',
    schemaVersion: WORKSHOP_PROJECT_SCHEMA_VERSION,
    id: document.id || createId('project'),
    name: document.name || 'Untitled Project',
    createdAt,
    updatedAt,
    document: normalizedDocument,
    settings: cloneSerializable(settings),
    sources: normalizedSources,
    sourceLayouts: normalizeEntries(sourceLayouts),
    selectedFrameBySource: normalizeEntries(selectedFrameBySource),
    ui: {
      activeSourceId,
      selectedFrameId
    },
    packageState: cloneSerializable(packageState),
    destinationState: cloneSerializable(destinationState),
    metadata: {
      generator: 'Stixio Workshop',
      generatorVersion: '1.0.0',
      ...cloneSerializable(metadata)
    }
  };
}

export function validateWorkshopProject(snapshot, { allowFutureVersion = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!snapshot || typeof snapshot !== 'object') errors.push(projectIssue('project.invalid', 'Project snapshot is invalid.'));
  if (!snapshot?.schemaVersion) errors.push(projectIssue('project.schema.missing', 'Project schemaVersion is required.'));
  if (!snapshot?.id) errors.push(projectIssue('project.id.missing', 'Project id is required.'));
  if (!snapshot?.document || typeof snapshot.document !== 'object') errors.push(projectIssue('project.document.missing', 'Project document is required.'));
  if (!Array.isArray(snapshot?.sources)) errors.push(projectIssue('project.sources.invalid', 'Project sources must be an array.'));
  if (!Array.isArray(snapshot?.document?.frames)) errors.push(projectIssue('project.frames.invalid', 'Project frames must be an array.'));
  if (!Array.isArray(snapshot?.sourceLayouts)) errors.push(projectIssue('project.layouts.invalid', 'Project sourceLayouts must be an entry array.'));
  const currentMajor = majorVersion(WORKSHOP_PROJECT_SCHEMA_VERSION);
  const snapshotMajor = majorVersion(snapshot?.schemaVersion);
  if (!allowFutureVersion && snapshotMajor > currentMajor) {
    errors.push(projectIssue('project.schema.future', `Project schema ${snapshot.schemaVersion} is newer than this Stixio version.`));
  }
  const sourceIds = new Set((snapshot?.sources || []).map(source => source.id));
  for (const frame of snapshot?.document?.frames || []) {
    if (!frame.id) errors.push(projectIssue('project.frame.idMissing', 'A Frame is missing its id.'));
    if (!frame.sourceImageId || !sourceIds.has(frame.sourceImageId)) {
      errors.push(projectIssue('project.frame.sourceMissing', `${frame.name || frame.id || 'Frame'} references a missing source image.`, { frameId: frame.id }));
    }
  }
  for (const source of snapshot?.sources || []) {
    if (!source.id) errors.push(projectIssue('project.source.idMissing', 'A source image is missing its id.'));
    if (!source.uri && !source.assetPath) warnings.push(projectIssue('project.source.assetMissing', `${source.name || source.id || 'Source'} has no embedded asset.`, { sourceId: source.id }, 'warning'));
  }
  return { errors, warnings, ready: errors.length === 0 };
}

export function migrateWorkshopProject(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid Stixio project.');
  const source = cloneSerializable(input);
  const version = source.schemaVersion || '1.0.0';
  if (majorVersion(version) > majorVersion(WORKSHOP_PROJECT_SCHEMA_VERSION)) {
    const error = new Error(`Project schema ${version} is newer than supported ${WORKSHOP_PROJECT_SCHEMA_VERSION}.`);
    error.name = 'ProjectVersionError';
    throw error;
  }

  if (majorVersion(version) < 2) {
    const document = source.document || {
      schemaVersion: '1.0.0',
      id: source.id || createId('doc'),
      name: source.name || 'Imported Project',
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString(),
      status: 'draft',
      sourceRefs: source.sources || source.assets || [],
      frames: source.frames || source.artworks || [],
      operations: source.operations || [],
      packagePlans: source.packagePlans || source.packages || [],
      metadata: source.metadata || {}
    };
    return createWorkshopProjectSnapshot({
      document,
      settings: source.settings || {},
      sources: source.sources || source.assets || [],
      sourceLayouts: source.sourceLayouts || [],
      selectedFrameBySource: source.selectedFrameBySource || [],
      activeSourceId: source.ui?.activeSourceId || source.activeSourceId || null,
      selectedFrameId: source.ui?.selectedFrameId || source.selectedFrameId || null,
      packageState: source.packageState || null,
      destinationState: source.destinationState || null,
      metadata: { ...(source.metadata || {}), migratedFrom: version },
      now: source.updatedAt || new Date()
    });
  }

  const migrated = {
    ...source,
    schema: source.schema || 'https://stixio.app/schemas/workshop-project/v2',
    schemaVersion: WORKSHOP_PROJECT_SCHEMA_VERSION,
    settings: source.settings || {},
    sources: normalizeSources(source.sources || []),
    sourceLayouts: normalizeEntries(source.sourceLayouts || []),
    selectedFrameBySource: normalizeEntries(source.selectedFrameBySource || []),
    packageState: cloneSerializable(source.packageState || null),
    destinationState: cloneSerializable(source.destinationState || null),
    ui: {
      activeSourceId: source.ui?.activeSourceId || null,
      selectedFrameId: source.ui?.selectedFrameId || null
    },
    document: serializeDocument(source.document || {})
  };
  const validation = validateWorkshopProject(migrated);
  if (!validation.ready) {
    const error = new Error(validation.errors[0]?.message || 'Project validation failed.');
    error.name = 'ProjectValidationError';
    error.issues = validation.errors;
    throw error;
  }
  return migrated;
}

export function serializeDocument(document) {
  const cloned = cloneSerializable(document || {});
  return {
    ...cloned,
    sourceRefs: Array.isArray(cloned.sourceRefs) ? cloned.sourceRefs.map(stripRuntimeSourceFields) : [],
    frames: Array.isArray(document?.frames) ? document.frames.map(serializeFrame) : [],
    operations: Array.isArray(cloned.operations) ? cloned.operations : [],
    packagePlans: Array.isArray(cloned.packagePlans) ? cloned.packagePlans : [],
    metadata: cloned.metadata || {}
  };
}

export function serializeFrame(frame) {
  const custom = { ...(frame?.custom || {}) };
  const maskCanvas = custom.protectMaskCanvas;
  delete custom.protectMaskCanvas;
  if (maskCanvas?.toDataURL) {
    custom.protectMask = {
      format: 'image/png',
      width: maskCanvas.width,
      height: maskCanvas.height,
      dataUrl: maskCanvas.toDataURL('image/png')
    };
  } else if (custom.protectMask?.dataUrl) {
    custom.protectMask = cloneSerializable(custom.protectMask);
  }
  return cloneSerializable({ ...frame, custom });
}

export function hydrateFrameMask(frame, maskCanvas) {
  const custom = { ...(frame?.custom || {}) };
  const protectMask = custom.protectMask || null;
  delete custom.protectMask;
  if (maskCanvas) custom.protectMaskCanvas = maskCanvas;
  return { ...cloneSerializable(frame), custom, protectMask };
}

export async function createStixioProjectArchive({
  snapshot,
  JSZipClass = globalThis.JSZip,
  cryptoImpl = globalThis.crypto,
  previewDataUrl = null,
  onProgress = null,
  now = new Date()
} = {}) {
  if (!JSZipClass) throw new Error('JSZip is not available.');
  const migrated = migrateWorkshopProject(snapshot);
  const validation = validateWorkshopProject(migrated);
  if (!validation.ready) throw projectValidationError(validation.errors);

  const zip = new JSZipClass();
  const archiveSnapshot = cloneSerializable(migrated);
  const checksumInputs = [];
  const requiredPaths = [];

  archiveSnapshot.sources = archiveSnapshot.sources.map(source => {
    const extension = extensionForMime(source.mimeType || mimeFromDataUrl(source.uri));
    const assetPath = `assets/${sanitizeArchiveId(source.id)}.${extension}`;
    const bytes = dataUrlBytes(source.uri);
    if (!bytes.length) throw new Error(`Source asset is missing: ${source.name || source.id}.`);
    zip.file(assetPath, bytes);
    checksumInputs.push({ path: assetPath, bytes });
    requiredPaths.push(assetPath);
    const next = { ...source, uri: null, assetPath };
    return next;
  });

  archiveSnapshot.document.frames = archiveSnapshot.document.frames.map(frame => {
    const next = cloneSerializable(frame);
    const mask = next.custom?.protectMask;
    if (mask?.dataUrl) {
      const maskPath = `masks/${sanitizeArchiveId(frame.id)}.png`;
      const bytes = dataUrlBytes(mask.dataUrl);
      zip.file(maskPath, bytes);
      checksumInputs.push({ path: maskPath, bytes });
      requiredPaths.push(maskPath);
      next.custom.protectMask = { ...mask, dataUrl: null, assetPath: maskPath };
    }
    return next;
  });

  if (previewDataUrl) {
    const previewPath = 'preview.png';
    const previewBytes = dataUrlBytes(previewDataUrl);
    zip.file(previewPath, previewBytes);
    checksumInputs.push({ path: previewPath, bytes: previewBytes });
    requiredPaths.push(previewPath);
    archiveSnapshot.metadata = { ...(archiveSnapshot.metadata || {}), previewPath };
  }

  archiveSnapshot.updatedAt = toIso(now);
  const projectJson = JSON.stringify(archiveSnapshot, null, 2);
  const projectBytes = new TextEncoder().encode(projectJson);
  zip.file('project.json', projectJson);
  checksumInputs.push({ path: 'project.json', bytes: projectBytes });
  requiredPaths.push('project.json');

  const checksumLines = [];
  for (let index = 0; index < checksumInputs.length; index += 1) {
    const item = checksumInputs[index];
    const digest = await sha256Hex(item.bytes, cryptoImpl);
    checksumLines.push(`${digest}  ${item.path}`);
    onProgress?.({ stage: 'hashing', percent: Math.round((index + 1) / checksumInputs.length * 40), current: item.path });
  }
  zip.file('checksums.sha256', checksumLines.join('\n'));
  requiredPaths.push('checksums.sha256');

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, update => {
    onProgress?.({ stage: 'compressing', percent: 40 + Math.round(Number(update.percent || 0) * 0.6), current: update.currentFile || null });
  });
  const verification = await verifyStixioProjectArchive({ blob, JSZipClass, cryptoImpl, requiredPaths });
  if (!verification.verified) {
    const error = new Error(`Project archive verification failed: ${verification.errors[0] || 'unknown error'}`);
    error.name = 'ProjectArchiveVerificationError';
    error.verification = verification;
    throw error;
  }
  onProgress?.({ stage: 'complete', percent: 100, current: null });
  return {
    blob,
    fileName: `${sanitizePackageSegment(migrated.name || 'stixio-project', 'stixio-project', 96)}${WORKSHOP_PROJECT_EXTENSION}`,
    snapshot: migrated,
    verification
  };
}

export async function parseStixioProjectArchive({
  blob,
  JSZipClass = globalThis.JSZip,
  cryptoImpl = globalThis.crypto,
  verifyChecksums = true
} = {}) {
  if (!JSZipClass) throw new Error('JSZip is not available.');
  if (!blob) throw new Error('Project archive is required.');
  const loader = typeof JSZipClass.loadAsync === 'function' ? JSZipClass : new JSZipClass();
  let archive;
  try {
    archive = await loader.loadAsync(blob);
  } catch (cause) {
    const error = new Error('This file is not a valid .stixio project archive.');
    error.name = 'ProjectArchiveError';
    error.cause = cause;
    throw error;
  }
  const projectFile = archive.file?.('project.json') || archive.files?.['project.json'];
  if (!projectFile) throw new Error('Project archive is missing project.json.');
  const projectJson = await projectFile.async('string');
  let snapshot;
  try {
    snapshot = migrateWorkshopProject(JSON.parse(projectJson));
  } catch (cause) {
    const error = new Error(cause.message || 'Project manifest is invalid.');
    error.name = cause.name || 'ProjectManifestError';
    error.cause = cause;
    throw error;
  }

  for (const source of snapshot.sources) {
    if (!source.assetPath) continue;
    const file = archive.file?.(source.assetPath) || archive.files?.[source.assetPath];
    if (!file) throw new Error(`Project archive is missing source asset ${source.assetPath}.`);
    const base64 = await file.async('base64');
    source.uri = `data:${source.mimeType || mimeForExtension(source.assetPath)};base64,${base64}`;
  }
  for (const frame of snapshot.document.frames) {
    const mask = frame.custom?.protectMask;
    if (!mask?.assetPath) continue;
    const file = archive.file?.(mask.assetPath) || archive.files?.[mask.assetPath];
    if (!file) throw new Error(`Project archive is missing mask ${mask.assetPath}.`);
    const base64 = await file.async('base64');
    mask.dataUrl = `data:image/png;base64,${base64}`;
  }

  let verification = { verified: true, errors: [], paths: Object.keys(archive.files || {}) };
  if (verifyChecksums) verification = await verifyStixioProjectArchive({ blob, JSZipClass, cryptoImpl });
  if (!verification.verified) {
    const error = new Error(`Project checksum verification failed: ${verification.errors[0] || 'unknown error'}`);
    error.name = 'ProjectChecksumError';
    error.verification = verification;
    throw error;
  }
  const validation = validateWorkshopProject(snapshot);
  if (!validation.ready) throw projectValidationError(validation.errors);
  return { snapshot, verification };
}

export async function verifyStixioProjectArchive({
  blob,
  JSZipClass = globalThis.JSZip,
  cryptoImpl = globalThis.crypto,
  requiredPaths = []
} = {}) {
  const loader = typeof JSZipClass.loadAsync === 'function' ? JSZipClass : new JSZipClass();
  const archive = await loader.loadAsync(blob);
  const files = archive.files || {};
  const paths = Object.entries(files).filter(([, file]) => !file.dir).map(([path]) => path).sort();
  const errors = [];
  for (const path of requiredPaths) if (!files[path]) errors.push(`Missing ${path}`);
  const checksumFile = archive.file?.('checksums.sha256') || files['checksums.sha256'];
  if (!checksumFile) errors.push('Missing checksums.sha256');
  else {
    const checksumText = await checksumFile.async('string');
    const rows = checksumText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const row of rows) {
      const match = row.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
      if (!match) {
        errors.push(`Invalid checksum row: ${row}`);
        continue;
      }
      const [, expected, path] = match;
      const file = archive.file?.(path) || files[path];
      if (!file) {
        errors.push(`Checksum target missing: ${path}`);
        continue;
      }
      const bytes = await file.async('uint8array');
      const actual = await sha256Hex(bytes, cryptoImpl);
      if (actual !== expected.toLowerCase()) errors.push(`Checksum mismatch: ${path}`);
    }
  }
  return { verified: errors.length === 0, errors, paths };
}

export function projectSummary(snapshot) {
  return {
    id: snapshot.id,
    name: snapshot.name,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    sourceCount: snapshot.sources?.length || 0,
    frameCount: snapshot.document?.frames?.length || 0,
    schemaVersion: snapshot.schemaVersion,
    previewDataUrl: snapshot.metadata?.previewDataUrl || null
  };
}

function normalizeSources(sources) {
  const values = sources instanceof Map ? [...sources.values()] : Array.isArray(sources) ? sources : Object.values(sources || {});
  return values.map(stripRuntimeSourceFields);
}

function stripRuntimeSourceFields(source) {
  const { img: _img, bitmap: _bitmap, canvas: _canvas, ...rest } = source || {};
  return cloneSerializable(rest);
}

function normalizeEntries(value) {
  if (value instanceof Map) return [...value.entries()].map(([key, item]) => [key, cloneSerializable(item)]);
  if (Array.isArray(value)) return value.map(entry => Array.isArray(entry) ? [entry[0], cloneSerializable(entry[1])] : entry);
  return Object.entries(value || {}).map(([key, item]) => [key, cloneSerializable(item)]);
}

function cloneSerializable(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* use JSON fallback */ }
  }
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'function') return undefined;
    if (typeof Element !== 'undefined' && item instanceof Element) return undefined;
    return item;
  }));
}

function dataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return new Uint8Array();
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return new TextEncoder().encode(dataUrl);
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!metadata.includes(';base64')) return new TextEncoder().encode(decodeURIComponent(payload));
  if (typeof atob === 'function') {
    const binary = atob(payload);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(payload, 'base64'));
  throw new Error('Base64 decoding is not available.');
}

function mimeFromDataUrl(dataUrl) {
  return String(dataUrl || '').match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream';
}

function extensionForMime(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('jpeg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('svg')) return 'svg';
  return 'png';
}

function mimeForExtension(path) {
  const extension = String(path || '').split('.').pop().toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'svg') return 'image/svg+xml';
  return 'image/png';
}

function sanitizeArchiveId(value) {
  return sanitizePackageSegment(String(value || 'asset'), 'asset', 96).replace(/\s+/g, '-');
}

function majorVersion(version) {
  const major = Number(String(version || '0').split('.')[0]);
  return Number.isFinite(major) ? major : 0;
}

function toIso(value) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function projectIssue(code, message, metadata = {}, severity = 'error') {
  return { code, message, severity, ...metadata };
}

function projectValidationError(issues) {
  const error = new Error(issues[0]?.message || 'Project validation failed.');
  error.name = 'ProjectValidationError';
  error.issues = issues;
  return error;
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
