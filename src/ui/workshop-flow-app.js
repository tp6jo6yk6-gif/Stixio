const WORKFLOW_STORAGE_KEY = 'stixio-workflow-stage';
const REFINED_STORAGE_KEY = 'stixio-refined-frame-ids';
const FLOW_STYLE_ID = 'stixio-workflow-app-style';
const FLOW_CACHE_ID = 'stixio-workflow-panel-cache';

export const WORKFLOW_STAGES = Object.freeze([
  {
    id: 'layout',
    step: '01',
    label: 'IMPORT',
    title: '匯入與切割',
    description: '匯入圖片並建立每張貼圖的裁切範圍。',
    accent: 'emerald'
  },
  {
    id: 'refine',
    step: '02',
    label: 'REFINE',
    title: '去背與修圖',
    description: '清除背景、修補邊緣並確認透明成品。',
    accent: 'rose'
  },
  {
    id: 'review',
    step: '03',
    label: 'REVIEW',
    title: '檢查與核准',
    description: '檢查尺寸、邊界、檔案大小與輸出內容。',
    accent: 'sky'
  },
  {
    id: 'package',
    step: '04',
    label: 'EXPORT',
    title: '打包與下載',
    description: '確認命名與檔案結構，產生完整貼圖包。',
    accent: 'amber'
  }
]);

const STAGE_IDS = new Set(WORKFLOW_STAGES.map(stage => stage.id));

const PANEL_DEFINITIONS = Object.freeze({
  import: '#stage-layout',
  detection: '#detectBtn',
  destination: '#destinationRulesRoot',
  output: '#package-rules-panel',
  refineSettings: '#refine-settings-panel',
  sourceEditor: '#sourceCanvas',
  refineEditor: '#stage-refine',
  reviewBoard: '#stage-review',
  packageBoard: '#packageWorkspaceRoot',
  sourceList: '#sourceList',
  selected: '#selectedInfo',
  reviewInspector: '#reviewGateStatus',
  packageSettings: '#packageSettingsRoot'
});

const WORKSPACE_LAYOUTS = Object.freeze({
  layout: {
    grid: 'xl:grid-cols-[360px_minmax(0,1fr)_340px]',
    left: ['import', 'detection', 'destination'],
    center: ['sourceEditor'],
    right: ['sourceList', 'selected']
  },
  refine: {
    grid: 'xl:grid-cols-[360px_minmax(0,1fr)_340px]',
    left: ['refineSettings'],
    center: ['refineEditor'],
    right: ['sourceList', 'selected']
  },
  review: {
    grid: 'xl:grid-cols-[minmax(0,1fr)_340px]',
    left: [],
    center: ['reviewBoard'],
    right: ['reviewInspector']
  },
  package: {
    grid: 'xl:grid-cols-[360px_minmax(0,1fr)_340px]',
    left: ['destination', 'output'],
    center: ['packageBoard'],
    right: ['packageSettings']
  }
});

