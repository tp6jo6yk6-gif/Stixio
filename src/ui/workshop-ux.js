const THEME_KEY = 'stixio-theme';
const WORKSPACE_CLEARED_KEY = 'stixio-workspace-cleared';
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.12;

export const GRID_RESET_FIELDS = Object.freeze([
  'marginXInput',
  'marginYInput',
  'gapXInput',
  'gapYInput'
]);

export function clampViewportZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function getWorkshopShortcut(eventLike = {}) {
  const key = String(eventLike.key || '').toLowerCase();
  const command = Boolean(eventLike.ctrlKey || eventLike.metaKey);
  const shift = Boolean(eventLike.shiftKey);

  if (command && key === 'z') return shift ? 'redo' : 'undo';
  if (command && key === 'y') return 'redo';
  if (command && key === 'd') return 'duplicate';
  if (command && shift && key === 'e') return 'export';
  if (key === 'delete' || key === 'backspace') return 'delete';
  if (key === 'arrowleft') return shift ? 'nudge-left-5' : 'nudge-left';
  if (key === 'arrowright') return shift ? 'nudge-right-5' : 'nudge-right';
  if (key === 'arrowup') return shift ? 'nudge-up-5' : 'nudge-up';
  if (key === 'arrowdown') return shift ? 'nudge-down-5' : 'nudge-down';
  if (key === '0') return 'zoom-reset';
  if (key === '+' || key === '=') return 'zoom-in';
  if (key === '-' || key === '_') return 'zoom-out';
  return null;
}

