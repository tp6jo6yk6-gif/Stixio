import {
  BRAND,
  detectGrid,
  renderFrameToCanvas,
  reviewFrames,
  createPngExport,
  createZipExport,
  canvasToPngDataUrl,
  ReviewBackgrounds,
  moveFrame,
  resizeFrame,
  snapFrame,
  createCanvasFrameGuides,
  createFrameGuides,
  mergeFrameGuides,
  createCommand,
  executeCommand,
  createHistory,
  commitHistory,
  undo,
  redo,
  canUndo,
  canRedo
} from '../core/index.js';

const DEFAULT_SETTINGS = {
  rows: 1,
  cols: 1,
  marginX: 0,
  marginY: 0,
  gapX: 0,
  gapY: 0,
  targetW: 370,
  targetH: 320,
  safeMargin: 15,
  chromaEnabled: true,
  chromaColor: [255, 255, 255],
  tolerance: 30,
  exteriorOnly: true,
  autoDespeckle: true,
  shrinkRadius: 0,
  featherRadius: 1,
  trimEnabled: false,
  trimPadding: 0,
  whiteBorderEnabled: false,
  whiteBorderSize: 6,
  shadowEnabled: false,
  shadowBlur: 8,
  shadowOffsetY: 4,
  lineNamingMode: true,
  selectedId: null,
  reviewBackground: ReviewBackgrounds.CHECKER,
  mode: 'developer'
};

const WORKSPACES = ['Artwork', 'Layout', 'Refine', 'Review', 'Package'];
const HANDLE_SIZE = 14;
const MIN_FRAME_SIZE = 8;

const state = {
  source: null,
  frames: [],
  rendered: new Map(),
  renderKeys: new Map(),
  detectionReport: null,
  reviewReport: null,
  editorDrag: null,
  history: createHistory({ frames: [], selectedId: null }),
  settings: { ...DEFAULT_SETTINGS }
};

export function initStixioApp(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = `${BRAND.name} - ${BRAND.slogan}`;
  root.innerHTML = renderShell();
  bindEvents(root);
  refresh();
}

function renderShell() {
  return `
    <div class="min-h-screen bg-[#f6f3ec] text-slate-950 selection:bg-emerald-300/50">
      <header class="sticky top-0 z-30 border-b border-slate-900/10 bg-[#f6f3ec]/90 backdrop-blur-xl">
        <div class="mx-auto max-w-[1500px] px-5 py-4 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="h-11 w-11 rounded-2xl bg-slate-950 text-emerald-300 grid place-items-center font-black text-xl shadow-[6px_6px_0_rgba(16,185,129,.25)]">S</div>
            <div><div class="flex items-center gap-2"><h1 class="text-xl font-black tracking-tight">${BRAND.name}</h1><span class="rounded-full border border-slate-900/10 bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Beta</span></div><p class="text-xs font-semibold text-slate-500">${BRAND.slogan}</p></div>
          </div>
          <div class="hidden lg:flex items-center gap-2 rounded-2xl border border-slate-900/10 bg-white/70 p-1 shadow-sm">
            ${WORKSPACES.map((label, index) => `<button class="workspace-tab rounded-xl px-4 py-2 text-left transition ${index === 1 ? 'bg-slate-950 text-white shadow' : 'hover:bg-slate-100'}"><span class="block text-[10px] font-black uppercase tracking-widest ${index === 1 ? 'text-emerald-300' : 'text-slate-400'}">0${index + 1}</span><span class="block text-sm font-black">${label}</span></button>`).join('')}
          </div>
          <div class="flex items-center gap-2"><span class="hidden md:inline-flex rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-xs font-black text-slate-700">Undo / Redo</span><button id="workspaceCtaBtn" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow hover:-translate-y-0.5 transition">M1 Only</button></div>
        </div>
      </header>
      <main class="mx-auto max-w-[1500px] px-5 py-6 space-y-6">
        ${renderHero()}
        <div class="grid grid-cols-1 xl:grid-cols-[380px_1fr_320px] gap-5 items-start">${renderLeftPanel()}${renderCenterPanel()}${renderRightPanel()}</div>
      </main>
    </div>
  `;
}

