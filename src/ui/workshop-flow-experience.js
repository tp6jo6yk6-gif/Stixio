const COLLAPSE_STORAGE_KEY = 'stixio-workflow-collapsed-columns';
const STYLE_ID = 'stixio-workflow-experience-style';

const STAGES = Object.freeze([
  { id: 'layout', step: '01', shortTitle: '匯入' },
  { id: 'refine', step: '02', shortTitle: '修圖' },
  { id: 'review', step: '03', shortTitle: '檢查' },
  { id: 'package', step: '04', shortTitle: '下載' }
]);

const EMPTY_STATES = Object.freeze({
  layout: {
    eyebrow: 'START HERE',
    title: '尚未匯入圖片',
    description: '加入一張或多張排版圖，Stixio 會協助建立貼圖裁切範圍。',
    action: 'file',
    actionLabel: '選擇圖片'
  },
  refine: {
    eyebrow: 'REFINE',
    title: '尚無貼圖可修整',
    description: '請先完成圖片匯入與裁切，再進行去背和邊緣修補。',
    action: 'layout',
    actionLabel: '前往匯入與切割'
  },
  review: {
    eyebrow: 'REVIEW',
    title: '尚無貼圖可檢查',
    description: '建立貼圖範圍後，就能在這裡檢查尺寸、透明背景與輸出品質。',
    action: 'layout',
    actionLabel: '前往匯入與切割'
  },
  package: {
    eyebrow: 'EXPORT',
    title: '尚無貼圖可打包',
    description: '請先匯入素材並完成品質檢查，再建立完整貼圖包。',
    action: 'layout',
    actionLabel: '前往匯入與切割'
  }
});

export function enhanceWorkflowExperience(root = document.getElementById('app')) {
  if (!root || root.dataset.workflowExperience === 'ready') return;
  root.dataset.workflowExperience = 'ready';
  installStyle();

  const collapsed = loadCollapsedColumns();
  let scheduled = false;

  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyExperience(root, collapsed);
    });
  };

  root.addEventListener('stixio:stagechange', scheduleApply);
  root.addEventListener('change', scheduleApply);
  root.addEventListener('input', scheduleApply);
  window.addEventListener('resize', scheduleApply);

  root.addEventListener('click', event => {
    const collapseButton = event.target.closest?.('[data-workflow-collapse]');
    if (collapseButton && root.contains(collapseButton)) {
      event.preventDefault();
      const side = collapseButton.dataset.workflowCollapse;
      if (side === 'left' || side === 'right') {
        collapsed[side] = !collapsed[side];
        persistCollapsedColumns(collapsed);
        applyExperience(root, collapsed);
      }
      return;
    }

    const emptyAction = event.target.closest?.('[data-workflow-empty-action]');
    if (!emptyAction || !root.contains(emptyAction)) return;
    event.preventDefault();
    const action = emptyAction.dataset.workflowEmptyAction;
    if (action === 'file') {
      root.querySelector('#fileInput')?.click();
      return;
    }
    root.querySelector(`nav[aria-label="貼圖製作流程"] [data-workflow-stage="${action}"]`)?.click();
  });

  const observer = new MutationObserver(scheduleApply);
  observer.observe(root, { childList: true });
  scheduleApply();
}

export function getWorkflowEmptyState(stageId, metrics = {}) {
  const sourceCount = Math.max(0, Number(metrics.sourceCount) || 0);
  const frameCount = Math.max(0, Number(metrics.frameCount) || 0);
  if (stageId === 'layout' && sourceCount === 0) return EMPTY_STATES.layout;
  if (stageId !== 'layout' && frameCount === 0) return EMPTY_STATES[stageId] || null;
  return null;
}

export function normalizeCollapsedColumns(value = {}) {
  return { left: Boolean(value.left), right: Boolean(value.right) };
}

function applyExperience(root, collapsed) {
  const workspace = root.querySelector('[data-workflow-managed="true"]');
  if (!workspace) return;

  removeStaleEmptyGuides(root, workspace);
  const stageId = workspace.dataset.activeStage || 'layout';
  ensureCollapseControls(workspace);
  applyEmptyState(workspace, stageId, collectMetrics(root));
  applyCollapsedColumns(workspace, collapsed);
  ensureMobileNavigation(root, stageId);
}

function removeStaleEmptyGuides(root, workspace) {
  root.querySelectorAll('[data-workflow-empty]').forEach(guide => {
    if (!workspace.contains(guide)) guide.remove();
  });
}

