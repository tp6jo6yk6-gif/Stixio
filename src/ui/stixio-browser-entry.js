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

const coreWorkflowStages = [
  { id: 'layout', number: '01', label: 'Layout', detail: 'Frame artwork', target: 'stage-layout' },
  { id: 'refine', number: '02', label: 'Refine', detail: 'Clean masks', target: 'stage-refine' },
  { id: 'review', number: '03', label: 'Review', detail: 'Approve output', target: 'stage-review' },
  { id: 'package', number: '04', label: 'Package', detail: 'Export files', target: 'stage-package' }
];

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
  if (!nav || nav.dataset.coreWorkflowTabs === 'true') return;

  nav.dataset.coreWorkflowTabs = 'true';
  nav.className = 'mx-auto max-w-[1600px] px-5 pb-3';
  nav.innerHTML = `<div class="rounded-2xl border border-slate-900/10 bg-white/90 p-2 shadow-sm backdrop-blur" role="tablist" aria-label="Stixio core workflow">
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      ${coreWorkflowStages.map(stage => coreWorkflowTab(stage)).join('')}
    </div>
  </div>`;

  nav.querySelectorAll('[data-core-workflow-tab]').forEach(button => {
    button.addEventListener('click', () => activateCoreWorkflowTab(root, button.dataset.coreWorkflowTab, { scroll: true }));
  });

  syncCoreWorkflowOffsets(root);
  installCoreWorkflowSpy(root);
  activateCoreWorkflowTab(root, 'layout');
  window.addEventListener('resize', () => syncCoreWorkflowOffsets(root), { passive: true });
}

function coreWorkflowTab(stage) {
  return `<button type="button" role="tab" aria-selected="false" aria-controls="${stage.target}" data-core-workflow-tab="${stage.id}" class="min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-left text-slate-700 transition">
    <span class="block truncate text-[10px] font-black uppercase tracking-[.14em] text-slate-400">${stage.number}</span>
    <span class="mt-0.5 block truncate text-sm font-black">${stage.label}</span>
    <span class="block truncate text-[11px] font-bold opacity-70">${stage.detail}</span>
  </button>`;
}

function activateCoreWorkflowTab(root, stageId, options = {}) {
  const activeStage = coreWorkflowStages.find(stage => stage.id === stageId) || coreWorkflowStages[0];
  const nav = root?.querySelector('header nav[aria-label="Workshop workflow"]');
  if (!nav) return;

  nav.querySelectorAll('[data-core-workflow-tab]').forEach(button => {
    const active = button.dataset.coreWorkflowTab === activeStage.id;
    button.setAttribute('aria-selected', String(active));
    button.className = active
      ? 'min-w-0 rounded-xl bg-slate-950 px-3 py-2 text-left text-white shadow-sm transition'
      : 'min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100';
    const number = button.querySelector('span');
    if (number) number.className = active
      ? 'block truncate text-[10px] font-black uppercase tracking-[.14em] text-emerald-300'
      : 'block truncate text-[10px] font-black uppercase tracking-[.14em] text-slate-400';
  });

  if (options.scroll) {
    document.getElementById(activeStage.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function syncCoreWorkflowOffsets(root) {
  const header = root?.querySelector('header');
  const offset = Math.ceil((header?.getBoundingClientRect().height || 140) + 16);
  coreWorkflowStages.forEach(stage => {
    const target = document.getElementById(stage.target);
    if (target) target.style.scrollMarginTop = `${offset}px`;
  });
}

function installCoreWorkflowSpy(root) {
  const targets = coreWorkflowStages
    .map(stage => ({ ...stage, element: document.getElementById(stage.target) }))
    .filter(stage => stage.element);
  if (!targets.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
      const stage = visible && targets.find(item => item.element === visible.target);
      if (stage) activateCoreWorkflowTab(root, stage.id);
    }, { rootMargin: '-28% 0px -58% 0px', threshold: [0, 0.2, 0.6] });
    targets.forEach(stage => observer.observe(stage.element));
    return;
  }

  window.addEventListener('scroll', () => {
    const stage = targets
      .map(item => ({ ...item, distance: Math.abs(item.element.getBoundingClientRect().top - 120) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (stage) activateCoreWorkflowTab(root, stage.id);
  }, { passive: true });
}