function renderHero() {
  return `
    <section class="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-6 md:p-8 shadow-xl">
      <div class="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,.55),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,.35),transparent_32%)]"></div>
      <div class="relative grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-center">
        <div>
          <div class="mb-4 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-emerald-200">Command Engine</div>
          <h2 class="text-4xl md:text-6xl font-black leading-tight tracking-tight">Edit freely.<br><span class="text-emerald-300">Undo safely.</span></h2>
          <p class="mt-4 max-w-2xl text-sm md:text-base text-slate-300">Frame moves, resize, duplicate, delete, and keyboard nudges now enter Command History with Undo / Redo.</p>
          <div class="mt-6 flex flex-wrap gap-3"><label class="cursor-pointer rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 shadow hover:-translate-y-0.5 transition"><input id="heroFileInput" type="file" accept="image/*" class="hidden" />Drop / choose artwork</label><button id="heroRenderBtn" class="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15 transition">Render + Review</button></div>
        </div>
        <div class="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur"><div class="grid grid-cols-2 gap-3">${metricCard('Frames', state.frames.length || '0', 'detected areas')}${metricCard('Selected', getSelectedFrame()?.name || 'None', 'active frame')}${metricCard('Undo', canUndo(state.history) ? 'Ready' : '—', 'history state')}${metricCard('Redo', canRedo(state.history) ? 'Ready' : '—', 'history state')}</div></div>
      </div>
    </section>
  `;
}

function metricCard(label, value, hint) {
  return `<div class="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p class="text-[10px] uppercase tracking-widest text-slate-400 font-black">${label}</p><p class="mt-2 text-2xl font-black text-white truncate">${value}</p><p class="mt-1 text-xs text-slate-400 truncate">${hint}</p></div>`;
}

function renderLeftPanel() {
  return `
    <aside class="space-y-4">
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex items-start justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Quick Project</p><h3 class="mt-1 text-xl font-black">Import artwork</h3></div><span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">OPEN</span></div><p class="mt-3 text-sm text-slate-500">Upload a sheet. Then adjust detected Frames directly on the source canvas.</p><label id="dropZone" class="mt-5 block cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50"><input id="fileInput" type="file" accept="image/*" class="hidden" /><div class="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-3xl text-emerald-300">＋</div><p class="font-black">Drop or choose artwork</p><p class="mt-1 text-xs text-slate-500">PNG, JPG, WebP. One sheet is enough.</p></label></section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detection</p><h3 class="text-lg font-black">Grid Detect v2</h3></div><div class="flex gap-2"><button id="preset4x4Btn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">4×4</button><button id="preset5x8Btn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">5×8</button></div></div><div class="mt-4 grid grid-cols-2 gap-3">${numberInput('rowsInput', 'Rows', state.settings.rows, 1, 12)}${numberInput('colsInput', 'Cols', state.settings.cols, 1, 12)}${numberInput('marginXInput', 'Margin X', state.settings.marginX, 0, 500)}${numberInput('marginYInput', 'Margin Y', state.settings.marginY, 0, 500)}${numberInput('gapXInput', 'Gap X', state.settings.gapX, 0, 500)}${numberInput('gapYInput', 'Gap Y', state.settings.gapY, 0, 500)}</div><button id="applyGridBtn" class="mt-4 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white hover:-translate-y-0.5 transition">Detect Frames</button><div id="detectionMiniReport" class="mt-4">${renderDetectionMiniReport()}</div></section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Command History</p><h3 class="text-lg font-black">Undo / Redo</h3><div class="mt-4 grid grid-cols-2 gap-2"><button id="undoBtn" class="rounded-2xl ${canUndo(state.history) ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400'} py-3 text-xs font-black">Undo</button><button id="redoBtn" class="rounded-2xl ${canRedo(state.history) ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400'} py-3 text-xs font-black">Redo</button></div><div class="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">Shortcut: Ctrl/Cmd+Z · Ctrl/Cmd+Shift+Z</div></section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Frame Editor</p><h3 class="text-lg font-black">Manual adjust</h3><div class="mt-4 space-y-2 text-sm">${renderSelectedFrameInfo()}<div class="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">Mouse: drag / resize handle<br>Keyboard: arrows nudge · Shift = 10px</div></div><div class="mt-4 grid grid-cols-2 gap-2"><button id="deleteFrameBtn" class="rounded-2xl bg-rose-50 py-3 text-xs font-black text-rose-700">Delete</button><button id="duplicateFrameBtn" class="rounded-2xl bg-slate-100 py-3 text-xs font-black text-slate-700">Duplicate</button></div></section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Refine</p><h3 class="text-lg font-black">Finish effects</h3><div class="mt-4 space-y-3"><label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Remove white background</span><input id="chromaEnabled" type="checkbox" ${state.settings.chromaEnabled ? 'checked' : ''}></label><label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Exterior only</span><input id="exteriorOnly" type="checkbox" ${state.settings.exteriorOnly ? 'checked' : ''}></label>${numberInput('toleranceInput', 'Tolerance', state.settings.tolerance, 0, 255)}<div class="grid grid-cols-2 gap-3">${numberInput('shrinkInput', 'Shrink', state.settings.shrinkRadius, 0, 10)}${numberInput('featherInput', 'Feather', state.settings.featherRadius, 0, 10)}</div><label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Trim transparent</span><input id="trimEnabled" type="checkbox" ${state.settings.trimEnabled ? 'checked' : ''}></label>${numberInput('trimPaddingInput', 'Trim padding', state.settings.trimPadding, 0, 50)}<label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>White border</span><input id="whiteBorderEnabled" type="checkbox" ${state.settings.whiteBorderEnabled ? 'checked' : ''}></label>${numberInput('whiteBorderSizeInput', 'Border size', state.settings.whiteBorderSize, 0, 40)}<label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Shadow</span><input id="shadowEnabled" type="checkbox" ${state.settings.shadowEnabled ? 'checked' : ''}></label><div class="grid grid-cols-2 gap-3">${numberInput('shadowBlurInput', 'Shadow blur', state.settings.shadowBlur, 0, 40)}${numberInput('shadowOffsetYInput', 'Shadow Y', state.settings.shadowOffsetY, -40, 40)}</div></div><button id="renderBtn" class="mt-4 w-full rounded-2xl border border-slate-900/10 bg-white py-3 text-sm font-black text-slate-950 hover:bg-slate-50 transition">Render selected</button></section>
    </aside>
  `;
}

