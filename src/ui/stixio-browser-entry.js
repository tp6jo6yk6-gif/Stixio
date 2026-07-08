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
  { id: 'layout', number: '01', label: 'Layout', detail: 'Import and frame', target: 'stage-layout' },
  { id: 'refine', number: '02', label: 'Refine', detail: 'Clean masks', target: 'stage-refine' },
  { id: 'review', number: '03', label: 'Review', detail: 'Approve output', target: 'stage-review' },
  { id: 'package', number: '04', label: 'Package', detail: 'Export files', target: 'stage-package' }
];

const mainGridClass = 'mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-5 py-6';
const threeColumnGrid = `${mainGridClass} xl:grid-cols-[360px_minmax(0,1fr)_340px]`;
const focusedGrid = `${mainGridClass} xl:grid-cols-[340px_minmax(0,1fr)]`;
const reviewGrid = `${mainGridClass} xl:grid-cols-[minmax(0,1fr)_340px]`;

const workflowPanels = {
  layout: [
    '#stage-layout',
    '#stage-layout + section',
    '#sourceCanvas',
    '#sourceList',
    '#selectedInfo'
  ],
  refine: [
    '#refine-settings-panel',
    '#stage-refine'
  ],
  review: [
    '#stage-review',
    '#reviewGateStatus'
  ],
  package: [
    '#destinationRulesRoot',
    '#package-rules-panel',
    '#stage-package',
    '#packageSettingsRoot'
  ]
};

const workflowGridClasses = {
  layout: threeColumnGrid,
  refine: focusedGrid,
  review: reviewGrid,
  package: threeColumnGrid
};

let activeCoreWorkflowStage = 'layout';
let workflowMutationFrame = null;
let restoringWorkflowScroll = false;
const workflowScrollPositions = new Map();

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

  if (nav.dataset.coreWorkflowTabs !== 'true') {
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
  }

  syncCoreWorkflowOffsets(root);
  activateCoreWorkflowTab(root, activeCoreWorkflowStage);
  installWorkflowMutationGuard(root);
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

  if (options.scroll) rememberWorkflowScroll(activeCoreWorkflowStage);
  activeCoreWorkflowStage = activeStage.id;

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

  applyFocusedWorkflowLayout(root, activeStage.id);

  if (options.scroll) restoreWorkflowScroll(activeStage.id);
}

function applyFocusedWorkflowLayout(root, stageId) {
  const main = root?.querySelector('main');
  if (!main) return;

  document.documentElement.dataset.stixioCoreStage = stageId;
  const allowedPanels = new Set(resolveWorkflowPanels(root, stageId));
  resolveWorkflowPanels(root).forEach(panel => {
    panel.hidden = !allowedPanels.has(panel);
  });

  [...main.children].forEach(column => {
    const hasVisiblePanel = [...column.children].some(child => !child.hidden);
    column.hidden = !hasVisiblePanel;
  });

  main.className = workflowGridClasses[stageId] || threeColumnGrid;
  if (stageId === 'review') resetReviewGalleryLayout(root);
  syncStageActions(root, stageId);
  syncCoreWorkflowOffsets(root);
}

