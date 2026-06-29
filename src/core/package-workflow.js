export const PackageFolderModes = Object.freeze({
  FLAT: 'flat',
  ROLE: 'role',
  SOURCE: 'source',
  SOURCE_ROLE: 'source-role'
});

export const PackageCompressionModes = Object.freeze({
  STORE: 'store',
  DEFLATE: 'deflate'
});

export const PackageJobStatuses = Object.freeze({
  IDLE: 'idle',
  PREPARING: 'preparing',
  HASHING: 'hashing',
  COMPRESSING: 'compressing',
  VERIFYING: 'verifying',
  COMPLETE: 'complete',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
});

const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

export function createPackageDeliverySettings(options = {}) {
  return {
    zipBaseName: sanitizePackageSegment(options.zipBaseName || 'stixio-package', 'stixio-package', 96),
    rootFolder: options.rootFolder ? sanitizePackageSegment(options.rootFolder, '', 96) : '',
    folderMode: Object.values(PackageFolderModes).includes(options.folderMode)
      ? options.folderMode
      : PackageFolderModes.FLAT,
    includeManifestJson: options.includeManifestJson !== false,
    includeManifestCsv: options.includeManifestCsv === true,
    includeChecksums: options.includeChecksums !== false,
    includeReadme: options.includeReadme !== false,
    compression: options.compression === PackageCompressionModes.DEFLATE
      ? PackageCompressionModes.DEFLATE
      : PackageCompressionModes.STORE,
    compressionLevel: clampInteger(options.compressionLevel, 1, 9, 6),
    maxPackageSizeBytes: Math.max(1, Number(options.maxPackageSizeMB || 200)) * 1024 * 1024,
    manifestBaseName: sanitizePackageSegment(options.manifestBaseName || 'stixio-package', 'stixio-package', 64),
    verifyArchive: options.verifyArchive !== false
  };
}

export function sanitizePackageSegment(value, fallback = 'untitled', maxLength = 96) {
  let result = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .trim()
    .replace(/^[. -]+|[. ]+$/g, '')
    .replace(/-+/g, '-')
    .replace(/\s*-\s*/g, '-');
  if (!result) result = fallback;
  const bareName = result.split('.')[0].toLowerCase();
  if (WINDOWS_RESERVED_NAMES.has(bareName)) result = `_${result}`;
  if (maxLength > 0 && result.length > maxLength) result = result.slice(0, maxLength).replace(/[. ]+$/g, '');
  return result || fallback;
}

export function sanitizePackageFileName(value, fallback = 'file.png') {
  const raw = String(value || fallback);
  const lastDot = raw.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < raw.length - 1;
  const stem = sanitizePackageSegment(hasExtension ? raw.slice(0, lastDot) : raw, 'file', 120);
  const extension = sanitizePackageSegment(hasExtension ? raw.slice(lastDot + 1) : 'png', 'png', 12)
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase() || 'png';
  return `${stem}.${extension}`;
}

export function normalizeZipFileName(value, fallback = 'stixio-package') {
  const raw = String(value || fallback).trim().replace(/\.zip$/i, '');
  return `${sanitizePackageSegment(raw, fallback, 120)}.zip`;
}

export function buildPackagePath(item, settings = {}, sourceNames = new Map()) {
  const normalized = createPackageDeliverySettings(settings);
  const fileName = sanitizePackageFileName(item.fileName || `${item.artworkId || 'file'}.png`);
  const sourceName = resolveSourceName(sourceNames, item.sourceImageId || item.sourceId) || 'source';
  const role = sanitizePackageSegment(item.role || 'sticker', 'sticker', 48);
  const segments = [];
  if (normalized.rootFolder) segments.push(normalized.rootFolder);
  if (normalized.folderMode === PackageFolderModes.ROLE) segments.push(role);
  if (normalized.folderMode === PackageFolderModes.SOURCE) segments.push(sanitizePackageSegment(sourceName, 'source', 72));
  if (normalized.folderMode === PackageFolderModes.SOURCE_ROLE) {
    segments.push(sanitizePackageSegment(sourceName, 'source', 72), role);
  }
  segments.push(fileName);
  return segments.join('/');
}

