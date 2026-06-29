import {
  BRAND,
  createDocument,
  addSourceRef,
  removeSourceRef,
  setDocumentFrames,
  createSourceImageRef,
  detectGrid,
  detectProjectionGrid,
  tightenFramesToContent,
  smartSnapFrameToContent,
  reviewFrames,
  createMultiSourceZipExport,
  applyStickerPreset,
  getStickerPresets,
  StickerCategories,
  AssetRoles,
  createMaskCanvas,
  resizeMaskCanvas,
  paintMaskStroke,
  applyMagicMask,
  captureMaskSnapshot,
  restoreMaskSnapshot,
  MaskActions,
  createHistory,
  createCommand,
  executeCommand,
  commitHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  getAvailableAssetRoles,
  createSourceLayoutSettings,
  applySourceLayoutSettings,
  PackageNamingModes,
  clampSafeMargin,
  createPlatformNeutralRules,
  buildWorkshopPackagePlan,
  renderWorkshopFrame,
  estimateCanvasPngBytes,
  mergeDetectedFrameStates,
  getNextSourceId
} from '../core/index.js';

const HANDLE_SIZE = 14;
const MIN_FRAME_SIZE = 8;
const DEFAULT_MAX_FILE_SIZE_KB = 1000;

const DEFAULT_SETTINGS = applyStickerPreset({
  layoutMode: 'auto',
  rows: 1,
  cols: 1,
  marginX: 0,
  marginY: 0,
  gapX: 0,
  gapY: 0,
  smartSnap: true,
  chromaEnabled: true,
  chromaColor: [255, 255, 255],
  tolerance: 30,
  exteriorOnly: true,
  autoDespeckle: true,
  shrinkRadius: 0,
  featherRadius: 1,
  whiteBorderEnabled: false,
  whiteBorderSize: 8,
  borderColor: '#ffffff',
  alignMode: 'center',
  stickerCategory: StickerCategories.NORMAL,
  outputRole: AssetRoles.STICKER,
  reviewBackground: 'checker',
  showSafeGuide: true,
  refineZoom: 1,
  maskTool: 'view',
  maskSize: 15,
  packageNamingMode: PackageNamingModes.PACKAGE,
  filenamePrefix: '',
  filenameSuffix: '',
  maxFileSizeKB: DEFAULT_MAX_FILE_SIZE_KB
}, StickerCategories.NORMAL, AssetRoles.STICKER);

const state = {
  document: createDocument({ name: 'Sticker Package Project' }),
  sources: new Map(),
  sourceLayouts: new Map(),
  selectedFrameBySource: new Map(),
  activeSourceId: null,
  selectedFrameId: null,
  rendered: new Map(),
  renderKeys: new Map(),
  reviewReport: null,
  settings: { ...DEFAULT_SETTINGS },
  frameDrag: null,
  maskStroke: null,
  maskHistories: new Map(),
  draggedReviewFrameId: null,
  frameHistory: createHistory({ frames: [], selectedFrameId: null })
};

export function initStixioWorkshop(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = `${BRAND.name} Workshop`;
  root.innerHTML = renderShell();
  bindStaticEvents(root);
  refresh();
}

function renderShell() {
  return `
    <div class="min-h-screen bg-[#f6f3ec] text-slate-950">
      <header class="sticky top-0 z-40 border-b border-slate-900/10 bg-[#f6f3ec]/95 backdrop-blur-xl">
        <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-xl font-black text-emerald-300">S</div>
            <div><h1 class="text-xl font-black">${BRAND.name} <span class="text-emerald-600">Workshop</span></h1><p class="text-xs font-bold text-slate-500">Layout · Refine · Review · Package</p></div>
          </div>
          <div class="flex items-center gap-2"><button id="undoBtn" class="rounded-xl bg-white px-3 py-2 text-xs font-black">Undo</button><button id="redoBtn" class="rounded-xl bg-white px-3 py-2 text-xs font-black">Redo</button><button id="exportZipBtn" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Package · Export ZIP</button></div>
        </div>
        <nav aria-label="Workshop workflow" class="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-5 pb-4 md:grid-cols-4">
          ${stageLink('layout','Layout','匯入與版面切割','bg-slate-950 text-white','text-emerald-300')}
          ${stageLink('refine','Refine','細部修補','border border-slate-900/10 bg-white','text-rose-500')}
          ${stageLink('review','Review','預覽與檢查','border border-slate-900/10 bg-white','text-sky-600')}
          ${stageLink('package','Package','角色與輸出打包','border border-slate-900/10 bg-white','text-amber-600')}
        </nav>
      </header>
      <main class="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[360px_1fr_340px]">
        <aside class="space-y-4">${renderImportPanel()}${renderDetectionPanel()}${renderOutputPanel()}${renderRefinePanel()}</aside>
        <section class="space-y-4">${renderSourceEditor()}${renderRefineEditor()}${renderReviewBoard()}</section>
        <aside class="space-y-4">${renderSourceListPanel()}${renderSelectedPanel()}${renderReviewPanel()}</aside>
      </main>
    </div>`;
}

function stageLink(id, label, subtitle, boxClass, labelClass) {
  return `<a href="#stage-${id}" class="rounded-2xl px-4 py-3 ${boxClass}"><span class="block text-xs font-black uppercase tracking-[.18em] ${labelClass}">${label}</span><span class="mt-1 block text-sm font-black">${subtitle}</span></a>`;
}

function renderImportPanel() {
  return `<section id="stage-layout" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Artwork Engine</p><h2 class="mt-1 text-xl font-black">匯入與版面切割</h2><p class="mt-2 text-sm text-slate-500">同一個 Document 可追加多張排版圖，每張原圖保留自己的 Layout 設定。</p><label id="dropZone" class="mt-4 block cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-emerald-400"><input id="fileInput" type="file" accept="image/*" multiple class="hidden"><div class="text-3xl font-black text-emerald-500">＋</div><div class="mt-2 font-black">拖曳或選擇圖片</div><div class="text-xs text-slate-400">可一次多選並持續追加</div></label></section>`;
}

function renderDetectionPanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Detection Engine</p><h2 class="mt-1 text-xl font-black">切割與智能貼合</h2><div class="mt-4 grid grid-cols-3 gap-2">${layoutButton('auto','智能')}${layoutButton('1x1','單圖')}${layoutButton('2x2','2×2')}${layoutButton('3x3','3×3')}${layoutButton('custom','自訂')}</div><div class="mt-4 grid grid-cols-2 gap-3">${numberInput('rowsInput','Rows',state.settings.rows,1,12)}${numberInput('colsInput','Cols',state.settings.cols,1,12)}${numberInput('marginXInput','Margin X',state.settings.marginX,0,500)}${numberInput('marginYInput','Margin Y',state.settings.marginY,0,500)}${numberInput('gapXInput','Gap X',state.settings.gapX,0,500)}${numberInput('gapYInput','Gap Y',state.settings.gapY,0,500)}</div><label class="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>拖曳後智能貼合內容</span><input id="smartSnapInput" type="checkbox" ${state.settings.smartSnap?'checked':''}></label><button id="detectBtn" class="mt-4 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white">重新偵測目前原圖</button></section>`;
}