export function enhanceWorkshopUx(root = document.getElementById('app')) {
  if (!root || root.dataset.uxController === 'ready') return;
  root.dataset.uxController = 'ready';

  const viewportStates = new Map();
  let activeCanvasId = 'sourceCanvas';
  let spacePressed = false;
  let panSession = null;
  let scheduled = false;

  installThemeStyle();
  applyInitialTheme();

  const scheduleInstall = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      installControls();
      installViewports();
    });
  };

  const observer = new MutationObserver(scheduleInstall);
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener('wheel', event => {
    const canvas = event.target.closest?.('canvas');
    if (!canvas || !root.contains(canvas)) return;
    event.preventDefault();
    activeCanvasId = canvas.id || activeCanvasId;
    const state = getViewportState(activeCanvasId);
    const multiplier = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    state.zoom = clampViewportZoom(state.zoom * multiplier);
    applyViewport(activeCanvasId);
  }, { passive: false, capture: true });

  root.addEventListener('pointerdown', event => {
    const canvas = event.target.closest?.('canvas');
    if (!canvas || (!spacePressed && event.button !== 1)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activeCanvasId = canvas.id || activeCanvasId;
    const state = getViewportState(activeCanvasId);
    panSession = {
      pointerId: event.pointerId,
      canvasId: activeCanvasId,
      startX: event.clientX,
      startY: event.clientY,
      originX: state.x,
      originY: state.y
    };
    canvas.setPointerCapture?.(event.pointerId);
    document.body.classList.add('stixio-panning');
  }, true);

  window.addEventListener('pointermove', event => {
    if (!panSession || event.pointerId !== panSession.pointerId) return;
    const state = getViewportState(panSession.canvasId);
    state.x = panSession.originX + event.clientX - panSession.startX;
    state.y = panSession.originY + event.clientY - panSession.startY;
    applyViewport(panSession.canvasId);
  }, true);

  window.addEventListener('pointerup', event => {
    if (!panSession || event.pointerId !== panSession.pointerId) return;
    panSession = null;
    document.body.classList.remove('stixio-panning');
  }, true);

  window.addEventListener('keydown', event => {
    if (event.code === 'Space' && !isTypingTarget(event.target)) {
      spacePressed = true;
      document.body.classList.add('stixio-pan-ready');
      event.preventDefault();
      return;
    }

    if (isTypingTarget(event.target)) return;
    const action = getWorkshopShortcut(event);
    if (!action) return;
    if (runShortcut(action)) event.preventDefault();
  }, true);

  window.addEventListener('keyup', event => {
    if (event.code !== 'Space') return;
    spacePressed = false;
    document.body.classList.remove('stixio-pan-ready');
  }, true);

  window.addEventListener('blur', () => {
    spacePressed = false;
    panSession = null;
    document.body.classList.remove('stixio-pan-ready', 'stixio-panning');
  });

  root.addEventListener('click', event => {
    const zoomButton = event.target.closest?.('[data-ux-zoom]');
    if (zoomButton) {
      event.preventDefault();
      const canvasId = zoomButton.dataset.canvasId || activeCanvasId;
      const action = zoomButton.dataset.uxZoom;
      activeCanvasId = canvasId;
      if (action === 'reset') resetViewport(canvasId);
      if (action === 'in') zoomViewport(canvasId, ZOOM_STEP);
      if (action === 'out') zoomViewport(canvasId, 1 / ZOOM_STEP);
      return;
    }

    if (event.target.closest?.('#uxThemeToggle')) toggleTheme();
    if (event.target.closest?.('#uxGridReset')) resetGrid();
    if (event.target.closest?.('#uxClearWorkspace')) clearWorkspace();
  });

  scheduleInstall();
  showClearedMessage();

  function installControls() {
    const headerControls = root.querySelector('header .flex.items-center.gap-2');
    if (headerControls && !root.querySelector('#uxThemeToggle')) {
      const themeButton = createButton('uxThemeToggle', themeButtonLabel(), 'rounded-xl bg-white px-3 py-2 text-xs font-black');
      const clearButton = createButton('uxClearWorkspace', '清除 Workspace', 'rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700');
      headerControls.prepend(clearButton);
      headerControls.prepend(themeButton);
    }

    const detectButton = root.querySelector('#detectBtn');
    if (detectButton && !root.querySelector('#uxGridReset')) {
      const resetButton = createButton('uxGridReset', 'Margin／Gap 歸零', 'mt-2 w-full rounded-2xl bg-slate-100 py-3 text-sm font-black');
      detectButton.insertAdjacentElement('beforebegin', resetButton);
    }
  }

  function installViewports() {
    for (const canvasId of ['sourceCanvas', 'refineCanvas']) {
      const canvas = root.querySelector(`#${canvasId}`);
      if (!canvas) continue;
      ensureViewportLayer(canvas);
      applyViewport(canvasId);
    }
  }

  function ensureViewportLayer(canvas) {
    let layer = canvas.parentElement?.closest?.('[data-ux-transform-layer]');
    if (!layer) {
      layer = document.createElement('div');
      layer.dataset.uxTransformLayer = canvas.id;
      layer.className = 'relative inline-block will-change-transform';
      layer.style.transformOrigin = 'center center';
      canvas.parentNode.insertBefore(layer, canvas);
      layer.appendChild(canvas);
    }

    const viewport = layer.parentElement;
    if (viewport && !viewport.querySelector(`:scope > [data-ux-toolbar="${canvas.id}"]`)) {
      viewport.classList.add('relative');
      const toolbar = document.createElement('div');
      toolbar.dataset.uxToolbar = canvas.id;
      toolbar.className = 'sticky left-full top-2 z-30 ml-auto mr-2 flex w-fit gap-1 rounded-xl bg-slate-950/85 p-1 text-white shadow-lg backdrop-blur';
      toolbar.innerHTML = `
        <button data-ux-zoom="out" data-canvas-id="${canvas.id}" class="rounded-lg px-2 py-1 text-xs font-black">−</button>
        <button data-ux-zoom="reset" data-canvas-id="${canvas.id}" class="rounded-lg px-2 py-1 text-xs font-black"><span data-ux-zoom-label="${canvas.id}">100%</span></button>
        <button data-ux-zoom="in" data-canvas-id="${canvas.id}" class="rounded-lg px-2 py-1 text-xs font-black">＋</button>`;
      viewport.prepend(toolbar);
    }
  }

  function getViewportState(canvasId) {
    if (!viewportStates.has(canvasId)) viewportStates.set(canvasId, { zoom: 1, x: 0, y: 0 });
    return viewportStates.get(canvasId);
  }

  function applyViewport(canvasId) {
    const state = getViewportState(canvasId);
    const layer = root.querySelector(`[data-ux-transform-layer="${canvasId}"]`);
    if (layer) layer.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.zoom})`;
    root.querySelectorAll(`[data-ux-zoom-label="${canvasId}"]`).forEach(label => {
      label.textContent = `${Math.round(state.zoom * 100)}%`;
    });
  }

  function zoomViewport(canvasId, multiplier) {
    const state = getViewportState(canvasId);
    state.zoom = clampViewportZoom(state.zoom * multiplier);
    applyViewport(canvasId);
  }

  function resetViewport(canvasId) {
    viewportStates.set(canvasId, { zoom: 1, x: 0, y: 0 });
    applyViewport(canvasId);
  }

  function runShortcut(action) {
    const clicks = {
      undo: '#undoBtn',
      redo: '#redoBtn',
      duplicate: '#duplicateBtn',
      delete: '#deleteBtn',
      export: '#exportZipBtn'
    };
    if (clicks[action]) return clickControl(clicks[action]);

    const nudgeMap = {
      'nudge-left': '[data-nudge-x="-1"]',
      'nudge-right': '[data-nudge-x="1"]',
      'nudge-up': '[data-nudge-y="-1"]',
      'nudge-down': '[data-nudge-y="1"]'
    };
    const baseAction = action.replace('-5', '');
    if (nudgeMap[baseAction]) {
      const count = action.endsWith('-5') ? 5 : 1;
      let handled = false;
      for (let index = 0; index < count; index += 1) handled = clickControl(nudgeMap[baseAction]) || handled;
      return handled;
    }

    if (action === 'zoom-reset') { resetViewport(activeCanvasId); return true; }
    if (action === 'zoom-in') { zoomViewport(activeCanvasId, ZOOM_STEP); return true; }
    if (action === 'zoom-out') { zoomViewport(activeCanvasId, 1 / ZOOM_STEP); return true; }
    return false;
  }

  function clickControl(selector) {
    const control = root.querySelector(selector);
    if (!control || control.disabled) return false;
    control.click();
    return true;
  }

  function resetGrid() {
    let changed = false;
    for (const id of GRID_RESET_FIELDS) {
      const input = root.querySelector(`#${id}`);
      if (!input) continue;
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      changed = true;
    }
    if (changed) showToast('Margin 與 Gap 已全部歸零');
  }

  function clearWorkspace() {
    const hasArtwork = Boolean(root.querySelector('#sourceList img, #reviewGrid img'));
    const message = hasArtwork
      ? '確定清除所有原圖、裁切框、遮罩、排序與輸出設定？此動作無法復原。'
      : '確定重設目前 Workspace？';
    if (!window.confirm(message)) return;
    sessionStorage.setItem(WORKSPACE_CLEARED_KEY, '1');
    window.location.reload();
  }

  function showClearedMessage() {
    if (sessionStorage.getItem(WORKSPACE_CLEARED_KEY) !== '1') return;
    sessionStorage.removeItem(WORKSPACE_CLEARED_KEY);
    setTimeout(() => showToast('Workspace 已清除'), 50);
  }
}