export function buildPackageEntries({
  items = [],
  frames = [],
  renderedMap = new Map(),
  sourceNames = new Map(),
  settings = {}
} = {}) {
  const normalized = createPackageDeliverySettings(settings);
  const frameById = new Map(frames.map(frame => [frame.id, frame]));
  return items.map((item, index) => {
    const frame = frameById.get(item.artworkId) || null;
    const canvas = renderedMap.get(item.artworkId) || null;
    const fileName = sanitizePackageFileName(item.fileName || `${String(index + 1).padStart(2, '0')}.png`);
    const entry = {
      frameId: item.artworkId,
      artworkId: item.artworkId,
      name: frame?.name || item.name || fileName,
      role: item.role || 'sticker',
      roleLabel: item.roleLabel || item.role || 'Sticker',
      order: item.order ?? index,
      stickerIndex: item.stickerIndex ?? null,
      sourceImageId: frame?.sourceImageId || item.sourceImageId || null,
      sourceName: resolveSourceName(sourceNames, frame?.sourceImageId || item.sourceImageId) || '',
      fileName,
      width: Number(canvas?.width || 0),
      height: Number(canvas?.height || 0),
      bytes: estimatePackageCanvasBytes(canvas),
      approved: frame?.state?.reviewApproved === true,
      exportSelected: frame?.state?.visible !== false && frame?.state?.exportSelected !== false,
      canvas,
      sha256: null
    };
    entry.path = buildPackagePath(entry, normalized, sourceNames);
    return entry;
  });
}

export function validatePackageEntries(entries = [], settings = {}) {
  const normalized = createPackageDeliverySettings(settings);
  const errors = [];
  const warnings = [];
  const seenPaths = new Map();
  let totalBytes = 0;

  if (!entries.length) errors.push(packageIssue('package.entries.empty', 'Package contains no image files.', 'error'));

  entries.forEach(entry => {
    totalBytes += Math.max(0, Number(entry.bytes || 0));
    if (!entry.canvas && !entry.base64 && !entry.bytesData) errors.push(packageIssue('package.canvas.missing', `${entry.name || entry.path} has no rendered PNG.`, 'error', entry));
    if (!entry.approved) errors.push(packageIssue('package.review.pending', `${entry.name || entry.path} is not approved in Review.`, 'error', entry));
    if (!entry.path || entry.path.startsWith('/') || entry.path.includes('..') || entry.path.includes('\\')) {
      errors.push(packageIssue('package.path.unsafe', `Unsafe package path: ${entry.path || '(empty)'}.`, 'error', entry));
    }
    if (String(entry.path || '').length > 240) {
      errors.push(packageIssue('package.path.tooLong', `Package path exceeds 240 characters: ${entry.path}.`, 'error', entry));
    }
    const pathKey = String(entry.path || '').toLowerCase();
    if (seenPaths.has(pathKey)) {
      errors.push(packageIssue('package.path.duplicate', `Duplicate package path: ${entry.path}.`, 'error', {
        ...entry,
        duplicateOf: seenPaths.get(pathKey)
      }));
    } else if (pathKey) {
      seenPaths.set(pathKey, entry.frameId);
    }
    if (!entry.bytes) warnings.push(packageIssue('package.file.empty', `${entry.name || entry.path} is estimated at 0 bytes.`, 'warning', entry));
  });

  if (totalBytes > normalized.maxPackageSizeBytes) {
    warnings.push(packageIssue(
      'package.totalSize.large',
      `Estimated package size is ${formatBytes(totalBytes)}, above the ${formatBytes(normalized.maxPackageSizeBytes)} warning threshold.`,
      'warning',
      { totalBytes, maxPackageSizeBytes: normalized.maxPackageSizeBytes }
    ));
  }
  if (!normalized.includeManifestJson && !normalized.includeManifestCsv) {
    warnings.push(packageIssue('package.manifest.disabled', 'No package manifest will be included.', 'warning'));
  }
  if (!normalized.includeChecksums) {
    warnings.push(packageIssue('package.checksums.disabled', 'SHA-256 checksum file is disabled.', 'warning'));
  }

  return {
    errors,
    warnings,
    ready: errors.length === 0,
    summary: summarizePackageEntries(entries, totalBytes)
  };
}