function ensureCollapseControls(workspace) {
  const overview = workspace.querySelector('[data-workflow-overview]');
  if (!overview || overview.querySelector('[data-workflow-collapse-controls]')) return;

  const controls = document.createElement('div');
  controls.dataset.workflowCollapseControls = 'true';
  controls.className = 'flex items-center gap-2';
  controls.innerHTML = `
    <button type="button" data-workflow-collapse="left" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm" aria-pressed="false">收合左欄</button>
    <button type="button" data-workflow-collapse="right" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm" aria-pressed="false">收合右欄</button>`;
  overview.appendChild(controls);
}

function applyCollapsedColumns(workspace, collapsed) {
  for (const side of ['left', 'right']) {
    const column = workspace.querySelector(`[data-workflow-column="${side}"]`);
    const available = Boolean(column && column.childElementCount && column.dataset.emptyHidden !== 'true');
    const isCollapsed = available && collapsed[side];
    if (column) column.dataset.collapsed = String(isCollapsed);
    workspace.dataset[`collapse${capitalize(side)}`] = String(isCollapsed);

    const button = workspace.querySelector(`[data-workflow-collapse="${side}"]`);
    if (!button) continue;
    button.hidden = !available;
    button.setAttribute('aria-pressed', String(isCollapsed));
    button.textContent = isCollapsed ? `顯示${side === 'left' ? '左欄' : '右欄'}` : `收合${side === 'left' ? '左欄' : '右欄'}`;
  }
}

function applyEmptyState(workspace, stageId, metrics) {
  const nextState = getWorkflowEmptyState(stageId, metrics);
  const currentStage = workspace.dataset.emptyStage || '';
  const existingGuide = workspace.querySelector('[data-workflow-empty]');

  if (!nextState) {
    if (currentStage || existingGuide || workspace.querySelector('[data-empty-panel-hidden], [data-empty-hidden]')) clearEmptyState(workspace);
    return;
  }

  if (currentStage === stageId && existingGuide) return;
  clearEmptyState(workspace);

  const center = workspace.querySelector('[data-workflow-column="center"]');
  if (!center) return;

  workspace.dataset.emptyStage = stageId;
  workspace.querySelectorAll('[data-workflow-column]').forEach(column => {
    const keepImportColumn = stageId === 'layout' && column.dataset.workflowColumn === 'left';
    if (!keepImportColumn && column !== center) {
      column.dataset.emptyHidden = 'true';
      column.style.display = 'none';
    }
  });

  [...center.children].forEach(child => {
    child.dataset.emptyPanelHidden = 'true';
    child.style.display = 'none';
  });
  center.hidden = false;
  center.style.removeProperty('display');

  const guide = document.createElement('section');
  guide.dataset.workflowEmpty = stageId;
  guide.className = 'grid min-h-[420px] place-items-center rounded-[2rem] border-2 border-dashed border-slate-300 bg-white p-8 text-center shadow-sm';
  guide.innerHTML = `
    <div class="max-w-md">
      <div class="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-950 text-xl font-black text-emerald-300">${stageStep(stageId)}</div>
      <p class="mt-6 text-[10px] font-black uppercase tracking-[.24em] text-slate-400">${nextState.eyebrow}</p>
      <h3 class="mt-2 text-2xl font-black text-slate-950">${nextState.title}</h3>
      <p class="mt-3 text-sm font-bold leading-6 text-slate-500">${nextState.description}</p>
      <button type="button" data-workflow-empty-action="${nextState.action}" class="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">${nextState.actionLabel}</button>
    </div>`;
  center.appendChild(guide);
}

function clearEmptyState(workspace) {
  delete workspace.dataset.emptyStage;
  workspace.querySelector('[data-workflow-empty]')?.remove();
  workspace.querySelectorAll('[data-empty-panel-hidden]').forEach(element => {
    delete element.dataset.emptyPanelHidden;
    element.style.removeProperty('display');
  });
  workspace.querySelectorAll('[data-empty-hidden]').forEach(column => {
    delete column.dataset.emptyHidden;
    column.style.removeProperty('display');
  });
}