export function enhanceWorkshopFlow(root = document.getElementById('app')) {
  if (!root || root.dataset.workflowApp === 'ready') return;
  root.dataset.workflowApp = 'ready';

  installFlowStyle();

  let activeStage = resolveInitialStage();
  const refinedFrameIds = loadRefinedFrameIds();
  let panelRegistry = new Map();
  let scheduled = false;
  let chromeTimer = null;

  const refreshChromeSoon = (delay = 0) => {
    if (chromeTimer) clearTimeout(chromeTimer);
    chromeTimer = setTimeout(() => {
      chromeTimer = null;
      refreshWorkflowChrome(root, activeStage, refinedFrameIds);
    }, delay);
  };

  const scheduleHydrate = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const shell = root.firstElementChild;
      const originalMain = shell?.querySelector(':scope > main');
      if (!shell || !originalMain || originalMain.dataset.workflowManaged === 'true') {
        refreshWorkflowChrome(root, activeStage, refinedFrameIds);
        return;
      }
      panelRegistry = capturePanels(originalMain);
      buildWorkflowShell(root, shell, originalMain, panelRegistry, activeStage, refinedFrameIds);
    });
  };

  const setStage = (nextStage, { updateUrl = true, focusTab = false } = {}) => {
    if (!STAGE_IDS.has(nextStage)) return;
    activeStage = nextStage;
    persistStage(activeStage);
    if (updateUrl) history.replaceState(null, '', `#workflow-${activeStage}`);

    const shell = root.firstElementChild;
    const workspace = shell?.querySelector('[data-workflow-managed="true"]');
    const cache = shell?.querySelector(`#${FLOW_CACHE_ID}`);
    if (workspace && cache && panelRegistry.size) {
      renderWorkspace(workspace, cache, panelRegistry, activeStage, root, refinedFrameIds);
    } else {
      scheduleHydrate();
    }

    if (focusTab) root.querySelector(`[data-workflow-stage="${activeStage}"]`)?.focus();
    root.dispatchEvent(new CustomEvent('stixio:stagechange', { detail: { stage: activeStage } }));
  };

  root.addEventListener('click', event => {
    const stageControl = event.target.closest?.('[data-workflow-stage]');
    if (stageControl && root.contains(stageControl)) {
      event.preventDefault();
      setStage(stageControl.dataset.workflowStage);
      return;
    }

    const flowButton = event.target.closest?.('[data-workflow-action]');
    if (flowButton && root.contains(flowButton)) {
      event.preventDefault();
      const next = adjacentStage(activeStage, flowButton.dataset.workflowAction === 'previous' ? -1 : 1);
      if (next) setStage(next, { focusTab: true });
      return;
    }

    if (event.target.closest?.('[data-package-frame]')) {
      queueMicrotask(() => setStage('review'));
      return;
    }

    if (event.target.closest?.('#applyRefineBtn')) {
      const frameId = root.querySelector('#refineCanvas')?.dataset.frameId;
      if (frameId) refinedFrameIds.add(frameId);
      persistRefinedFrameIds(refinedFrameIds);
      refreshChromeSoon();
      return;
    }

    if (event.target.closest?.('#resetSelectedRefineBtn')) {
      const frameId = root.querySelector('#refineCanvas')?.dataset.frameId;
      if (frameId) refinedFrameIds.delete(frameId);
      persistRefinedFrameIds(refinedFrameIds);
    }

    refreshChromeSoon();
  });

  root.addEventListener('change', () => refreshChromeSoon());
  root.addEventListener('input', () => refreshChromeSoon(140));

  root.addEventListener('keydown', event => {
    const tab = event.target.closest?.('[data-workflow-stage]');
    if (!tab || !root.contains(tab)) return;
    const currentIndex = WORKFLOW_STAGES.findIndex(stage => stage.id === tab.dataset.workflowStage);
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % WORKFLOW_STAGES.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + WORKFLOW_STAGES.length) % WORKFLOW_STAGES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = WORKFLOW_STAGES.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    setStage(WORKFLOW_STAGES[nextIndex].id, { focusTab: true });
  });

  window.addEventListener('hashchange', () => {
    const stage = stageFromHash(location.hash);
    if (stage) setStage(stage, { updateUrl: false });
  });

  const observer = new MutationObserver(() => scheduleHydrate());
  observer.observe(root, { childList: true });

  scheduleHydrate();
}