function renderCenterPanel() {
  return `<section class="space-y-4"><section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Frame Editor</p><h3 class="text-xl font-black">Source image + editable Frame overlay</h3></div><div id="statusText" class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">No artwork loaded</div></div><div class="grid min-h-[440px] place-items-center overflow-auto rounded-[1.25rem] border border-slate-900/10 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:18px_18px] bg-slate-50 p-4"><canvas id="sourceCanvas" class="max-w-full rounded-xl shadow-xl cursor-crosshair"></canvas></div></section><section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Review</p><h3 class="text-xl font-black">Rendered Frame board</h3></div><div id="limitText" class="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">${getReviewSummaryLabel()}</div></div><div class="mb-4 flex flex-wrap gap-2"><button data-review-bg="checker" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Checker</button><button data-review-bg="white" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">White</button><button data-review-bg="black" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Black</button><button data-review-bg="line-preview" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">LINE</button></div><div id="frameGrid" class="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3"></div></section></section>`;
}

function renderRightPanel() { return `<aside class="space-y-4"><section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Review Issues</p><div class="mt-4 space-y-2 text-sm">${renderReviewIssues()}</div></section><section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Project Health</p><div class="mt-4 flex items-end gap-3"><div class="text-5xl font-black">${calculateHealth()}%</div><div class="pb-2 text-sm font-bold text-slate-500">ready</div></div><div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-400" style="width:${calculateHealth()}%"></div></div><div class="mt-4 space-y-2 text-sm">${healthRow(Boolean(state.source), 'Source image imported')}${healthRow(state.frames.length > 0, `${state.frames.length || 0} Frames detected`)}${healthRow(Boolean(state.settings.selectedId), 'One Frame selected')}${healthRow(Boolean(state.reviewReport?.ready), 'Review ready')}</div></section><section class="rounded-[1.75rem] border border-slate-900/10 bg-slate-950 p-5 text-white shadow-sm"><p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Export Engine</p><h3 class="mt-1 text-xl font-black">Export center</h3><p class="mt-2 text-sm text-slate-400">PNG and ZIP export are created through Export Engine after review.</p><div class="mt-5 space-y-3"><button id="downloadPngBtn" class="w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950 hover:-translate-y-0.5 transition">Download selected PNG</button><button id="downloadZipBtn" class="w-full rounded-2xl border border-white/10 bg-white/10 py-3 text-sm font-black text-white hover:bg-white/15 transition">Export Frames ZIP</button></div></section></aside>`; }
function numberInput(id, label, value, min, max) { return `<label class="block text-xs font-black text-slate-500"><span>${label}</span><input id="${id}" type="number" min="${min}" max="${max}" value="${value}" class="mt-1 w-full rounded-2xl border border-slate-900/10 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"></label>`; }
function renderSelectedFrameInfo() { const f = getSelectedFrame(); if (!f) return '<div class="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">No selected Frame.</div>'; const g = f.geometry; return `<div class="rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">${f.name}<br>x:${Math.round(g.x)} y:${Math.round(g.y)} · ${Math.round(g.width)}×${Math.round(g.height)}</div>`; }
function renderDetectionMiniReport() { if (!state.detectionReport) return '<div class="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">Run detection to see quality score.</div>'; const q = state.detectionReport.quality; return `<div class="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">${q.frameCount} Frames · Quality ${q.score}% · Cell ${Math.round(q.cellWidth)}×${Math.round(q.cellHeight)}</div>`; }
function renderReviewIssues() { if (!state.reviewReport) return healthRow(false, 'No review yet'); if (!state.reviewReport.issues.length) return healthRow(true, 'No review issues'); return state.reviewReport.issues.slice(0, 8).map(issue => healthRow(issue.severity !== 'error', issue.message)).join(''); }
function healthRow(ok, label) { return `<div class="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"><span class="font-bold text-slate-600">${label}</span><span class="font-black ${ok ? 'text-emerald-600' : 'text-amber-600'}">${ok ? '✓' : '!'}</span></div>`; }
function getDetectionScoreLabel() { return state.detectionReport ? `${state.detectionReport.quality.score}%` : '—'; }
function getReviewSummaryLabel() { if (!state.reviewReport) return 'Not reviewed'; const { errors, warnings } = state.reviewReport.summary; return state.reviewReport.ready ? `Ready · ${warnings} warnings` : `${errors} errors`; }
function calculateHealth() { let score = 0; if (state.source) score += 25; if (state.frames.length) score += 25; if (state.rendered.size) score += 25; if (state.reviewReport?.ready) score += 25; return score; }

