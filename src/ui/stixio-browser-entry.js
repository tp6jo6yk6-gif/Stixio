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
  { id: 'layout', number: '01', label: 'Layout', detail: '匯入與裁切', target: 'stage-layout' },
  { id: 'refine', number: '02', label: 'Refine', detail: '修補與預覽', target: 'stage-refine' },
  { id: 'review', number: '03', label: 'Review', detail: '檢查與核准', target: 'stage-review' },
  { id: 'package', number: '04', label: 'Package', detail: '輸出與封裝', target: 'stage-package' }
];

const mainGridClass = 'mx-auto grid w-full max-w-[2400px] grid-cols-1 gap-0 px-0 py-0';
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
    '#stage-review',
    '#stage-refine',
    '#refine-settings-panel'
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
  refine: threeColumnGrid,
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
    installOriginalShellStyles();
    arrangeHeaderChrome(root);
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

function installOriginalShellStyles() {
  if (document.getElementById('stixio-original-shell-layout')) return;
  const style = document.createElement('style');
  style.id = 'stixio-original-shell-layout';
  style.textContent = `
    html,
    body,
    #app,
    #app > div {
      min-height: 100vh;
    }

    #app > div {
      display: flex;
      flex-direction: column;
      background: #f8fafc;
    }

    #app header {
      flex: 0 0 auto;
      border-bottom-color: rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.96);
    }

    #app header > div:first-child {
      max-width: 2400px;
      padding-bottom: 0.75rem;
      padding-top: 0.75rem;
    }

    #app main {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    #app main > aside,
    #app main > section {
      min-height: 0;
      overflow: auto;
      padding: 1.25rem;
    }

    #app main > section {
      background: #f1f5f9;
    }

    #app main > aside {
      background: #ffffff;
      border-left: 1px solid rgba(15, 23, 42, 0.1);
      border-right: 1px solid rgba(15, 23, 42, 0.06);
    }

    #app section[id^="stage-"],
    #app section.rounded-\[1\.75rem\],
    #app div[id$="Root"] > section {
      border-radius: 1rem !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
    }

    #app header nav[aria-label="Workshop workflow"] {
      order: 2;
      flex: 1 1 520px;
      max-width: 720px;
      min-width: 360px;
      margin: 0 1rem;
      padding: 0;
    }

    #app header > div:first-child > div:first-child {
      order: 1;
      flex: 0 0 auto;
    }

    #app header > div:first-child > div:last-child {
      order: 3;
      flex: 0 1 auto;
      min-width: 0;
      justify-content: flex-end;
    }

    #projectToolbarRoot {
      display: flex;
      min-width: 0;
    }

    #projectToolbarRoot > div {
      max-width: none !important;
      padding: 0 !important;
    }

    #projectToolbarRoot > div > div:first-child {
      flex-wrap: nowrap;
      gap: 0.35rem;
      border: 0;
      background: transparent;
      padding: 0;
      box-shadow: none;
    }

    #projectToolbarRoot #projectNameInput {
      width: 150px;
      min-width: 110px;
      flex: 0 1 150px;
      padding: 0.5rem 0.65rem;
    }

    #projectToolbarRoot button,
    #projectToolbarRoot label {
      padding: 0.5rem 0.65rem;
      white-space: nowrap;
    }

    #projectToolbarRoot #projectAutosaveStatus {
      display: none;
    }

    #projectToolbarRoot #projectProgress,
    #projectToolbarRoot #projectRecentPanel {
      position: absolute;
      right: 1.25rem;
      top: calc(100% - 0.35rem);
      z-index: 60;
      width: min(720px, calc(100vw - 2.5rem));
    }

    html[data-stixio-core-stage="refine"] #stage-review {
      display: block;
      padding: 1rem !important;
    }

    html[data-stixio-core-stage="refine"] #stage-review::before {
      content: '已切割單張';
      display: block;
      margin-bottom: 0.75rem;
      color: #0891b2;
      font-size: 0.68rem;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    html[data-stixio-core-stage="refine"] #stage-review > div:first-child,
    html[data-stixio-core-stage="refine"] #stage-review > div:nth-of-type(2),
    html[data-stixio-core-stage="refine"] #stage-review > div:nth-of-type(3),
    html[data-stixio-core-stage="refine"] #stage-review > div:nth-of-type(4),
    html[data-stixio-core-stage="refine"] #stage-review > div:nth-of-type(5),
    html[data-stixio-core-stage="refine"] #stage-review > #reviewProgressBar {
      display: none !important;
    }

    html[data-stixio-core-stage="refine"] #reviewGrid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.65rem;
      max-height: calc(100vh - var(--stixio-workflow-offset, 150px) - 3rem);
      overflow: auto;
      padding-right: 0.25rem;
    }

    html[data-stixio-core-stage="refine"] #reviewGrid [data-review-card="true"] {
      border-radius: 1rem;
      cursor: pointer;
      padding: 0.65rem;
    }

    html[data-stixio-core-stage="refine"] #reviewGrid [data-review-card="true"] > div:first-child {
      aspect-ratio: 1 / 1;
      min-height: 0;
    }

    html[data-stixio-core-stage="refine"] #reviewGrid .single-download,
    html[data-stixio-core-stage="refine"] #reviewGrid .role-select,
    html[data-stixio-core-stage="refine"] #reviewGrid .review-approve,
    html[data-stixio-core-stage="refine"] #reviewGrid .export-check,
    html[data-stixio-core-stage="refine"] #reviewGrid [data-review-card="true"] > div:nth-of-type(2) {
      display: none !important;
    }

    html[data-stixio-core-stage="review"] #stage-review {
      display: block;
    }

    html[data-stixio-core-stage="review"] #stage-review > div:nth-of-type(3),
    html[data-stixio-core-stage="review"] #stage-review > div:nth-of-type(4) {
      display: none;
    }

    html[data-stixio-core-stage="review"] #reviewGrid {
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      max-height: 68vh;
      overflow: auto;
    }

    html[data-stixio-core-stage="review"] #reviewGrid .single-download,
    html[data-stixio-core-stage="review"] #reviewGrid .role-select {
      display: none;
    }

    html[data-stixio-core-stage="review"] #reviewGrid [data-review-card="true"] {
      border-radius: 1.25rem;
      padding: 0.75rem;
      padding-bottom: 0.9rem;
    }

    html[data-stixio-core-stage="package"] #destinationRulesRoot,
    html[data-stixio-core-stage="package"] #package-rules-panel,
    html[data-stixio-core-stage="package"] #stage-package,
    html[data-stixio-core-stage="package"] #packageSettingsRoot {
      display: block;
    }

    @media (max-width: 1279px) {
      #app header > div:first-child {
        flex-wrap: wrap;
      }

      #app header nav[aria-label="Workshop workflow"] {
        order: 4;
        flex-basis: 100%;
        max-width: none;
        min-width: 0;
        margin: 0;
      }

      #projectToolbarRoot #projectNameInput {
        display: none;
      }

      #app main {
        overflow: auto;
      }

      #app main > aside,
      #app main > section {
        overflow: visible;
      }
    }
  `;
  document.head.appendChild(style);
}