export function summarizeWorkflowMetrics(metrics = {}) {
  const totalFrames = Math.max(0, Number(metrics.totalFrames) || 0);
  const sourceCount = Math.max(0, Number(metrics.sourceCount) || 0);
  const refinedCount = Math.min(totalFrames, Math.max(0, Number(metrics.refinedCount) || 0));
  const selectedCount = Math.max(0, Number(metrics.selectedCount) || totalFrames);
  const approvedCount = Math.min(selectedCount, Math.max(0, Number(metrics.approvedCount) || 0));
  const errors = Math.max(0, Number(metrics.errors) || 0);
  const warnings = Math.max(0, Number(metrics.warnings) || 0);
  const packageReady = Boolean(metrics.packageReady);
  const packageFileCount = Math.max(0, Number(metrics.packageFileCount) || selectedCount);

  return {
    layout: {
      value: sourceCount ? `${sourceCount} 張原圖 · ${totalFrames} 張貼圖` : '尚未加入素材',
      percent: sourceCount && totalFrames ? 100 : 0,
      tone: sourceCount && totalFrames ? 'complete' : 'idle'
    },
    refine: {
      value: totalFrames ? `已完成 ${refinedCount}/${totalFrames}` : '等待建立貼圖範圍',
      percent: totalFrames ? Math.round(refinedCount / totalFrames * 100) : 0,
      tone: refinedCount && refinedCount === totalFrames ? 'complete' : refinedCount ? 'active' : 'idle'
    },
    review: {
      value: selectedCount
        ? `已核准 ${approvedCount}/${selectedCount}${errors ? ` · ${errors} 錯誤` : warnings ? ` · ${warnings} 警告` : ''}`
        : '尚無貼圖可檢查',
      percent: selectedCount ? Math.round(approvedCount / selectedCount * 100) : 0,
      tone: errors ? 'error' : warnings ? 'warning' : approvedCount && approvedCount === selectedCount ? 'complete' : approvedCount ? 'active' : 'idle'
    },
    package: {
      value: packageReady
        ? `可下載 · ${packageFileCount} 個檔案`
        : errors
          ? `${errors} 項錯誤待修正`
          : selectedCount
            ? `尚缺 ${Math.max(0, selectedCount - approvedCount)} 張核准`
            : '完成檢查後即可下載',
      percent: packageReady ? 100 : selectedCount ? Math.round(approvedCount / selectedCount * 100) : 0,
      tone: packageReady ? 'complete' : errors ? 'error' : warnings ? 'warning' : approvedCount ? 'active' : 'idle'
    }
  };
}

export function adjacentStage(stageId, direction) {
  const index = WORKFLOW_STAGES.findIndex(stage => stage.id === stageId);
  if (index < 0) return null;
  const nextIndex = index + Math.sign(Number(direction) || 0);
  return WORKFLOW_STAGES[nextIndex]?.id || null;
}

function capturePanels(main) {
  const registry = new Map();
  for (const [key, selector] of Object.entries(PANEL_DEFINITIONS)) {
    const match = main.querySelector(selector);
    const panel = findTopLevelPanel(match, main);
    if (panel) registry.set(key, panel);
  }
  return registry;
}

function findTopLevelPanel(element, main) {
  if (!element || !main) return null;
  const column = [...main.children].find(child => child.contains(element));
  if (!column) return null;
  let panel = element;
  while (panel.parentElement && panel.parentElement !== column) panel = panel.parentElement;
  return panel.parentElement === column ? panel : null;
}

function buildWorkflowShell(root, shell, originalMain, registry, activeStage, refinedFrameIds) {
  const cache = document.createElement('div');
  cache.id = FLOW_CACHE_ID;
  cache.hidden = true;
  cache.setAttribute('aria-hidden', 'true');
  cache.dataset.workflowCache = 'true';

  [...new Set(registry.values())].forEach(panel => cache.appendChild(panel));

  const workspace = document.createElement('main');
  workspace.dataset.workflowManaged = 'true';
  workspace.className = 'mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-5 py-5';

  originalMain.replaceWith(workspace);
  shell.appendChild(cache);
  shell.dataset.workflowShell = 'true';

  renderWorkspace(workspace, cache, registry, activeStage, root, refinedFrameIds);
}