function bindEvents(root) {
  bindFileInputs(root);
  bindFrameEditorEvents(root);
  document.addEventListener('keydown', handleKeydown);
  root.querySelector('#applyGridBtn').addEventListener('click', () => { readSettings(root); createFramesFromSource(); renderAll(); runReview(); refresh(); });
  root.querySelector('#preset4x4Btn').addEventListener('click', () => applyPreset(root, 4, 4));
  root.querySelector('#preset5x8Btn').addEventListener('click', () => applyPreset(root, 5, 8));
  root.querySelector('#renderBtn').addEventListener('click', () => { readSettings(root); clearRenderCache(); renderSelected(); runReview(); refresh(); });
  root.querySelector('#heroRenderBtn').addEventListener('click', () => { clearRenderCache(); renderAll(); runReview(); refresh(); });
  root.querySelector('#downloadPngBtn').addEventListener('click', downloadSelectedPng);
  root.querySelector('#downloadZipBtn').addEventListener('click', downloadZip);
  root.querySelector('#deleteFrameBtn').addEventListener('click', deleteSelectedFrame);
  root.querySelector('#duplicateFrameBtn').addEventListener('click', duplicateSelectedFrame);
  root.querySelector('#undoBtn').addEventListener('click', undoCommand);
  root.querySelector('#redoBtn').addEventListener('click', redoCommand);
  root.querySelector('#workspaceCtaBtn').addEventListener('click', showWorkspacePrompt);
  root.querySelectorAll('.review-bg').forEach(button => button.addEventListener('click', () => { state.settings.reviewBackground = button.dataset.reviewBg; refresh(); }));
}