function renderOutputPanel() {
  const presets = getStickerPresets(state.settings.stickerCategory);
  const safeMax = Math.max(0, Math.floor(Math.min(state.settings.targetW, state.settings.targetH) / 2) - 1);
  return `<section id="stage-package" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Rules Engine</p><h2 class="mt-1 text-xl font-black">輸出規格與對齊</h2><label class="mt-4 block text-xs font-black text-slate-500">貼圖類型<select id="categoryInput" class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">${Object.values(StickerCategories).map(value=>`<option value="${value}" ${value===state.settings.stickerCategory?'selected':''}>${categoryLabel(value)}</option>`).join('')}</select></label><label class="mt-3 block text-xs font-black text-slate-500">輸出用途<select id="presetRoleInput" class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">${presets.map(item=>`<option value="${item.role}" ${item.role===state.settings.outputRole?'selected':''}>${item.name} · ${item.width}×${item.height}</option>`).join('')}</select></label><div class="mt-3 grid grid-cols-2 gap-3">${numberInput('targetWInput','自訂寬度',state.settings.targetW,1,8192)}${numberInput('targetHInput','自訂高度',state.settings.targetH,1,8192)}</div>${rangeInput('safeMarginInput','安全留白',state.settings.safeMargin,0,safeMax)}<div class="mt-3"><div class="mb-2 text-xs font-black text-slate-500">圖案對齊</div><div class="grid grid-cols-2 gap-2">${alignButton('center','絕對置中')}${alignButton('bottom','靠下貼齊')}</div></div><div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">${state.settings.targetW} × ${state.settings.targetH}px · safe ${state.settings.safeMargin}px</div></section>`;
}

function renderRefinePanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Refine · Refine Engine</p><h2 class="mt-1 text-xl font-black">去背與邊緣</h2><label class="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>去除背景色</span><input id="chromaEnabledInput" type="checkbox" ${state.settings.chromaEnabled?'checked':''}></label><div class="mt-3 flex gap-2"><input id="chromaColorInput" type="color" value="${rgbToHex(state.settings.chromaColor)}" class="h-10 w-14 rounded-xl"><button id="pickerBtn" class="flex-1 rounded-xl bg-slate-100 text-xs font-black">吸色器</button></div>${rangeInput('toleranceInput','色差容忍度',state.settings.tolerance,5,120)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>僅移除外圍背景</span><input id="exteriorInput" type="checkbox" ${state.settings.exteriorOnly?'checked':''}></label><label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>自動清除透明孤島</span><input id="despeckleInput" type="checkbox" ${state.settings.autoDespeckle?'checked':''}></label>${rangeInput('shrinkInput','去白邊',state.settings.shrinkRadius,0,8)}${rangeInput('featherInput','羽化',state.settings.featherRadius,0,8)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>外框</span><input id="borderInput" type="checkbox" ${state.settings.whiteBorderEnabled?'checked':''}></label><div class="mt-3 flex items-end gap-3"><label class="text-xs font-black text-slate-500">外框顏色<input id="borderColorInput" type="color" value="${state.settings.borderColor}" class="mt-1 h-10 w-14 rounded-xl"></label><div class="flex-1">${rangeInput('borderSizeInput','外框粗細',state.settings.whiteBorderSize,0,25)}</div></div><button id="renderAllBtn" class="mt-4 w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950">重新渲染全部</button></section>`;
}

function renderSourceEditor() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="mb-4 flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Frame Editor</p><h2 class="text-xl font-black">原圖與九點裁切框</h2></div><div id="sourceStatus" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">尚未匯入</div></div><div class="grid min-h-[460px] place-items-center overflow-auto rounded-3xl border border-slate-200 bg-slate-100 p-4"><canvas id="sourceCanvas" class="max-h-[70vh] max-w-full cursor-crosshair rounded-xl shadow-xl"></canvas></div></section>`;
}

function renderRefineEditor() {
  return `<section id="stage-refine" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Refine · Manual Tools</p><h2 class="text-xl font-black">魔術去背與保留筆刷</h2></div><div class="flex gap-2"><button data-mask-tool="view" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">檢視</button><button data-mask-tool="magic" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">魔術</button><button data-mask-tool="keep" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">保留</button><button data-mask-tool="delete" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">刪除</button></div></div><div class="mt-4 flex flex-wrap items-center gap-2">${rangeInput('maskSizeInput','筆刷',state.settings.maskSize,5,80)}<button id="maskUndoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">筆刷 Undo</button><button id="maskRedoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Redo</button><button id="maskClearBtn" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">清除</button><button id="zoomOutBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">−</button><button id="zoomResetBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">${Math.round(state.settings.refineZoom*100)}%</button><button id="zoomInBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">＋</button></div><div class="mt-4 grid min-h-[360px] place-items-center overflow-auto rounded-3xl bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:18px_18px] p-5"><canvas id="refineCanvas" class="max-w-full origin-center rounded-lg shadow-lg" style="transform:scale(${state.settings.refineZoom})"></canvas></div></section>`;
}

function renderReviewBoard() {
  return `<section id="stage-review" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-sky-600">Review · Package</p><h2 class="text-xl font-black">大型預覽、排序與匯出</h2></div><div class="flex gap-2"><button id="toggleSafeGuideBtn" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">${state.settings.showSafeGuide?'隱藏':'顯示'}安全區</button><button data-review-bg="checker" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">透明</button><button data-review-bg="white" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">白</button><button data-review-bg="black" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">黑</button></div></div><div class="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]"><div id="reviewHeroStage" class="relative grid min-h-[380px] place-items-center overflow-hidden rounded-3xl border border-slate-200"><img id="reviewHeroImage" class="max-h-[70vh] max-w-full object-contain"><div id="reviewSafeGuide" class="pointer-events-none absolute border-2 border-rose-500 bg-rose-500/10"></div></div><div id="reviewHeroMeta" class="rounded-3xl bg-slate-950 p-4 text-sm text-white"></div></div><div id="reviewGrid" class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"></div></section>`;
}

function renderSourceListPanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Document Engine</p><h2 class="mt-1 text-xl font-black">原圖清單</h2><div id="sourceList" class="mt-4 space-y-2"></div></section>`;
}

function renderSelectedPanel() {
  const frame = selectedFrame();
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Selected Frame</p><div id="selectedInfo" class="mt-4 text-sm text-slate-500">尚未選取</div><div class="mt-4 grid grid-cols-2 gap-2">${numberInput('offsetXInput','輸出 Offset X',frame?.custom?.offsetX||0,-4096,4096)}${numberInput('offsetYInput','輸出 Offset Y',frame?.custom?.offsetY||0,-4096,4096)}</div><div class="mt-2 grid grid-cols-4 gap-2"><button data-nudge-x="-1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">←</button><button data-nudge-y="-1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">↑</button><button data-nudge-y="1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">↓</button><button data-nudge-x="1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">→</button></div><button id="resetOffsetBtn" class="mt-2 w-full rounded-xl bg-emerald-50 py-2 text-xs font-black text-emerald-800">圖案置中最大化</button><div class="mt-4 grid grid-cols-2 gap-2"><button id="duplicateBtn" class="rounded-xl bg-slate-100 py-2 text-xs font-black">複製</button><button id="deleteBtn" class="rounded-xl bg-rose-50 py-2 text-xs font-black text-rose-700">刪除</button></div></section>`;
}

function renderReviewPanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-slate-950 p-5 text-white shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Package · Review Engine</p><label class="mt-4 block text-xs font-black text-slate-300">命名模式<select id="packageNamingModeInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="package" ${state.settings.packageNamingMode===PackageNamingModes.PACKAGE?'selected':''}>角色命名</option><option value="sequential" ${state.settings.packageNamingMode===PackageNamingModes.SEQUENTIAL?'selected':''}>自訂流水號</option></select></label><div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">前綴<input id="filenamePrefixInput" value="${escapeHtml(state.settings.filenamePrefix)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label><label class="text-xs font-black text-slate-300">後綴<input id="filenameSuffixInput" value="${escapeHtml(state.settings.filenameSuffix)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div><label class="mt-3 block text-xs font-black text-slate-300">檔案警告上限 KB<input id="maxFileSizeKBInput" type="number" min="1" max="102400" value="${state.settings.maxFileSizeKB}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label><div id="reviewSummary" class="mt-4 space-y-2 text-sm"></div><button id="downloadSelectedBtn" class="mt-4 w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950">下載選取 PNG</button></section>`;
}

