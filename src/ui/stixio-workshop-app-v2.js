import { bootNativeWorkshop } from './native-workspace-runtime.js';

export async function initStixioWorkshop(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  root.dataset.stixioBuild = 'native-workspaces-v1';
  try {
    return await bootNativeWorkshop(root);
  } catch (error) {
    console.error('Stixio native Workspace bootstrap failed.', error);
    root.innerHTML = renderBootstrapError(error);
    throw error;
  }
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
