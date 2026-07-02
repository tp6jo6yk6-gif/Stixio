import {
  migrateWorkshopProject,
  validateWorkshopProject,
  verifyStixioProjectArchive
} from '../core/index.js';

export const STIXIO_BETA_LIMITS = Object.freeze({
  maxImageBytes: 64 * 1024 * 1024,
  maxProjectBytes: 512 * 1024 * 1024,
  maxProjectEntries: 5000,
  maxManifestBytes: 20 * 1024 * 1024,
  minimumStorageHeadroomBytes: 50 * 1024 * 1024
});

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'
]);

export function classifyStixioFailure(error, context = {}) {
  const name = String(error?.name || context.name || 'Error');
  const message = String(error?.message || error || context.message || '發生未預期錯誤。').slice(0, 1200);
  const haystack = `${name} ${message}`.toLowerCase();
  const defaults = {
    code: 'UNEXPECTED_ERROR', title: '操作沒有完成', message,
    recovery: '請先匯出或保存目前專案，重新整理頁面後再試一次。若問題持續，請下載診斷資訊。',
    severity: 'error'
  };
  if (/quota|storage|indexeddb|disk|space|容量|空間/.test(haystack)) {
    return { ...defaults, code: 'STORAGE_UNAVAILABLE', title: '瀏覽器儲存空間不足', recovery: '請先匯出 .stixio 備份，清理瀏覽器網站資料或磁碟空間，再重新開啟專案。' };
  }
  if (/checksum|corrupt|invalid .*stixio|project\s*archive|project\s*manifest|project\s*checksum|project\s*validation|project\s*version|project\s*path|project\.json|manifest|schema|zip.*invalid|crc|專案.*(損壞|缺少|無效|校驗|不安全)/.test(haystack)) {
    return { ...defaults, code: 'PROJECT_DAMAGED', title: '專案檔案可能已損壞', recovery: '請保留原始檔案，嘗試較早的備份或最近自動保存版本。不要覆蓋原檔。' };
  }
  if (/jszip|vendor|tailwind|script.*load|failed to fetch dynamically imported/.test(haystack)) {
    return { ...defaults, code: 'RUNTIME_ASSET_MISSING', title: '必要程式資源沒有載入', recovery: '請確認網路連線後重新整理。部署管理者應檢查本地 vendor bundle 是否存在。' };
  }
  if (/image|bitmap|decode|unsupported|mime|圖片|圖像/.test(haystack)) {
    return { ...defaults, code: 'IMAGE_UNSUPPORTED', title: '圖片無法讀取', recovery: '請改用 PNG、JPEG、WebP、GIF 或 SVG，並確認檔案沒有損壞且大小未超過限制。' };
  }
  if (/memory|allocation|canvas|out of memory|too large/.test(haystack)) {
    return { ...defaults, code: 'MEMORY_PRESSURE', title: '圖片或專案超出瀏覽器可用記憶體', recovery: '請先保存專案，關閉其他分頁，縮小原圖或分批處理後再試。' };
  }
  if (/network|offline|fetch|internet|連線/.test(haystack)) {
    return { ...defaults, code: 'NETWORK_UNAVAILABLE', title: '目前無法連線', recovery: '已載入的編輯內容仍可繼續使用；需要網路的操作請恢復連線後重試。', severity: 'warning' };
  }
  if (/abort|cancel|取消/.test(haystack)) {
    return { ...defaults, code: 'OPERATION_CANCELLED', title: '操作已取消', recovery: '目前資料未被刪除，可直接重新執行。', severity: 'info' };
  }
  return defaults;
}

export function validateImportFiles(files, limits = STIXIO_BETA_LIMITS) {
  const accepted = [];
  const rejected = [];
  for (const file of Array.from(files || [])) {
    const name = String(file?.name || '未命名檔案');
    const size = Number(file?.size || 0);
    const type = String(file?.type || '').toLowerCase();
    if (!size) rejected.push({ file, code: 'EMPTY_FILE', message: `${name} 是空白檔案。` });
    else if (!ALLOWED_IMAGE_TYPES.has(type)) rejected.push({ file, code: 'UNSUPPORTED_IMAGE_TYPE', message: `${name} 的格式 ${type || '未知'} 不受支援。` });
    else if (size > limits.maxImageBytes) rejected.push({ file, code: 'IMAGE_TOO_LARGE', message: `${name} 超過 ${formatBytes(limits.maxImageBytes)} 的單檔限制。` });
    else accepted.push(file);
  }
  return { accepted, rejected, ready: rejected.length === 0 };
}