function layoutButton(mode,label){return `<button data-layout="${mode}" class="layout-btn rounded-xl px-2 py-2 text-xs font-black ${state.settings.layoutMode===mode?'bg-slate-950 text-white':'bg-slate-100'}">${label}</button>`;}
function alignButton(mode,label){return `<button data-align="${mode}" class="align-btn rounded-xl px-3 py-2 text-xs font-black ${state.settings.alignMode===mode?'bg-slate-950 text-white':'bg-slate-100'}">${label}</button>`;}
function numberInput(id,label,value,min,max){return `<label class="text-xs font-black text-slate-500">${label}<input id="${id}" type="number" min="${min}" max="${max}" value="${value}" class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950"></label>`;}
function rangeInput(id,label,value,min,max){return `<label class="mt-3 block text-xs font-black text-slate-500"><span class="flex justify-between"><span>${label}</span><span id="${id}Value">${value}</span></span><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" class="mt-2 w-full accent-emerald-500"></label>`;}

function bindStaticEvents(root) {
  const fileInput = root.querySelector('#fileInput');
  fileInput.addEventListener('change', event => importFiles(event.target.files));
  const dropZone = root.querySelector('#dropZone');
  dropZone.addEventListener('dragover', event => event.preventDefault());
  dropZone.addEventListener('drop', event => { event.preventDefault(); importFiles(event.dataTransfer.files); });
  root.querySelectorAll('.layout-btn').forEach(button => button.addEventListener('click', () => setLayoutMode(button.dataset.layout)));
  root.querySelector('#detectBtn').addEventListener('click', detectActiveSource);
  ['rowsInput','colsInput','marginXInput','marginYInput','gapXInput','gapYInput'].forEach(id => root.querySelector(`#${id}`).addEventListener('input', readGridSettings));
  root.querySelector('#smartSnapInput').addEventListener('change', event => { state.settings.smartSnap = event.target.checked; saveActiveSourceLayout(); });
  root.querySelector('#categoryInput').addEventListener('change', event => changeCategory(event.target.value));
  root.querySelector('#presetRoleInput').addEventListener('change', event => changePreset(event.target.value));
  root.querySelector('#targetWInput').addEventListener('change', event => updateOutputDimension('targetW',event.target.value));
  root.querySelector('#targetHInput').addEventListener('change', event => updateOutputDimension('targetH',event.target.value));
  root.querySelector('#safeMarginInput').addEventListener('input', event => updateSafeMargin(event.target.value));
  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;clearRenderCache();renderAll();rerenderShell(); }));
  root.querySelector('#chromaEnabledInput').addEventListener('change', event => updateRefineSetting('chromaEnabled',event.target.checked));
  root.querySelector('#chromaColorInput').addEventListener('input', event => updateRefineSetting('chromaColor',hexToRgb(event.target.value)));
  root.querySelector('#pickerBtn').addEventListener('click', () => { state.settings.maskTool = 'picker'; refreshMaskToolButtons(); });
  root.querySelector('#exteriorInput').addEventListener('change', event => updateRefineSetting('exteriorOnly',event.target.checked));
  root.querySelector('#despeckleInput').addEventListener('change', event => updateRefineSetting('autoDespeckle',event.target.checked));
  bindRange(root,'toleranceInput','tolerance'); bindRange(root,'shrinkInput','shrinkRadius'); bindRange(root,'featherInput','featherRadius'); bindRange(root,'borderSizeInput','whiteBorderSize'); bindRange(root,'maskSizeInput','maskSize',false);
  root.querySelector('#borderInput').addEventListener('change', event => updateRefineSetting('whiteBorderEnabled',event.target.checked));
  root.querySelector('#borderColorInput').addEventListener('input', event => updateRefineSetting('borderColor',event.target.value));
  root.querySelector('#renderAllBtn').addEventListener('click', () => { clearRenderCache(); renderAll(); refresh(); });
  root.querySelectorAll('.mask-tool').forEach(button => button.addEventListener('click', () => { state.settings.maskTool = button.dataset.maskTool; refreshMaskToolButtons(); }));
  root.querySelector('#maskUndoBtn').addEventListener('click', () => stepMaskHistory(-1));
  root.querySelector('#maskRedoBtn').addEventListener('click', () => stepMaskHistory(1));
  root.querySelector('#maskClearBtn').addEventListener('click', clearSelectedMask);
  root.querySelector('#zoomOutBtn').addEventListener('click', () => setRefineZoom(state.settings.refineZoom - .25));
  root.querySelector('#zoomResetBtn').addEventListener('click', () => setRefineZoom(1));
  root.querySelector('#zoomInBtn').addEventListener('click', () => setRefineZoom(state.settings.refineZoom + .25));
  root.querySelectorAll('.review-bg').forEach(button => button.addEventListener('click', () => { state.settings.reviewBackground = button.dataset.reviewBg; renderReviewGrid(); renderLargeReview(); }));
  root.querySelector('#toggleSafeGuideBtn').addEventListener('click',()=>{state.settings.showSafeGuide=!state.settings.showSafeGuide;rerenderShell();});
  root.querySelector('#duplicateBtn').addEventListener('click', duplicateSelectedFrame);
  root.querySelector('#deleteBtn').addEventListener('click', deleteSelectedFrame);
  root.querySelector('#offsetXInput').addEventListener('change',event=>setSelectedOffset('offsetX',event.target.value));
  root.querySelector('#offsetYInput').addEventListener('change',event=>setSelectedOffset('offsetY',event.target.value));
  root.querySelectorAll('.nudge-btn').forEach(button=>button.addEventListener('click',()=>nudgeSelectedOffset(Number(button.dataset.nudgeX||0),Number(button.dataset.nudgeY||0))));
  root.querySelector('#resetOffsetBtn').addEventListener('click',resetSelectedOffset);
  root.querySelector('#packageNamingModeInput').addEventListener('change',event=>{state.settings.packageNamingMode=event.target.value;refresh();});
  root.querySelector('#filenamePrefixInput').addEventListener('input',event=>{state.settings.filenamePrefix=event.target.value;renderReviewGrid();renderLargeReview();});
  root.querySelector('#filenameSuffixInput').addEventListener('input',event=>{state.settings.filenameSuffix=event.target.value;renderReviewGrid();renderLargeReview();});
  root.querySelector('#maxFileSizeKBInput').addEventListener('change',event=>{state.settings.maxFileSizeKB=Math.max(1,Number(event.target.value)||DEFAULT_MAX_FILE_SIZE_KB);refresh();});
  root.querySelector('#downloadSelectedBtn').addEventListener('click', downloadSelectedPng);
  root.querySelector('#exportZipBtn').addEventListener('click', downloadZip);
  root.querySelector('#undoBtn').addEventListener('click', undoFrames);
  root.querySelector('#redoBtn').addEventListener('click', redoFrames);
  bindSourceCanvas(root.querySelector('#sourceCanvas'));
  bindRefineCanvas(root.querySelector('#refineCanvas'));
}

