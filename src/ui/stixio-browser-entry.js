import { initStixioWorkshopProgressive } from './stixio-workshop-app-v2.js';
import { enhanceWorkshopUx } from './workshop-ux.js';
import { bridgeWorkshopLegacyControls } from './workshop-ux-bridge.js';
import { installBetaHardening } from './beta-hardening.js';

const stageLabels = {
  shell: '正在建立工作區…',
  events: '正在啟用操作控制…',
  destination: '正在載入輸出規格…',
  package: '正在準備打包工具…',
  project: '正在連接專案儲存…',
  refresh: '正在完成工作區…',
  ux: '正在啟用操作體驗…',
  ready: '工作區已就緒'
};

void bootstrap();

async function bootstrap() {
  const root = document.getElementById('app');
  const diagnostics = installBetaHardening({ version: '1.0.0' });
  const html = document.documentElement;
  delete html.dataset.stixioReady;
  delete html.dataset.stixioBootError;

  const setStage = stage => {
    html.dataset.stixioBootStage = stage;
    const message = document.querySelector('#stixioBootStatus p');
    if (message) message.textContent = stageLabels[stage] || `正在啟動：${stage}`;
  };

  const watchdog = setTimeout(() => {
    if (html.dataset.stixioReady === 'true' || html.dataset.stixioBootError === 'true') return;
    html.dataset.stixioBootError = 'true';
    const stage = html.dataset.stixioBootStage || 'unknown';
    const error = new Error(`Stixio bootstrap stalled at stage ${stage}.`);
    diagnostics?.reportError(error, { source: `bootstrap-watchdog:${stage}`, userVisible: true });
    console.error('Stixio bootstrap stalled.', error);
  }, 15_000);

  try {
    await initStixioWorkshopProgressive(root, { onStage: setStage });
    setStage('ux');
    alignCoreWorkflow(root);
    enhanceWorkshopUx(root);
    bridgeWorkshopLegacyControls(root);
    if (html.dataset.stixioBootError === 'true') throw new Error('Stixio bootstrap did not finish.');
    html.dataset.stixioReady = 'true';
    html.dataset.stixioBootStage = 'ready';
    window.dispatchEvent(new CustomEvent('stixio:ready'));
  } catch (error) {
    html.dataset.stixioBootError = 'true';
    const stage = html.dataset.stixioBootStage || 'unknown';
    diagnostics?.reportError(error, { source: `bootstrap:${stage}`, userVisible: true });
    console.error('Stixio bootstrap failed.', error);
    if (root) {
      root.innerHTML = `<div id="stixioBootStatus" data-error="true" role="alert"><div><strong>Stixio 無法啟動</strong><p>啟動階段：${stage}。請重新整理；若問題持續，請下載診斷資訊並聯絡支援。</p></div></div>`;
    }
  } finally {
    clearTimeout(watchdog);
  }
}

function alignCoreWorkflow(root) {
  const nav = root?.querySelector('header nav[aria-label="Workshop workflow"]');
  if (!nav) return;

  nav.className = 'mx-auto max-w-[1600px] px-5 pb-4';
  nav.innerHTML = `<section aria-label="Core workflow" class="rounded-2xl border border-slate-900/10 bg-white px-4 py-3 shadow-sm">
    <div class="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Core flow only</div>
    <div class="mt-3 grid gap-2 md:grid-cols-4">
      ${coreFlowStep('01', 'Layout', 'Import and frame artwork', true)}
      ${coreFlowStep('02', 'Refine', 'Clean edges and masks')}
      ${coreFlowStep('03', 'Review', 'Inspect and approve')}
      ${coreFlowStep('04', 'Package', 'Export ZIP or project')}
    </div>
    <p class="mt-3 text-xs font-bold leading-5 text-slate-500">Stixio 1.0.0 uses one linear production path. Native Workspace tabs, hidden columns, and alternate page modes are deferred until after this flow is stable.</p>
  </section>`;
}

function coreFlowStep(number, label, detail, active = false) {
  return `<div class="rounded-xl ${active ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-700'} px-3 py-2">
    <div class="text-[10px] font-black uppercase tracking-[.16em] ${active ? 'text-emerald-300' : 'text-slate-400'}">${number}</div>
    <div class="mt-1 text-sm font-black">${label}</div>
    <div class="mt-0.5 text-[11px] font-bold opacity-70">${detail}</div>
  </div>`;
}
