import {
  BRAND,
  detectGrid,
  renderFrameToCanvas,
  getStickerFilename,
  createZipFileName
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
  mode: 'developer'
};

const WORKSPACES = ['Artwork', 'Layout', 'Refine', 'Review', 'Package'];

const state = {
  source: null,
  frames: [],
  rendered: new Map(),
  renderKeys: new Map(),
  detectionReport: null,
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
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-black tracking-tight">${BRAND.name}</h1>
                <span class="rounded-full border border-slate-900/10 bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Beta</span>
              </div>
              <p class="text-xs font-semibold text-slate-500">${BRAND.slogan}</p>
            </div>
          </div>
          <div class="hidden lg:flex items-center gap-2 rounded-2xl border border-slate-900/10 bg-white/70 p-1 shadow-sm">
            ${WORKSPACES.map((label, index) => `
              <button class="workspace-tab rounded-xl px-4 py-2 text-left transition ${index === 2 ? 'bg-slate-950 text-white shadow' : 'hover:bg-slate-100'}">
                <span class="block text-[10px] font-black uppercase tracking-widest ${index === 2 ? 'text-emerald-300' : 'text-slate-400'}">0${index + 1}</span>
                <span class="block text-sm font-black">${label}</span>
              </button>
            `).join('')}
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden md:inline-flex rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-xs font-black text-slate-700">Core Editor</span>
            <button id="workspaceCtaBtn" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow hover:-translate-y-0.5 transition">M1 Only</button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-[1500px] px-5 py-6 space-y-6">
        ${renderHero()}
        <div class="grid grid-cols-1 xl:grid-cols-[380px_1fr_320px] gap-5 items-start">
          ${renderLeftPanel()}
          ${renderCenterPanel()}
          ${renderRightPanel()}
        </div>
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
          <div class="mb-4 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-emerald-200">Refine Evolution</div>
          <h2 class="text-4xl md:text-6xl font-black leading-tight tracking-tight">Create once.<br><span class="text-emerald-300">Finish faster.</span></h2>
          <p class="mt-4 max-w-2xl text-sm md:text-base text-slate-300">Trim, White Border, and Shadow now run inside the Render Engine, so preview, PNG, and ZIP use the same output.</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <label class="cursor-pointer rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 shadow hover:-translate-y-0.5 transition">
              <input id="heroFileInput" type="file" accept="image/*" class="hidden" />
              Drop / choose artwork
            </label>
            <button id="heroRenderBtn" class="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15 transition">Render all Frames</button>
          </div>
        </div>
        <div class="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
          <div class="grid grid-cols-2 gap-3">
            ${metricCard('Frames', state.frames.length || '0', 'detected areas')}
            ${metricCard('Quality', getDetectionScoreLabel(), 'grid confidence')}
            ${metricCard('Rendered', state.rendered.size || '0', 'cached previews')}
            ${metricCard('Refine', getRefineSummary(), 'active effects')}
          </div>
        </div>
      </div>
    </section>
  `;
}

function metricCard(label, value, hint) {
  return `
    <div class="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p class="text-[10px] uppercase tracking-widest text-slate-400 font-black">${label}</p>
      <p class="mt-2 text-2xl font-black text-white truncate">${value}</p>
      <p class="mt-1 text-xs text-slate-400 truncate">${hint}</p>
    </div>
  `;
}

function renderLeftPanel() {
  return `
    <aside class="space-y-4">
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Quick Project</p>
            <h3 class="mt-1 text-xl font-black">Import artwork</h3>
          </div>
          <span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">OPEN</span>
        </div>
        <p class="mt-3 text-sm text-slate-500">Upload a sheet. Detection creates Frames; Refine effects finish sticker-ready output.</p>
        <label id="dropZone" class="mt-5 block cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-50">
          <input id="fileInput" type="file" accept="image/*" class="hidden" />
          <div class="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-3xl text-emerald-300">＋</div>
          <p class="font-black">Drop or choose artwork</p>
          <p class="mt-1 text-xs text-slate-500">PNG, JPG, WebP. One sheet is enough.</p>
        </label>
      </section>

      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detection</p>
            <h3 class="text-lg font-black">Grid Detect v2</h3>
          </div>
          <div class="flex gap-2">
            <button id="preset4x4Btn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">4×4</button>
            <button id="preset5x8Btn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">5×8</button>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3">
          ${numberInput('rowsInput', 'Rows', state.settings.rows, 1, 12)}
          ${numberInput('colsInput', 'Cols', state.settings.cols, 1, 12)}
          ${numberInput('marginXInput', 'Margin X', state.settings.marginX, 0, 500)}
          ${numberInput('marginYInput', 'Margin Y', state.settings.marginY, 0, 500)}
          ${numberInput('gapXInput', 'Gap X', state.settings.gapX, 0, 500)}
          ${numberInput('gapYInput', 'Gap Y', state.settings.gapY, 0, 500)}
        </div>
        <button id="applyGridBtn" class="mt-4 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white hover:-translate-y-0.5 transition">Detect Frames</button>
        <div id="detectionMiniReport" class="mt-4">${renderDetectionMiniReport()}</div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Refine</p>
        <h3 class="text-lg font-black">Finish effects</h3>
        <div class="mt-4 space-y-3">
          <label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Remove white background</span><input id="chromaEnabled" type="checkbox" ${state.settings.chromaEnabled ? 'checked' : ''}></label>
          <label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Exterior only</span><input id="exteriorOnly" type="checkbox" ${state.settings.exteriorOnly ? 'checked' : ''}></label>
          ${numberInput('toleranceInput', 'Tolerance', state.settings.tolerance, 0, 255)}
          <div class="grid grid-cols-2 gap-3">
            ${numberInput('shrinkInput', 'Shrink', state.settings.shrinkRadius, 0, 10)}
            ${numberInput('featherInput', 'Feather', state.settings.featherRadius, 0, 10)}
          </div>
          <label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Trim transparent</span><input id="trimEnabled" type="checkbox" ${state.settings.trimEnabled ? 'checked' : ''}></label>
          ${numberInput('trimPaddingInput', 'Trim padding', state.settings.trimPadding, 0, 50)}
          <label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>White border</span><input id="whiteBorderEnabled" type="checkbox" ${state.settings.whiteBorderEnabled ? 'checked' : ''}></label>
          ${numberInput('whiteBorderSizeInput', 'Border size', state.settings.whiteBorderSize, 0, 40)}
          <label class="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>Shadow</span><input id="shadowEnabled" type="checkbox" ${state.settings.shadowEnabled ? 'checked' : ''}></label>
          <div class="grid grid-cols-2 gap-3">
            ${numberInput('shadowBlurInput', 'Shadow blur', state.settings.shadowBlur, 0, 40)}
            ${numberInput('shadowOffsetYInput', 'Shadow Y', state.settings.shadowOffsetY, -40, 40)}
          </div>
        </div>
        <button id="renderBtn" class="mt-4 w-full rounded-2xl border border-slate-900/10 bg-white py-3 text-sm font-black text-slate-950 hover:bg-slate-50 transition">Render selected</button>
      </section>
    </aside>
  `;
}

function renderCenterPanel() {
  return `
    <section class="space-y-4">
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Canvas</p>
            <h3 class="text-xl font-black">Source image + Frame overlay</h3>
          </div>
          <div id="statusText" class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">No artwork loaded</div>
        </div>
        <div class="grid min-h-[440px] place-items-center overflow-auto rounded-[1.25rem] border border-slate-900/10 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:18px_18px] bg-slate-50 p-4">
          <canvas id="sourceCanvas" class="max-w-full rounded-xl shadow-xl"></canvas>
        </div>
      </section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Review</p>
            <h3 class="text-xl font-black">Rendered Frame board</h3>
          </div>
          <div id="limitText" class="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">${getRefineSummary()}</div>
        </div>
        <div id="frameGrid" class="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3"></div>
      </section>
    </section>
  `;
}

function renderRightPanel() {
  return `
    <aside class="space-y-4">
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Detection Quality</p>
        <div class="mt-4 flex items-end gap-3"><div class="text-5xl font-black">${getDetectionScoreLabel()}</div><div class="pb-2 text-sm font-bold text-slate-500">score</div></div>
        <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full ${getDetectionScoreBarClass()}" style="width:${getDetectionScoreNumber()}%"></div></div>
        <div class="mt-4 space-y-2 text-sm">${renderDetectionIssues()}</div>
      </section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Project Health</p>
        <div class="mt-4 flex items-end gap-3"><div class="text-5xl font-black">${calculateHealth()}%</div><div class="pb-2 text-sm font-bold text-slate-500">ready</div></div>
        <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-400" style="width:${calculateHealth()}%"></div></div>
        <div class="mt-4 space-y-2 text-sm">
          ${healthRow(Boolean(state.source), 'Source image imported')}
          ${healthRow(state.frames.length > 0, `${state.frames.length || 0} Frames detected`)}
          ${healthRow(Boolean(state.settings.selectedId), 'One Frame selected')}
          ${healthRow(state.rendered.size > 0, `${state.rendered.size || 0} Frames rendered`)}
        </div>
      </section>
      <section class="rounded-[1.75rem] border border-slate-900/10 bg-slate-950 p-5 text-white shadow-sm">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Package</p>
        <h3 class="mt-1 text-xl font-black">Export center</h3>
        <p class="mt-2 text-sm text-slate-400">PNG and ZIP export reuse the same refined Render Engine output.</p>
        <div class="mt-5 space-y-3">
          <button id="downloadPngBtn" class="w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950 hover:-translate-y-0.5 transition">Download selected PNG</button>
          <button id="downloadZipBtn" class="w-full rounded-2xl border border-white/10 bg-white/10 py-3 text-sm font-black text-white hover:bg-white/15 transition">Export Frames ZIP</button>
        </div>
      </section>
    </aside>
  `;
}

function numberInput(id, label, value, min, max) {
  return `<label class="block text-xs font-black text-slate-500"><span>${label}</span><input id="${id}" type="number" min="${min}" max="${max}" value="${value}" class="mt-1 w-full rounded-2xl border border-slate-900/10 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-950 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"></label>`;
}

function renderDetectionMiniReport() {
  if (!state.detectionReport) return '<div class="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">Run detection to see quality score.</div>';
  const quality = state.detectionReport.quality;
  return `<div class="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">${quality.frameCount} Frames · Quality ${quality.score}% · Cell ${Math.round(quality.cellWidth)}×${Math.round(quality.cellHeight)}</div>`;
}

function renderDetectionIssues() {
  if (!state.detectionReport) return healthRow(false, 'No detection yet');
  const issues = state.detectionReport.quality.issues;
  if (!issues.length) return healthRow(true, 'No detection warnings');
  return issues.map(item => healthRow(item.severity !== 'error', item.message)).join('');
}

function healthRow(ok, label) {
  return `<div class="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"><span class="font-bold text-slate-600">${label}</span><span class="font-black ${ok ? 'text-emerald-600' : 'text-amber-600'}">${ok ? '✓' : '!'}</span></div>`;
}

function getDetectionScoreNumber() { return state.detectionReport?.quality?.score ?? 0; }
function getDetectionScoreLabel() { return state.detectionReport ? `${getDetectionScoreNumber()}%` : '—'; }
function getDetectionScoreBarClass() { const score = getDetectionScoreNumber(); return score >= 85 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-rose-400'; }

function getRefineSummary() {
  const active = [];
  if (state.settings.trimEnabled) active.push('Trim');
  if (state.settings.whiteBorderEnabled) active.push('Border');
  if (state.settings.shadowEnabled) active.push('Shadow');
  return active.length ? active.join(' + ') : 'Basic';
}

function calculateHealth() {
  let score = 0;
  if (state.source) score += 25;
  if (state.frames.length) score += 25;
  if (state.settings.selectedId) score += 25;
  if (state.rendered.size) score += 25;
  return score;
}

function bindEvents(root) {
  bindFileInputs(root);
  root.querySelector('#applyGridBtn').addEventListener('click', () => { readSettings(root); createFramesFromSource(); renderAll(); refresh(); });
  root.querySelector('#preset4x4Btn').addEventListener('click', () => applyPreset(root, 4, 4));
  root.querySelector('#preset5x8Btn').addEventListener('click', () => applyPreset(root, 5, 8));
  root.querySelector('#renderBtn').addEventListener('click', () => { readSettings(root); clearRenderCache(); renderSelected(); refresh(); });
  root.querySelector('#heroRenderBtn').addEventListener('click', () => { clearRenderCache(); renderAll(); refresh(); });
  root.querySelector('#downloadPngBtn').addEventListener('click', downloadSelectedPng);
  root.querySelector('#downloadZipBtn').addEventListener('click', downloadZip);
  root.querySelector('#workspaceCtaBtn').addEventListener('click', showWorkspacePrompt);
}

function applyPreset(root, rows, cols) {
  root.querySelector('#rowsInput').value = rows;
  root.querySelector('#colsInput').value = cols;
  readSettings(root);
  createFramesFromSource();
  renderAll();
  refresh();
}

function bindFileInputs(root) {
  const inputs = [root.querySelector('#fileInput'), root.querySelector('#heroFileInput')].filter(Boolean);
  inputs.forEach(input => input.addEventListener('change', event => loadFile(event.target.files?.[0])));
  const dropZone = root.querySelector('#dropZone');
  dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('border-emerald-400', 'bg-emerald-50'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-emerald-400', 'bg-emerald-50'));
  dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('border-emerald-400', 'bg-emerald-50'); loadFile(event.dataTransfer.files?.[0]); });
}

function readSettings(root) {
  state.settings.rows = numberValue(root, '#rowsInput', 1);
  state.settings.cols = numberValue(root, '#colsInput', 1);
  state.settings.marginX = numberValue(root, '#marginXInput', 0);
  state.settings.marginY = numberValue(root, '#marginYInput', 0);
  state.settings.gapX = numberValue(root, '#gapXInput', 0);
  state.settings.gapY = numberValue(root, '#gapYInput', 0);
  state.settings.tolerance = numberValue(root, '#toleranceInput', 30);
  state.settings.shrinkRadius = numberValue(root, '#shrinkInput', 0);
  state.settings.featherRadius = numberValue(root, '#featherInput', 1);
  state.settings.trimPadding = numberValue(root, '#trimPaddingInput', 0);
  state.settings.whiteBorderSize = numberValue(root, '#whiteBorderSizeInput', 6);
  state.settings.shadowBlur = numberValue(root, '#shadowBlurInput', 8);
  state.settings.shadowOffsetY = numberValue(root, '#shadowOffsetYInput', 4);
  state.settings.chromaEnabled = Boolean(root.querySelector('#chromaEnabled')?.checked);
  state.settings.exteriorOnly = Boolean(root.querySelector('#exteriorOnly')?.checked);
  state.settings.trimEnabled = Boolean(root.querySelector('#trimEnabled')?.checked);
  state.settings.whiteBorderEnabled = Boolean(root.querySelector('#whiteBorderEnabled')?.checked);
  state.settings.shadowEnabled = Boolean(root.querySelector('#shadowEnabled')?.checked);
}

function numberValue(root, selector, fallback) {
  const value = Number(root.querySelector(selector)?.value);
  return Number.isFinite(value) ? value : fallback;
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  state.source = { id: createId('source'), fileName: file.name, name: file.name, provider: 'local', img, width: img.width, height: img.height, mimeType: file.type };
  clearRenderCache();
  createFramesFromSource();
  renderAll();
  refresh();
}

function createFramesFromSource() {
  if (!state.source) return;
  state.detectionReport = detectGrid(state.source, {
    grid: { rows: state.settings.rows, cols: state.settings.cols, marginX: state.settings.marginX, marginY: state.settings.marginY, gapX: state.settings.gapX, gapY: state.settings.gapY, snapToPixels: true, minCellSize: 8 }
  });
  state.frames = state.detectionReport.frames;
  clearRenderCache();
  state.settings.selectedId = state.frames[0]?.id || null;
}

function getRenderOptions() {
  return {
    targetW: state.settings.targetW,
    targetH: state.settings.targetH,
    safeMargin: state.settings.safeMargin,
    highQuality: true,
    refine: {
      enabled: true,
      chromaEnabled: state.settings.chromaEnabled,
      chromaColor: state.settings.chromaColor,
      tolerance: state.settings.tolerance,
      exteriorOnly: state.settings.exteriorOnly,
      autoDespeckle: state.settings.autoDespeckle,
      shrinkRadius: state.settings.shrinkRadius,
      featherRadius: state.settings.featherRadius,
      trim: { enabled: state.settings.trimEnabled, threshold: 1, padding: state.settings.trimPadding },
      whiteBorder: { enabled: state.settings.whiteBorderEnabled, size: state.settings.whiteBorderSize, color: '#ffffff' },
      shadow: { enabled: state.settings.shadowEnabled, blur: state.settings.shadowBlur, offsetX: 0, offsetY: state.settings.shadowOffsetY, color: 'rgba(0,0,0,0.28)' }
    }
  };
}

function clearRenderCache() {
  state.rendered.clear();
  state.renderKeys.clear();
}

function renderAll() {
  if (!state.source) return;
  state.frames.forEach(frame => renderFrame(frame));
}

function renderSelected() {
  const frame = getSelectedFrame();
  if (frame) renderFrame(frame, true);
}

function renderFrame(frame, force = false) {
  if (!state.source || !frame) return null;
  const options = getRenderOptions();
  const key = JSON.stringify({ sourceId: state.source.id, frameId: frame.id, geometry: frame.geometry, targetW: options.targetW, targetH: options.targetH, safeMargin: options.safeMargin, refine: options.refine });
  if (!force && state.rendered.has(frame.id) && state.renderKeys.get(frame.id) === key) return state.rendered.get(frame.id);
  const result = renderFrameToCanvas(state.source, frame, options);
  state.rendered.set(frame.id, result.canvas);
  state.renderKeys.set(frame.id, key);
  return result.canvas;
}

function refresh() {
  drawSourcePreview();
  renderFrameGrid();
  const status = document.getElementById('statusText');
  if (status) status.textContent = state.source ? `${state.source.fileName} · ${state.frames.length} Frames · Quality ${getDetectionScoreLabel()} · ${getRefineSummary()}` : 'No artwork loaded';
  const detectionMiniReport = document.getElementById('detectionMiniReport');
  if (detectionMiniReport) detectionMiniReport.innerHTML = renderDetectionMiniReport();
}

function drawSourcePreview() {
  const canvas = document.getElementById('sourceCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!state.source) { canvas.width = 1; canvas.height = 1; ctx.clearRect(0, 0, 1, 1); return; }
  canvas.width = state.source.img.width;
  canvas.height = state.source.img.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.source.img, 0, 0);
  state.frames.forEach(frame => {
    const selected = frame.id === state.settings.selectedId;
    ctx.strokeStyle = selected ? '#10b981' : '#ef4444';
    ctx.lineWidth = selected ? Math.max(6, canvas.width / 180) : Math.max(3, canvas.width / 300);
    ctx.strokeRect(frame.geometry.x, frame.geometry.y, frame.geometry.width, frame.geometry.height);
  });
}

function renderFrameGrid() {
  const grid = document.getElementById('frameGrid');
  if (!grid) return;
  if (!state.frames.length) {
    grid.innerHTML = '<div class="col-span-full rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-12 text-center"><p class="text-lg font-black text-slate-700">No Frames yet</p><p class="mt-1 text-sm text-slate-500">Import artwork and run detection to start.</p></div>';
    return;
  }
  grid.innerHTML = '';
  state.frames.forEach((frame, index) => {
    const canvas = state.rendered.get(frame.id) || renderFrame(frame);
    const card = document.createElement('button');
    card.className = `group rounded-[1.25rem] border p-2 text-left transition hover:-translate-y-0.5 ${frame.id === state.settings.selectedId ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-900/10' : 'border-slate-900/10 bg-white hover:shadow-md'}`;
    card.innerHTML = `<div class="aspect-[370/320] overflow-hidden rounded-2xl border border-slate-900/10 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:14px_14px] grid place-items-center"></div><div class="mt-2 flex items-center justify-between px-1 text-xs"><span class="font-black text-slate-700">${frame.name || `Frame ${index + 1}`}</span><span class="font-black ${frame.id === state.settings.selectedId ? 'text-emerald-700' : 'text-slate-400'}">${frame.id === state.settings.selectedId ? 'Selected' : 'Rendered'}</span></div>`;
    const holder = card.querySelector('div');
    const preview = document.createElement('img');
    preview.src = canvas.toDataURL('image/png');
    preview.className = 'max-w-full max-h-full object-contain transition group-hover:scale-105';
    holder.appendChild(preview);
    card.addEventListener('click', () => { state.settings.selectedId = frame.id; refresh(); });
    grid.appendChild(card);
  });
}

