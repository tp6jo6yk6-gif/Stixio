const WORKFLOW_STORAGE_KEY = 'stixio-active-workflow-stage';
const STYLE_ID = 'stixio-workflow-tabs-style';

export const WORKSHOP_STAGES = Object.freeze([
  {
    id: 'layout',
    step: '01',
    label: 'IMPORT',
    title: '匯入與切割',
    subtitle: '匯入圖片並建立貼圖範圍',
    accentClass: 'text-emerald-300'
  },
  {
    id: 'refine',
    step: '02',
    label: 'REFINE',
    title: '去背與修圖',
    subtitle: '清除背景並修補貼圖邊緣',
    accentClass: 'text-rose-300'
  },
  {
    id: 'review',
    step: '03',
    label: 'REVIEW',
    title: '檢查與核准',
    subtitle: '預覽成品並確認輸出品質',
    accentClass: 'text-sky-300'
  },
  {
    id: 'package',
    step: '04',
    label: 'EXPORT',
    title: '打包與下載',
    subtitle: '建立並下載完整貼圖包',
    accentClass: 'text-amber-300'
  }
]);

const STAGE_IDS = new Set(WORKSHOP_STAGES.map(stage => stage.id));

export function enhanceWorkshopTabs(root = document.getElementById('app')) {
  if (!root || root.dataset.workflowTabsController === 'ready') return;
  root.dataset.workflowTabsController = 'ready';

  installWorkflowStyle();

  let activeStage = resolveInitialStage();
  let scheduled = false;

  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyWorkflowTabs(root, activeStage);
    });
  };

  const setStage = (nextStage, { updateUrl = true, focusTab = false } = {}) => {
    if (!STAGE_IDS.has(nextStage)) return;
    activeStage = nextStage;
    try {
      localStorage.setItem(WORKFLOW_STORAGE_KEY, activeStage);
    } catch {
      // Storage may be unavailable in private browsing or embedded previews.
    }
    if (updateUrl) history.replaceState(null, '', `#workflow-${activeStage}`);
    applyWorkflowTabs(root, activeStage);
    resetColumnScroll(root);
    if (focusTab) root.querySelector(`[data-workshop-stage="${activeStage}"]`)?.focus();
    root.dispatchEvent(new CustomEvent('stixio:stagechange', { detail: { stage: activeStage } }));
  };

  root.addEventListener('click', event => {
    const tab = event.target.closest?.('[data-workshop-stage]');
    if (tab && root.contains(tab)) {
      event.preventDefault();
      setStage(tab.dataset.workshopStage);
      return;
    }

    if (event.target.closest?.('[data-package-frame]')) {
      queueMicrotask(() => setStage('review'));
    }
  });

  root.addEventListener('keydown', event => {
    const tab = event.target.closest?.('[data-workshop-stage]');
    if (!tab || !root.contains(tab)) return;
    const index = WORKSHOP_STAGES.findIndex(stage => stage.id === tab.dataset.workshopStage);
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % WORKSHOP_STAGES.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + WORKSHOP_STAGES.length) % WORKSHOP_STAGES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = WORKSHOP_STAGES.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    setStage(WORKSHOP_STAGES[nextIndex].id, { focusTab: true });
  });

  window.addEventListener('hashchange', () => {
    const stage = stageFromHash(location.hash);
    if (stage) setStage(stage, { updateUrl: false });
  });

  const observer = new MutationObserver(scheduleApply);
  observer.observe(root, { childList: true, subtree: true });
  scheduleApply();
}

export function applyWorkflowTabs(root, activeStage = 'layout') {
  if (!root || !STAGE_IDS.has(activeStage)) return;
  const nav = root.querySelector('nav[aria-label="Workshop workflow"], nav[aria-label="貼圖製作流程"]');
  const main = root.querySelector('main');
  if (!nav || !main) return;

  updateBrandCopy(root);
  decorateTabList(nav, activeStage, root);
  arrangeStagePanels(root, main, activeStage);
  applyWorkspaceViewport(root, main, activeStage);
}

function resolveInitialStage() {
  const hashStage = stageFromHash(location.hash);
  if (hashStage) return hashStage;
  try {
    const saved = localStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (STAGE_IDS.has(saved)) return saved;
  } catch {
    // Use the first stage when storage is unavailable.
  }
  return 'layout';
}

