import { migrateWorkshopSource, rewriteWorkshopImports } from './native-workspace-migrator.js';

const sourceUrl = new URL('./stixio-workshop-app-v2.backup.js', import.meta.url);
const constantsUrl = new URL('../../scripts/native_migration/constants.txt', import.meta.url);
const rendererUrl = new URL('../../scripts/native_migration/render_block.txt', import.meta.url);
let modulePromise;

export async function bootNativeWorkshop(root) {
  if (!modulePromise) modulePromise = loadNativeModule();
  const nativeModule = await modulePromise;
  return nativeModule.initStixioWorkshop(root);
}

async function loadNativeModule() {
  const [source, constants, renderer] = await Promise.all([
    loadText(sourceUrl),
    loadText(constantsUrl),
    loadText(rendererUrl)
  ]);
  const migrated = migrateWorkshopSource(source, { constants, renderer });
  const executable = rewriteWorkshopImports(migrated, import.meta.url);
  const moduleUrl = URL.createObjectURL(new Blob([executable], { type: 'text/javascript' }));
  const nativeModule = await import(moduleUrl);
  URL.revokeObjectURL(moduleUrl);
  return nativeModule;
}

async function loadText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${url.pathname}: HTTP ${response.status}`);
  return response.text();
}