function bindFrameEditorEvents(root) { const canvas = root.querySelector('#sourceCanvas'); canvas.addEventListener('pointerdown', handleCanvasPointerDown); canvas.addEventListener('pointermove', handleCanvasPointerMove); canvas.addEventListener('pointerup', handleCanvasPointerUp); canvas.addEventListener('pointerleave', handleCanvasPointerUp); }
function handleCanvasPointerDown(event) { if (!state.source || !state.frames.length) return; const point = getCanvasPoint(event); const hit = hitTestFrame(point); if (!hit) return; event.preventDefault(); state.settings.selectedId = hit.frame.id; state.editorDrag = { type: hit.handle ? 'resize' : 'move', frameId: hit.frame.id, startPoint: point, startGeometry: { ...hit.frame.geometry }, before: createFrameSnapshot() }; event.currentTarget.setPointerCapture?.(event.pointerId); refresh(); }
function handleCanvasPointerMove(event) { if (!state.source) return; const canvas = event.currentTarget; const point = getCanvasPoint(event); const hit = hitTestFrame(point); canvas.style.cursor = hit?.handle ? 'nwse-resize' : hit ? 'move' : 'crosshair'; if (!state.editorDrag) return; event.preventDefault(); const drag = state.editorDrag; const dx = point.x - drag.startPoint.x; const dy = point.y - drag.startPoint.y; const frame = state.frames.find(item => item.id === drag.frameId); if (!frame) return; let nextFrame; if (drag.type === 'resize') { nextFrame = resizeFrame(frame, { ...drag.startGeometry, width: Math.max(MIN_FRAME_SIZE, drag.startGeometry.width + dx), height: Math.max(MIN_FRAME_SIZE, drag.startGeometry.height + dy) }); } else { nextFrame = moveFrame({ ...frame, geometry: drag.startGeometry }, dx, dy); } nextFrame = snapFrameToEditor(clampFrameToSource(nextFrame)); updateFrameInState(nextFrame); clearRenderCache(); drawSourcePreview(); }
function handleCanvasPointerUp() { if (!state.editorDrag) return; const drag = state.editorDrag; state.editorDrag = null; const after = createFrameSnapshot(); if (!sameSnapshot(drag.before, after)) commitFrameCommand(drag.type === 'resize' ? 'Resize Frame' : 'Move Frame', drag.before, after); renderSelected(); runReview(); refresh(); }
function handleKeydown(event) { if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redoCommand(); else undoCommand(); return; } const keyMap = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (!keyMap[event.key]) return; const frame = getSelectedFrame(); if (!frame) return; event.preventDefault(); const before = createFrameSnapshot(); const step = event.shiftKey ? 10 : 1; const [x, y] = keyMap[event.key]; const moved = snapFrameToEditor(clampFrameToSource(moveFrame(frame, x * step, y * step))); updateFrameInState(moved); commitFrameCommand('Nudge Frame', before, createFrameSnapshot()); clearRenderCache(); renderSelected(); runReview(); refresh(); }

function createFrameSnapshot() { return { frames: cloneFrames(state.frames), selectedId: state.settings.selectedId }; }
function cloneFrames(frames) { return frames.map(frame => ({ ...frame, geometry: { ...frame.geometry }, state: { ...(frame.state || {}) }, detection: frame.detection ? { ...frame.detection } : frame.detection })); }
function sameSnapshot(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function commitFrameCommand(label, before, after) { const command = createCommand({ type: 'frames.update', label, target: after.selectedId, payload: { after }, apply: () => after }); const executed = executeCommand(before, command); state.history = commitHistory(state.history, executed.entry); applyFrameSnapshot(state.history.present); }
function applyFrameSnapshot(snapshot) { if (!snapshot) return; state.frames = cloneFrames(snapshot.frames); state.settings.selectedId = snapshot.selectedId; clearRenderCache(); renderAll(); runReview(); }
function undoCommand() { if (!canUndo(state.history)) return; state.history = undo(state.history); applyFrameSnapshot(state.history.present); refresh(); }
function redoCommand() { if (!canRedo(state.history)) return; state.history = redo(state.history); applyFrameSnapshot(state.history.present); refresh(); }
function resetHistoryBaseline() { state.history = createHistory(createFrameSnapshot()); }

function getCanvasPoint(event) { const canvas = event.currentTarget || document.getElementById('sourceCanvas'); const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }; }
function hitTestFrame(point) { for (let i = state.frames.length - 1; i >= 0; i--) { const frame = state.frames[i]; const g = frame.geometry; const inBox = point.x >= g.x && point.x <= g.x + g.width && point.y >= g.y && point.y <= g.y + g.height; if (!inBox) continue; const handle = point.x >= g.x + g.width - HANDLE_SIZE && point.y >= g.y + g.height - HANDLE_SIZE; return { frame, handle }; } return null; }
function clampFrameToSource(frame) { if (!state.source) return frame; const g = frame.geometry; const width = Math.min(g.width, state.source.width); const height = Math.min(g.height, state.source.height); return { ...frame, geometry: { ...g, width, height, x: Math.max(0, Math.min(g.x, state.source.width - width)), y: Math.max(0, Math.min(g.y, state.source.height - height)) } }; }
function snapFrameToEditor(frame) { if (!state.source) return frame; const guides = mergeFrameGuides(createCanvasFrameGuides(state.source.width, state.source.height), createFrameGuides(state.frames, frame.id)); return snapFrame(frame, guides, 8); }
function updateFrameInState(nextFrame) { state.frames = state.frames.map(frame => frame.id === nextFrame.id ? { ...nextFrame, state: { ...nextFrame.state, selected: true } } : { ...frame, state: { ...frame.state, selected: false } }); state.settings.selectedId = nextFrame.id; }
function applyFrameListCommand(label, nextFrames, nextSelectedId) { const before = createFrameSnapshot(); const after = { frames: cloneFrames(nextFrames), selectedId: nextSelectedId }; if (!sameSnapshot(before, after)) commitFrameCommand(label, before, after); renderAll(); runReview(); refresh(); }