function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);refresh();}
function bindRange(root,id,key,render=true){root.querySelector(`#${id}`).addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(`#${id}Value`);if(label)label.textContent=event.target.value;if(render){clearRenderCache();renderAll();refresh();}});}
function updateRefineSetting(key,value){state.settings[key]=value;clearRenderCache();renderAll();refresh();}
function valueOf(id,fallback){const value=Number(document.getElementById(id)?.value);return Number.isFinite(value)?value:fallback;}

function readGridSettings(){state.settings.rows=valueOf('rowsInput',1);state.settings.cols=valueOf('colsInput',1);state.settings.marginX=valueOf('marginXInput',0);state.settings.marginY=valueOf('marginYInput',0);state.settings.gapX=valueOf('gapXInput',0);state.settings.gapY=valueOf('gapYInput',0);saveActiveSourceLayout();}
function setLayoutMode(mode){state.settings.layoutMode=mode;if(mode==='1x1'){state.settings.rows=1;state.settings.cols=1;}if(mode==='2x2'){state.settings.rows=2;state.settings.cols=2;}if(mode==='3x3'){state.settings.rows=3;state.settings.cols=3;}saveActiveSourceLayout();rerenderShell();}
function saveActiveSourceLayout(){if(state.activeSourceId)state.sourceLayouts.set(state.activeSourceId,createSourceLayoutSettings(state.settings));}
function sourceLayout(sourceId){return state.sourceLayouts.get(sourceId)||createSourceLayoutSettings(state.settings);}
function activateSource(sourceId){
  if(!state.sources.has(sourceId))return;
  if(state.activeSourceId&&state.selectedFrameId)state.selectedFrameBySource.set(state.activeSourceId,state.selectedFrameId);
  state.activeSourceId=sourceId;
  state.settings=applySourceLayoutSettings(state.settings,sourceLayout(sourceId));
  const sourceFrames=frames().filter(frame=>frame.sourceImageId===sourceId);
  const rememberedId=state.selectedFrameBySource.get(sourceId);
  const selected=sourceFrames.find(frame=>frame.id===rememberedId)||sourceFrames[0]||null;
  state.selectedFrameId=selected?.id||null;
  if(selected)state.selectedFrameBySource.set(sourceId,selected.id);
  rerenderShell();
}
function selectFrame(frameId){
  const frame=frames().find(item=>item.id===frameId);
  if(!frame)return;
  if(state.activeSourceId&&state.selectedFrameId)state.selectedFrameBySource.set(state.activeSourceId,state.selectedFrameId);
  state.activeSourceId=frame.sourceImageId;
  state.settings=applySourceLayoutSettings(state.settings,sourceLayout(frame.sourceImageId));
  state.selectedFrameId=frame.id;
  state.selectedFrameBySource.set(frame.sourceImageId,frame.id);
}

function changeCategory(category){state.settings.stickerCategory=category;const role=getStickerPresets(category)[0].role;state.settings=applyStickerPreset(state.settings,category,role);state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);normalizeFrameRolesForCategory();clearRenderCache();renderAll();rerenderShell();}
function changePreset(role){state.settings=applyStickerPreset(state.settings,state.settings.stickerCategory,role);state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);clearRenderCache();renderAll();rerenderShell();}
function updateOutputDimension(key,value){state.settings[key]=Math.max(1,Math.min(8192,Math.round(Number(value)||1)));state.settings.safeMargin=clampSafeMargin(state.settings.safeMargin,state.settings.targetW,state.settings.targetH);clearRenderCache();renderAll();rerenderShell();}
function updateSafeMargin(value){state.settings.safeMargin=clampSafeMargin(value,state.settings.targetW,state.settings.targetH);const label=document.getElementById('safeMarginInputValue');if(label)label.textContent=state.settings.safeMargin;clearRenderCache();renderAll();refresh();}
function normalizeFrameRolesForCategory(){const allowed=new Set(getAvailableAssetRoles(state.settings.stickerCategory));setFrames(frames().map(frame=>allowed.has(packageRole(frame))?frame:{...frame,state:{...frame.state,packageRole:AssetRoles.STICKER},custom:{...frame.custom,outputRole:AssetRoles.STICKER}}));}

async function importFiles(fileList) {
  const files = [...(fileList || [])].filter(file => file.type?.startsWith('image/'));
  for (const file of files) {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const ref = createSourceImageRef({ name:file.name,width:img.width,height:img.height,mimeType:file.type,uri:dataUrl });
    state.sources.set(ref.id,{ ...ref, fileName:file.name, img });
    state.sourceLayouts.set(ref.id,createSourceLayoutSettings(state.settings));
    state.document = addSourceRef(state.document,ref);
    state.activeSourceId = ref.id;
    detectSource(ref.id);
  }
  rerenderShell();
}

function deleteSource(sourceId){
  const source=state.sources.get(sourceId);if(!source)return;
  if(!window.confirm(`確定刪除「${source.name}」及其所有 Frames？`))return;
  const sourceIds=[...state.sources.keys()];
  const nextSourceId=getNextSourceId(sourceIds,sourceId);
  const removedFrames=frames().filter(frame=>frame.sourceImageId===sourceId);
  removedFrames.forEach(frame=>{state.rendered.delete(frame.id);state.renderKeys.delete(frame.id);state.maskHistories.delete(frame.id);});
  state.sources.delete(sourceId);
  state.sourceLayouts.delete(sourceId);
  state.selectedFrameBySource.delete(sourceId);
  state.document=removeSourceRef(state.document,sourceId);
  state.activeSourceId=nextSourceId;
  if(nextSourceId){
    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(nextSourceId));
    const sourceFrames=frames().filter(frame=>frame.sourceImageId===nextSourceId);
    const remembered=state.selectedFrameBySource.get(nextSourceId);
    const selected=sourceFrames.find(frame=>frame.id===remembered)||sourceFrames[0]||null;
    state.selectedFrameId=selected?.id||null;
  }else{
    state.selectedFrameId=null;
  }
  resetFrameHistory();clearRenderCache();renderAll();rerenderShell();
}

function detectActiveSource(){if(!state.activeSourceId)return;readGridSettings();detectSource(state.activeSourceId);refresh();}
function detectSource(sourceId) {
  const source = state.sources.get(sourceId); if(!source)return;
  const layout = sourceLayout(sourceId);
  const previousFrames=frames().filter(frame=>frame.sourceImageId===sourceId);
  let report;
  if(layout.layoutMode==='auto') report=detectProjectionGrid(source,{chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,tighten:true});
  else {
    report=detectGrid(source,{grid:{layout:layout.layoutMode,rows:layout.rows,cols:layout.cols,marginX:layout.marginX,marginY:layout.marginY,gapX:layout.gapX,gapY:layout.gapY,snapToPixels:true,minCellSize:8}});
    report.frames=tightenFramesToContent(source,report.frames,{padding:4,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance});
  }
  const oldFrames=frames().filter(frame=>frame.sourceImageId!==sourceId);
  const newFrames=mergeDetectedFrameStates(previousFrames,report.frames,{
    defaultRole:AssetRoles.STICKER,
    createName:(_,index)=>`${stripExtension(source.name)} ${String(index+1).padStart(2,'0')}`,
    resizeMask:(mask,width,height)=>resizeMaskCanvas(mask,width,height)
  });
  setFrames([...oldFrames,...newFrames]);
  const rememberedId=state.selectedFrameBySource.get(sourceId);
  const selected=newFrames.find(frame=>frame.id===rememberedId)||newFrames[0]||null;
  state.selectedFrameId=selected?.id||state.selectedFrameId;
  if(selected)state.selectedFrameBySource.set(sourceId,selected.id);
  resetFrameHistory(); clearRenderCache(); renderAll();
}