function resetReviewGalleryLayout(root) {
  const board = root?.querySelector('#stage-review');
  const reviewGridNode = root?.querySelector('#reviewGrid');
  const heroStage = root?.querySelector('#reviewHeroStage');
  if (!board || !reviewGridNode || !heroStage) return;

  const titleBlock = board.firstElementChild;
  let gallery = board.querySelector('#coreReviewGallery');
  if (!gallery) {
    gallery = document.createElement('div');
    gallery.id = 'coreReviewGallery';
    gallery.className = 'mt-4 grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]';
    gallery.innerHTML = `
      <section id="coreReviewThumbPane" class="min-w-0 rounded-3xl bg-slate-50 p-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Review Gallery</p>
            <h3 class="text-sm font-black">縮圖總覽</h3>
          </div>
          <span class="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-400">All Frames</span>
        </div>
      </section>
      <section id="coreReviewPreviewPane" class="min-w-0"></section>`;
    if (titleBlock?.nextSibling) board.insertBefore(gallery, titleBlock.nextSibling);
    else board.appendChild(gallery);
  }

  const thumbPane = gallery.querySelector('#coreReviewThumbPane');
  const previewPane = gallery.querySelector('#coreReviewPreviewPane');
  const filters = root.querySelector('#reviewSearchInput')?.closest('.mt-4.grid');
  const progress = root.querySelector('#reviewProgressBar');
  const backgroundTools = root.querySelector('[data-review-bg]')?.closest('.mt-3.flex');
  const heroLayout = heroStage.closest('.mt-4.grid');
  const bulkActions = root.querySelector('#reviewSelectAllBtn')?.closest('.mt-4.flex');

  if (filters && thumbPane && !thumbPane.contains(filters)) {
    filters.className = 'mt-3 grid gap-2 rounded-2xl bg-white p-3';
    thumbPane.appendChild(filters);
  }
  if (progress && thumbPane && !thumbPane.contains(progress)) {
    progress.className = 'mt-3';
    thumbPane.appendChild(progress);
  }
  if (reviewGridNode && thumbPane && !thumbPane.contains(reviewGridNode)) {
    reviewGridNode.className = 'mt-3 grid max-h-[64vh] grid-cols-2 gap-2 overflow-auto pr-1 xl:grid-cols-1';
    thumbPane.appendChild(reviewGridNode);
  }

  if (backgroundTools && previewPane && !previewPane.contains(backgroundTools)) {
    backgroundTools.className = 'flex flex-wrap items-center gap-2 rounded-3xl bg-slate-50 p-3';
    previewPane.appendChild(backgroundTools);
  }
  if (heroLayout && previewPane && !previewPane.contains(heroLayout)) {
    heroLayout.className = 'mt-3 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_250px]';
    previewPane.appendChild(heroLayout);
  }
  if (bulkActions && previewPane && !previewPane.contains(bulkActions)) {
    bulkActions.className = 'mt-3 flex flex-wrap gap-2';
    previewPane.appendChild(bulkActions);
  }
}

function syncStageActions(root, stageId) {
  const exportZip = root?.querySelector('#exportZipBtn');
  if (exportZip) exportZip.hidden = stageId !== 'package';
}

function rememberWorkflowScroll(stageId) {
  if (!stageId || restoringWorkflowScroll) return;
  workflowScrollPositions.set(stageId, currentScrollY());
}

function restoreWorkflowScroll(stageId) {
  const targetTop = workflowScrollPositions.has(stageId) ? workflowScrollPositions.get(stageId) : 0;
  restoringWorkflowScroll = true;
  requestAnimationFrame(() => {
    const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(targetTop, maxTop), left: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
      restoringWorkflowScroll = false;
    });
  });
}

function currentScrollY() {
  return Math.max(0, window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0);
}

function resolveWorkflowPanels(root, stageId = null) {
  const selectors = stageId
    ? workflowPanels[stageId] || []
    : [...new Set(Object.values(workflowPanels).flat())];
  const panels = [];
  selectors.forEach(selector => {
    const node = root.querySelector(selector);
    const panel = node?.matches?.('section, div[id$="Root"]') ? node : node?.closest?.('section, div[id$="Root"]');
    if (panel && !panels.includes(panel)) panels.push(panel);
  });
  return panels;
}

function installWorkflowMutationGuard(root) {
  if (!root || root.dataset.coreWorkflowMutationGuard === 'true' || !('MutationObserver' in window)) return;
  root.dataset.coreWorkflowMutationGuard = 'true';
  const observer = new MutationObserver(() => {
    if (workflowMutationFrame) return;
    workflowMutationFrame = requestAnimationFrame(() => {
      workflowMutationFrame = null;
      const nav = root.querySelector('header nav[aria-label="Workshop workflow"]');
      if (!nav) return;
      if (nav.dataset.coreWorkflowTabs !== 'true') {
        alignCoreWorkflow(root);
        return;
      }
      activateCoreWorkflowTab(root, activeCoreWorkflowStage);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
}

function syncCoreWorkflowOffsets(root) {
  const header = root?.querySelector('header');
  const offset = Math.ceil((header?.getBoundingClientRect().height || 140) + 16);
  coreWorkflowStages.forEach(stage => {
    const target = document.getElementById(stage.target);
    if (target) target.style.scrollMarginTop = `${offset}px`;
  });
}