function isTypingTarget(target) {
  if (!target) return false;
  return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function createButton(id, label, className) {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function applyInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark = saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('stixio-dark', Boolean(dark));
}

function toggleTheme() {
  const dark = !document.body.classList.contains('stixio-dark');
  document.body.classList.toggle('stixio-dark', dark);
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  document.querySelectorAll('#uxThemeToggle').forEach(button => { button.textContent = themeButtonLabel(); });
}

function themeButtonLabel() {
  return document.body.classList.contains('stixio-dark') ? '☀ 淺色' : '☾ 深色';
}

function installThemeStyle() {
  if (document.getElementById('stixioUxThemeStyle')) return;
  const style = document.createElement('style');
  style.id = 'stixioUxThemeStyle';
  style.textContent = `
    [data-ux-transform-layer] { transition: transform 60ms ease-out; }
    .stixio-pan-ready canvas { cursor: grab !important; }
    .stixio-panning, .stixio-panning * { cursor: grabbing !important; user-select: none !important; }
    body.stixio-dark { background: #020617; color-scheme: dark; }
    body.stixio-dark #app > div { background: #020617 !important; color: #e2e8f0 !important; }
    body.stixio-dark header { background: rgba(2, 6, 23, .94) !important; border-color: #334155 !important; }
    body.stixio-dark section,
    body.stixio-dark aside > section { background: #0f172a !important; border-color: #334155 !important; color: #e2e8f0 !important; }
    body.stixio-dark input,
    body.stixio-dark select,
    body.stixio-dark textarea { background: #1e293b !important; border-color: #475569 !important; color: #f8fafc !important; }
    body.stixio-dark .bg-white { background-color: #0f172a !important; }
    body.stixio-dark .bg-slate-50,
    body.stixio-dark .bg-slate-100 { background-color: #1e293b !important; }
    body.stixio-dark .bg-emerald-50 { background-color: rgba(6, 78, 59, .42) !important; }
    body.stixio-dark .bg-rose-50 { background-color: rgba(136, 19, 55, .32) !important; }
    body.stixio-dark .text-slate-950 { color: #f8fafc !important; }
    body.stixio-dark .text-slate-500,
    body.stixio-dark .text-slate-400 { color: #94a3b8 !important; }
    body.stixio-dark .border-slate-200,
    body.stixio-dark .border-slate-300 { border-color: #475569 !important; }
    body.stixio-dark #uxThemeToggle { background: #1e293b !important; color: #f8fafc !important; }
  `;
  document.head.appendChild(style);
}

function showToast(message) {
  const existing = document.getElementById('stixioUxToast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.id = 'stixioUxToast';
  toast.className = 'fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}
