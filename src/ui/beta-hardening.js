import {
  STIXIO_BETA_LIMITS,
  classifyStixioFailure,
  createDiagnosticsSnapshot,
  inspectStixioProjectArchive,
  validateImportFiles
} from './beta-hardening-core.js';
import { createDiagnosticsUi } from './diagnostics-ui.js';

const state = {
  installed: false,
  errors: [],
  storage: null,
  lastObservedError: null,
  mutationObserver: null,
  version: '1.0.0-rc.1',
  build: 'development',
  ui: null
};

export function installBetaHardening({ version, build } = {}) {
  if (typeof window === 'undefined' || state.installed) return globalThis.StixioDiagnostics || null;
  state.installed = true;
  state.version = version || document.querySelector('meta[name="stixio-version"]')?.content || state.version;
  const metaBuild = document.querySelector('meta[name="stixio-build"]')?.content || 'development';
  state.build = build || (metaBuild.startsWith('__') ? 'development' : metaBuild);
  state.ui = createDiagnosticsUi({ getSnapshot: diagnosticsSnapshot, onClear: () => { state.errors = []; } });
  bindGlobalFailureHandlers();
  bindImportGuards();
  observeApplicationErrors();
  void refreshStorageEstimate();
  validateRuntimeAssets();

  const api = {
    reportError,
    show: state.ui.show,
    hide: state.ui.hide,
    snapshot: diagnosticsSnapshot,
    inspectProjectArchive: inspectStixioProjectArchive,
    getErrors: () => state.errors.map(item => ({ ...item }))
  };
  globalThis.StixioDiagnostics = api;
  return api;
}

function diagnosticsSnapshot() {
  return createDiagnosticsSnapshot({ version: state.version, build: state.build, storage: state.storage, errors: state.errors });
}

function bindGlobalFailureHandlers() {
  window.addEventListener('error', event => reportError(event.error || new Error(event.message || 'Window error'), { source: 'window.error' }));
  window.addEventListener('unhandledrejection', event => reportError(event.reason || new Error('Unhandled promise rejection'), { source: 'unhandledrejection' }));
  window.addEventListener('offline', () => reportError(new Error('Network offline'), { source: 'network', severity: 'warning' }));
  window.addEventListener('online', () => state.ui.setBanner({ title: '已恢復連線', message: '需要網路的操作現在可以重新執行。', recovery: '', severity: 'info' }));

  window.__stixioNativeAlert = window.alert.bind(window);
  window.alert = message => reportError(new Error(String(message || '操作無法完成。')), { source: 'application-alert', userVisible: true });
}

function bindImportGuards() {
  document.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'file') return;
    if (target.id === 'fileInput') guardImageInput(event, target);
    if (target.id === 'projectOpenInput') guardProjectInput(event, target);
  }, true);
}

function guardImageInput(event, input) {
  const validation = validateImportFiles(input.files);
  if (!validation.rejected.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const first = validation.rejected[0];
  input.value = '';
  const error = new Error(first.message);
  error.name = 'ImageImportError';
  reportError(error, { source: 'image-import', userVisible: true });
}

function guardProjectInput(event, input) {
  if (input.dataset.stixioValidated === 'true') {
    delete input.dataset.stixioValidated;
    return;
  }
  const file = input.files?.[0];
  if (!file) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void inspectStixioProjectArchive(file)
    .then(() => {
      input.dataset.stixioValidated = 'true';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })
    .catch(error => {
      input.value = '';
      reportError(error, { source: 'project-open-preflight', userVisible: true });
    });
}

function observeApplicationErrors() {
  state.mutationObserver = new MutationObserver(() => {
    const projectStatus = document.querySelector('#projectAutosaveStatus')?.textContent?.trim();
    if (projectStatus?.startsWith('錯誤') && projectStatus !== state.lastObservedError) {
      state.lastObservedError = projectStatus;
      reportError(new Error(projectStatus.replace(/^錯誤\s*·?\s*/, '')), { source: 'project-storage', userVisible: true });
    }
    const packageError = document.querySelector('#packageProgress .text-rose-300')?.textContent?.trim();
    if (packageError && packageError !== state.lastObservedError) {
      state.lastObservedError = packageError;
      reportError(new Error(packageError), { source: 'package-export', userVisible: true });
    }
  });
  state.mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}

async function refreshStorageEstimate() {
  try {
    state.storage = await navigator.storage?.estimate?.() || null;
    const remaining = Number(state.storage?.quota || 0) - Number(state.storage?.usage || 0);
    if (state.storage?.quota && remaining < STIXIO_BETA_LIMITS.minimumStorageHeadroomBytes) {
      const error = new DOMException(`剩餘瀏覽器儲存空間不足（${Math.max(0, remaining)} bytes）。`, 'QuotaExceededError');
      reportError(error, { source: 'storage-estimate', severity: 'warning', userVisible: true });
    }
  } catch (error) {
    reportError(error, { source: 'storage-estimate', severity: 'warning', userVisible: false });
  }
  state.ui.render();
}

function validateRuntimeAssets() {
  const missing = [];
  if (!globalThis.JSZip) missing.push('JSZip');
  const scripts = [...document.scripts].map(script => script.src).filter(Boolean);
  if (!scripts.some(src => src.includes('tailwindcss-browser-4.3.2.js'))) missing.push('Tailwind browser bundle');
  if (missing.length) {
    const error = new Error(`缺少必要資源：${missing.join('、')}`);
    error.name = 'RuntimeAssetError';
    reportError(error, { source: 'runtime-assets', userVisible: true });
  }
}

function reportError(error, context = {}) {
  const issue = classifyStixioFailure(error, context);
  const record = {
    ...issue,
    source: context.source || 'unknown',
    time: new Date().toISOString(),
    severity: context.severity || issue.severity
  };
  state.errors.push(record);
  if (state.errors.length > 30) state.errors.splice(0, state.errors.length - 30);
  if (context.userVisible !== false && record.severity !== 'info') state.ui.setBanner(record);
  state.ui.render();
  window.dispatchEvent(new CustomEvent('stixio:diagnostic-error', { detail: { ...record } }));
  return record;
}