function renderWorkspace(workspace, cache, registry, activeStage, root, refinedFrameIds) {
  moveWorkspacePanelsToCache(workspace, cache);

  const stage = WORKFLOW_STAGES.find(item => item.id === activeStage) || WORKFLOW_STAGES[0];
  const layout = WORKSPACE_LAYOUTS[stage.id];
  const metrics = collectWorkflowMetrics(root, refinedFrameIds);
  const summaries = summarizeWorkflowMetrics(metrics);
  const summary = summaries[stage.id];

  workspace.innerHTML = `
    <section class="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-slate-900/10 bg-white px-5 py-4 shadow-sm" data-workflow-overview>
      <div class="min-w-0">
        <div class="text-[10px] font-black uppercase tracking-[.2em] ${accentTextClass(stage.accent)}">${stage.step} · ${stage.label}</div>
        <h2 class="mt-1 text-xl font-black">${stage.title}</h2>
        <p class="mt-1 text-sm font-bold text-slate-500">${stage.description}</p>
      </div>
      <div class="min-w-[220px] rounded-2xl ${toneSurfaceClass(summary.tone)} px-4 py-3" data-workflow-status-card>
        <div class="text-xs font-black" data-workflow-current-status>${summary.value}</div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70"><div class="h-full rounded-full ${toneBarClass(summary.tone)}" data-workflow-current-bar style="width:${summary.percent}%"></div></div>
      </div>
    </section>
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-5 ${layout.grid}" data-workflow-grid>
      <aside class="min-h-0 space-y-4 overflow-y-auto pr-1" data-workflow-column="left"></aside>
      <section class="min-h-0 space-y-4 overflow-y-auto pr-1" data-workflow-column="center"></section>
      <aside class="min-h-0 space-y-4 overflow-y-auto pr-1" data-workflow-column="right"></aside>
    </div>
    <footer class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-900/10 bg-white px-4 py-3 shadow-sm" data-workflow-footer>
      ${renderPreviousButton(stage.id)}
      <div class="text-center text-xs font-bold text-slate-400">自動儲存目前專案進度</div>
      ${renderNextButton(stage.id)}
    </footer>`;

  const columns = {
    left: workspace.querySelector('[data-workflow-column="left"]'),
    center: workspace.querySelector('[data-workflow-column="center"]'),
    right: workspace.querySelector('[data-workflow-column="right"]')
  };

  for (const columnName of ['left', 'center', 'right']) {
    for (const panelKey of layout[columnName]) {
      const panel = registry.get(panelKey);
      if (panel) columns[columnName].appendChild(panel);
    }
    columns[columnName].hidden = !columns[columnName].childElementCount;
  }

  workspace.dataset.activeStage = stage.id;
  decorateStageNavigation(root, stage.id, summaries);
  resetWorkspaceScroll(workspace);
}

function moveWorkspacePanelsToCache(workspace, cache) {
  workspace.querySelectorAll('[data-workflow-column]').forEach(column => {
    [...column.children].forEach(panel => cache.appendChild(panel));
  });
}

