const STORAGE_KEY = 'stixio-active-workflow-stage-v4';
const COLLAPSE_KEY = 'stixio-workflow-collapsed-columns-v4';
const STYLE_ID = 'stixio-workflow-tabs-v4-style';

const STAGES = Object.freeze([
  { id: 'layout', step: '01', label: 'IMPORT', title: '匯入與切割', description: '匯入圖片並建立貼圖裁切範圍', accent: 'emerald' },
  { id: 'refine', step: '02', label: 'REFINE', title: '去背與修圖', description: '清除背景並修補貼圖邊緣', accent: 'rose' },
  { id: 'review', step: '03', label: 'REVIEW', title: '檢查與核准', description: '預覽成品並確認輸出品質', accent: 'sky' },
  { id: 'package', step: '04', label: 'EXPORT', title: '打包與下載', description: '建立並下載完整貼圖包', accent: 'amber' }
]);

const STAGE_IDS = new Set(STAGES.map(stage => stage.id));
const PANEL_SELECTORS = Object.freeze({
  layout: ['#stage-layout', '#detectBtn', '#destinationRulesRoot', '#sourceCanvas', '#sourceList', '#selectedInfo'],
  refine: ['#refine-settings-panel', '#stage-refine', '#sourceList', '#selectedInfo'],
  review: ['#stage-review', '#reviewGateStatus'],
  package: ['#destinationRulesRoot', '#package-rules-panel', '#packageWorkspaceRoot', '#packageSettingsRoot']
});

export function enhanceWorkshopTabsV4(root = document.getElementById('app')) {
  if (!root || root.dataset.workflowTabsV4 === 'ready') return;
  root.dataset.workflowTabsV4 = 'ready';
  installStyle();

  let activeStage = resolveInitialStage();
  const collapsed = loadCollapsed();
  let scheduled = false;

  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyStage(root, activeStage, collapsed);
    });
  };

  const setStage = (stageId, options = {}) => {
    if (!STAGE_IDS.has(stageId)) return;
    activeStage = stageId;
    persistStage(stageId);
    if (options.updateUrl !== false) history.replaceState(null, '', `#workflow-${stageId}`);
    applyStage(root, activeStage, collapsed);
    root.dispatchEvent(new CustomEvent('stixio:stagechange', { detail: { stage: activeStage } }));
    if (options.focus) root.querySelector(`[data-workflow-stage="${stageId}"]`)?.focus();
  };

  root.addEventListener('click', event => {
    const stageButton = event.target.closest?.('[data-workflow-stage]');
    if (stageButton && root.contains(stageButton)) {
      event.preventDefault();
      setStage(stageButton.dataset.workflowStage);
      return;
    }

    const flowButton = event.target.closest?.('[data-workflow-direction]');
    if (flowButton && root.contains(flowButton)) {
      event.preventDefault();
      const index = STAGES.findIndex(stage => stage.id === activeStage);
      const direction = flowButton.dataset.workflowDirection === 'previous' ? -1 : 1;
      const next = STAGES[index + direction];
      if (next) setStage(next.id, { focus: true });
      return;
    }

    const collapseButton = event.target.closest?.('[data-workflow-collapse]');
    if (collapseButton && root.contains(collapseButton)) {
      event.preventDefault();
      const side = collapseButton.dataset.workflowCollapse;
      if (side === 'left' || side === 'right') {
        collapsed[side] = !collapsed[side];
        persistCollapsed(collapsed);
        applyStage(root, activeStage, collapsed);
      }
      return;
    }

    const emptyAction = event.target.closest?.('[data-workflow-empty-action]');
    if (emptyAction && root.contains(emptyAction)) {
      event.preventDefault();
      const action = emptyAction.dataset.workflowEmptyAction;
      if (action === 'file') root.querySelector('#fileInput')?.click();
      else setStage(action, { focus: true });
      return;
    }

    if (event.target.closest?.('[data-package-frame]')) {
      queueMicrotask(() => setStage('review'));
      return;
    }

    setTimeout(scheduleApply, 0);
  });

  root.addEventListener('keydown', event => {
    const tab = event.target.closest?.('[data-workflow-stage]');
    if (!tab || !root.contains(tab)) return;
    const index = STAGES.findIndex(stage => stage.id === tab.dataset.workflowStage);
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % STAGES.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + STAGES.length) % STAGES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = STAGES.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    setStage(STAGES[nextIndex].id, { focus: true });
  });

  root.addEventListener('change', scheduleApply);
  root.addEventListener('input', scheduleApply);
  window.addEventListener('hashchange', () => {
    const stageId = stageFromHash(location.hash);
    if (stageId) setStage(stageId, { updateUrl: false });
  });

  const observer = new MutationObserver(scheduleApply);
  observer.observe(root, { childList: true });
  scheduleApply();
}