function arrangeHeaderChrome(root) {
  const header = root?.querySelector('header');
  const bar = header?.firstElementChild;
  const nav = header?.querySelector('nav[aria-label="Workshop workflow"]');
  const projectToolbar = header?.querySelector('#projectToolbarRoot');
  const actions = bar?.lastElementChild;

  if (!header || !bar || !actions) return;
  bar.className = 'mx-auto flex max-w-[2400px] items-center justify-between gap-3 px-5 py-3';

  if (nav && !bar.contains(nav)) bar.insertBefore(nav, actions);
  if (projectToolbar && !actions.contains(projectToolbar)) actions.insertBefore(projectToolbar, actions.firstChild);
}

function alignCoreWorkflow(root) {
  const nav = root?.querySelector('header nav[aria-label="Workshop workflow"]');
  if (!nav) return;

  if (nav.dataset.coreWorkflowTabs !== 'true') {
    nav.dataset.coreWorkflowTabs = 'true';
    nav.className = 'min-w-0 flex-1';
    nav.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-100 p-1.5 shadow-sm" role="tablist" aria-label="Stixio four-page workflow">
      <div class="grid grid-cols-4 gap-1">
        ${coreWorkflowStages.map(stage => coreWorkflowTab(stage)).join('')}
      </div>
    </div>`;

    nav.querySelectorAll('[data-core-workflow-tab]').forEach(button => {
      button.addEventListener('click', () => activateCoreWorkflowTab(root, button.dataset.coreWorkflowTab, { scroll: true }));
    });
  }

  arrangeHeaderChrome(root);
  syncCoreWorkflowOffsets(root);
  activateCoreWorkflowTab(root, activeCoreWorkflowStage);
  installWorkflowMutationGuard(root);
  window.addEventListener('resize', () => syncCoreWorkflowOffsets(root), { passive: true });
}

function coreWorkflowTab(stage) {
  return `<button type="button" role="tab" aria-selected="false" aria-controls="${stage.target}" data-core-workflow-tab="${stage.id}" class="min-w-0 rounded-lg px-3 py-2 text-center text-xs font-black text-slate-500 transition">
    <span class="block truncate">${stage.number} ${stage.label}</span>
    <span class="mt-0.5 block truncate text-[10px] font-bold opacity-60">${stage.detail}</span>
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
      ? 'min-w-0 rounded-lg bg-white px-3 py-2 text-center text-xs font-black text-emerald-600 shadow-sm transition'
      : 'min-w-0 rounded-lg px-3 py-2 text-center text-xs font-black text-slate-500 transition hover:text-slate-700';
  });

  applyFocusedWorkflowLayout(root, activeStage.id);

  if (options.scroll) restoreWorkflowScroll(activeStage.id);
}