function stageFromHash(hash = '') {
  const value = String(hash).replace(/^#/, '').replace(/^workflow-/, '').replace(/^stage-/, '');
  return STAGE_IDS.has(value) ? value : null;
}

function updateBrandCopy(root) {
  setText(root.querySelector('header h1 + p'), '從原圖到貼圖包，一個工作區完成');
  setText(root.querySelector('#exportZipBtn'), '下載貼圖包 ZIP');
}

function decorateTabList(nav, activeStage, root) {
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', '貼圖製作流程');

  const existingTabs = [...nav.children];
  WORKSHOP_STAGES.forEach((stage, index) => {
    const tab = existingTabs[index];
    if (!tab) return;

    if (tab.dataset.workshopStage !== stage.id) {
      tab.dataset.workshopStage = stage.id;
      tab.id = `workflow-tab-${stage.id}`;
      tab.href = `#workflow-${stage.id}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `stage-${stage.id}`);
      tab.innerHTML = `
        <span class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-black uppercase tracking-[.18em]" data-stage-label></span>
          <span class="rounded-full px-2 py-0.5 text-[10px] font-black" data-stage-step></span>
        </span>
        <span class="mt-1 block text-sm font-black" data-stage-title></span>
        <span class="mt-1 block truncate text-[10px] font-bold opacity-65" data-stage-status></span>`;
    }

    const active = stage.id === activeStage;
    tab.className = active
      ? 'rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-left text-white shadow-sm transition'
      : 'rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-left text-slate-950 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm';
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
    if (active) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');

    const label = tab.querySelector('[data-stage-label]');
    if (label) {
      setText(label, stage.label);
      label.className = `text-[10px] font-black uppercase tracking-[.18em] ${active ? stage.accentClass : 'text-slate-400'}`;
    }
    const step = tab.querySelector('[data-stage-step]');
    if (step) {
      setText(step, stage.step);
      step.className = active
        ? 'rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white'
        : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500';
    }
    setText(tab.querySelector('[data-stage-title]'), stage.title);
    setText(tab.querySelector('[data-stage-status]'), getStageStatus(stage.id, root));
  });
}

function arrangeStagePanels(root, main, activeStage) {
  main.dataset.workshopMain = 'true';
  main.dataset.activeStage = activeStage;

  const columns = [...main.children];
  columns.forEach((column, index) => {
    column.dataset.workshopColumn = String(index + 1);
  });

  const panelGroups = {
    layout: [
      findTopLevelPanel(root.querySelector('#stage-layout'), main),
      findTopLevelPanel(root.querySelector('#detectBtn')?.closest('section'), main),
      findTopLevelPanel(root.querySelector('#destinationRulesRoot'), main),
      findTopLevelPanel(root.querySelector('#sourceCanvas')?.closest('section'), main),
      findTopLevelPanel(root.querySelector('#sourceList')?.closest('section'), main),
      findTopLevelPanel(root.querySelector('#selectedInfo')?.closest('section'), main)
    ],
    refine: [
      findTopLevelPanel(root.querySelector('#refine-settings-panel'), main),
      findTopLevelPanel(root.querySelector('#stage-refine'), main),
      findTopLevelPanel(root.querySelector('#sourceList')?.closest('section'), main),
      findTopLevelPanel(root.querySelector('#selectedInfo')?.closest('section'), main)
    ],
    review: [
      findTopLevelPanel(root.querySelector('#stage-review'), main),
      findTopLevelPanel(root.querySelector('#reviewGateStatus')?.closest('section'), main)
    ],
    package: [
      findTopLevelPanel(root.querySelector('#destinationRulesRoot'), main),
      findTopLevelPanel(root.querySelector('#package-rules-panel'), main),
      findTopLevelPanel(root.querySelector('#packageWorkspaceRoot'), main),
      findTopLevelPanel(root.querySelector('#packageSettingsRoot'), main)
    ]
  };

  const allPanels = columns.flatMap(column => [...column.children]);
  allPanels.forEach(panel => {
    panel.hidden = true;
    panel.style.display = 'none';
    panel.removeAttribute('role');
    panel.removeAttribute('aria-labelledby');
  });

  unique(panelGroups[activeStage]).forEach(panel => {
    panel.hidden = false;
    panel.style.removeProperty('display');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `workflow-tab-${activeStage}`);
  });

  columns.forEach(column => {
    const visible = [...column.children].some(panel => !panel.hidden);
    column.hidden = !visible;
    if (visible) column.style.removeProperty('display');
    else column.style.display = 'none';
  });
}

function applyWorkspaceViewport(root, main, activeStage) {
  const shell = root.firstElementChild;
  if (shell) shell.dataset.workshopShell = 'true';
  main.dataset.activeStage = activeStage;
}

function resetColumnScroll(root) {
  root.querySelectorAll('[data-workshop-column]').forEach(column => {
    column.scrollTop = 0;
  });
}

function findTopLevelPanel(element, main) {
  if (!element || !main) return null;
  const column = [...main.children].find(child => child.contains(element));
  if (!column) return null;
  let panel = element;
  while (panel.parentElement && panel.parentElement !== column) panel = panel.parentElement;
  return panel.parentElement === column ? panel : null;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function getStageStatus(stageId, root) {
  const sourceRows = root.querySelectorAll('#sourceList [data-source-id]');
  const frameCount = [...sourceRows].reduce((total, row) => {
    const match = row.textContent.match(/(\d+)\s+Frames/i);
    return total + Number(match?.[1] || 0);
  }, 0);

  if (stageId === 'layout') {
    if (!sourceRows.length) return '尚未加入素材';
    return `${sourceRows.length} 張原圖 · ${frameCount} 張貼圖`;
  }
  if (stageId === 'refine') {
    return frameCount ? `${frameCount} 張貼圖可逐張修整` : '等待建立貼圖範圍';
  }
  if (stageId === 'review') {
    return frameCount ? `共 ${frameCount} 張待確認` : '尚無貼圖可檢查';
  }
  const preflight = root.querySelector('#packagePreflight')?.textContent || '';
  return preflight.includes('可產生 ZIP') ? '可以下載貼圖包' : '完成檢查後即可下載';
}

function installWorkflowStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #app [data-workshop-main] > [hidden],
    #app [data-workshop-main] > * > [hidden] {
      display: none !important;
    }

    @media (min-width: 1024px) {
      html,
      body,
      #app,
      #app > [data-workshop-shell] {
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      #app > [data-workshop-shell] {
        display: flex;
        flex-direction: column;
      }

      #app > [data-workshop-shell] > header {
        position: relative;
        flex: 0 0 auto;
      }

      #app [data-workshop-main] {
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        align-items: stretch;
      }

      #app [data-workshop-main] > [data-workshop-column] {
        min-height: 0;
        max-height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
      }
    }

    @media (min-width: 1280px) {
      #app [data-workshop-main][data-active-stage="review"] {
        grid-template-columns: minmax(0, 1fr) 340px !important;
      }
    }

    @media (max-width: 1023px) {
      #app [data-workshop-main],
      #app [data-workshop-main] > [data-workshop-column] {
        max-height: none;
        overflow: visible;
      }
    }
  `;
  document.head.appendChild(style);
}