function frames(){return state.document.frames;}
function setFrames(next){state.document=setDocumentFrames(state.document,next);}
function activeSource(){return state.sources.get(state.activeSourceId)||null;}
function selectedFrame(){return frames().find(frame=>frame.id===state.selectedFrameId)||null;}
function sourceForFrame(frame){return frame?state.sources.get(frame.sourceImageId)||null:null;}
function exportFrames(){return frames().filter(frame=>frame.state?.visible!==false&&frame.state?.exportSelected!==false);}

function getRenderOptions(){return{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,alignMode:state.settings.alignMode,highQuality:true,refine:{enabled:true,chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,exteriorOnly:state.settings.exteriorOnly,autoDespeckle:state.settings.autoDespeckle,shrinkRadius:state.settings.shrinkRadius,featherRadius:state.settings.featherRadius,whiteBorder:{enabled:state.settings.whiteBorderEnabled,size:state.settings.whiteBorderSize,color:state.settings.borderColor},shadow:{enabled:false}}};}
function renderFrame(frame,force=false){const source=sourceForFrame(frame);if(!source)return null;const key=JSON.stringify({source:source.id,geometry:frame.geometry,offsetX:frame.custom?.offsetX||0,offsetY:frame.custom?.offsetY||0,maskVersion:frame.custom?.maskVersion||0,options:getRenderOptions()});if(!force&&state.rendered.has(frame.id)&&state.renderKeys.get(frame.id)===key)return state.rendered.get(frame.id);const canvas=renderWorkshopFrame(source,frame,getRenderOptions()).canvas;state.rendered.set(frame.id,canvas);state.renderKeys.set(frame.id,key);return canvas;}
function renderAll(){frames().forEach(frame=>renderFrame(frame));runReview();}
function clearRenderCache(){state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;}
function runReview(){const base=reviewFrames(frames(),state.rendered,{targetW:state.settings.targetW,targetH:state.settings.targetH});const sizeIssues=frames().flatMap(frame=>{const canvas=state.rendered.get(frame.id);const bytes=estimateCanvasPngBytes(canvas);return bytes>state.settings.maxFileSizeKB*1024?[{code:'render.fileTooLarge',message:`${frame.name} 約 ${Math.ceil(bytes/1024)}KB，超過 ${state.settings.maxFileSizeKB}KB。`,severity:'warning',frameId:frame.id,metadata:{bytes}}]:[];});const issues=[...base.issues,...sizeIssues];state.reviewReport={issues,summary:{total:issues.length,errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length,info:issues.filter(i=>i.severity==='info').length},ready:!issues.some(i=>i.severity==='error')};}

