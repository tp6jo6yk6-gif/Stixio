// NATIVE_WORKSPACE_RENDERING
import { migrateWorkshopSource, rewriteWorkshopImports } from './native-workspace-migrator.js';

const BUILD_ID = 'native-workspaces-v1';
const SOURCE_URL = new URL('./stixio-workshop-app-v2.backup.js', import.meta.url);
const CONSTANTS_URL = new URL('../../scripts/native_migration/constants.txt', import.meta.url);
const RENDERER_URL = new URL('../../scripts/native_migration/render_block.txt', import.meta.url);

let nativeModulePromise;

export async function initStixioWorkshop(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  root.dataset.stixioBuild = BUILD_ID;
  try {
    const nativeModule = await loadNativeModule();
    return nativeModule.initStixioWorkshop(root);
  } catch (error) {
    console.error('Stixio native Workspace bootstrap failed.', error);
    root.innerHTML = renderBootstrapError(error);
    throw error;
  }
}

async function loadNativeModule() {
  if (!nativeModulePromise) nativeModulePromise = createNativeModule();
  return nativeModulePromise;
}

async function createNativeModule() {
  const [source, constants, renderer] = await Promise.all([
    fetchText(SOURCE_URL),
    fetchText(CONSTANTS_URL),
    fetchText(RENDERER_URL)
  ]);
  const migrated = migrateWorkshopSource(source, { constants, renderer });
  const executable = rewriteWorkshopImports(migrated, import.meta.url);
  const moduleUrl = URL.createObjectURL(new Blob([`${executable}\n//# sourceURL=stixio-native-workspaces.js`], { type: 'text/javascript' }));
  try {
    return await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${url.pathname}: HTTP ${response.status}`);
  return response.text();
}

function renderBootstrapError(error) {
  const message = escapeHtml(error instanceof Error ? error.message : String(error));
  return `<main class="grid min-h-screen place-items-center bg-[#f6f3ec] p-6 text-slate-950"><section class="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-white p-8 shadow-xl"><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">STIXIO BOOTSTRAP ERROR</p><h1 class="mt-2 text-2xl font-black">原生 Workspace 無法啟動</h1><p class="mt-3 text-sm font-bold leading-6 text-slate-500">${message}</p><button type="button" class="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white" onclick="location.reload()">重新載入</button></section></main>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