export async function inspectStixioProjectArchive(file, {
  JSZipClass = globalThis.JSZip,
  cryptoImpl = globalThis.crypto,
  limits = STIXIO_BETA_LIMITS
} = {}) {
  if (!file) throw namedError('ProjectArchiveError', '未選擇 .stixio 專案檔案。');
  if (Number(file.size || 0) <= 0) throw namedError('ProjectArchiveError', '專案檔案是空白的。');
  if (Number(file.size || 0) > limits.maxProjectBytes) throw namedError('ProjectArchiveSizeError', `專案檔案超過 ${formatBytes(limits.maxProjectBytes)} 的 Beta 安全限制。`);
  if (!JSZipClass) throw namedError('RuntimeAssetError', 'JSZip is not available.');

  const loader = typeof JSZipClass.loadAsync === 'function' ? JSZipClass : new JSZipClass();
  let archive;
  try { archive = await loader.loadAsync(file); }
  catch (cause) {
    const error = namedError('ProjectArchiveError', '這不是有效的 .stixio 專案檔案。');
    error.cause = cause;
    throw error;
  }

  const entries = Object.entries(archive.files || {});
  if (entries.length > limits.maxProjectEntries) throw namedError('ProjectArchiveSizeError', `專案封裝包含過多檔案（${entries.length}）。`);
  for (const [path, entry] of entries) {
    const original = entry?.unsafeOriginalName || path;
    if (isUnsafeArchivePath(original)) throw namedError('ProjectArchivePathError', `專案含有不安全路徑：${original}`);
  }

  const projectFile = archive.file?.('project.json') || archive.files?.['project.json'];
  if (!projectFile) throw namedError('ProjectManifestError', '專案缺少 project.json。');
  const manifestBytes = await projectFile.async('uint8array');
  if (manifestBytes.byteLength > limits.maxManifestBytes) throw namedError('ProjectManifestError', `project.json 超過 ${formatBytes(limits.maxManifestBytes)} 的限制。`);

  let snapshot;
  try { snapshot = migrateWorkshopProject(JSON.parse(new TextDecoder().decode(manifestBytes))); }
  catch (cause) {
    const error = namedError(cause?.name || 'ProjectManifestError', cause?.message || '專案內容格式無效。');
    error.cause = cause;
    throw error;
  }
  const validation = validateWorkshopProject(snapshot);
  if (!validation.ready) {
    const error = namedError('ProjectValidationError', validation.errors[0]?.message || '專案內容驗證失敗。');
    error.issues = validation.errors;
    throw error;
  }

  const requiredPaths = ['project.json', 'checksums.sha256'];
  for (const source of snapshot.sources || []) if (source.assetPath) requiredPaths.push(source.assetPath);
  for (const frame of snapshot.document?.frames || []) {
    const maskPath = frame.custom?.protectMask?.assetPath;
    if (maskPath) requiredPaths.push(maskPath);
  }
  const verification = await verifyStixioProjectArchive({ blob: file, JSZipClass, cryptoImpl, requiredPaths });
  if (!verification.verified) {
    const error = namedError('ProjectChecksumError', `專案校驗失敗：${verification.errors[0] || '未知錯誤'}`);
    error.verification = verification;
    throw error;
  }
  return { snapshot, validation, verification, entryCount: entries.length };
}

export function createDiagnosticsSnapshot(environment = {}) {
  const navigatorValue = environment.navigator || globalThis.navigator || {};
  const screenValue = environment.screen || globalThis.screen || {};
  const locationValue = environment.location || globalThis.location || {};
  const storage = environment.storage || null;
  const errors = environment.errors || [];
  return {
    schema: 'stixio-diagnostics/v1', generatedAt: new Date().toISOString(),
    app: { name: 'Stixio Workshop', version: environment.version || 'unknown', build: environment.build || 'development' },
    runtime: {
      online: typeof navigatorValue.onLine === 'boolean' ? navigatorValue.onLine : null,
      userAgent: String(navigatorValue.userAgent || ''), language: String(navigatorValue.language || ''), platform: String(navigatorValue.platform || ''),
      viewport: { width: Number(environment.innerWidth || globalThis.innerWidth || 0), height: Number(environment.innerHeight || globalThis.innerHeight || 0), devicePixelRatio: Number(environment.devicePixelRatio || globalThis.devicePixelRatio || 1) },
      screen: { width: Number(screenValue.width || 0), height: Number(screenValue.height || 0) },
      path: String(locationValue.pathname || ''),
      features: { indexedDB: Boolean(environment.indexedDB ?? globalThis.indexedDB), canvas: typeof globalThis.HTMLCanvasElement !== 'undefined', cryptoSubtle: Boolean(globalThis.crypto?.subtle), jszip: Boolean(globalThis.JSZip), serviceWorker: Boolean(navigatorValue.serviceWorker) }
    },
    storage: storage ? { usage: Number(storage.usage || 0), quota: Number(storage.quota || 0), remaining: Math.max(0, Number(storage.quota || 0) - Number(storage.usage || 0)) } : null,
    recentErrors: errors.slice(-30).map(item => ({ time: item.time, code: item.code, title: item.title, message: String(item.message || '').slice(0, 1200), source: item.source || 'unknown' }))
  };
}

export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes || 0));
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function isUnsafeArchivePath(path) {
  const normalized = String(path || '').replace(/\\/g, '/');
  return normalized.startsWith('/') || /^[a-z]:\//i.test(normalized) || normalized.split('/').some(segment => segment === '..');
}

function namedError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}