function decorateStageNavigation(root, activeStage, summaries) {
  const nav = root.querySelector('nav[aria-label="Workshop workflow"], nav[aria-label="貼圖製作流程"]');
  if (!nav) return;
  nav.setAttribute('aria-label', '貼圖製作流程');
  nav.setAttribute('role', 'tablist');

  const tabs = [...nav.children];
  WORKFLOW_STAGES.forEach((stage, index) => {
    const tab = tabs[index];
    if (!tab) return;
    const active = stage.id === activeStage;
    const summary = summaries[stage.id];
    tab.dataset.workflowStage = stage.id;
    tab.id = `workflow-tab-${stage.id}`;
    tab.href = `#workflow-${stage.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
    if (active) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
    tab.className = active
      ? 'rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-left text-white shadow-sm transition'
      : 'rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-left text-slate-950 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm';
    tab.innerHTML = `
      <span class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-black uppercase tracking-[.18em] ${active ? accentActiveTextClass(stage.accent) : 'text-slate-400'}">${stage.label}</span>
        <span class="rounded-full ${active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 text-[10px] font-black">${stage.step}</span>
      </span>
      <span class="mt-1 block text-sm font-black">${stage.title}</span>
      <span class="mt-1 block truncate text-[10px] font-bold opacity-70">${summary.value}</span>
      <span class="mt-2 block h-1.5 overflow-hidden rounded-full ${active ? 'bg-white/15' : 'bg-slate-100'}"><span class="block h-full rounded-full ${toneBarClass(summary.tone)}" style="width:${summary.percent}%"></span></span>`;
  });

  const subtitle = root.querySelector('header h1 + p');
  if (subtitle) subtitle.textContent = '從原圖到貼圖包，一個工作區完成';
  const exportButton = root.querySelector('#exportZipBtn');
  if (exportButton) exportButton.textContent = '下載貼圖包 ZIP';
}

function refreshWorkflowChrome(root, activeStage, refinedFrameIds) {
  const workspace = root.querySelector('[data-workflow-managed="true"]');
  if (!workspace) return;

  pruneRefinedFrames(root, refinedFrameIds);
  const summaries = summarizeWorkflowMetrics(collectWorkflowMetrics(root, refinedFrameIds));
  decorateStageNavigation(root, activeStage, summaries);

  const current = summaries[activeStage];
  const status = workspace.querySelector('[data-workflow-current-status]');
  const card = workspace.querySelector('[data-workflow-status-card]');
  const bar = workspace.querySelector('[data-workflow-current-bar]');
  if (status) status.textContent = current.value;
  if (card) card.className = `min-w-[220px] rounded-2xl ${toneSurfaceClass(current.tone)} px-4 py-3`;
  if (bar) {
    bar.className = `h-full rounded-full ${toneBarClass(current.tone)}`;
    bar.style.width = `${current.percent}%`;
  }
}

function collectWorkflowMetrics(root, refinedFrameIds) {
  const sourceRows = [...root.querySelectorAll('#sourceList [data-source-id]')];
  const reviewCards = [...root.querySelectorAll('[data-review-card="true"]')];
  const totalFromSources = sourceRows.reduce((total, row) => {
    const match = row.textContent.match(/(\d+)\s+Frames/i);
    return total + Number(match?.[1] || 0);
  }, 0);
  const totalFrames = Math.max(totalFromSources, reviewCards.length);

  const reviewProgressText = root.querySelector('#reviewProgressBar')?.textContent || '';
  const approvedMatch = reviewProgressText.match(/已核准\s*(\d+)\s*\/\s*(\d+)/);
  const errorsMatch = reviewProgressText.match(/錯誤\s*(\d+)/);
  const warningsMatch = reviewProgressText.match(/警告\s*(\d+)/);
  const selectedCards = reviewCards.filter(card => card.dataset.exportSelected !== 'false');
  const approvedCards = selectedCards.filter(card => card.dataset.reviewApproved === 'true');

  const packagePreflight = root.querySelector('#packagePreflight')?.textContent || '';
  const packageFileText = root.querySelector('#packageFileCount')?.textContent || '';
  const packageFileCount = Number(packageFileText.match(/(\d+)\s+files/i)?.[1] || selectedCards.length);

  return {
    sourceCount: sourceRows.length,
    totalFrames,
    refinedCount: Math.min(refinedFrameIds.size, totalFrames),
    selectedCount: Number(approvedMatch?.[2] || selectedCards.length || totalFrames),
    approvedCount: Number(approvedMatch?.[1] || approvedCards.length),
    errors: Number(errorsMatch?.[1] || selectedCards.filter(card => card.dataset.reviewSeverity === 'error').length),
    warnings: Number(warningsMatch?.[1] || selectedCards.filter(card => card.dataset.reviewSeverity === 'warning').length),
    packageReady: packagePreflight.includes('可產生 ZIP'),
    packageFileCount
  };
}

function pruneRefinedFrames(root, refinedFrameIds) {
  const sourceExists = Boolean(root.querySelector('#sourceList [data-source-id]'));
  if (!sourceExists) {
    refinedFrameIds.clear();
    persistRefinedFrameIds(refinedFrameIds);
    return;
  }

  const totalFrames = [...root.querySelectorAll('#sourceList [data-source-id]')].reduce((total, row) => {
    const match = row.textContent.match(/(\d+)\s+Frames/i);
    return total + Number(match?.[1] || 0);
  }, 0);
  const cards = [...root.querySelectorAll('[data-review-card="true"]')];
  if (!totalFrames || cards.length !== totalFrames) return;

  const known = new Set(cards.map(card => card.dataset.frameId));
  let changed = false;
  [...refinedFrameIds].forEach(id => {
    if (!known.has(id)) {
      refinedFrameIds.delete(id);
      changed = true;
    }
  });
  if (changed) persistRefinedFrameIds(refinedFrameIds);
}

function renderPreviousButton(stageId) {
  const previous = adjacentStage(stageId, -1);
  if (!previous) return '<span></span>';
  const stage = WORKFLOW_STAGES.find(item => item.id === previous);
  return `<button type="button" data-workflow-action="previous" class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700">← 返回：${stage.title}</button>`;
}

function renderNextButton(stageId) {
  const next = adjacentStage(stageId, 1);
  if (!next) return '<span></span>';
  const stage = WORKFLOW_STAGES.find(item => item.id === next);
  return `<button type="button" data-workflow-action="next" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">下一步：${stage.title} →</button>`;
}

function resetWorkspaceScroll(workspace) {
  workspace.querySelectorAll('[data-workflow-column]').forEach(column => {
    column.scrollTop = 0;
  });
}

function resolveInitialStage() {
  const hashStage = stageFromHash(location.hash);
  if (hashStage) return hashStage;
  try {
    const saved = localStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (STAGE_IDS.has(saved)) return saved;
  } catch {
    // Continue with the default stage.
  }
  return 'layout';
}

function persistStage(stageId) {
  try {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, stageId);
  } catch {
    // Storage can be unavailable in private or embedded browsing contexts.
  }
}

function loadRefinedFrameIds() {
  try {
    const value = JSON.parse(localStorage.getItem(REFINED_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function persistRefinedFrameIds(frameIds) {
  try {
    localStorage.setItem(REFINED_STORAGE_KEY, JSON.stringify([...frameIds]));
  } catch {
    // Ignore unavailable storage.
  }
}

function stageFromHash(hash = '') {
  const value = String(hash).replace(/^#/, '').replace(/^workflow-/, '').replace(/^stage-/, '');
  return STAGE_IDS.has(value) ? value : null;
}

function accentTextClass(accent) {
  return ({ emerald: 'text-emerald-600', rose: 'text-rose-500', sky: 'text-sky-600', amber: 'text-amber-600' })[accent] || 'text-slate-500';
}

function accentActiveTextClass(accent) {
  return ({ emerald: 'text-emerald-300', rose: 'text-rose-300', sky: 'text-sky-300', amber: 'text-amber-300' })[accent] || 'text-white';
}

function toneSurfaceClass(tone) {
  return ({
    complete: 'bg-emerald-50 text-emerald-800',
    active: 'bg-sky-50 text-sky-800',
    warning: 'bg-amber-50 text-amber-800',
    error: 'bg-rose-50 text-rose-800',
    idle: 'bg-slate-100 text-slate-600'
  })[tone] || 'bg-slate-100 text-slate-600';
}

function toneBarClass(tone) {
  return ({
    complete: 'bg-emerald-500',
    active: 'bg-sky-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
    idle: 'bg-slate-300'
  })[tone] || 'bg-slate-300';
}

function installFlowStyle() {
  if (document.getElementById(FLOW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FLOW_STYLE_ID;
  style.textContent = `
    #${FLOW_CACHE_ID} { display: none !important; }

    @media (min-width: 1024px) {
      html,
      body,
      #app,
      #app > [data-workflow-shell="true"] {
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      #app > [data-workflow-shell="true"] {
        display: flex;
        flex-direction: column;
      }

      #app > [data-workflow-shell="true"] > header {
        position: relative;
        flex: 0 0 auto;
      }

      #app [data-workflow-managed="true"] {
        overflow: hidden;
      }

      #app [data-workflow-grid] {
        min-height: 0;
        overflow: hidden;
        align-items: stretch;
      }

      #app [data-workflow-column] {
        max-height: 100%;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
      }
    }

    @media (max-width: 1023px) {
      #app [data-workflow-managed="true"],
      #app [data-workflow-grid],
      #app [data-workflow-column] {
        max-height: none;
        overflow: visible;
      }
    }
  `;
  document.head.appendChild(style);
}