function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();refreshMaskToolButtons();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?`${source.name} · ${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}

function renderSourceList(){
  const holder=document.getElementById('sourceList');if(!holder)return;
  if(!state.sources.size){holder.innerHTML='<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">尚無原圖</div>';return;}
  holder.innerHTML='';
  state.sources.forEach(source=>{
    const layout=sourceLayout(source.id);
    const row=document.createElement('div');
    row.className=`grid grid-cols-[1fr_auto] gap-2 rounded-2xl border p-2 ${source.id===state.activeSourceId?'border-emerald-400 bg-emerald-50':'border-slate-200'}`;
    row.dataset.sourceId=source.id;
    row.dataset.sourceActive=String(source.id===state.activeSourceId);
    const button=document.createElement('button');
    button.className='flex min-w-0 items-center gap-3 text-left';
    button.innerHTML=`<img src="${source.uri}" class="h-12 w-12 rounded-xl object-cover"><div class="min-w-0"><div class="truncate text-xs font-black">${escapeHtml(source.name)}</div><div class="text-[10px] text-slate-400">${source.width}×${source.height} · ${layout.layoutMode} · ${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames</div></div>`;
    button.addEventListener('click',()=>activateSource(source.id));
    const remove=document.createElement('button');
    remove.type='button';
    remove.title='刪除此原圖與其 Frames';
    remove.className='rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-700';
    remove.textContent='刪除';
    remove.addEventListener('click',event=>{event.stopPropagation();deleteSource(source.id);});
    row.append(button,remove);holder.appendChild(row);
  });
}

function drawSourceCanvas(){const canvas=document.getElementById('sourceCanvas');if(!canvas)return;const source=activeSource();const ctx=canvas.getContext('2d');if(!source){canvas.width=1;canvas.height=1;ctx.clearRect(0,0,1,1);return;}canvas.width=source.width;canvas.height=source.height;ctx.drawImage(source.img,0,0);frames().filter(frame=>frame.sourceImageId===source.id).forEach(frame=>drawFrameOverlay(ctx,frame,frame.id===state.selectedFrameId));}
function drawFrameOverlay(ctx,frame,selected){const g=frame.geometry;ctx.save();ctx.strokeStyle=selected?'#10b981':'#ef4444';ctx.lineWidth=selected?Math.max(4,ctx.canvas.width/240):Math.max(2,ctx.canvas.width/400);ctx.strokeRect(g.x,g.y,g.width,g.height);if(selected)handlePoints(g).forEach(point=>{ctx.fillStyle='#10b981';ctx.fillRect(point.x-HANDLE_SIZE/2,point.y-HANDLE_SIZE/2,HANDLE_SIZE,HANDLE_SIZE);});ctx.restore();}
function bindSourceCanvas(canvas){canvas.addEventListener('pointerdown',sourcePointerDown);canvas.addEventListener('pointermove',sourcePointerMove);canvas.addEventListener('pointerup',sourcePointerUp);canvas.addEventListener('pointerleave',sourcePointerUp);}
function sourcePointerDown(event){const source=activeSource();if(!source)return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromSource(point);return;}const hit=hitTestFrame(point);if(!hit)return;selectFrame(hit.frame.id);state.frameDrag={frameId:hit.frame.id,handle:hit.handle,start:point,startGeometry:{...hit.frame.geometry},before:frameSnapshot()};event.currentTarget.setPointerCapture?.(event.pointerId);refresh();}
function sourcePointerMove(event){if(!state.frameDrag)return;const point=canvasPoint(event);const drag=state.frameDrag;const frame=frames().find(item=>item.id===drag.frameId);if(!frame)return;const dx=point.x-drag.start.x,dy=point.y-drag.start.y;const geometry=resizeGeometry(drag.startGeometry,drag.handle,dx,dy);replaceFrame({...frame,geometry:clampGeometry(geometry,activeSource())});drawSourceCanvas();}
function sourcePointerUp(){if(!state.frameDrag)return;const drag=state.frameDrag;state.frameDrag=null;let frame=frames().find(item=>item.id===drag.frameId);if(frame&&sourceLayout(frame.sourceImageId).smartSnap)frame=smartSnapFrameToContent(sourceForFrame(frame),frame,{searchPadding:12,padding:4,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance});if(frame){const mask=frame.custom?.protectMaskCanvas;if(mask&&(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height)))frame={...frame,custom:{...frame.custom,protectMaskCanvas:resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height),maskVersion:(frame.custom.maskVersion||0)+1}};replaceFrame(frame);}commitFrameChange(drag.handle==='move'?'Move Frame':'Resize Frame',drag.before,frameSnapshot());clearRenderCache();renderAll();refresh();}
function canvasPoint(event){const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
function hitTestFrame(point){const list=frames().filter(frame=>frame.sourceImageId===state.activeSourceId);const selected=selectedFrame();if(selected&&selected.sourceImageId===state.activeSourceId){const handle=hitHandle(point,selected.geometry);if(handle)return{frame:selected,handle};}for(let index=list.length-1;index>=0;index--){const frame=list[index],g=frame.geometry;if(point.x>=g.x&&point.x<=g.x+g.width&&point.y>=g.y&&point.y<=g.y+g.height)return{frame,handle:'move'};}return null;}
function handlePoints(g){return[{name:'nw',x:g.x,y:g.y},{name:'n',x:g.x+g.width/2,y:g.y},{name:'ne',x:g.x+g.width,y:g.y},{name:'e',x:g.x+g.width,y:g.y+g.height/2},{name:'se',x:g.x+g.width,y:g.y+g.height},{name:'s',x:g.x+g.width/2,y:g.y+g.height},{name:'sw',x:g.x,y:g.y+g.height},{name:'w',x:g.x,y:g.y+g.height/2}];}
function hitHandle(point,g){return handlePoints(g).find(item=>Math.abs(point.x-item.x)<=HANDLE_SIZE&&Math.abs(point.y-item.y)<=HANDLE_SIZE)?.name||null;}
function resizeGeometry(start,handle,dx,dy){let{x,y,width,height}=start;if(handle==='move')return{x:x+dx,y:y+dy,width,height};if(handle.includes('e'))width+=dx;if(handle.includes('s'))height+=dy;if(handle.includes('w')){x+=dx;width-=dx;}if(handle.includes('n')){y+=dy;height-=dy;}if(width<MIN_FRAME_SIZE){if(handle.includes('w'))x-=MIN_FRAME_SIZE-width;width=MIN_FRAME_SIZE;}if(height<MIN_FRAME_SIZE){if(handle.includes('n'))y-=MIN_FRAME_SIZE-height;height=MIN_FRAME_SIZE;}return{x,y,width,height};}
function clampGeometry(g,source){const width=Math.min(g.width,source.width),height=Math.min(g.height,source.height);return{x:Math.max(0,Math.min(g.x,source.width-width)),y:Math.max(0,Math.min(g.y,source.height-height)),width,height};}
function replaceFrame(next){setFrames(frames().map(frame=>frame.id===next.id?next:frame));}

function drawRefineCanvas(){const canvas=document.getElementById('refineCanvas');if(!canvas)return;const frame=selectedFrame(),source=sourceForFrame(frame),ctx=canvas.getContext('2d');if(!frame||!source){canvas.width=1;canvas.height=1;ctx.clearRect(0,0,1,1);return;}canvas.width=Math.max(1,Math.round(frame.geometry.width));canvas.height=Math.max(1,Math.round(frame.geometry.height));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);const mask=frame.custom?.protectMaskCanvas;if(mask){ctx.save();ctx.globalAlpha=.35;ctx.drawImage(mask,0,0,canvas.width,canvas.height);ctx.restore();}}
function bindRefineCanvas(canvas){canvas.addEventListener('pointerdown',refinePointerDown);canvas.addEventListener('pointermove',refinePointerMove);canvas.addEventListener('pointerup',refinePointerUp);canvas.addEventListener('pointerleave',refinePointerUp);}
function refinePointerDown(event){const frame=selectedFrame();if(!frame||state.settings.maskTool==='view')return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromRefine(point);return;}const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);if(state.settings.maskTool==='magic'){const raw=createRawCropCanvas(frame);applyMagicMask(raw,mask,point.x,point.y,{action:MaskActions.DELETE,tolerance:state.settings.tolerance});touchMask(frame,mask);commitMaskHistory(frame.id,mask);clearRenderCache();renderAll();refresh();return;}state.maskStroke={frameId:frame.id,last:point,action:state.settings.maskTool==='keep'?MaskActions.KEEP:MaskActions.DELETE};paintMaskStroke(mask,point,point,{action:state.maskStroke.action,size:state.settings.maskSize});touchMask(frame,mask);drawRefineCanvas();}
function refinePointerMove(event){if(!state.maskStroke)return;const frame=selectedFrame();if(!frame||frame.id!==state.maskStroke.frameId)return;const point=canvasPoint(event),mask=ensureFrameMask(frame);paintMaskStroke(mask,state.maskStroke.last,point,{action:state.maskStroke.action,size:state.settings.maskSize});state.maskStroke.last=point;touchMask(frame,mask);drawRefineCanvas();}
function refinePointerUp(){if(!state.maskStroke)return;const frame=selectedFrame(),mask=frame?.custom?.protectMaskCanvas;state.maskStroke=null;if(frame&&mask){commitMaskHistory(frame.id,mask);clearRenderCache();renderAll();refresh();}}
function ensureFrameMask(frame){let mask=frame.custom?.protectMaskCanvas;if(!mask)mask=createMaskCanvas(frame.geometry.width,frame.geometry.height);else if(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height))mask=resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height);touchMask(frame,mask,false);return mask;}
function touchMask(frame,mask,increment=true){replaceFrame({...frame,custom:{...frame.custom,protectMaskCanvas:mask,maskVersion:(frame.custom?.maskVersion||0)+(increment?1:0)}});}
function createRawCropCanvas(frame){const source=sourceForFrame(frame),canvas=document.createElement('canvas');canvas.width=Math.round(frame.geometry.width);canvas.height=Math.round(frame.geometry.height);canvas.getContext('2d').drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);return canvas;}
function ensureMaskHistory(frameId,mask){if(!state.maskHistories.has(frameId))state.maskHistories.set(frameId,{items:[captureMaskSnapshot(mask)],index:0});}
function commitMaskHistory(frameId,mask){ensureMaskHistory(frameId,mask);const history=state.maskHistories.get(frameId);history.items=history.items.slice(0,history.index+1);history.items.push(captureMaskSnapshot(mask));if(history.items.length>12)history.items.shift();history.index=history.items.length-1;}
function stepMaskHistory(direction){const frame=selectedFrame();if(!frame)return;const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);const history=state.maskHistories.get(frame.id),next=Math.max(0,Math.min(history.items.length-1,history.index+direction));if(next===history.index)return;history.index=next;restoreMaskSnapshot(mask,history.items[next]);touchMask(frame,mask);clearRenderCache();renderAll();refresh();}
function clearSelectedMask(){const frame=selectedFrame();if(!frame)return;const mask=createMaskCanvas(frame.geometry.width,frame.geometry.height);touchMask(frame,mask);state.maskHistories.delete(frame.id);ensureMaskHistory(frame.id,mask);clearRenderCache();renderAll();refresh();}
function setRefineZoom(value){state.settings.refineZoom=Math.max(.5,Math.min(4,value));const canvas=document.getElementById('refineCanvas');if(canvas)canvas.style.transform=`scale(${state.settings.refineZoom})`;const button=document.getElementById('zoomResetBtn');if(button)button.textContent=`${Math.round(state.settings.refineZoom*100)}%`;}
function refreshMaskToolButtons(){document.querySelectorAll('.mask-tool').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.maskTool===state.settings.maskTool));}
function pickColorFromSource(point){const source=activeSource();if(!source)return;const canvas=document.getElementById('sourceCanvas'),pixel=canvas.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function pickColorFromRefine(point){const canvas=document.getElementById('refineCanvas'),pixel=canvas.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function setPickedColor(pixel){state.settings.chromaColor=[pixel[0],pixel[1],pixel[2]];state.settings.maskTool='view';const input=document.getElementById('chromaColorInput');if(input)input.value=rgbToHex(state.settings.chromaColor);clearRenderCache();renderAll();refresh();}

function availableRoleOptions(){return getAvailableAssetRoles(state.settings.stickerCategory);}
function packageRole(frame){return frame.state?.packageRole||frame.custom?.outputRole||AssetRoles.STICKER;}
function roleLabel(role){return({sticker:'Sticker',main:'Main',tab:'Tab',background:'全螢幕背景','effect-background':'特效背景'})[role]||role;}
function currentRules(){return createPlatformNeutralRules({category:state.settings.stickerCategory,targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,maxFileSizeKB:state.settings.maxFileSizeKB});}
function packagePlan(list=frames()){return buildWorkshopPackagePlan(list,{category:state.settings.stickerCategory,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,destinationKey:'workshop'});}
function packageItemFor(frame,list=frames()){return packagePlan(list).items.find(item=>item.artworkId===frame.id)||null;}

function renderReviewGrid(){const grid=document.getElementById('reviewGrid');if(!grid)return;if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}grid.innerHTML='';const roles=availableRoleOptions(),plan=packagePlan();frames().forEach((frame,index)=>{const canvas=renderFrame(frame),card=document.createElement('div'),item=plan.items.find(entry=>entry.artworkId===frame.id);card.draggable=true;card.dataset.frameId=frame.id;card.dataset.sourceId=frame.sourceImageId;const kb=Math.ceil(estimateCanvasPngBytes(canvas)/1024),oversize=kb>state.settings.maxFileSizeKB;card.className=`rounded-3xl border p-2 ${oversize?'border-rose-400 bg-rose-50':frame.id===state.selectedFrameId?'border-emerald-400 bg-emerald-50':'border-slate-200 bg-white'}`;const dataUrl=canvas.toDataURL('image/png');card.innerHTML=`<button class="preview block aspect-[370/320] w-full overflow-hidden rounded-2xl ${reviewBackgroundClass()}"><img src="${dataUrl}" class="h-full w-full object-contain"></button><div class="mt-2 flex items-center justify-between gap-2"><span class="text-[10px] font-black">#${index+1} · <span class="${oversize?'text-rose-600':''}">${kb}KB${oversize?' ⚠':''}</span></span><input class="export-check" type="checkbox" ${frame.state?.exportSelected!==false?'checked':''}></div><div class="mt-1 truncate text-[10px] font-mono" title="${escapeHtml(item?.fileName||'')}">${escapeHtml(item?.fileName||'')}</div><select class="role-select mt-2 w-full rounded-xl bg-slate-100 px-2 py-1 text-xs font-black">${roles.map(role=>`<option value="${role}" ${packageRole(frame)===role?'selected':''}>${roleLabel(role)}</option>`).join('')}</select><button class="single-download mt-2 w-full rounded-xl bg-slate-950 py-2 text-xs font-black text-white">PNG</button>`;card.querySelector('.preview').addEventListener('click',()=>{selectFrame(frame.id);refresh();});card.querySelector('.export-check').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,exportSelected:event.target.checked}});refresh();});card.querySelector('.role-select').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,packageRole:event.target.value},custom:{...frame.custom,outputRole:event.target.value}});refresh();});card.querySelector('.single-download').addEventListener('click',()=>downloadFramePng(frame));card.addEventListener('dragstart',()=>state.draggedReviewFrameId=frame.id);card.addEventListener('dragover',event=>event.preventDefault());card.addEventListener('drop',()=>reorderFrame(state.draggedReviewFrameId,frame.id));grid.appendChild(card);});}
function reviewBackgroundClass(){if(state.settings.reviewBackground==='white')return'bg-white';if(state.settings.reviewBackground==='black')return'bg-slate-950';return'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%)] bg-[length:16px_16px]';}
function renderLargeReview(){const stage=document.getElementById('reviewHeroStage'),image=document.getElementById('reviewHeroImage'),guide=document.getElementById('reviewSafeGuide'),meta=document.getElementById('reviewHeroMeta');if(!stage||!image||!guide||!meta)return;const frame=selectedFrame()||frames()[0];stage.className=`relative grid min-h-[380px] place-items-center overflow-hidden rounded-3xl border border-slate-200 ${reviewBackgroundClass()}`;stage.style.aspectRatio=`${state.settings.targetW}/${state.settings.targetH}`;if(!frame){image.removeAttribute('src');guide.classList.add('hidden');meta.innerHTML='<div class="text-slate-400">尚無預覽</div>';return;}const canvas=renderFrame(frame),kb=Math.ceil(estimateCanvasPngBytes(canvas)/1024),oversize=kb>state.settings.maxFileSizeKB,item=packageItemFor(frame);image.src=canvas.toDataURL('image/png');const top=state.settings.safeMargin/state.settings.targetH*100,left=state.settings.safeMargin/state.settings.targetW*100;guide.style.top=`${top}%`;guide.style.bottom=`${top}%`;guide.style.left=`${left}%`;guide.style.right=`${left}%`;guide.classList.toggle('hidden',!state.settings.showSafeGuide);meta.innerHTML=`<div class="text-xs font-black uppercase tracking-widest text-emerald-300">Selected output</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(item?.fileName||'')}</div><div class="mt-3 rounded-2xl bg-white/10 p-3">${state.settings.targetW}×${state.settings.targetH}px<br>safe ${state.settings.safeMargin}px<br>${state.settings.alignMode==='bottom'?'靠下貼齊':'絕對置中'}<br>offset ${frame.custom?.offsetX||0}, ${frame.custom?.offsetY||0}</div><div class="mt-3 rounded-2xl ${oversize?'bg-rose-500/20 text-rose-200':'bg-emerald-500/20 text-emerald-200'} p-3 font-black">${kb}KB ${oversize?`· 超過 ${state.settings.maxFileSizeKB}KB`:'· 檔案大小正常'}</div>`;}
function reorderFrame(fromId,toId){if(!fromId||fromId===toId)return;const list=[...frames()],from=list.findIndex(frame=>frame.id===fromId),to=list.findIndex(frame=>frame.id===toId);if(from<0||to<0)return;const[item]=list.splice(from,1);list.splice(to,0,item);setFrames(list);state.draggedReviewFrameId=null;resetFrameHistory();refresh();}

function renderSelectedInfo(){const holder=document.getElementById('selectedInfo'),frame=selectedFrame();if(!holder)return;if(!frame){holder.textContent='尚未選取';return;}const g=frame.geometry,ox=frame.custom?.offsetX||0,oy=frame.custom?.offsetY||0;holder.innerHTML=`<div class="rounded-2xl bg-emerald-50 p-3 font-black text-emerald-800">${escapeHtml(frame.name)}<br><span class="text-xs">x ${Math.round(g.x)} · y ${Math.round(g.y)} · ${Math.round(g.width)}×${Math.round(g.height)}<br>output offset: ${ox}, ${oy}<br>role: ${roleLabel(packageRole(frame))}</span></div>`;const x=document.getElementById('offsetXInput'),y=document.getElementById('offsetYInput');if(x)x.value=ox;if(y)y.value=oy;}
function renderReviewSummary(){const holder=document.getElementById('reviewSummary');if(!holder)return;runReview();const report=state.reviewReport,plan=packagePlan(exportFrames());if(!report){holder.innerHTML='<div class="text-slate-400">尚未檢查</div>';return;}holder.innerHTML=`<div class="rounded-2xl bg-white/10 p-3"><div class="text-2xl font-black">${exportFrames().length}</div><div class="text-xs text-slate-400">selected exports</div></div><div class="rounded-2xl bg-white/10 p-3 text-xs">${report.ready&&plan.ready?'✓ Review ready':`${report.summary.errors+plan.validation.errors.length} errors · ${report.summary.warnings} warnings`}</div>`;}

function setSelectedOffset(key,value){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,[key]:Math.max(-4096,Math.min(4096,Number(value)||0))}});commitFrameChange('Set Output Offset',before,frameSnapshot());clearRenderCache();renderAll();refresh();}
function nudgeSelectedOffset(dx,dy){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,offsetX:(frame.custom?.offsetX||0)+dx,offsetY:(frame.custom?.offsetY||0)+dy}});commitFrameChange('Nudge Output Offset',before,frameSnapshot());clearRenderCache();renderAll();refresh();}
function resetSelectedOffset(){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot();replaceFrame({...frame,custom:{...frame.custom,offsetX:0,offsetY:0}});commitFrameChange('Reset Output Offset',before,frameSnapshot());clearRenderCache();renderAll();refresh();}