function applyFocusedWorkflowLayout(root, stageId) {
  const main = root?.querySelector('main');
  if (!main) return;

  document.documentElement.dataset.stixioCoreStage = stageId;
  organizeCoreWorkflowColumns(root, stageId);
  const allowedPanels = new Set(resolveWorkflowPanels(root, stageId));
  resolveWorkflowPanels(root).forEach(panel => {
    panel.hidden = !allowedPanels.has(panel);
  });

  [...main.children].forEach(column => {
    const hasVisiblePanel = [...column.children].some(child => !child.hidden);
    column.hidden = !hasVisiblePanel;
  });

  main.className = workflowGridClasses[stageId] || threeColumnGrid;
  syncStageActions(root, stageId);
  syncCoreWorkflowOffsets(root);
}

function organizeCoreWorkflowColumns(root, stageId) {
  if (stageId !== 'refine') return;
  const main = root?.querySelector('main');
  const leftColumn = main?.children?.[0];
  const middleColumn = main?.children?.[1];
  const rightColumn = main?.children?.[2];
  const framePicker = root?.querySelector('#stage-review');
  const refineStage = root?.querySelector('#stage-refine');
  const refineSettings = root?.querySelector('#refine-settings-panel');

  if (leftColumn && framePicker && framePicker.parentElement !== leftColumn) leftColumn.appendChild(framePicker);
  if (middleColumn && refineStage && refineStage.parentElement !== middleColumn) middleColumn.appendChild(refineStage);
  if (rightColumn && refineSettings && refineSettings.parentElement !== rightColumn) rightColumn.insertBefore(refineSettings, rightColumn.firstElementChild);
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
      arrangeHeaderChrome(root);
      activateCoreWorkflowTab(root, activeCoreWorkflowStage);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
}

function syncCoreWorkflowOffsets(root) {
  const header = root?.querySelector('header');
  const offset = Math.ceil((header?.getBoundingClientRect().height || 140) + 16);
  document.documentElement.style.setProperty('--stixio-workflow-offset', `${offset}px`);
  coreWorkflowStages.forEach(stage => {
    const target = document.getElementById(stage.target);
    if (target) target.style.scrollMarginTop = `${offset}px`;
  });
}