function applyStage(root, activeStage, collapsed) {
  const shell = root.firstElementChild;
  const main = shell?.querySelector(':scope > main');
  const nav = shell?.querySelector('nav[aria-label="Workshop workflow"], nav[aria-label="貼圖製作流程"]');
  if (!shell || !main || !nav) return;

  shell.dataset.workflowShell = 'v4';
  main.dataset.workflowManaged = 'true';
  main.dataset.activeStage = activeStage;
  main.classList.add('stixio-workflow-main');

  updateBrand(root);
  decorateTabs(root, nav, activeStage);
  filterPanels(main, activeStage);
  ensureStageHeader(main, activeStage, root);
  ensureFooter(main, activeStage);
  applyCollapsedState(main, collapsed);
  ensureMobileNavigation(shell, activeStage);
  applyEmptyState(main, activeStage, root);
}

function decorateTabs(root, nav, activeStage) {
  nav.setAttribute('aria-label', '貼圖製作流程');
  nav.setAttribute('role', 'tablist');
  nav.className = 'mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-5 pb-4 md:grid-cols-4';

  const existing = [...nav.children];
  STAGES.forEach((stage, index) => {
    const tab = existing[index];
    if (!tab) return;
    const active = stage.id === activeStage;
    const metrics = stageMetrics(stage.id, root);
    tab.dataset.workflowStage = stage.id;
    tab.id = `workflow-tab-${stage.id}`;
    tab.href = `#workflow-${stage.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
    if (active) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
    tab.className = active
      ? 'workflow-tab workflow-tab-active rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-left text-white shadow-sm'
      : 'workflow-tab rounded-2xl border border-slate-900/10 bg-white px-4 py-3 text-left text-slate-950 shadow-sm';
    tab.innerHTML = `<span class="flex items-center justify-between gap-2"><span class="text-[10px] font-black uppercase tracking-[.18em] ${active ? activeAccentClass(stage.accent) : 'text-slate-400'}">${stage.label}</span><span class="rounded-full px-2 py-0.5 text-[10px] font-black ${active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}">${stage.step}</span></span><span class="mt-1 block text-sm font-black">${stage.title}</span><span class="mt-1 block truncate text-[10px] font-bold opacity-70">${metrics.label}</span><span class="mt-2 block h-1.5 overflow-hidden rounded-full ${active ? 'bg-white/15' : 'bg-slate-100'}"><span class="block h-full rounded-full ${progressClass(metrics.tone)}" style="width:${metrics.percent}%"></span></span>`;
  });
}

function filterPanels(main, activeStage) {
  const columns = [...main.children].filter(element => !element.matches('[data-workflow-stage-header], [data-workflow-footer]'));
  columns.forEach((column, index) => {
    column.dataset.workflowColumn = ['left', 'center', 'right'][index] || String(index);
    [...column.children].forEach(panel => {
      panel.hidden = true;
      panel.style.display = 'none';
    });
  });

  const visiblePanels = new Set();
  for (const selector of PANEL_SELECTORS[activeStage] || []) {
    const target = main.querySelector(selector);
    const panel = topLevelPanel(target, main);
    if (panel) visiblePanels.add(panel);
  }

  visiblePanels.forEach(panel => {
    panel.hidden = false;
    panel.style.removeProperty('display');
  });

  columns.forEach(column => {
    const visible = [...column.children].some(panel => visiblePanels.has(panel));
    column.hidden = !visible;
    column.style.display = visible ? '' : 'none';
  });
}

function topLevelPanel(element, main) {
  if (!element || !main.contains(element)) return null;
  const column = [...main.children].find(child => child.contains(element));
  if (!column) return null;
  let panel = element;
  while (panel.parentElement && panel.parentElement !== column) panel = panel.parentElement;
  return panel.parentElement === column ? panel : null;
}

function ensureStageHeader(main, activeStage, root) {
  main.querySelector('[data-workflow-stage-header]')?.remove();
  const stage = STAGES.find(item => item.id === activeStage) || STAGES[0];
  const metrics = stageMetrics(activeStage, root);
  const header = document.createElement('section');
  header.dataset.workflowStageHeader = 'true';
  header.className = 'workflow-stage-header rounded-[1.5rem] border border-slate-900/10 bg-white px-5 py-4 shadow-sm';
  header.innerHTML = `<div class="min-w-0"><div class="text-[10px] font-black uppercase tracking-[.2em] ${accentClass(stage.accent)}">${stage.step} · ${stage.label}</div><h2 class="mt-1 text-xl font-black">${stage.title}</h2><p class="mt-1 text-sm font-bold text-slate-500">${stage.description}</p></div><div class="workflow-header-actions"><div class="min-w-[220px] rounded-2xl ${statusSurfaceClass(metrics.tone)} px-4 py-3"><div class="text-xs font-black">${metrics.label}</div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70"><div class="h-full rounded-full ${progressClass(metrics.tone)}" style="width:${metrics.percent}%"></div></div></div><div class="hidden items-center gap-2 xl:flex"><button type="button" data-workflow-collapse="left" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">收合左欄</button><button type="button" data-workflow-collapse="right" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">收合右欄</button></div></div>`;
  main.prepend(header);
}

function ensureFooter(main, activeStage) {
  main.querySelector('[data-workflow-footer]')?.remove();
  const index = STAGES.findIndex(stage => stage.id === activeStage);
  const previous = STAGES[index - 1];
  const next = STAGES[index + 1];
  const footer = document.createElement('footer');
  footer.dataset.workflowFooter = 'true';
  footer.className = 'workflow-footer rounded-[1.5rem] border border-slate-900/10 bg-white px-4 py-3 shadow-sm';
  footer.innerHTML = `${previous ? `<button type="button" data-workflow-direction="previous" class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700">← 返回：${previous.title}</button>` : '<span></span>'}<span class="text-center text-xs font-bold text-slate-400">自動儲存目前專案進度</span>${next ? `<button type="button" data-workflow-direction="next" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">下一步：${next.title} →</button>` : '<span></span>'}`;
  main.append(footer);
}

function applyCollapsedState(main, collapsed) {
  for (const side of ['left', 'right']) {
    const column = main.querySelector(`[data-workflow-column="${side}"]`);
    const available = Boolean(column && !column.hidden);
    const isCollapsed = available && collapsed[side];
    if (column) column.dataset.collapsed = String(isCollapsed);
    main.dataset[`collapse${capitalize(side)}`] = String(isCollapsed);
    const button = main.querySelector(`[data-workflow-collapse="${side}"]`);
    if (button) {
      button.hidden = !available;
      button.setAttribute('aria-pressed', String(isCollapsed));
      button.textContent = isCollapsed ? `顯示${side === 'left' ? '左欄' : '右欄'}` : `收合${side === 'left' ? '左欄' : '右欄'}`;
    }
  }
}

function ensureMobileNavigation(shell, activeStage) {
  let nav = shell.querySelector('[data-mobile-workflow-nav]');
  if (!nav) {
    nav = document.createElement('nav');
    nav.dataset.mobileWorkflowNav = 'true';
    nav.setAttribute('aria-label', '行動版貼圖製作流程');
    shell.appendChild(nav);
  }
  nav.innerHTML = STAGES.map(stage => {
    const active = stage.id === activeStage;
    return `<button type="button" data-workflow-stage="${stage.id}" data-active="${active}" ${active ? 'aria-current="step"' : ''}><span>${stage.step}</span><strong>${stage.title.replace('與', '')}</strong></button>`;
  }).join('');
}

function applyEmptyState(main, activeStage, root) {
  main.querySelector('[data-workflow-empty]')?.remove();
  const hasSources = root.querySelectorAll('#sourceList [data-source-id]').length > 0;
  const frameCount = countFrames(root);
  const shouldShow = activeStage === 'layout' ? !hasSources : frameCount === 0;
  if (!shouldShow) return;

  const center = main.querySelector('[data-workflow-column="center"]');
  if (!center) return;
  [...center.children].forEach(panel => {
    panel.dataset.workflowEmptyHidden = 'true';
    panel.style.display = 'none';
  });

  const copy = activeStage === 'layout'
    ? { title: '尚未匯入圖片', description: '加入一張或多張排版圖，開始建立貼圖裁切範圍。', action: 'file', label: '選擇圖片' }
    : { title: `尚無貼圖可${activeStage === 'refine' ? '修整' : activeStage === 'review' ? '檢查' : '打包'}`, description: '請先至「匯入與切割」加入圖片並建立貼圖範圍。', action: 'layout', label: '前往匯入與切割' };

  const empty = document.createElement('section');
  empty.dataset.workflowEmpty = activeStage;
  empty.className = 'grid min-h-[420px] place-items-center rounded-[2rem] border-2 border-dashed border-slate-300 bg-white p-8 text-center shadow-sm';
  empty.innerHTML = `<div class="max-w-md"><div class="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-950 text-xl font-black text-emerald-300">${STAGES.find(stage => stage.id === activeStage)?.step}</div><h3 class="mt-6 text-2xl font-black">${copy.title}</h3><p class="mt-3 text-sm font-bold leading-6 text-slate-500">${copy.description}</p><button type="button" data-workflow-empty-action="${copy.action}" class="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">${copy.label}</button></div>`;
  center.appendChild(empty);
}

function stageMetrics(stageId, root) {
  const sourceCount = root.querySelectorAll('#sourceList [data-source-id]').length;
  const frameCount = countFrames(root);
  const progressText = root.querySelector('#reviewProgressBar')?.textContent || '';
  const approvedMatch = progressText.match(/已核准\s*(\d+)\s*\/\s*(\d+)/);
  const errorsMatch = progressText.match(/錯誤\s*(\d+)/);
  const warningsMatch = progressText.match(/警告\s*(\d+)/);
  const approved = Number(approvedMatch?.[1] || 0);
  const selected = Number(approvedMatch?.[2] || frameCount);
  const errors = Number(errorsMatch?.[1] || 0);
  const warnings = Number(warningsMatch?.[1] || 0);
  const packageReady = (root.querySelector('#packagePreflight')?.textContent || '').includes('可產生 ZIP');

  if (stageId === 'layout') return { label: sourceCount ? `${sourceCount} 張原圖 · ${frameCount} 張貼圖` : '尚未加入素材', percent: sourceCount && frameCount ? 100 : 0, tone: sourceCount && frameCount ? 'complete' : 'idle' };
  if (stageId === 'refine') return { label: frameCount ? `${frameCount} 張貼圖可修整` : '等待建立貼圖範圍', percent: frameCount ? 25 : 0, tone: frameCount ? 'active' : 'idle' };
  if (stageId === 'review') return { label: frameCount ? `已核准 ${approved}/${selected}${errors ? ` · ${errors} 錯誤` : warnings ? ` · ${warnings} 警告` : ''}` : '尚無貼圖可檢查', percent: selected ? Math.round(approved / selected * 100) : 0, tone: errors ? 'error' : warnings ? 'warning' : approved && approved === selected ? 'complete' : approved ? 'active' : 'idle' };
  return { label: packageReady ? '可以下載貼圖包' : frameCount ? '完成檢查後即可下載' : '尚無貼圖可打包', percent: packageReady ? 100 : selected ? Math.round(approved / selected * 100) : 0, tone: packageReady ? 'complete' : errors ? 'error' : warnings ? 'warning' : approved ? 'active' : 'idle' };
}

function countFrames(root) {
  const rows = [...root.querySelectorAll('#sourceList [data-source-id]')];
  const fromRows = rows.reduce((total, row) => total + Number(row.textContent.match(/(\d+)\s+Frames/i)?.[1] || 0), 0);
  return Math.max(fromRows, root.querySelectorAll('[data-review-card="true"], #reviewGrid [data-frame-id]').length);
}

function updateBrand(root) {
  const subtitle = root.querySelector('header h1 + p');
  if (subtitle) subtitle.textContent = '從原圖到貼圖包，一個工作區完成';
  const exportButton = root.querySelector('#exportZipBtn');
  if (exportButton) exportButton.textContent = '下載貼圖包 ZIP';
}

function resolveInitialStage() {
  const hashStage = stageFromHash(location.hash);
  if (hashStage) return hashStage;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (STAGE_IDS.has(stored)) return stored;
  } catch {}
  return 'layout';
}

function stageFromHash(hash = '') {
  const value = String(hash).replace(/^#/, '').replace(/^workflow-/, '').replace(/^stage-/, '');
  return STAGE_IDS.has(value) ? value : null;
}

function persistStage(stageId) {
  try { localStorage.setItem(STORAGE_KEY, stageId); } catch {}
}

function loadCollapsed() {
  try {
    const value = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
    return { left: Boolean(value.left), right: Boolean(value.right) };
  } catch {
    return { left: false, right: false };
  }
}

function persistCollapsed(value) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(value)); } catch {}
}