function getSelectedFrame() { return state.frames.find(item => item.id === state.settings.selectedId) || state.frames[0] || null; }

function downloadSelectedPng() {
  const frame = getSelectedFrame();
  if (!frame) return alert('Please import artwork first.');
  const canvas = renderFrame(frame);
  downloadDataUrl(canvas.toDataURL('image/png'), getStickerFilename(0, { lineNamingMode: false, prefix: 'stixio' }));
}

async function downloadZip() {
  if (!state.frames.length) return alert('Please import artwork first.');
  if (!window.JSZip) return alert('JSZip is not loaded.');
  const zip = new JSZip();
  state.frames.forEach((frame, index) => {
    const canvas = renderFrame(frame);
    const fileName = getStickerFilename(index, { lineNamingMode: state.settings.lineNamingMode });
    zip.file(fileName, canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''), { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, createZipFileName({ prefix: 'stixio', targetW: state.settings.targetW, targetH: state.settings.targetH }));
}

function showWorkspacePrompt() { alert('Core Editor first. Workspace, Google Drive, Login, and Billing stay after M1.'); }
function downloadDataUrl(dataUrl, fileName) { const link = document.createElement('a'); link.href = dataUrl; link.download = fileName; link.click(); }
function downloadBlob(blob, fileName) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); URL.revokeObjectURL(link.href); }
function readFileAsDataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
function createId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