function duplicateSelectedFrame(){
  const frame=selectedFrame();if(!frame)return;
  const copy={...frame,id:createId('frame'),name:`${frame.name} Copy`,geometry:clampGeometry({...frame.geometry,x:frame.geometry.x+20,y:frame.geometry.y+20},sourceForFrame(frame)),custom:{...frame.custom,outputRole:AssetRoles.STICKER,protectMaskCanvas:null,maskVersion:0},state:{...frame.state,packageRole:AssetRoles.STICKER}};
  const list=[...frames()];
  const index=list.findIndex(item=>item.id===frame.id);
  list.splice(index+1,0,copy);
  applyFrameListChange('Duplicate Frame',list,copy.id,frame.sourceImageId);
}
function deleteSelectedFrame(){
  const frame=selectedFrame();if(!frame)return;
  const before=frames();
  const sourceFrames=before.filter(item=>item.sourceImageId===frame.sourceImageId);
  const sourceIndex=sourceFrames.findIndex(item=>item.id===frame.id);
  const list=before.filter(item=>item.id!==frame.id);
  const remainingSourceFrames=list.filter(item=>item.sourceImageId===frame.sourceImageId);
  const next=remainingSourceFrames[Math.min(sourceIndex,remainingSourceFrames.length-1)]||remainingSourceFrames[sourceIndex-1]||null;
  applyFrameListChange('Delete Frame',list,next?.id||null,frame.sourceImageId);
}
function frameSnapshot(){return{frames:cloneFrames(frames()),selectedFrameId:state.selectedFrameId};}
function cloneFrames(list){return list.map(frame=>({...frame,geometry:{...frame.geometry},state:{...frame.state},custom:{...frame.custom}}));}
function commitFrameChange(label,before,after){if(JSON.stringify(serializableSnapshot(before))===JSON.stringify(serializableSnapshot(after)))return;const command=createCommand({type:'frames.update',label,target:after.selectedFrameId,payload:{after},apply:()=>after});const executed=executeCommand(before,command);state.frameHistory=commitHistory(state.frameHistory,executed.entry);}
function serializableSnapshot(snapshot){return{selectedFrameId:snapshot.selectedFrameId,frames:snapshot.frames.map(frame=>({...frame,custom:{...frame.custom,protectMaskCanvas:frame.custom?.protectMaskCanvas?'[mask]':null}}))};}
function applyFrameSnapshot(snapshot){
  if(!snapshot)return;
  setFrames(cloneFrames(snapshot.frames));
  const restored=frames().find(frame=>frame.id===snapshot.selectedFrameId)||null;
  state.selectedFrameId=restored?.id||null;
  if(restored){
    state.activeSourceId=restored.sourceImageId;
    state.selectedFrameBySource.set(restored.sourceImageId,restored.id);
    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(restored.sourceImageId));
  }
  clearRenderCache();renderAll();refresh();
}
function resetFrameHistory(){state.frameHistory=createHistory(frameSnapshot());}
function undoFrames(){if(!canUndo(state.frameHistory))return;state.frameHistory=undo(state.frameHistory);applyFrameSnapshot(state.frameHistory.present);}
function redoFrames(){if(!canRedo(state.frameHistory))return;state.frameHistory=redo(state.frameHistory);applyFrameSnapshot(state.frameHistory.present);}
function applyFrameListChange(label,nextFrames,nextSelected,sourceId=state.activeSourceId){
  const before=frameSnapshot();
  setFrames(nextFrames);
  state.activeSourceId=sourceId||state.activeSourceId;
  const selected=nextFrames.find(frame=>frame.id===nextSelected)||null;
  state.selectedFrameId=selected?.id||null;
  if(state.activeSourceId){
    if(selected)state.selectedFrameBySource.set(state.activeSourceId,selected.id);
    else state.selectedFrameBySource.delete(state.activeSourceId);
    state.settings=applySourceLayoutSettings(state.settings,sourceLayout(state.activeSourceId));
  }
  const after=frameSnapshot();commitFrameChange(label,before,after);clearRenderCache();renderAll();refresh();
}