function ensureMobileNavigation(root, activeStage) {
  const shell = root.firstElementChild;
  if (!shell) return;

  let nav = shell.querySelector('[data-mobile-workflow-nav]');
  if (!nav) {
    nav = document.createElement('nav');
    nav.dataset.mobileWorkflowNav = 'true';
    nav.setAttribute('aria-label', '行動版貼圖製作流程');
    nav.innerHTML = STAGES.map(stage => `
      <button type="button" data-workflow-stage="${stage.id}" class="mobile-workflow-button" aria-label="${stage.step} ${stage.shortTitle}">
        <span class="mobile-workflow-step">${stage.step}</span>
        <span class="mobile-workflow-title">${stage.shortTitle}</span>
      </button>`).join('');
    shell.appendChild(nav);
  }

  nav.querySelectorAll('[data-workflow-stage]').forEach(button => {
    const active = button.dataset.workflowStage === activeStage;
    button.dataset.active = String(active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function collectMetrics(root) {
  const sourceRows = [...root.querySelectorAll('#sourceList [data-source-id]')];
  const frameCountFromRows = sourceRows.reduce((total, row) => {
    const match = row.textContent.match(/(\d+)\s+Frames/i);
    return total + Number(match?.[1] || 0);
  }, 0);
  return {
    sourceCount: sourceRows.length,
    frameCount: Math.max(frameCountFromRows, root.querySelectorAll('[data-review-card="true"]').length)
  };
}

function loadCollapsedColumns() {
  try {
    return normalizeCollapsedColumns(JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) || '{}'));
  } catch {
    return normalizeCollapsedColumns();
  }
}

function persistCollapsedColumns(collapsed) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(normalizeCollapsedColumns(collapsed)));
  } catch {
    // Storage may be unavailable in embedded or private browsing contexts.
  }
}

function stageStep(stageId) {
  return STAGES.find(stage => stage.id === stageId)?.step || '01';
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-workflow-column][data-collapsed="true"] { display: none !important; }
    [data-mobile-workflow-nav] { display: none; }

    @media (min-width: 1280px) {
      [data-workflow-collapse-controls] { display: flex; }
      [data-workflow-managed][data-active-stage="layout"] [data-workflow-grid],
      [data-workflow-managed][data-active-stage="refine"] [data-workflow-grid],
      [data-workflow-managed][data-active-stage="package"] [data-workflow-grid] {
        grid-template-columns: 360px minmax(0, 1fr) 340px !important;
      }
      [data-workflow-managed][data-active-stage="review"] [data-workflow-grid] {
        grid-template-columns: minmax(0, 1fr) 340px !important;
      }
      [data-workflow-managed][data-collapse-left="true"][data-collapse-right="false"] [data-workflow-grid] {
        grid-template-columns: minmax(0, 1fr) 340px !important;
      }
      [data-workflow-managed][data-collapse-left="false"][data-collapse-right="true"] [data-workflow-grid] {
        grid-template-columns: 360px minmax(0, 1fr) !important;
      }
      [data-workflow-managed][data-active-stage="review"][data-collapse-right="true"] [data-workflow-grid],
      [data-workflow-managed][data-collapse-left="true"][data-collapse-right="true"] [data-workflow-grid] {
        grid-template-columns: minmax(0, 1fr) !important;
      }
    }

    @media (max-width: 1279px) {
      [data-workflow-collapse-controls] { display: none !important; }
    }

    @media (max-width: 767px) {
      body { padding-bottom: 76px; }
      header nav[aria-label="貼圖製作流程"] { display: none !important; }
      [data-workflow-footer] { display: none !important; }
      [data-workflow-overview] { padding: 1rem; }
      [data-workflow-status-card] { width: 100%; min-width: 0; }
      [data-mobile-workflow-nav] {
        position: fixed;
        z-index: 70;
        right: 0;
        bottom: 0;
        left: 0;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: .25rem;
        padding: .5rem max(.5rem, env(safe-area-inset-right)) calc(.5rem + env(safe-area-inset-bottom)) max(.5rem, env(safe-area-inset-left));
        border-top: 1px solid rgba(15, 23, 42, .12);
        background: rgba(255, 255, 255, .96);
        box-shadow: 0 -10px 30px rgba(15, 23, 42, .12);
        backdrop-filter: blur(16px);
      }
      .mobile-workflow-button {
        display: grid;
        min-width: 0;
        place-items: center;
        gap: .15rem;
        border: 0;
        border-radius: .9rem;
        padding: .45rem .25rem;
        background: transparent;
        color: #64748b;
        font-weight: 900;
      }
      .mobile-workflow-button[data-active="true"] { background: #0f172a; color: #ffffff; }
      .mobile-workflow-step { font-size: .62rem; letter-spacing: .12em; }
      .mobile-workflow-title { overflow: hidden; max-width: 100%; font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
    }
  `;
  document.head.appendChild(style);
}