function activeAccentClass(accent) {
  return ({ emerald: 'text-emerald-300', rose: 'text-rose-300', sky: 'text-sky-300', amber: 'text-amber-300' })[accent] || 'text-white';
}
function accentClass(accent) {
  return ({ emerald: 'text-emerald-600', rose: 'text-rose-500', sky: 'text-sky-600', amber: 'text-amber-600' })[accent] || 'text-slate-500';
}
function statusSurfaceClass(tone) {
  return ({ complete: 'bg-emerald-50 text-emerald-800', active: 'bg-sky-50 text-sky-800', warning: 'bg-amber-50 text-amber-800', error: 'bg-rose-50 text-rose-800', idle: 'bg-slate-100 text-slate-600' })[tone] || 'bg-slate-100 text-slate-600';
}
function progressClass(tone) {
  return ({ complete: 'bg-emerald-500', active: 'bg-sky-500', warning: 'bg-amber-500', error: 'bg-rose-500', idle: 'bg-slate-300' })[tone] || 'bg-slate-300';
}
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .workflow-tab { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
    .workflow-tab:not(.workflow-tab-active):hover { transform: translateY(-2px); border-color: rgba(15,23,42,.35); }
    [data-workflow-column][data-collapsed="true"] { display: none !important; }
    [data-mobile-workflow-nav] { display: none; }
    .workflow-stage-header,.workflow-footer { grid-column: 1 / -1; }
    .workflow-stage-header { display:flex;align-items:center;justify-content:space-between;gap:1rem; }
    .workflow-header-actions { display:flex;align-items:center;gap:.75rem; }
    .workflow-footer { display:flex;align-items:center;justify-content:space-between;gap:.75rem; }
    @media (min-width:1024px) {
      html,body,#app,#app>[data-workflow-shell="v4"] { height:100%;min-height:0;overflow:hidden; }
      #app>[data-workflow-shell="v4"] { display:flex;flex-direction:column; }
      #app>[data-workflow-shell="v4"]>header { flex:0 0 auto; }
      .stixio-workflow-main { flex:1 1 auto;min-height:0;overflow:hidden;align-items:stretch;grid-template-rows:auto minmax(0,1fr) auto; }
      .stixio-workflow-main>[data-workflow-column] { min-height:0;max-height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable; }
      .stixio-workflow-main[data-active-stage="review"] { grid-template-columns:minmax(0,1fr) 340px !important; }
      .stixio-workflow-main[data-collapse-left="true"][data-collapse-right="false"] { grid-template-columns:minmax(0,1fr) 340px !important; }
      .stixio-workflow-main[data-collapse-left="false"][data-collapse-right="true"] { grid-template-columns:360px minmax(0,1fr) !important; }
      .stixio-workflow-main[data-collapse-left="true"][data-collapse-right="true"],.stixio-workflow-main[data-active-stage="review"][data-collapse-right="true"] { grid-template-columns:minmax(0,1fr) !important; }
    }
    @media (max-width:767px) {
      body { padding-bottom:76px; }
      header nav[aria-label="貼圖製作流程"] { display:none !important; }
      .workflow-stage-header { align-items:flex-start;flex-direction:column; }
      .workflow-header-actions { width:100%; }
      .workflow-header-actions>div:first-child { width:100%;min-width:0; }
      .workflow-footer { display:none; }
      [data-mobile-workflow-nav] { position:fixed;z-index:80;right:0;bottom:0;left:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.25rem;padding:.5rem max(.5rem,env(safe-area-inset-right)) calc(.5rem + env(safe-area-inset-bottom)) max(.5rem,env(safe-area-inset-left));border-top:1px solid rgba(15,23,42,.12);background:rgba(255,255,255,.96);box-shadow:0 -10px 30px rgba(15,23,42,.12);backdrop-filter:blur(16px); }
      [data-mobile-workflow-nav] button { display:grid;min-width:0;place-items:center;gap:.1rem;border:0;border-radius:.9rem;padding:.45rem .25rem;background:transparent;color:#64748b; }
      [data-mobile-workflow-nav] button[data-active="true"] { background:#0f172a;color:white; }
      [data-mobile-workflow-nav] span { font-size:.62rem;font-weight:900;letter-spacing:.12em; }
      [data-mobile-workflow-nav] strong { overflow:hidden;max-width:100%;font-size:.72rem;text-overflow:ellipsis;white-space:nowrap; }
    }`;
  document.head.appendChild(style);
}