export function createPackagePreflight({ entries = [], packagePlan = null, reviewReport = null, settings = {} } = {}) {
  const entryValidation = validatePackageEntries(entries, settings);
  const errors = [
    ...(packagePlan?.validation?.errors || []),
    ...(reviewReport?.issues || []).filter(issue => issue.severity === 'error'),
    ...entryValidation.errors
  ];
  const warnings = [
    ...(packagePlan?.validation?.warnings || []),
    ...(reviewReport?.issues || []).filter(issue => issue.severity === 'warning'),
    ...entryValidation.warnings
  ];
  const dedupedErrors = dedupeIssues(errors);
  const dedupedWarnings = dedupeIssues(warnings);
  return {
    entries,
    errors: dedupedErrors,
    warnings: dedupedWarnings,
    ready: dedupedErrors.length === 0 && packagePlan?.ready !== false && reviewReport?.canPackage !== false,
    summary: {
      ...entryValidation.summary,
      errors: dedupedErrors.length,
      warnings: dedupedWarnings.length
    }
  };
}

export function summarizePackageEntries(entries = [], knownTotalBytes = null) {
  const totalBytes = knownTotalBytes == null
    ? entries.reduce((total, entry) => total + Math.max(0, Number(entry.bytes || 0)), 0)
    : knownTotalBytes;
  const roles = {};
  const sources = new Set();
  entries.forEach(entry => {
    roles[entry.role] = (roles[entry.role] || 0) + 1;
    if (entry.sourceImageId) sources.add(entry.sourceImageId);
  });
  return {
    imageCount: entries.length,
    totalBytes,
    totalSizeLabel: formatBytes(totalBytes),
    roles,
    sourceCount: sources.size,
    approvedCount: entries.filter(entry => entry.approved).length
  };
}

export function createPackageManifest({ entries = [], settings = {}, metadata = {}, now = new Date() } = {}) {
  const normalized = createPackageDeliverySettings(settings);
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const summary = summarizePackageEntries(entries);
  return {
    schema: 'https://stixio.app/schemas/package-manifest/v1',
    schemaVersion: '1.0.0',
    generator: {
      name: 'Stixio Workshop',
      version: metadata.generatorVersion || '0.9.0-beta'
    },
    generatedAt,
    destinationKey: metadata.destinationKey || 'workshop',
    project: {
      id: metadata.documentId || null,
      name: metadata.documentName || normalized.zipBaseName
    },
    output: {
      width: Number(metadata.targetW || 0),
      height: Number(metadata.targetH || 0),
      category: metadata.category || null,
      safeMargin: Number(metadata.safeMargin || 0)
    },
    delivery: {
      zipFileName: normalizeZipFileName(normalized.zipBaseName),
      rootFolder: normalized.rootFolder,
      folderMode: normalized.folderMode,
      compression: normalized.compression,
      compressionLevel: normalized.compressionLevel
    },
    summary,
    files: entries.map(entry => ({
      path: entry.path,
      fileName: entry.fileName,
      frameId: entry.frameId,
      name: entry.name,
      role: entry.role,
      sourceImageId: entry.sourceImageId,
      sourceName: entry.sourceName,
      order: entry.order,
      stickerIndex: entry.stickerIndex,
      width: entry.width,
      height: entry.height,
      bytes: entry.bytes,
      sha256: entry.sha256,
      approved: entry.approved
    }))
  };
}

export function createPackageManifestCsv(entries = []) {
  const rows = [[
    'path', 'fileName', 'frameId', 'name', 'role', 'sourceImageId', 'sourceName',
    'order', 'stickerIndex', 'width', 'height', 'bytes', 'sha256', 'approved'
  ]];
  entries.forEach(entry => rows.push([
    entry.path,
    entry.fileName,
    entry.frameId,
    entry.name,
    entry.role,
    entry.sourceImageId,
    entry.sourceName,
    entry.order,
    entry.stickerIndex ?? '',
    entry.width,
    entry.height,
    entry.bytes,
    entry.sha256 || '',
    entry.approved
  ]));
  return rows.map(row => row.map(csvValue).join(',')).join('\n');
}

export function createChecksumsFile(entries = []) {
  return entries
    .filter(entry => entry.sha256)
    .map(entry => `${entry.sha256}  ${entry.path}`)
    .join('\n');
}