function downloadSelectedPng(){const frame=selectedFrame();if(frame)downloadFramePng(frame);}
function downloadFramePng(frame){const canvas=renderFrame(frame,true),item=packageItemFor(frame);downloadDataUrl(canvas.toDataURL('image/png'),item?.fileName||'sticker.png');}
async function downloadZip(){const selected=exportFrames();if(!selected.length)return alert('請至少勾選一張圖片。');try{const plan=packagePlan(selected);if(!plan.ready)throw new Error(plan.validation.errors[0]?.message||'Package 設定不完整。');const rules=currentRules();const result=await createMultiSourceZipExport({sourceImages:state.sources,frames:selected,renderOptions:getRenderOptions(),renderedMap:state.rendered,exportOptions:{prefix:state.settings.filenamePrefix||'stixio-workshop',allowWarnings:true,destinationKey:rules.key,packagePlan:plan,rules},JSZipClass:window.JSZip});state.rendered=result.renderedMap;downloadBlob(result.blob,result.fileName);refresh();}catch(error){alert(error.message||'ZIP 匯出失敗');}}
function downloadDataUrl(url,name){const link=document.createElement('a');link.href=url;link.download=name;link.click();}
function downloadBlob(blob,name){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}

function readFileAsDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});}
function rgbToHex([r,g,b]){return`#${[r,g,b].map(value=>Math.max(0,Math.min(255,value)).toString(16).padStart(2,'0')).join('')}`;}
function hexToRgb(hex){const value=hex.replace('#','');return[parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)];}
function stripExtension(name){return String(name||'source').replace(/\.[^.]+$/,'');}
function categoryLabel(value){return({normal:'一般貼圖',animated:'動態貼圖',big:'大貼圖',fullscreen:'全螢幕貼圖',effect:'特效貼圖'})[value]||value;}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function createId(prefix){return`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