function applyPreset(root, rows, cols) { root.querySelector('#rowsInput').value = rows; root.querySelector('#colsInput').value = cols; readSettings(root); createFramesFromSource(); renderAll(); runReview(); refresh(); }
function bindFileInputs(root) { const inputs = [root.querySelector('#fileInput'), root.querySelector('#heroFileInput')].filter(Boolean); inputs.forEach(input => input.addEventListener('change', event => loadFile(event.target.files?.[0]))); const dropZone = root.querySelector('#dropZone'); dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('border-emerald-400', 'bg-emerald-50'); }); dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-emerald-400', 'bg-emerald-50')); dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('border-emerald-400', 'bg-emerald-50'); loadFile(event.dataTransfer.files?.[0]); }); }
function readSettings(root) { state.settings.rows = numberValue(root, '#rowsInput', 1); state.settings.cols = numberValue(root, '#colsInput', 1); state.settings.marginX = numberValue(root, '#marginXInput', 0); state.settings.marginY = numberValue(root, '#marginYInput', 0); state.settings.gapX = numberValue(root, '#gapXInput', 0); state.settings.gapY = numberValue(root, '#gapYInput', 0); state.settings.tolerance = numberValue(root, '#toleranceInput', 30); state.settings.shrinkRadius = numberValue(root, '#shrinkInput', 0); state.settings.featherRadius = numberValue(root, '#featherInput', 1); state.settings.trimPadding = numberValue(root, '#trimPaddingInput', 0); state.settings.whiteBorderSize = numberValue(root, '#whiteBorderSizeInput', 6); state.settings.shadowBlur = numberValue(root, '#shadowBlurInput', 8); state.settings.shadowOffsetY = numberValue(root, '#shadowOffsetYInput', 4); state.settings.chromaEnabled = Boolean(root.querySelector('#chromaEnabled')?.checked); state.settings.exteriorOnly = Boolean(root.querySelector('#exteriorOnly')?.checked); state.settings.trimEnabled = Boolean(root.querySelector('#trimEnabled')?.checked); state.settings.whiteBorderEnabled = Boolean(root.querySelector('#whiteBorderEnabled')?.checked); state.settings.shadowEnabled = Boolean(root.querySelector('#shadowEnabled')?.checked); }
function numberValue(root, selector, fallback) { const value = Number(root.querySelector(selector)?.value); return Number.isFinite(value) ? value : fallback; }
async function loadFile(file) { if (!file || !file.type.startsWith('image/')) return; const dataUrl = await readFileAsDataURL(file); const img = await loadImage(dataUrl); state.source = { id: createId('source'), fileName: file.name, name: file.name, provider: 'local', img, width: img.width, height: img.height, mimeType: file.type }; clearRenderCache(); createFramesFromSource(); renderAll(); runReview(); refresh(); }
function createFramesFromSource() { if (!state.source) return; state.detectionReport = detectGrid(state.source, { grid: { rows: state.settings.rows, cols: state.settings.cols, marginX: state.settings.marginX, marginY: state.settings.marginY, gapX: state.settings.gapX, gapY: state.settings.gapY, snapToPixels: true, minCellSize: 8 } }); state.frames = state.detectionReport.frames.map((frame, index) => ({ ...frame, state: { ...frame.state, selected: index === 0 } })); clearRenderCache(); state.settings.selectedId = state.frames[0]?.id || null; resetHistoryBaseline(); }
function getRenderOptions() { return { targetW: state.settings.targetW, targetH: state.settings.targetH, safeMargin: state.settings.safeMargin, highQuality: true, refine: { enabled: true, chromaEnabled: state.settings.chromaEnabled, chromaColor: state.settings.chromaColor, tolerance: state.settings.tolerance, exteriorOnly: state.settings.exteriorOnly, autoDespeckle: state.settings.autoDespeckle, shrinkRadius: state.settings.shrinkRadius, featherRadius: state.settings.featherRadius, trim: { enabled: state.settings.trimEnabled, threshold: 1, padding: state.settings.trimPadding }, whiteBorder: { enabled: state.settings.whiteBorderEnabled, size: state.settings.whiteBorderSize, color: '#ffffff' }, shadow: { enabled: state.settings.shadowEnabled, blur: state.settings.shadowBlur, offsetX: 0, offsetY: state.settings.shadowOffsetY, color: 'rgba(0,0,0,0.28)' } } }; }
function clearRenderCache() { state.rendered.clear(); state.renderKeys.clear(); state.reviewReport = null; }
function renderAll() { if (!state.source) return; state.frames.forEach(frame => renderFrame(frame)); }
function renderSelected() { const frame = getSelectedFrame(); if (frame) renderFrame(frame, true); }
function renderFrame(frame, force = false) { if (!state.source || !frame) return null; const options = getRenderOptions(); const key = JSON.stringify({ sourceId: state.source.id, frameId: frame.id, geometry: frame.geometry, targetW: options.targetW, targetH: options.targetH, safeMargin: options.safeMargin, refine: options.refine }); if (!force && state.rendered.has(frame.id) && state.renderKeys.get(frame.id) === key) return state.rendered.get(frame.id); const result = renderFrameToCanvas(state.source, frame, options); state.rendered.set(frame.id, result.canvas); state.renderKeys.set(frame.id, key); return result.canvas; }
function runReview() { state.reviewReport = reviewFrames(state.frames, state.rendered, { targetW: state.settings.targetW, targetH: state.settings.targetH }); }
function refresh() { drawSourcePreview(); renderFrameGrid(); const status = document.getElementById('statusText'); if (status) status.textContent = state.source ? `${state.source.fileName} · ${state.frames.length} Frames · ${getSelectedFrame()?.name || 'No selection'}` : 'No artwork loaded'; const detectionMiniReport = document.getElementById('detectionMiniReport'); if (detectionMiniReport) detectionMiniReport.innerHTML = renderDetectionMiniReport(); }
function drawSourcePreview() { const canvas = document.getElementById('sourceCanvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); if (!state.source) { canvas.width = 1; canvas.height = 1; ctx.clearRect(0, 0, 1, 1); return; } canvas.width = state.source.img.width; canvas.height = state.source.img.height; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(state.source.img, 0, 0); state.frames.forEach(frame => { const selected = frame.id === state.settings.selectedId; const g = frame.geometry; ctx.strokeStyle = selected ? '#10b981' : '#ef4444'; ctx.lineWidth = selected ? Math.max(6, canvas.width / 180) : Math.max(3, canvas.width / 300); ctx.strokeRect(g.x, g.y, g.width, g.height); ctx.fillStyle = selected ? '#10b981' : '#ef4444'; ctx.globalAlpha = 0.9; ctx.fillRect(g.x + g.width - HANDLE_SIZE, g.y + g.height - HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE); ctx.globalAlpha = 1; }); }
function renderFrameGrid() { const grid = document.getElementById('frameGrid'); if (!grid) return; if (!state.frames.length) { grid.innerHTML = '<div class="col-span-full rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-12 text-center"><p class="text-lg font-black text-slate-700">No Frames yet</p><p class="mt-1 text-sm text-slate-500">Import artwork and run detection to start.</p></div>'; return; } grid.innerHTML = ''; state.frames.forEach((frame, index) => { const canvas = state.rendered.get(frame.id) || renderFrame(frame); const card = document.createElement('button'); const bg = getReviewCardBackgroundClass(); card.className = `group rounded-[1.25rem] border p-2 text-left transition hover:-translate-y-0.5 ${frame.id === state.settings.selectedId ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-900/10' : 'border-slate-900/10 bg-white hover:shadow-md'}`; card.innerHTML = `<div class="aspect-[370/320] overflow-hidden rounded-2xl border border-slate-900/10 ${bg} grid place-items-center"></div><div class="mt-2 flex items-center justify-between px-1 text-xs"><span class="font-black text-slate-700">${frame.name || `Frame ${index + 1}`}</span><span class="font-black ${frame.id === state.settings.selectedId ? 'text-emerald-700' : 'text-slate-400'}">${frame.id === state.settings.selectedId ? 'Selected' : 'Rendered'}</span></div>`; const holder = card.querySelector('div'); const preview = document.createElement('img'); preview.src = canvas.toDataURL('image/png'); preview.className = 'max-w-full max-h-full object-contain transition group-hover:scale-105'; holder.appendChild(preview); card.addEventListener('click', () => { const before = createFrameSnapshot(); updateFrameInState(frame); commitFrameCommand('Select Frame', before, createFrameSnapshot()); refresh(); }); grid.appendChild(card); }); }
function getReviewCardBackgroundClass() { if (state.settings.reviewBackground === ReviewBackgrounds.WHITE) return 'bg-white'; if (state.settings.reviewBackground === ReviewBackgrounds.BLACK) return 'bg-slate-950'; if (state.settings.reviewBackground === ReviewBackgrounds.LINE) return 'bg-[#06c755]'; return 'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:14px_14px]'; }
function getSelectedFrame() { return state.frames.find(item => item.id === state.settings.selectedId) || state.frames[0] || null; }
function deleteSelectedFrame() { const frame = getSelectedFrame(); if (!frame) return; const nextFrames = state.frames.filter(item => item.id !== frame.id); applyFrameListCommand('Delete Frame', nextFrames, nextFrames[0]?.id || null); }
function duplicateSelectedFrame() { const frame = getSelectedFrame(); if (!frame) return; const copy = clampFrameToSource({ ...frame, id: createId('frame'), name: `${frame.name} Copy`, geometry: { ...frame.geometry, x: frame.geometry.x + 24, y: frame.geometry.y + 24 }, state: { ...frame.state, selected: true } }); const nextFrames = [...state.frames.map(item => ({ ...item, state: { ...item.state, selected: false } })), copy]; applyFrameListCommand('Duplicate Frame', nextFrames, copy.id); }
async function downloadSelectedPng() { const frame = getSelectedFrame(); if (!frame) return alert('Please import artwork first.'); const exportResult = createPngExport({ sourceImage: state.source, frame, renderOptions: getRenderOptions(), fileName: `${frame.name || 'stixio-frame'}.png` }); downloadDataUrl(canvasToPngDataUrl(exportResult.canvas), exportResult.fileName); }
async function downloadZip() { if (!state.frames.length) return alert('Please import artwork first.'); try { const exportResult = await createZipExport({ sourceImage: state.source, frames: state.frames, renderOptions: getRenderOptions(), renderedMap: state.rendered, exportOptions: { lineNamingMode: state.settings.lineNamingMode, prefix: 'stixio', allowWarningsOnly: true }, JSZipClass: window.JSZip }); state.rendered = exportResult.renderedMap; state.reviewReport = exportResult.review; downloadBlob(exportResult.blob, exportResult.fileName); refresh(); } catch (error) { alert(error.message || 'Export failed.'); } }
function showWorkspacePrompt() { alert('Core Editor first. Workspace, Google Drive, Login, and Billing stay after M1.'); }
function downloadDataUrl(dataUrl, fileName) { const link = document.createElement('a'); link.href = dataUrl; link.download = fileName; link.click(); }
function downloadBlob(blob, fileName) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); URL.revokeObjectURL(link.href); }
function readFileAsDataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
function createId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