export function createPackageReadme({ manifest, settings = {} } = {}) {
  const normalized = createPackageDeliverySettings(settings);
  const summary = manifest?.summary || { imageCount: 0, totalSizeLabel: '0 B' };
  return [
    'Stixio Workshop Package',
    '========================',
    '',
    `Generated: ${manifest?.generatedAt || new Date().toISOString()}`,
    `Images: ${summary.imageCount}`,
    `Estimated PNG size: ${summary.totalSizeLabel}`,
    `Folder mode: ${normalized.folderMode}`,
    `Compression: ${normalized.compression}`,
    '',
    'Package contents:',
    '- PNG artwork files',
    normalized.includeManifestJson ? `- ${normalized.manifestBaseName}.json` : null,
    normalized.includeManifestCsv ? `- ${normalized.manifestBaseName}.csv` : null,
    normalized.includeChecksums ? '- checksums.sha256' : null,
    '',
    'Checksums use SHA-256 and cover PNG artwork files only.'
  ].filter(value => value != null).join('\n');
}

export async function addPackageChecksums(entries = [], { cryptoImpl = globalThis.crypto, onProgress = null, signal = null } = {}) {
  const next = [];
  for (let index = 0; index < entries.length; index += 1) {
    throwIfAborted(signal);
    const entry = entries[index];
    const bytes = packageEntryBytes(entry);
    const sha256 = await sha256Hex(bytes, cryptoImpl);
    next.push({ ...entry, sha256 });
    onProgress?.({
      stage: PackageJobStatuses.HASHING,
      percent: entries.length ? Math.round((index + 1) / entries.length * 100) : 100,
      current: entry.path
    });
  }
  return next;
}

export async function createCompletePackageArchive({
  entries = [],
  settings = {},
  metadata = {},
  JSZipClass = globalThis.JSZip,
  cryptoImpl = globalThis.crypto,
  onProgress = null,
  signal = null,
  now = new Date()
} = {}) {
  if (!JSZipClass) throw new Error('JSZip is not available.');
  const normalized = createPackageDeliverySettings(settings);
  const validation = validatePackageEntries(entries, normalized);
  if (!validation.ready) {
    const error = new Error(validation.errors[0]?.message || 'Package validation failed.');
    error.name = 'PackageValidationError';
    error.issues = validation.errors;
    throw error;
  }

  throwIfAborted(signal);
  onProgress?.({ stage: PackageJobStatuses.PREPARING, percent: 0 });
  const hashedEntries = normalized.includeChecksums
    ? await addPackageChecksums(entries, { cryptoImpl, onProgress, signal })
    : entries.map(entry => ({ ...entry, sha256: null }));
  const manifest = createPackageManifest({ entries: hashedEntries, settings: normalized, metadata, now });
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestCsv = createPackageManifestCsv(hashedEntries);
  const checksums = createChecksumsFile(hashedEntries);
  const readme = createPackageReadme({ manifest, settings: normalized });

  const zip = new JSZipClass();
  hashedEntries.forEach(entry => {
    throwIfAborted(signal);
    zip.file(entry.path, packageEntryBase64(entry), { base64: true });
  });
  const supportFiles = [];
  const supportPath = fileName => normalized.rootFolder ? `${normalized.rootFolder}/${fileName}` : fileName;
  if (normalized.includeManifestJson) {
    const path = supportPath(`${normalized.manifestBaseName}.json`);
    zip.file(path, manifestJson);
    supportFiles.push(path);
  }
  if (normalized.includeManifestCsv) {
    const path = supportPath(`${normalized.manifestBaseName}.csv`);
    zip.file(path, manifestCsv);
    supportFiles.push(path);
  }
  if (normalized.includeChecksums) {
    const path = supportPath('checksums.sha256');
    zip.file(path, checksums);
    supportFiles.push(path);
  }
  if (normalized.includeReadme) {
    const path = supportPath('README.txt');
    zip.file(path, readme);
    supportFiles.push(path);
  }

  throwIfAborted(signal);
  const compression = normalized.compression === PackageCompressionModes.DEFLATE ? 'DEFLATE' : 'STORE';
  const blob = await zip.generateAsync({
    type: 'blob',
    compression,
    compressionOptions: compression === 'DEFLATE' ? { level: normalized.compressionLevel } : undefined
  }, update => {
    throwIfAborted(signal);
    onProgress?.({
      stage: PackageJobStatuses.COMPRESSING,
      percent: Math.round(Number(update.percent || 0)),
      current: update.currentFile || null
    });
  });

  throwIfAborted(signal);
  let verification = {
    verified: true,
    expectedCount: hashedEntries.length + supportFiles.length,
    actualCount: hashedEntries.length + supportFiles.length,
    missing: [],
    unexpected: []
  };
  if (normalized.verifyArchive) {
    onProgress?.({ stage: PackageJobStatuses.VERIFYING, percent: 0 });
    verification = await verifyPackageArchive({
      blob,
      expectedPaths: [...hashedEntries.map(entry => entry.path), ...supportFiles],
      JSZipClass,
      signal
    });
    if (!verification.verified) {
      const error = new Error(`Package verification failed. Missing: ${verification.missing.join(', ') || 'none'}.`);
      error.name = 'PackageVerificationError';
      error.verification = verification;
      throw error;
    }
  }

  onProgress?.({ stage: PackageJobStatuses.COMPLETE, percent: 100 });
  return {
    blob,
    fileName: normalizeZipFileName(normalized.zipBaseName),
    entries: hashedEntries,
    supportFiles,
    manifest,
    manifestJson,
    manifestCsv,
    checksums,
    readme,
    verification,
    settings: normalized,
    summary: summarizePackageEntries(hashedEntries)
  };
}

export async function verifyPackageArchive({ blob, expectedPaths = [], JSZipClass = globalThis.JSZip, signal = null } = {}) {
  if (!JSZipClass) throw new Error('JSZip is not available.');
  throwIfAborted(signal);
  const loader = typeof JSZipClass.loadAsync === 'function' ? JSZipClass : new JSZipClass();
  const archive = await loader.loadAsync(blob);
  throwIfAborted(signal);
  const actualPaths = Object.entries(archive.files || {})
    .filter(([, file]) => !file.dir)
    .map(([path]) => path)
    .sort();
  const expected = [...new Set(expectedPaths)].sort();
  const actualSet = new Set(actualPaths);
  const expectedSet = new Set(expected);
  const missing = expected.filter(path => !actualSet.has(path));
  const unexpected = actualPaths.filter(path => !expectedSet.has(path));
  return {
    verified: missing.length === 0 && unexpected.length === 0,
    expectedCount: expected.length,
    actualCount: actualPaths.length,
    missing,
    unexpected,
    paths: actualPaths
  };
}

export async function sha256Hex(input, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) throw new Error('SHA-256 is not available in this environment.');
  const bytes = toUint8Array(input);
  const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function packageEntryBytes(entry) {
  if (entry.bytesData) return toUint8Array(entry.bytesData);
  const base64 = packageEntryBase64(entry);
  if (typeof atob === 'function') {
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
  throw new Error(`Cannot decode PNG data for ${entry.path || entry.fileName}.`);
}

export function packageEntryBase64(entry) {
  if (entry.base64) return String(entry.base64).replace(/^data:image\/png;base64,/, '');
  if (!entry.canvas?.toDataURL) throw new Error(`Missing PNG canvas for ${entry.path || entry.fileName}.`);
  return entry.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

export function estimatePackageCanvasBytes(canvas) {
  if (!canvas?.toDataURL) return 0;
  try {
    const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    return Math.max(0, Math.floor(base64.length * 3 / 4));
  } catch {
    return 0;
  }
}

export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes || 0));
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function packageIssue(code, message, severity, metadata = {}) {
  return {
    code,
    message,
    severity,
    frameId: metadata.frameId || metadata.artworkId || null,
    path: metadata.path || null,
    metadata
  };
}

function resolveSourceName(sourceNames, sourceId) {
  if (!sourceId) return '';
  if (sourceNames instanceof Map) return sourceNames.get(sourceId) || '';
  if (typeof sourceNames === 'function') return sourceNames(sourceId) || '';
  return sourceNames?.[sourceId] || '';
}

function dedupeIssues(issues = []) {
  const seen = new Set();
  return issues.filter(issue => {
    const key = [issue.code, issue.frameId || '', issue.path || '', issue.message || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (Array.isArray(input)) return Uint8Array.from(input);
  throw new TypeError('Unsupported SHA-256 input.');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error('Package export cancelled.');
  error.name = 'AbortError';
  throw error;
}

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
