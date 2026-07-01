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
  getNextSourceId,
  clearMask,
  getMaskStats,
  createRefineViewState,
  zoomRefineView,
  panRefineView,
  resetRefineView,
  refineViewTransform,
  analyzeRenderedCanvas,
  getReviewBackgroundStyle,
  runFullReview,
  buildReviewItems,
  filterReviewItems,
  sortReviewItems,
  getReviewProgress,
  setFrameReviewApproval,
  setFramesReviewApproval,
  setFramesExportSelection,
  invertFramesExportSelection,
  nextReviewFrameId,
  ReviewFilterModes,
  ReviewSortModes,
  ReviewIssueSeverity,
  createWorkshopProjectSnapshot,
  applyDestinationProfileToSettings,
  normalizeFramesForDestination
} from '../core/index.js';
import { createPackageController } from './package-controller.js';
import { createProjectController } from './project-controller.js';
import { createDestinationController } from './destination-controller.js';

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
  showContentBounds: true,
  reviewFilter: ReviewFilterModes.ALL,
  reviewSort: ReviewSortModes.FRAME_ORDER,
  reviewSearch: '',
  reviewZoom: 1,
  refineZoom: 1,
  maskTool: 'view',
  maskSize: 15,
  maskOverlayVisible: true,
  maskOverlayOpacity: 42,
  magicAction: MaskActions.DELETE,
  magicContiguous: true,
  refineViewMode: 'split',
  despeckleMinSize: 30,
  packageNamingMode: PackageNamingModes.PACKAGE,
  filenamePrefix: '',
  filenameSuffix: '',
  maxFileSizeKB: DEFAULT_MAX_FILE_SIZE_KB,
  destinationProfileKey: 'workshop-flexible',
  destinationProfileVersion: '1.0.0'
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
  frameHistory: createHistory({ frames: [], selectedFrameId: null }),
  refineView: createRefineViewState(),
  refinePan: null,
  refinePointer: null,
  activeEditor: 'layout',
  globalEventsBound: false,
  refineAppliedAt: new Map(),
  refineRenderTimer: null,
  reviewView: createRefineViewState({ minZoom: 0.25, maxZoom: 4 }),
  reviewPan: null,
  reviewPointerActive: false,
  packageController: null,
  projectController: null,
  destinationController: null
};

export function initStixioWorkshop(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = `${BRAND.name} Workshop`;
  root.innerHTML = renderShell();
  bindStaticEvents(root);
  mountDestinationController(root);
  mountPackageController(root);
  mountProjectController(root);
  refresh();
}

// BETA_PROGRESSIVE_BOOTSTRAP
export async function initStixioWorkshopProgressive(
  root = document.getElementById('app'),
  { onStage = null } = {}
) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = `${BRAND.name} Workshop`;

  const runStage = async (name, action) => {
    document.documentElement.dataset.stixioBootStage = name;
    onStage?.(name);
    await nextBootstrapFrame();
    action();
    await nextBootstrapFrame();
  };

  await runStage('shell', () => { root.innerHTML = renderShell(); });
  await runStage('events', () => bindStaticEvents(root));
  await runStage('destination', () => mountDestinationController(root));
  await runStage('package', () => mountPackageController(root));
  await runStage('project', () => mountProjectController(root));
  await runStage('refresh', refresh);
  document.documentElement.dataset.stixioBootStage = 'ready';
  return root;
}

function nextBootstrapFrame() {
  return new Promise(resolve => {
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : callback => setTimeout(callback, 0);
    schedule(() => setTimeout(resolve, 0));
  });
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
        <div id="projectToolbarRoot"></div>
        <nav aria-label="Workshop workflow" class="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-5 pb-4 md:grid-cols-4">
          ${stageLink('layout','Layout','匯入與版面切割','bg-slate-950 text-white','text-emerald-300')}
          ${stageLink('refine','Refine','細部修補','border border-slate-900/10 bg-white','text-rose-500')}
          ${stageLink('review','Review','預覽與檢查','border border-slate-900/10 bg-white','text-sky-600')}
          ${stageLink('package','Package','角色與輸出打包','border border-slate-900/10 bg-white','text-amber-600')}
        </nav>
      </header>
      <main class="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[360px_1fr_340px]">
        <aside class="space-y-4">${renderImportPanel()}${renderDetectionPanel()}${renderDestinationPanel()}${renderOutputPanel()}${renderRefinePanel()}</aside>
        <section class="space-y-4">${renderSourceEditor()}${renderRefineEditor()}${renderReviewBoard()}${renderPackageBoard()}</section>
        <aside class="space-y-4">${renderSourceListPanel()}${renderSelectedPanel()}${renderReviewPanel()}${renderPackagePanel()}</aside>
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

function renderDestinationPanel() {
  return '<div id="destinationRulesRoot"></div>';
}

function renderOutputPanel() {
  const frame=selectedFrame();
  const output=state.destinationController?.getFrameOutput?.(frame)||{role:state.settings.outputRole,width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin,maxFileSizeBytes:state.settings.maxFileSizeKB*1024};
  const safeMax=Math.max(0,Math.floor(Math.min(output.width,output.height)/2)-1);
  return `<section id="package-rules-panel" class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Rules Engine</p><h2 class="mt-1 text-xl font-black">角色輸出與對齊</h2><div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-2xl bg-slate-50 p-3"><div class="text-[10px] font-black uppercase text-slate-400">Role</div><div class="mt-1 text-sm font-black">${roleLabel(output.role)}</div></div><div class="rounded-2xl bg-slate-50 p-3"><div class="text-[10px] font-black uppercase text-slate-400">File limit</div><div class="mt-1 text-sm font-black">≤${Math.ceil(output.maxFileSizeBytes/1024)}KB</div></div></div><div class="mt-3 grid grid-cols-2 gap-3">${numberInput('targetWInput','自訂寬度',output.width,1,8192)}${numberInput('targetHInput','自訂高度',output.height,1,8192)}</div>${rangeInput('safeMarginInput','安全留白',output.safeMargin,0,safeMax)}<div class="mt-3"><div class="mb-2 text-xs font-black text-slate-500">圖案對齊</div><div class="grid grid-cols-2 gap-2">${alignButton('center','絕對置中')}${alignButton('bottom','靠下貼齊')}</div></div><div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">${output.width} × ${output.height}px · safe ${output.safeMargin}px</div><p class="mt-3 text-[10px] font-bold text-slate-400">修改內建規格時會自動複製成 Custom Profile，原始 Profile 不會被覆蓋。</p></section>`;
}

function renderRefinePanel() {
  return `<section id="refine-settings-panel" class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Refine · Processing Engine</p><h2 class="mt-1 text-xl font-black">自動去背與邊緣品質</h2><label class="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>去除背景色</span><input id="chromaEnabledInput" type="checkbox" ${state.settings.chromaEnabled?'checked':''}></label><div class="mt-3 flex gap-2"><input id="chromaColorInput" type="color" value="${rgbToHex(state.settings.chromaColor)}" class="h-10 w-14 rounded-xl"><button id="pickerBtn" class="flex-1 rounded-xl bg-slate-100 text-xs font-black">吸色器</button></div>${rangeInput('toleranceInput','色差容忍度',state.settings.tolerance,5,120)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>僅移除外圍背景</span><input id="exteriorInput" type="checkbox" ${state.settings.exteriorOnly?'checked':''}></label><label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>自動清除透明孤島</span><input id="despeckleInput" type="checkbox" ${state.settings.autoDespeckle?'checked':''}></label>${rangeInput('despeckleSizeInput','雜點最小保留面積',state.settings.despeckleMinSize,1,500)}${rangeInput('shrinkInput','去白邊／侵蝕',state.settings.shrinkRadius,0,8)}${rangeInput('featherInput','平滑羽化',state.settings.featherRadius,0,8)}<label class="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-black"><span>外框</span><input id="borderInput" type="checkbox" ${state.settings.whiteBorderEnabled?'checked':''}></label><div class="mt-3 flex items-end gap-3"><label class="text-xs font-black text-slate-500">外框顏色<input id="borderColorInput" type="color" value="${state.settings.borderColor}" class="mt-1 h-10 w-14 rounded-xl"></label><div class="flex-1">${rangeInput('borderSizeInput','外框粗細',state.settings.whiteBorderSize,0,25)}</div></div><div class="mt-4 grid grid-cols-2 gap-2"><button id="renderSelectedBtn" class="rounded-2xl bg-sky-50 py-3 text-xs font-black text-sky-800">重算本張</button><button id="renderAllBtn" class="rounded-2xl bg-emerald-300 py-3 text-xs font-black text-slate-950">重算全部</button></div><button id="resetRefineSettingsBtn" class="mt-2 w-full rounded-2xl bg-slate-100 py-3 text-xs font-black">恢復 Refine 預設值</button></section>`;
}

function renderSourceEditor() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="mb-4 flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Frame Editor</p><h2 class="text-xl font-black">原圖與九點裁切框</h2></div><div id="sourceStatus" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">尚未匯入</div></div><div class="grid min-h-[460px] place-items-center overflow-auto rounded-3xl border border-slate-200 bg-slate-100 p-4"><canvas id="sourceCanvas" class="max-h-[70vh] max-w-full cursor-crosshair rounded-xl shadow-xl"></canvas></div></section>`;
}

function renderRefineEditor() {
  const mode = state.settings.refineViewMode;
  const showEditor = mode !== 'result';
  const showResult = mode !== 'mask';
  return `<section id="stage-refine" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Refine · Manual Tools</p><h2 class="text-xl font-black">單張遮罩修補工作台</h2></div><div class="flex flex-wrap gap-2"><button data-mask-tool="view" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">檢視／平移</button><button data-mask-tool="magic" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">魔術</button><button data-mask-tool="keep" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">保留</button><button data-mask-tool="delete" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">強制去背</button><button data-mask-tool="clear" class="mask-tool rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">清除標記</button></div></div><div class="mt-4 grid gap-3 rounded-3xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4"><div><div class="text-xs font-black text-slate-500">魔術動作</div><div class="mt-2 grid grid-cols-2 gap-2"><button data-magic-action="delete" class="magic-action rounded-xl bg-white px-3 py-2 text-xs font-black">去背</button><button data-magic-action="keep" class="magic-action rounded-xl bg-white px-3 py-2 text-xs font-black">保留</button></div><label class="mt-2 flex items-center gap-2 text-xs font-black"><input id="magicContiguousInput" type="checkbox" ${state.settings.magicContiguous?'checked':''}>僅連續區域</label></div><div>${rangeInput('maskSizeInput','筆刷大小',state.settings.maskSize,5,120)}</div><div><label class="flex items-center justify-between text-xs font-black text-slate-500"><span>顯示遮罩標記</span><input id="maskOverlayInput" type="checkbox" ${state.settings.maskOverlayVisible?'checked':''}></label>${rangeInput('maskOverlayOpacityInput','遮罩透明度',state.settings.maskOverlayOpacity,5,100)}</div><div><div class="text-xs font-black text-slate-500">檢視模式</div><div class="mt-2 grid grid-cols-3 gap-1"><button data-refine-view="split" class="refine-view rounded-xl bg-white px-2 py-2 text-xs font-black">雙欄</button><button data-refine-view="mask" class="refine-view rounded-xl bg-white px-2 py-2 text-xs font-black">修補</button><button data-refine-view="result" class="refine-view rounded-xl bg-white px-2 py-2 text-xs font-black">成品</button></div></div></div><div class="mt-3 flex flex-wrap items-center gap-2"><button id="maskUndoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black disabled:opacity-30">遮罩 Undo</button><button id="maskRedoBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black disabled:opacity-30">Redo</button><button id="maskClearBtn" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">清除全部標記</button><button id="resetSelectedRefineBtn" class="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">重設本張</button><button id="applyRefineBtn" class="rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white">套用修補結果</button><span class="ml-auto text-xs font-bold text-slate-400">滾輪縮放 · 拖曳平移 · 空白鍵暫時平移</span><button id="zoomOutBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">−</button><button id="zoomResetBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">${Math.round(state.refineView.zoom*100)}%</button><button id="zoomInBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">＋</button></div><div id="refineWorkspace" class="mt-4 grid gap-4 ${showEditor&&showResult?'lg:grid-cols-2':'grid-cols-1'}"><div id="refineViewport" class="relative min-h-[430px] overflow-hidden rounded-3xl border border-slate-200 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:18px_18px] touch-none" style="${showEditor?'':'display:none'};min-height:430px"><div id="refineTransformLayer" class="absolute left-1/2 top-1/2 origin-center" style="position:absolute;left:50%;top:50%;transform:${refineViewTransform(state.refineView)}"><canvas id="refineCanvas" class="block max-h-[70vh] max-w-[70vw] rounded-lg shadow-lg" style="display:block;max-width:760px;max-height:680px"></canvas></div><div id="refineBrushCursor" class="pointer-events-none absolute hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.7)]"></div><div class="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-slate-950/75 px-3 py-2 text-[10px] font-black text-white">綠＝保留 · 紅＝刪除</div></div><div id="refineResultPane" class="grid min-h-[430px] place-items-center overflow-auto rounded-3xl border border-slate-200 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%)] bg-[length:18px_18px] p-5" style="${showResult?'':'display:none'};min-height:430px"><canvas id="refineOutputCanvas" class="max-h-[70vh] max-w-full rounded-lg shadow-lg"></canvas></div></div><div id="refineStatus" class="mt-4 rounded-2xl bg-slate-950 p-4 text-xs font-bold text-slate-200">尚未選取 Frame</div></section>`;
}

function renderReviewBoard() {
  return `<section id="stage-review" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-sky-600">Review · Quality Gate</p><h2 class="text-xl font-black">大型預覽、品質檢查與核准</h2><p class="mt-1 text-xs font-bold text-slate-400">檢查透明度、碰邊、安全區、檔案大小與輸出命名，再核准進入 Package。</p></div><div class="flex flex-wrap gap-2"><button id="reviewPrevBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">← 上一張</button><button id="reviewNextBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">下一張 →</button><button id="toggleSafeGuideBtn" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">${state.settings.showSafeGuide?'隱藏':'顯示'}安全區</button><button id="toggleContentBoundsBtn" class="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">${state.settings.showContentBounds?'隱藏':'顯示'}內容邊界</button></div></div><div class="mt-4 grid gap-3 rounded-3xl bg-slate-50 p-4 lg:grid-cols-[1fr_190px_190px]"><label class="text-xs font-black text-slate-500">搜尋<input id="reviewSearchInput" value="${escapeHtml(state.settings.reviewSearch)}" placeholder="名稱、來源或檔名" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950"></label><label class="text-xs font-black text-slate-500">篩選<select id="reviewFilterInput" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950"><option value="all">全部</option><option value="errors">錯誤</option><option value="warnings">警告</option><option value="pending">待核准</option><option value="approved">已核准</option><option value="selected">要匯出</option><option value="excluded">已排除</option></select></label><label class="text-xs font-black text-slate-500">排序<select id="reviewSortInput" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950"><option value="frame-order">Frame 順序</option><option value="issue-severity">問題嚴重度</option><option value="file-size-desc">檔案大小</option><option value="name">名稱</option><option value="source">來源</option></select></label></div><div class="mt-3 flex flex-wrap items-center gap-2"><span class="text-[10px] font-black uppercase tracking-widest text-slate-400">預覽背景</span><button data-review-bg="checker" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">透明格</button><button data-review-bg="white" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">白</button><button data-review-bg="black" class="review-bg rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">黑</button><button data-review-bg="sticker-preview" class="review-bg rounded-xl bg-[#06c755] px-3 py-2 text-xs font-black text-white">貼圖綠</button><span class="ml-auto text-[10px] font-bold text-slate-400">滾輪縮放 · 拖曳平移 · ← → 切換</span><button id="reviewZoomOutBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">−</button><button id="reviewZoomResetBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">${Math.round(state.reviewView.zoom*100)}%</button><button id="reviewZoomInBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">＋</button></div><div class="mt-4 grid gap-4 lg:grid-cols-[1fr_250px]"><div id="reviewHeroStage" class="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-200 touch-none" style="position:relative;min-height:360px;overflow:hidden;touch-action:none"><div id="reviewTransformLayer" class="pointer-events-none absolute left-1/2 top-1/2 h-full w-full origin-center" style="position:absolute;left:50%;top:50%;width:100%;height:100%;pointer-events:none;transform-origin:center;transform:${refineViewTransform(state.reviewView)}"><img id="reviewHeroImage" class="absolute inset-0 h-full w-full object-contain" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none"><div id="reviewSafeGuide" class="pointer-events-none absolute border-2 border-rose-500 bg-rose-500/10" style="position:absolute;pointer-events:none"></div><div id="reviewContentBounds" class="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/10" style="position:absolute;pointer-events:none"></div></div></div><div id="reviewHeroMeta" class="rounded-3xl bg-slate-950 p-4 text-sm text-white"></div></div><div class="mt-4 flex flex-wrap gap-2"><button id="reviewSelectAllBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">篩選結果全選</button><button id="reviewSelectNoneBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">篩選結果排除</button><button id="reviewInvertBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">反選</button><button id="reviewApproveCleanBtn" class="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950">核准無錯誤項目</button><button id="reviewRevokeVisibleBtn" class="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">撤銷篩選結果核准</button></div><div id="reviewProgressBar" class="mt-4"></div><div id="reviewGrid" class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5"></div></section>`;
}

function renderPackageBoard() {
  return '<div id="packageWorkspaceRoot"></div>';
}

function renderSourceListPanel() {
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Document Engine</p><h2 class="mt-1 text-xl font-black">原圖清單</h2><div id="sourceList" class="mt-4 space-y-2"></div></section>`;
}

function renderSelectedPanel() {
  const frame = selectedFrame();
  return `<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Selected Frame</p><div id="selectedInfo" class="mt-4 text-sm text-slate-500">尚未選取</div><div class="mt-4 grid grid-cols-2 gap-2">${numberInput('offsetXInput','輸出 Offset X',frame?.custom?.offsetX||0,-4096,4096)}${numberInput('offsetYInput','輸出 Offset Y',frame?.custom?.offsetY||0,-4096,4096)}</div><div class="mt-2 grid grid-cols-4 gap-2"><button data-nudge-x="-1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">←</button><button data-nudge-y="-1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">↑</button><button data-nudge-y="1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">↓</button><button data-nudge-x="1" class="nudge-btn rounded-xl bg-slate-100 py-2 text-xs font-black">→</button></div><button id="resetOffsetBtn" class="mt-2 w-full rounded-xl bg-emerald-50 py-2 text-xs font-black text-emerald-800">圖案置中最大化</button><div class="mt-4 grid grid-cols-2 gap-2"><button id="duplicateBtn" class="rounded-xl bg-slate-100 py-2 text-xs font-black">複製</button><button id="deleteBtn" class="rounded-xl bg-rose-50 py-2 text-xs font-black text-rose-700">刪除</button></div></section>`;
}

function renderReviewPanel() {
  return `<section class="rounded-[1.75rem] border border-sky-200 bg-sky-950 p-5 text-white shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-sky-300">Review · Inspector</p><h2 class="mt-1 text-lg font-black">品質門檻</h2><div id="reviewGateStatus" class="mt-4"></div><div class="mt-3 grid grid-cols-2 gap-2"><button id="reviewApproveCurrentBtn" class="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950">核准目前</button><button id="reviewRevokeCurrentBtn" class="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">撤銷目前</button></div><button id="reviewNextIssueBtn" class="mt-2 w-full rounded-xl bg-sky-500/20 px-3 py-2 text-xs font-black text-sky-100">前往下一個問題</button><div id="reviewIssueList" class="mt-4 max-h-[360px] space-y-2 overflow-auto"></div></section>`;
}

function renderPackagePanel() {
  return '<div id="packageSettingsRoot"></div>';
}

function layoutButton(mode,label){return `<button data-layout="${mode}" class="layout-btn rounded-xl px-2 py-2 text-xs font-black ${state.settings.layoutMode===mode?'bg-slate-950 text-white':'bg-slate-100'}">${label}</button>`;}
function alignButton(mode,label){return `<button data-align="${mode}" class="align-btn rounded-xl px-3 py-2 text-xs font-black ${state.settings.alignMode===mode?'bg-slate-950 text-white':'bg-slate-100'}">${label}</button>`;}
function numberInput(id,label,value,min,max){return `<label class="text-xs font-black text-slate-500">${label}<input id="${id}" type="number" min="${min}" max="${max}" value="${value}" class="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950"></label>`;}
function rangeInput(id,label,value,min,max){return `<label class="mt-3 block text-xs font-black text-slate-500"><span class="flex justify-between"><span>${label}</span><span id="${id}Value">${value}</span></span><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" class="mt-2 w-full accent-emerald-500"></label>`;}

// REFINE_FULL_COMPLETION
// REVIEW_FULL_COMPLETION
// PACKAGE_FULL_COMPLETION

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
  root.querySelector('#targetWInput')?.addEventListener('change',event=>state.destinationController?.updateActiveRoleRule('width',event.target.value));
  root.querySelector('#targetHInput')?.addEventListener('change',event=>state.destinationController?.updateActiveRoleRule('height',event.target.value));
  root.querySelector('#safeMarginInput')?.addEventListener('change',event=>state.destinationController?.updateActiveRoleRule('safeMargin',event.target.value));
  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;clearRenderCache();renderAll();rerenderShell(); }));
  root.querySelector('#chromaEnabledInput').addEventListener('change', event => updateRefineSetting('chromaEnabled',event.target.checked));
  root.querySelector('#chromaColorInput').addEventListener('input', event => updateRefineSetting('chromaColor',hexToRgb(event.target.value)));
  root.querySelector('#pickerBtn').addEventListener('click', () => { state.settings.maskTool = 'picker'; state.activeEditor='refine'; refreshMaskToolButtons(); });
  root.querySelector('#exteriorInput').addEventListener('change', event => updateRefineSetting('exteriorOnly',event.target.checked));
  root.querySelector('#despeckleInput').addEventListener('change', event => updateRefineSetting('autoDespeckle',event.target.checked));
  bindRange(root,'toleranceInput','tolerance');
  bindRange(root,'despeckleSizeInput','despeckleMinSize');
  bindRange(root,'shrinkInput','shrinkRadius');
  bindRange(root,'featherInput','featherRadius');
  bindRange(root,'borderSizeInput','whiteBorderSize');
  bindRange(root,'maskSizeInput','maskSize',false);
  bindRange(root,'maskOverlayOpacityInput','maskOverlayOpacity',false,drawRefineCanvas);
  root.querySelector('#borderInput').addEventListener('change', event => updateRefineSetting('whiteBorderEnabled',event.target.checked));
  root.querySelector('#borderColorInput').addEventListener('input', event => updateRefineSetting('borderColor',event.target.value));
  root.querySelector('#renderSelectedBtn').addEventListener('click', renderSelectedRefineNow);
  root.querySelector('#renderAllBtn').addEventListener('click', () => { clearRenderCache(); renderAll(); refresh(); });
  root.querySelector('#resetRefineSettingsBtn').addEventListener('click', resetRefineSettings);
  root.querySelectorAll('.mask-tool').forEach(button => button.addEventListener('click', () => { state.settings.maskTool = button.dataset.maskTool; state.activeEditor='refine'; refreshMaskToolButtons(); updateBrushCursor(); }));
  root.querySelectorAll('.magic-action').forEach(button=>button.addEventListener('click',()=>{state.settings.magicAction=button.dataset.magicAction;refreshMaskToolButtons();}));
  root.querySelector('#magicContiguousInput').addEventListener('change',event=>state.settings.magicContiguous=event.target.checked);
  root.querySelector('#maskOverlayInput').addEventListener('change',event=>{state.settings.maskOverlayVisible=event.target.checked;drawRefineCanvas();});
  root.querySelectorAll('.refine-view').forEach(button=>button.addEventListener('click',()=>{state.settings.refineViewMode=button.dataset.refineView;rerenderShell();}));
  root.querySelector('#maskUndoBtn').addEventListener('click', () => stepMaskHistory(-1));
  root.querySelector('#maskRedoBtn').addEventListener('click', () => stepMaskHistory(1));
  root.querySelector('#maskClearBtn').addEventListener('click', clearSelectedMask);
  root.querySelector('#resetSelectedRefineBtn').addEventListener('click', resetSelectedRefine);
  root.querySelector('#applyRefineBtn').addEventListener('click', applySelectedRefine);
  root.querySelector('#zoomOutBtn').addEventListener('click', () => setRefineZoom(state.refineView.zoom / 1.2));
  root.querySelector('#zoomResetBtn').addEventListener('click', () => resetRefineViewport());
  root.querySelector('#zoomInBtn').addEventListener('click', () => setRefineZoom(state.refineView.zoom * 1.2));
  root.querySelectorAll('.review-bg').forEach(button => button.addEventListener('click', () => { state.settings.reviewBackground = button.dataset.reviewBg; renderReviewGrid(); renderLargeReview(); refreshReviewControls(); }));
  root.querySelector('#toggleSafeGuideBtn').addEventListener('click',()=>{state.settings.showSafeGuide=!state.settings.showSafeGuide;renderLargeReview();root.querySelector('#toggleSafeGuideBtn').textContent=(state.settings.showSafeGuide?'隱藏':'顯示')+'安全區';});
  root.querySelector('#toggleContentBoundsBtn').addEventListener('click',()=>{state.settings.showContentBounds=!state.settings.showContentBounds;renderLargeReview();root.querySelector('#toggleContentBoundsBtn').textContent=(state.settings.showContentBounds?'隱藏':'顯示')+'內容邊界';});
  root.querySelector('#reviewSearchInput').addEventListener('input',event=>{state.settings.reviewSearch=event.target.value;renderReviewGrid();renderReviewProgress();});
  root.querySelector('#reviewFilterInput').addEventListener('change',event=>{state.settings.reviewFilter=event.target.value;renderReviewGrid();renderReviewProgress();});
  root.querySelector('#reviewSortInput').addEventListener('change',event=>{state.settings.reviewSort=event.target.value;renderReviewGrid();});
  root.querySelector('#reviewPrevBtn').addEventListener('click',()=>navigateReview(-1));
  root.querySelector('#reviewNextBtn').addEventListener('click',()=>navigateReview(1));
  root.querySelector('#reviewZoomOutBtn').addEventListener('click',()=>setReviewZoom(state.reviewView.zoom/1.2));
  root.querySelector('#reviewZoomResetBtn').addEventListener('click',resetReviewViewport);
  root.querySelector('#reviewZoomInBtn').addEventListener('click',()=>setReviewZoom(state.reviewView.zoom*1.2));
  root.querySelector('#reviewSelectAllBtn').addEventListener('click',()=>batchReviewExport('all'));
  root.querySelector('#reviewSelectNoneBtn').addEventListener('click',()=>batchReviewExport('none'));
  root.querySelector('#reviewInvertBtn').addEventListener('click',()=>batchReviewExport('invert'));
  root.querySelector('#reviewApproveCleanBtn').addEventListener('click',approveVisibleClean);
  root.querySelector('#reviewRevokeVisibleBtn').addEventListener('click',revokeVisibleApproval);
  root.querySelector('#reviewApproveCurrentBtn').addEventListener('click',()=>setCurrentReviewApproval(true));
  root.querySelector('#reviewRevokeCurrentBtn').addEventListener('click',()=>setCurrentReviewApproval(false));
  root.querySelector('#reviewNextIssueBtn').addEventListener('click',navigateNextIssue);
  bindReviewViewport(root.querySelector('#reviewHeroStage'));
  root.querySelector('#duplicateBtn').addEventListener('click', duplicateSelectedFrame);
  root.querySelector('#deleteBtn').addEventListener('click', deleteSelectedFrame);
  root.querySelector('#offsetXInput').addEventListener('change',event=>setSelectedOffset('offsetX',event.target.value));
  root.querySelector('#offsetYInput').addEventListener('change',event=>setSelectedOffset('offsetY',event.target.value));
  root.querySelectorAll('.nudge-btn').forEach(button=>button.addEventListener('click',()=>nudgeSelectedOffset(Number(button.dataset.nudgeX||0),Number(button.dataset.nudgeY||0))));
  root.querySelector('#resetOffsetBtn').addEventListener('click',resetSelectedOffset);
  root.querySelector('#exportZipBtn').addEventListener('click', () => state.packageController?.exportPackage());
  root.querySelector('#undoBtn').addEventListener('click', undoFrames);
  root.querySelector('#redoBtn').addEventListener('click', redoFrames);
  bindSourceCanvas(root.querySelector('#sourceCanvas'));
  bindRefineCanvas(root.querySelector('#refineCanvas'));
  bindRefineViewport(root.querySelector('#refineViewport'));
  bindGlobalEvents();
}

// DESTINATION_RULES_FULL_COMPLETION
function mountDestinationController(root){
  if(!state.destinationController){
    state.destinationController=createDestinationController({
      applyDestinationProfile:(profile,role,options={})=>{
        state.settings=applyDestinationProfileToSettings(state.settings,profile,role);
        if(options.updateFrames!==false)setFrames(normalizeFramesForDestination(frames(),profile,{invalidateApproval:options.invalidateApproval!==false}));
        clearRenderCache(options.invalidateApproval!==false);renderAll();
      },
      rerender:rerenderShell,
      downloadText:(text,name,type)=>downloadBlob(new Blob([text],{type}),name),
      alert:message=>window.alert(message),
      confirm:message=>window.confirm(message),
      prompt:(message,value)=>window.prompt(message,value)
    });
  }
  state.destinationController.mount(root);
}

function mountPackageController(root){
  if(!state.packageController){
    state.packageController=createPackageController({
      getExportFrames:exportFrames,
      ensureRendered:frame=>renderFrame(frame),
      getPackagePlan:list=>packagePlan(list),
      getRenderedMap:()=>state.rendered,
      getSourceNames:reviewSourceNames,
      getReviewReport:()=>{runReview();return state.reviewReport;},
      getOutputMetadata:()=>{const profile=state.destinationController?.getActiveProfile?.();return{documentId:state.document.id,documentName:state.document.name,targetW:state.settings.targetW,targetH:state.settings.targetH,category:state.settings.stickerCategory,safeMargin:state.settings.safeMargin,destinationKey:profile?.key||'workshop-flexible',destinationVersion:profile?.version||'1.0.0'};},
      getNamingSettings:()=>({mode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,maxFileSizeKB:state.settings.maxFileSizeKB}),
      updateNamingSetting:(key,value)=>{
        if(key==='mode')state.settings.packageNamingMode=value;
        if(key==='prefix')state.settings.filenamePrefix=value;
        if(key==='suffix')state.settings.filenameSuffix=value;
        if(key==='maxFileSizeKB')state.settings.maxFileSizeKB=Math.max(1,Number(value)||DEFAULT_MAX_FILE_SIZE_KB);
        runReview();refresh();
      },
      assignRoles:mode=>{
        const selected=exportFrames(),profile=state.destinationController?.getActiveProfile?.();
        if(!profile)return false;
        const fallback=profile.roles.find(role=>role.key===AssetRoles.STICKER)?.key||profile.roles[0].key;
        const required=[],optional=[];
        profile.roles.filter(role=>role.key!==fallback).forEach(role=>{
          const count=role.exact??(role.required?Math.max(1,role.min||1):0);
          for(let i=0;i<count;i++)required.push(role.key);
          if(!count&&(role.max==null||role.max>0))optional.push(role.key);
        });
        const minimumSticker=profile.roles.find(role=>role.key===fallback)?.min||1;
        if(mode==='auto'&&selected.length<required.length+minimumSticker){window.alert(`此 Profile 至少需要 ${required.length+minimumSticker} 張輸出。`);return false;}
        const optionalCapacity=Math.max(0,selected.length-required.length-minimumSticker);
        const assignments=mode==='auto'?[...required,...optional.slice(0,optionalCapacity)]:[];
        const selectedIds=new Set(selected.map(frame=>frame.id));
        setFrames(frames().map(frame=>{
          if(!selectedIds.has(frame.id))return frame;
          const index=selected.findIndex(item=>item.id===frame.id);
          const role=mode==='auto'?(assignments[index]||fallback):fallback;
          return{...frame,state:{...frame.state,packageRole:role,reviewApproved:false},custom:{...frame.custom,outputRole:role}};
        }));
        clearRenderCache();renderAll();refresh();return true;
      },
      downloadSelectedPng,
      openFrame:frameId=>{selectFrame(frameId);state.activeEditor='review';refresh();document.getElementById('stage-review')?.scrollIntoView({behavior:'smooth',block:'start'});},
      getJSZipClass:()=>window.JSZip,
      downloadBlob,
      downloadDataUrl,
      downloadText:(text,name,type)=>downloadBlob(new Blob([text],{type}),name),
      alert:message=>window.alert(message)
    });
  }
  state.packageController.mount(root);
}

// DOCUMENT_PROJECT_FULL_COMPLETION
function mountProjectController(root){
  if(!state.projectController){
    state.projectController=createProjectController({
      captureProjectSnapshot,
      restoreProjectSnapshot,
      resetProject:resetProjectState,
      renameProject,
      getProjectInfo:()=>({id:state.document.id,name:state.document.name,updatedAt:state.document.updatedAt}),
      getProjectFingerprint,
      isProjectEmpty:()=>state.sources.size===0&&frames().length===0,
      getProjectPreviewDataUrl,
      getJSZipClass:()=>window.JSZip,
      downloadBlob,
      alert:message=>window.alert(message),
      confirm:message=>window.confirm(message),
      prompt:(message,value)=>window.prompt(message,value)
    });
  }
  state.projectController.mount(root);
}

async function captureProjectSnapshot(){
  return createWorkshopProjectSnapshot({
    document:state.document,
    settings:state.settings,
    sources:state.sources,
    sourceLayouts:state.sourceLayouts,
    selectedFrameBySource:state.selectedFrameBySource,
    activeSourceId:state.activeSourceId,
    selectedFrameId:state.selectedFrameId,
    packageState:state.packageController?.exportState?.()||null,
    destinationState:state.destinationController?.exportState?.()||null,
    metadata:{previewDataUrl:getProjectPreviewDataUrl()}
  });
}

async function restoreProjectSnapshot(snapshot){
  const restoredSources=new Map();
  for(const source of snapshot.sources||[]){
    if(!source.uri)throw new Error(`來源圖片缺失：${source.name||source.id}`);
    const img=await loadImage(source.uri);
    restoredSources.set(source.id,{...source,img,fileName:source.fileName||source.name});
  }
  const restoredFrames=[];
  for(const frame of snapshot.document?.frames||[]){
    const custom={...(frame.custom||{})};
    const mask=custom.protectMask;
    delete custom.protectMask;
    if(mask?.dataUrl){
      const maskImage=await loadImage(mask.dataUrl);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Number(mask.width)||maskImage.width||Math.round(frame.geometry?.width)||1);
      canvas.height=Math.max(1,Number(mask.height)||maskImage.height||Math.round(frame.geometry?.height)||1);
      canvas.getContext('2d').drawImage(maskImage,0,0,canvas.width,canvas.height);
      custom.protectMaskCanvas=canvas;
    }
    restoredFrames.push({...frame,custom});
  }
  state.document={...snapshot.document,id:snapshot.id||snapshot.document.id,name:snapshot.name||snapshot.document.name,frames:restoredFrames,sourceRefs:(snapshot.sources||[]).map(source=>{const{img,...ref}=source;return ref;})};
  state.sources=restoredSources;
  state.sourceLayouts=new Map(snapshot.sourceLayouts||[]);
  state.selectedFrameBySource=new Map(snapshot.selectedFrameBySource||[]);
  state.settings={...cloneDefaultSettings(),...(snapshot.settings||{})};
  state.activeSourceId=snapshot.ui?.activeSourceId&&restoredSources.has(snapshot.ui.activeSourceId)?snapshot.ui.activeSourceId:[...restoredSources.keys()][0]||null;
  state.selectedFrameId=(snapshot.ui?.selectedFrameId&&restoredFrames.some(frame=>frame.id===snapshot.ui.selectedFrameId))?snapshot.ui.selectedFrameId:restoredFrames[0]?.id||null;
  state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;state.maskHistories.clear();state.refineAppliedAt.clear();
  resetFrameHistory();resetRefineViewport();resetReviewViewport();
  state.destinationController?.importState?.(snapshot.destinationState||null);
  state.packageController?.importState?.(snapshot.packageState||null);
  clearRenderCache(false);renderAll();rerenderShell();
}

async function resetProjectState(){
  state.document=createDocument({name:'Sticker Package Project'});
  state.sources=new Map();state.sourceLayouts=new Map();state.selectedFrameBySource=new Map();state.activeSourceId=null;state.selectedFrameId=null;
  state.settings=cloneDefaultSettings();state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;state.maskHistories.clear();state.refineAppliedAt.clear();
  state.destinationController?.importState?.(null);state.packageController?.importState?.(null);resetFrameHistory();resetRefineViewport();resetReviewViewport();rerenderShell();
}

function renameProject(name){state.document={...state.document,name:String(name||'Untitled Project'),updatedAt:new Date().toISOString()};}
function cloneDefaultSettings(){return typeof structuredClone==='function'?structuredClone(DEFAULT_SETTINGS):JSON.parse(JSON.stringify(DEFAULT_SETTINGS));}
function getProjectPreviewDataUrl(){const frame=selectedFrame()||frames()[0];const canvas=frame?renderFrame(frame):null;return canvas?.toDataURL?.('image/png')||activeSource()?.uri||null;}
async function getProjectFingerprint(){
  const frameState=frames().map(frame=>({id:frame.id,sourceImageId:frame.sourceImageId,geometry:frame.geometry,state:frame.state,custom:{offsetX:frame.custom?.offsetX||0,offsetY:frame.custom?.offsetY||0,maskVersion:frame.custom?.maskVersion||0,outputRole:frame.custom?.outputRole||null}}));
  return JSON.stringify({id:state.document.id,name:state.document.name,sources:[...state.sources.values()].map(source=>({id:source.id,name:source.name,width:source.width,height:source.height,uriLength:source.uri?.length||0})),layouts:[...state.sourceLayouts.entries()],frames:frameState,settings:state.settings,destinationState:state.destinationController?.exportState?.()||null,packageState:state.packageController?.exportState?.()||null});
}

function rerenderShell(){const root=document.getElementById('app');root.innerHTML=renderShell();bindStaticEvents(root);mountDestinationController(root);mountPackageController(root);mountProjectController(root);refresh();}
function bindRange(root,id,key,render=true,afterChange=null){root.querySelector(`#${id}`).addEventListener('input',event=>{state.settings[key]=Number(event.target.value);const label=root.querySelector(`#${id}Value`);if(label)label.textContent=event.target.value;if(render){clearRenderCache();renderSelectedRefineNow(false);scheduleRenderAll();}if(afterChange)afterChange();});}
function updateRefineSetting(key,value){state.settings[key]=value;clearRenderCache();renderSelectedRefineNow(false);scheduleRenderAll();}
function scheduleRenderAll(delay=90){if(state.refineRenderTimer)clearTimeout(state.refineRenderTimer);state.refineRenderTimer=setTimeout(()=>{state.refineRenderTimer=null;clearRenderCache();renderAll();refresh();},delay);}
function valueOf(id,fallback){const value=Number(document.getElementById(id)?.value);return Number.isFinite(value)?value:fallback;}

function readGridSettings(){state.settings.rows=valueOf('rowsInput',1);state.settings.cols=valueOf('colsInput',1);state.settings.marginX=valueOf('marginXInput',0);state.settings.marginY=valueOf('marginYInput',0);state.settings.gapX=valueOf('gapXInput',0);state.settings.gapY=valueOf('gapYInput',0);saveActiveSourceLayout();}
function setLayoutMode(mode){state.settings.layoutMode=mode;if(mode==='1x1'){state.settings.rows=1;state.settings.cols=1;}if(mode==='2x2'){state.settings.rows=2;state.settings.cols=2;}if(mode==='3x3'){state.settings.rows=3;state.settings.cols=3;}saveActiveSourceLayout();rerenderShell();}
function saveActiveSourceLayout(){if(state.activeSourceId)state.sourceLayouts.set(state.activeSourceId,createSourceLayoutSettings(state.settings));}
function sourceLayout(sourceId){return state.sourceLayouts.get(sourceId)||createSourceLayoutSettings(state.settings);}
function activateSource(sourceId){
  if(!state.sources.has(sourceId))return;
  resetRefineViewport();
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
  if(state.selectedFrameId!==frame.id)resetRefineViewport();
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
  previousFrames.forEach(frame=>state.maskHistories.delete(frame.id));
  resetFrameHistory(); clearRenderCache(); renderAll();
}

function frames(){return state.document.frames;}
function setFrames(next){state.document=setDocumentFrames(state.document,next);}
function activeSource(){return state.sources.get(state.activeSourceId)||null;}
function selectedFrame(){return frames().find(frame=>frame.id===state.selectedFrameId)||null;}
function sourceForFrame(frame){return frame?state.sources.get(frame.sourceImageId)||null:null;}
function exportFrames(){return frames().filter(frame=>frame.state?.visible!==false&&frame.state?.exportSelected!==false);}

function getRenderOptions(frame=null){
  const output=state.destinationController?.getFrameOutput?.(frame)||{width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin};
  return{targetW:output.width,targetH:output.height,safeMargin:output.safeMargin,alignMode:state.settings.alignMode,highQuality:true,refine:{enabled:true,chromaEnabled:state.settings.chromaEnabled,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance,exteriorOnly:state.settings.exteriorOnly,autoDespeckle:state.settings.autoDespeckle,despeckle:{minComponentSize:state.settings.despeckleMinSize},shrinkRadius:state.settings.shrinkRadius,featherRadius:state.settings.featherRadius,whiteBorder:{enabled:state.settings.whiteBorderEnabled,size:state.settings.whiteBorderSize,color:state.settings.borderColor},shadow:{enabled:false}}};
}
function renderFrame(frame,force=false){const source=sourceForFrame(frame);if(!source)return null;const options=getRenderOptions(frame);const key=JSON.stringify({source:source.id,geometry:frame.geometry,offsetX:frame.custom?.offsetX||0,offsetY:frame.custom?.offsetY||0,maskVersion:frame.custom?.maskVersion||0,options});if(!force&&state.rendered.has(frame.id)&&state.renderKeys.get(frame.id)===key)return state.rendered.get(frame.id);const canvas=renderWorkshopFrame(source,frame,options).canvas;state.rendered.set(frame.id,canvas);state.renderKeys.set(frame.id,key);return canvas;}

function renderAll(){frames().forEach(frame=>renderFrame(frame));runReview();}
function clearRenderCache(invalidateApprovals=true){state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;if(invalidateApprovals)invalidateAllReviewApprovals();}
function runReview(){
  const selected=exportFrames();selected.forEach(frame=>renderFrame(frame));
  const plan=packagePlan(selected);
  const outputRulesByFrame=new Map(plan.items.map(item=>[item.artworkId,{targetW:item.expectedWidth,targetH:item.expectedHeight,safeMargin:item.safeMargin,maxFileSizeBytes:item.maxFileSizeBytes}]));
  const report=runFullReview(frames(),state.rendered,{targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,safeAreaMargin:state.settings.safeMargin,maxFileSizeKB:state.settings.maxFileSizeKB,outputRulesByFrame,packageItems:plan.items,requireTransparency:true});
  const packageIssues=[...plan.validation.errors,...plan.validation.warnings].map(issue=>({...issue,id:issue.id||createId('issue'),frameId:issue.frameId||null,metadata:issue.metadata||{}}));
  const issues=[...report.issues,...packageIssues];
  const summary={total:issues.length,errors:issues.filter(issue=>issue.severity==='error').length,warnings:issues.filter(issue=>issue.severity==='warning').length,info:issues.filter(issue=>issue.severity==='info').length};
  state.reviewReport={...report,issues,summary,ready:report.allSelectedApproved&&summary.errors===0&&plan.ready,canPackage:report.allSelectedApproved&&summary.errors===0&&plan.ready,packagePlan:plan};
}

function refresh(){drawSourceCanvas();drawRefineCanvas();renderSourceList();renderReviewGrid();renderLargeReview();renderSelectedInfo();renderReviewSummary();renderReviewInspector();renderReviewProgress();refreshReviewControls();state.packageController?.refresh();state.projectController?.refresh();refreshMaskToolButtons();refreshMaskHistoryButtons();updateRefineTransform();updateReviewTransform();const status=document.getElementById('sourceStatus');if(status){const source=activeSource();status.textContent=source?`${source.name} · ${frames().filter(frame=>frame.sourceImageId===source.id).length} Frames`:'尚未匯入';}const undoBtn=document.getElementById('undoBtn');const redoBtn=document.getElementById('redoBtn');if(undoBtn)undoBtn.disabled=!canUndo(state.frameHistory);if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}

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
function sourcePointerDown(event){state.activeEditor='layout';const source=activeSource();if(!source)return;const point=canvasPoint(event);if(state.settings.maskTool==='picker'){pickColorFromSource(point);return;}const hit=hitTestFrame(point);if(!hit)return;selectFrame(hit.frame.id);state.frameDrag={frameId:hit.frame.id,handle:hit.handle,start:point,startGeometry:{...hit.frame.geometry},before:frameSnapshot()};event.currentTarget.setPointerCapture?.(event.pointerId);refresh();}
function sourcePointerMove(event){if(!state.frameDrag)return;const point=canvasPoint(event);const drag=state.frameDrag;const frame=frames().find(item=>item.id===drag.frameId);if(!frame)return;const dx=point.x-drag.start.x,dy=point.y-drag.start.y;const geometry=resizeGeometry(drag.startGeometry,drag.handle,dx,dy);replaceFrame({...frame,geometry:clampGeometry(geometry,activeSource())});drawSourceCanvas();}
function sourcePointerUp(){if(!state.frameDrag)return;const drag=state.frameDrag;state.frameDrag=null;let frame=frames().find(item=>item.id===drag.frameId);if(frame&&sourceLayout(frame.sourceImageId).smartSnap)frame=smartSnapFrameToContent(sourceForFrame(frame),frame,{searchPadding:12,padding:4,chromaColor:state.settings.chromaColor,tolerance:state.settings.tolerance});if(frame){const mask=frame.custom?.protectMaskCanvas;if(mask&&(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height)))frame={...frame,custom:{...frame.custom,protectMaskCanvas:resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height),maskVersion:(frame.custom.maskVersion||0)+1}};replaceFrame(frame);}commitFrameChange(drag.handle==='move'?'Move Frame':'Resize Frame',drag.before,frameSnapshot());clearRenderCache();renderAll();refresh();}
function canvasPoint(event){const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
function hitTestFrame(point){const list=frames().filter(frame=>frame.sourceImageId===state.activeSourceId);const selected=selectedFrame();if(selected&&selected.sourceImageId===state.activeSourceId){const handle=hitHandle(point,selected.geometry);if(handle)return{frame:selected,handle};}for(let index=list.length-1;index>=0;index--){const frame=list[index],g=frame.geometry;if(point.x>=g.x&&point.x<=g.x+g.width&&point.y>=g.y&&point.y<=g.y+g.height)return{frame,handle:'move'};}return null;}
function handlePoints(g){return[{name:'nw',x:g.x,y:g.y},{name:'n',x:g.x+g.width/2,y:g.y},{name:'ne',x:g.x+g.width,y:g.y},{name:'e',x:g.x+g.width,y:g.y+g.height/2},{name:'se',x:g.x+g.width,y:g.y+g.height},{name:'s',x:g.x+g.width/2,y:g.y+g.height},{name:'sw',x:g.x,y:g.y+g.height},{name:'w',x:g.x,y:g.y+g.height/2}];}
function hitHandle(point,g){return handlePoints(g).find(item=>Math.abs(point.x-item.x)<=HANDLE_SIZE&&Math.abs(point.y-item.y)<=HANDLE_SIZE)?.name||null;}
function resizeGeometry(start,handle,dx,dy){let{x,y,width,height}=start;if(handle==='move')return{x:x+dx,y:y+dy,width,height};if(handle.includes('e'))width+=dx;if(handle.includes('s'))height+=dy;if(handle.includes('w')){x+=dx;width-=dx;}if(handle.includes('n')){y+=dy;height-=dy;}if(width<MIN_FRAME_SIZE){if(handle.includes('w'))x-=MIN_FRAME_SIZE-width;width=MIN_FRAME_SIZE;}if(height<MIN_FRAME_SIZE){if(handle.includes('n'))y-=MIN_FRAME_SIZE-height;height=MIN_FRAME_SIZE;}return{x,y,width,height};}
function clampGeometry(g,source){const width=Math.min(g.width,source.width),height=Math.min(g.height,source.height);return{x:Math.max(0,Math.min(g.x,source.width-width)),y:Math.max(0,Math.min(g.y,source.height-height)),width,height};}
function replaceFrame(next,{preserveReview=false}={}){const previous=frames().find(frame=>frame.id===next.id);let value=next;if(!preserveReview&&previous?.state?.reviewApproved&&frameReviewSignature(previous)!==frameReviewSignature(next))value=setFrameReviewApproval(next,false);setFrames(frames().map(frame=>frame.id===value.id?value:frame));}
function frameReviewSignature(frame){return JSON.stringify({geometry:frame.geometry,offsetX:frame.custom?.offsetX||0,offsetY:frame.custom?.offsetY||0,maskVersion:frame.custom?.maskVersion||0});}

function drawRefineCanvas(updateOutput=true){
  const canvas=document.getElementById('refineCanvas');if(!canvas)return;
  const outputCanvas=document.getElementById('refineOutputCanvas');
  const status=document.getElementById('refineStatus');
  const frame=selectedFrame(),source=sourceForFrame(frame),ctx=canvas.getContext('2d');
  if(!frame||!source){canvas.width=1;canvas.height=1;ctx.clearRect(0,0,1,1);if(outputCanvas){outputCanvas.width=1;outputCanvas.height=1;outputCanvas.getContext('2d').clearRect(0,0,1,1);}if(status)status.textContent='尚未選取 Frame';return;}
  canvas.dataset.frameId=frame.id;
  canvas.width=Math.max(1,Math.round(frame.geometry.width));canvas.height=Math.max(1,Math.round(frame.geometry.height));
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);
  const mask=frame.custom?.protectMaskCanvas;
  if(mask&&state.settings.maskOverlayVisible){ctx.save();ctx.globalAlpha=state.settings.maskOverlayOpacity/100;ctx.drawImage(mask,0,0,canvas.width,canvas.height);ctx.restore();}
  const rendered=updateOutput?renderFrame(frame):state.rendered.get(frame.id);
  if(outputCanvas&&rendered){outputCanvas.width=rendered.width;outputCanvas.height=rendered.height;const outCtx=outputCanvas.getContext('2d');outCtx.clearRect(0,0,outputCanvas.width,outputCanvas.height);outCtx.drawImage(rendered,0,0);}
  const stats=mask?getMaskStats(mask):{total:canvas.width*canvas.height,keep:0,delete:0,marked:0,coverage:0,hasEdits:false};
  const kb=rendered?Math.ceil(estimateCanvasPngBytes(rendered)/1024):0;
  const applied=state.refineAppliedAt.get(frame.id);
  if(status)status.innerHTML=`<span class="text-emerald-300">${escapeHtml(frame.name)}</span> · 保留 ${stats.keep}px · 刪除 ${stats.delete}px · 標記 ${(stats.coverage*100).toFixed(1)}% · 成品 ${kb}KB${applied?` · 已套用 ${new Date(applied).toLocaleTimeString()}`:''}`;
}
function bindRefineCanvas(canvas){canvas.addEventListener('pointerdown',refinePointerDown);canvas.addEventListener('pointermove',refinePointerMove);canvas.addEventListener('pointerup',refinePointerUp);canvas.addEventListener('pointercancel',refinePointerUp);canvas.addEventListener('pointerleave',event=>{updateBrushCursor();if(!state.maskStroke)state.refinePointer=null;});}
function refinePointerDown(event){
  state.activeEditor='refine';
  const frame=selectedFrame();if(!frame||state.settings.maskTool==='view'||state.isSpaceDown||event.button===1)return;
  const point=canvasPoint(event);state.refinePointer={clientX:event.clientX,clientY:event.clientY};updateBrushCursor(event);
  if(state.settings.maskTool==='picker'){pickColorFromRefine(point);return;}
  const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);
  if(state.settings.maskTool==='magic'){
    const raw=createRawCropCanvas(frame);
    applyMagicMask(raw,mask,point.x,point.y,{action:state.settings.magicAction,tolerance:state.settings.tolerance,contiguous:state.settings.magicContiguous});
    touchMask(frame,mask,true);commitMaskHistory(frame.id,mask);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();return;
  }
  const action=state.settings.maskTool==='keep'?MaskActions.KEEP:state.settings.maskTool==='clear'?MaskActions.CLEAR:MaskActions.DELETE;
  state.maskStroke={frameId:frame.id,last:point,action};
  event.currentTarget.setPointerCapture?.(event.pointerId);
  paintMaskStroke(mask,point,point,{action,size:state.settings.maskSize});touchMask(frame,mask,false);drawRefineCanvas(false);
}
function refinePointerMove(event){state.refinePointer={clientX:event.clientX,clientY:event.clientY};updateBrushCursor(event);if(!state.maskStroke)return;const frame=selectedFrame();if(!frame||frame.id!==state.maskStroke.frameId)return;const point=canvasPoint(event),mask=ensureFrameMask(frame);paintMaskStroke(mask,state.maskStroke.last,point,{action:state.maskStroke.action,size:state.settings.maskSize});state.maskStroke.last=point;touchMask(frame,mask,false);drawRefineCanvas(false);}
function refinePointerUp(){if(!state.maskStroke)return;const frame=frames().find(item=>item.id===state.maskStroke.frameId),mask=frame?.custom?.protectMaskCanvas;state.maskStroke=null;if(frame&&mask){touchMask(frame,mask,true);commitMaskHistory(frame.id,mask);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();}}
function ensureFrameMask(frame){let mask=frame.custom?.protectMaskCanvas;if(!mask)mask=createMaskCanvas(frame.geometry.width,frame.geometry.height);else if(mask.width!==Math.round(frame.geometry.width)||mask.height!==Math.round(frame.geometry.height))mask=resizeMaskCanvas(mask,frame.geometry.width,frame.geometry.height);touchMask(frame,mask,false);return mask;}
function touchMask(frame,mask,increment=true){replaceFrame({...frame,custom:{...frame.custom,protectMaskCanvas:mask,maskVersion:(frame.custom?.maskVersion||0)+(increment?1:0)}});}
function createRawCropCanvas(frame){const source=sourceForFrame(frame),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(frame.geometry.width));canvas.height=Math.max(1,Math.round(frame.geometry.height));canvas.getContext('2d').drawImage(source.img,frame.geometry.x,frame.geometry.y,frame.geometry.width,frame.geometry.height,0,0,canvas.width,canvas.height);return canvas;}
function ensureMaskHistory(frameId,mask){if(!state.maskHistories.has(frameId))state.maskHistories.set(frameId,{items:[captureMaskSnapshot(mask)],index:0});}
function commitMaskHistory(frameId,mask){ensureMaskHistory(frameId,mask);const history=state.maskHistories.get(frameId);history.items=history.items.slice(0,history.index+1);history.items.push(captureMaskSnapshot(mask));if(history.items.length>30)history.items.shift();history.index=history.items.length-1;refreshMaskHistoryButtons();}
function canStepMaskHistory(direction){const frame=selectedFrame(),history=frame&&state.maskHistories.get(frame.id);if(!history)return false;return direction<0?history.index>0:history.index<history.items.length-1;}
function stepMaskHistory(direction){const frame=selectedFrame();if(!frame||!canStepMaskHistory(direction))return false;const mask=ensureFrameMask(frame),history=state.maskHistories.get(frame.id);history.index+=direction;restoreMaskSnapshot(mask,history.items[history.index]);touchMask(frame,mask,true);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();return true;}
function clearSelectedMask(){const frame=selectedFrame();if(!frame)return;const mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);clearMask(mask);touchMask(frame,mask,true);commitMaskHistory(frame.id,mask);clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();}
function resetSelectedRefine(){const frame=selectedFrame();if(!frame)return;const before=frameSnapshot(),mask=ensureFrameMask(frame);ensureMaskHistory(frame.id,mask);clearMask(mask);const next={...frame,custom:{...frame.custom,protectMaskCanvas:mask,maskVersion:(frame.custom?.maskVersion||0)+1,offsetX:0,offsetY:0}};replaceFrame(next);commitMaskHistory(frame.id,mask);commitFrameChange('Reset Selected Refine',before,frameSnapshot());state.refineAppliedAt.delete(frame.id);resetRefineViewport();clearFrameRender(frame.id);renderSelectedRefineNow(false);refresh();}
function resetRefineSettings(){['chromaEnabled','chromaColor','tolerance','exteriorOnly','autoDespeckle','despeckleMinSize','shrinkRadius','featherRadius','whiteBorderEnabled','whiteBorderSize','borderColor'].forEach(key=>state.settings[key]=Array.isArray(DEFAULT_SETTINGS[key])?[...DEFAULT_SETTINGS[key]]:DEFAULT_SETTINGS[key]);clearRenderCache();renderAll();rerenderShell();}
function renderSelectedRefineNow(refreshUi=true){const frame=selectedFrame();if(!frame)return;clearFrameRender(frame.id);renderFrame(frame,true);runReview();if(refreshUi)refresh();else{drawRefineCanvas();renderLargeReview();renderReviewSummary();}}
function applySelectedRefine(){const frame=selectedFrame();if(!frame)return;renderSelectedRefineNow(false);state.refineAppliedAt.set(frame.id,Date.now());refresh();}
function clearFrameRender(frameId){state.rendered.delete(frameId);state.renderKeys.delete(frameId);invalidateFrameReviewApproval(frameId);}
function invalidateAllReviewApprovals(){setFrames(frames().map(frame=>frame.state?.reviewApproved?setFrameReviewApproval(frame,false):frame));}
function invalidateFrameReviewApproval(frameId){setFrames(frames().map(frame=>frame.id===frameId&&frame.state?.reviewApproved?setFrameReviewApproval(frame,false):frame));}
function setRefineZoom(value,anchor={x:0,y:0}){state.refineView=zoomRefineView(state.refineView,value,anchor);state.settings.refineZoom=state.refineView.zoom;updateRefineTransform();}
function resetRefineViewport(){state.refineView=resetRefineView(state.refineView);state.settings.refineZoom=1;updateRefineTransform();}
function updateRefineTransform(){const layer=document.getElementById('refineTransformLayer');if(layer)layer.style.transform=refineViewTransform(state.refineView);const button=document.getElementById('zoomResetBtn');if(button)button.textContent=`${Math.round(state.refineView.zoom*100)}%`;}
function bindRefineViewport(viewport){if(!viewport)return;viewport.addEventListener('wheel',refineWheel,{passive:false});viewport.addEventListener('pointerdown',refineViewportPointerDown,true);viewport.addEventListener('pointermove',refineViewportPointerMove,true);viewport.addEventListener('pointerup',refineViewportPointerUp,true);viewport.addEventListener('pointercancel',refineViewportPointerUp,true);viewport.addEventListener('pointerleave',event=>{if(state.refinePan)refineViewportPointerUp(event);state.refinePointer=null;updateBrushCursor();},true);}
function refineWheel(event){event.preventDefault();state.activeEditor='refine';const rect=event.currentTarget.getBoundingClientRect(),anchor={x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2};setRefineZoom(state.refineView.zoom*(event.deltaY>0?.9:1.1),anchor);}
function refineViewportPointerDown(event){const shouldPan=state.settings.maskTool==='view'||state.isSpaceDown||event.button===1;if(!shouldPan)return;event.preventDefault();event.stopPropagation();state.activeEditor='refine';state.refinePan={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originX:state.refineView.panX,originY:state.refineView.panY};event.currentTarget.setPointerCapture?.(event.pointerId);event.currentTarget.style.cursor='grabbing';}
function refineViewportPointerMove(event){state.refinePointer={clientX:event.clientX,clientY:event.clientY};if(state.refinePan){event.preventDefault();event.stopPropagation();state.refineView={...state.refineView,panX:state.refinePan.originX+event.clientX-state.refinePan.startX,panY:state.refinePan.originY+event.clientY-state.refinePan.startY};updateRefineTransform();}else updateBrushCursor(event);}
function refineViewportPointerUp(event){if(!state.refinePan)return;event.preventDefault?.();event.stopPropagation?.();state.refinePan=null;const viewport=document.getElementById('refineViewport');if(viewport)viewport.style.cursor=state.settings.maskTool==='view'?'grab':'';}
function updateBrushCursor(event=null){const cursor=document.getElementById('refineBrushCursor'),viewport=document.getElementById('refineViewport');if(!cursor||!viewport)return;if(event)state.refinePointer={clientX:event.clientX,clientY:event.clientY};const pointer=state.refinePointer,tool=state.settings.maskTool;if(!pointer||tool==='view'||tool==='picker'||state.refinePan){cursor.classList.add('hidden');return;}const rect=viewport.getBoundingClientRect(),size=tool==='magic'?18:Math.max(6,state.settings.maskSize*state.refineView.zoom);cursor.classList.remove('hidden');cursor.style.width=`${size}px`;cursor.style.height=`${size}px`;cursor.style.left=`${pointer.clientX-rect.left-size/2}px`;cursor.style.top=`${pointer.clientY-rect.top-size/2}px`;cursor.style.borderColor=tool==='keep'?'#22c55e':tool==='clear'?'#f8fafc':'#ef4444';}
function refreshMaskToolButtons(){document.querySelectorAll('.mask-tool').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.maskTool===state.settings.maskTool));document.querySelectorAll('.magic-action').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.magicAction===state.settings.magicAction));document.querySelectorAll('.refine-view').forEach(button=>button.classList.toggle('bg-emerald-300',button.dataset.refineView===state.settings.refineViewMode));}
function refreshMaskHistoryButtons(){const undoButton=document.getElementById('maskUndoBtn'),redoButton=document.getElementById('maskRedoBtn');if(undoButton)undoButton.disabled=!canStepMaskHistory(-1);if(redoButton)redoButton.disabled=!canStepMaskHistory(1);}
function pickColorFromSource(point){const source=activeSource();if(!source)return;const canvas=document.getElementById('sourceCanvas'),pixel=canvas.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function pickColorFromRefine(point){const frame=selectedFrame();if(!frame)return;const raw=createRawCropCanvas(frame),pixel=raw.getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;setPickedColor(pixel);}
function setPickedColor(pixel){state.settings.chromaColor=[pixel[0],pixel[1],pixel[2]];state.settings.maskTool='view';const input=document.getElementById('chromaColorInput');if(input)input.value=rgbToHex(state.settings.chromaColor);clearRenderCache();renderAll();refresh();}
function bindGlobalEvents(){if(state.globalEventsBound)return;state.globalEventsBound=true;window.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(state.activeEditor==='refine'&&stepMaskHistory(event.shiftKey?1:-1))return;event.shiftKey?redoFrames():undoFrames();return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();if(state.activeEditor==='refine'&&stepMaskHistory(1))return;redoFrames();return;}if(event.code==='Space'&&state.activeEditor==='refine'){state.isSpaceDown=true;event.preventDefault();const viewport=document.getElementById('refineViewport');if(viewport)viewport.style.cursor='grab';}if(state.activeEditor==='refine'&&event.key==='0'){event.preventDefault();resetRefineViewport();}if(state.activeEditor==='refine'&&event.key==='Escape'){state.settings.maskTool='view';refreshMaskToolButtons();}if(state.activeEditor==='refine'&&(event.key==='['||event.key===']')){event.preventDefault();state.settings.maskSize=Math.max(5,Math.min(120,state.settings.maskSize+(event.key===']'?5:-5)));const input=document.getElementById('maskSizeInput');if(input)input.value=state.settings.maskSize;const label=document.getElementById('maskSizeInputValue');if(label)label.textContent=state.settings.maskSize;updateBrushCursor();}if(state.activeEditor==='review'&&event.key==='ArrowLeft'){event.preventDefault();navigateReview(-1);}if(state.activeEditor==='review'&&event.key==='ArrowRight'){event.preventDefault();navigateReview(1);}if(state.activeEditor==='review'&&event.key.toLowerCase()==='a'){event.preventDefault();setCurrentReviewApproval(true);}if(state.activeEditor==='review'&&event.key.toLowerCase()==='x'){event.preventDefault();const item=selectedReviewItem();if(item){replaceFrame({...item.frame,state:{...item.frame.state,exportSelected:!item.exportSelected}},{preserveReview:true});runReview();refresh();}}if(state.activeEditor==='review'&&event.key==='0'){event.preventDefault();resetReviewViewport();}});window.addEventListener('keyup',event=>{if(event.code==='Space'){state.isSpaceDown=false;state.refinePan=null;const viewport=document.getElementById('refineViewport');if(viewport)viewport.style.cursor=state.settings.maskTool==='view'?'grab':'';}});}


function availableRoleOptions(){return state.destinationController?.getActiveProfile?.().roles.map(role=>role.key)||getAvailableAssetRoles(state.settings.stickerCategory);}
function packageRole(frame){return frame.state?.packageRole||frame.custom?.outputRole||AssetRoles.STICKER;}
function roleLabel(role){const profile=state.destinationController?.getActiveProfile?.();return profile?.roles.find(item=>item.key===role)?.label||({sticker:'Sticker',main:'Main',tab:'Tab',background:'全螢幕背景','effect-background':'特效背景'})[role]||role;}
function currentRules(){return state.destinationController?.getActiveProfile?.()||createPlatformNeutralRules({category:state.settings.stickerCategory,targetW:state.settings.targetW,targetH:state.settings.targetH,safeMargin:state.settings.safeMargin,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,maxFileSizeKB:state.settings.maxFileSizeKB});}
function packagePlan(list=frames()){return state.destinationController?.buildPlan?.(list,{namingMode:state.settings.packageNamingMode==='sequential'?'sequential':'profile',prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,renderedMap:state.rendered,identityFrames:frames()})||buildWorkshopPackagePlan(list,{category:state.settings.stickerCategory,namingMode:state.settings.packageNamingMode,prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,destinationKey:'workshop'});}
function packageItemFor(frame,list=frames()){return packagePlan(list).items.find(item=>item.artworkId===frame.id)||null;}

function reviewSourceNames(){return new Map([...state.sources.values()].map(source=>[source.id,source.name]));}
function allReviewItems(){runReview();const plan=state.reviewReport?.packagePlan||packagePlan(exportFrames());return buildReviewItems({frames:frames(),renderedMap:state.rendered,issues:state.reviewReport?.issues||[],packageItems:plan.items,sourceNames:reviewSourceNames()});}
function visibleReviewItems(){return sortReviewItems(filterReviewItems(allReviewItems(),{filter:state.settings.reviewFilter,query:state.settings.reviewSearch}),state.settings.reviewSort);}
function selectedReviewItem(){return allReviewItems().find(item=>item.frameId===state.selectedFrameId)||null;}
function renderReviewGrid(){
  const grid=document.getElementById('reviewGrid');if(!grid)return;
  const items=visibleReviewItems();
  if(!frames().length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">尚無貼圖</div>';return;}
  if(!items.length){grid.innerHTML='<div class="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">沒有符合篩選條件的 Frame</div>';return;}
  grid.innerHTML='';const roles=availableRoleOptions();
  const canReorder=state.settings.reviewSort===ReviewSortModes.FRAME_ORDER&&state.settings.reviewFilter===ReviewFilterModes.ALL&&!state.settings.reviewSearch;
  items.forEach(item=>{const frame=item.frame,canvas=renderFrame(frame),card=document.createElement('article');card.draggable=canReorder;card.dataset.frameId=frame.id;card.dataset.sourceId=frame.sourceImageId;card.dataset.reviewCard='true';card.dataset.reviewSeverity=item.highestSeverity||'clean';card.dataset.reviewApproved=String(item.approved);card.dataset.exportSelected=String(item.exportSelected);const severityClass=item.hasErrors?'border-rose-500 bg-rose-50':item.hasWarnings?'border-amber-400 bg-amber-50':item.approved?'border-emerald-400 bg-emerald-50':frame.id===state.selectedFrameId?'border-sky-400 bg-sky-50':'border-slate-200 bg-white';card.className=`rounded-3xl border p-2 transition ${severityClass}`;const dataUrl=canvas.toDataURL('image/png');const badge=item.hasErrors?'錯誤':item.hasWarnings?'警告':item.approved?'已核准':'待核准';card.innerHTML=`<button class="preview relative block aspect-[370/320] w-full overflow-hidden rounded-2xl"><img src="${dataUrl}" class="h-full w-full object-contain"><span class="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-black text-white">${badge}</span></button><div class="mt-2 flex items-center justify-between gap-2"><span class="text-[10px] font-black">#${item.index+1} · ${item.kb}KB</span><label class="flex items-center gap-1 text-[10px] font-black"><input class="export-check" type="checkbox" ${item.exportSelected?'checked':''}>匯出</label></div><div class="mt-1 truncate text-xs font-black" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="mt-1 truncate text-[10px] text-slate-400">${escapeHtml(item.sourceName)} · ${escapeHtml(item.fileName||'不匯出')}</div><div class="mt-2 flex gap-2"><button class="review-approve flex-1 rounded-xl ${item.approved?'bg-emerald-500 text-white':'bg-slate-100'} py-2 text-xs font-black">${item.approved?'撤銷核准':'核准'}</button><button class="single-download rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">PNG</button></div><select class="role-select mt-2 w-full rounded-xl bg-slate-100 px-2 py-1 text-xs font-black">${roles.map(role=>`<option value="${role}" ${packageRole(frame)===role?'selected':''}>${roleLabel(role)}</option>`).join('')}</select>`;
    applyReviewBackground(card.querySelector('.preview'));
    card.querySelector('.preview').addEventListener('click',()=>{state.activeEditor='review';selectFrame(frame.id);resetReviewViewport();refresh();});
    card.querySelector('.export-check').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,exportSelected:event.target.checked}},{preserveReview:true});runReview();refresh();});
    card.querySelector('.review-approve').addEventListener('click',()=>toggleFrameReviewApproval(frame.id));
    card.querySelector('.role-select').addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,packageRole:event.target.value,reviewApproved:false},custom:{...frame.custom,outputRole:event.target.value}});clearFrameRender(frame.id);renderFrame(frame,true);runReview();refresh();});
    card.querySelector('.single-download').addEventListener('click',()=>downloadFramePng(frame));
    card.addEventListener('dragstart',()=>state.draggedReviewFrameId=frame.id);card.addEventListener('dragover',event=>{if(canReorder)event.preventDefault();});card.addEventListener('drop',()=>{if(canReorder)reorderFrame(state.draggedReviewFrameId,frame.id);});grid.appendChild(card);
  });
}
function applyReviewBackground(element){if(!element)return;const style=getReviewBackgroundStyle(state.settings.reviewBackground);element.style.background=style.background;element.style.backgroundSize=style.backgroundSize||'';element.dataset.reviewBackground=state.settings.reviewBackground;}
function renderLargeReview(){
  const stage=document.getElementById('reviewHeroStage'),image=document.getElementById('reviewHeroImage'),guide=document.getElementById('reviewSafeGuide'),bounds=document.getElementById('reviewContentBounds'),meta=document.getElementById('reviewHeroMeta');if(!stage||!image||!guide||!bounds||!meta)return;
  const frame=selectedFrame()||frames()[0],output=state.destinationController?.getFrameOutput?.(frame)||{width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin};applyReviewBackground(stage);stage.style.aspectRatio=`${output.width}/${output.height}`;
  if(!frame){image.removeAttribute('src');guide.classList.add('hidden');bounds.classList.add('hidden');meta.innerHTML='<div class="text-slate-400">尚無預覽</div>';return;}
  const canvas=renderFrame(frame),item=allReviewItems().find(entry=>entry.frameId===frame.id),analysis=analyzeRenderedCanvas(canvas);image.src=canvas.toDataURL('image/png');
  const top=output.safeMargin/output.height*100,left=output.safeMargin/output.width*100;guide.style.top=`${top}%`;guide.style.bottom=`${top}%`;guide.style.left=`${left}%`;guide.style.right=`${left}%`;guide.classList.toggle('hidden',!state.settings.showSafeGuide);
  if(analysis.bounds){bounds.style.left=`${analysis.bounds.x/analysis.width*100}%`;bounds.style.top=`${analysis.bounds.y/analysis.height*100}%`;bounds.style.width=`${analysis.bounds.width/analysis.width*100}%`;bounds.style.height=`${analysis.bounds.height/analysis.height*100}%`;bounds.classList.toggle('hidden',!state.settings.showContentBounds);}else bounds.classList.add('hidden');
  const issueBadges=(item?.issues||[]).filter(issue=>issue.code!=='review.pendingApproval').map(issue=>`<div class="mt-2 rounded-xl ${issue.severity==='error'?'bg-rose-500/20 text-rose-200':issue.severity==='warning'?'bg-amber-500/20 text-amber-100':'bg-white/10'} p-2 text-xs">${escapeHtml(reviewIssueText(issue))}</div>`).join('');
  meta.innerHTML=`<div class="text-xs font-black uppercase tracking-widest text-sky-300">Selected Review</div><div class="mt-2 break-all text-lg font-black">${escapeHtml(frame.name)}</div><div class="mt-1 break-all font-mono text-xs text-slate-300">${escapeHtml(item?.fileName||'')}</div><div class="mt-3 rounded-2xl bg-white/10 p-3">${roleLabel(packageRole(frame))}<br>${output.width}×${output.height}px<br>safe ${output.safeMargin}px<br>內容 ${analysis.bounds?analysis.bounds.width+'×'+analysis.bounds.height:'無'}<br>透明 ${Math.round((analysis.transparentRatio||0)*100)}%<br>${item?.kb||0}KB</div><button id="reviewHeroApproveBtn" class="mt-3 w-full rounded-xl ${item?.approved?'bg-emerald-500':'bg-emerald-300 text-slate-950'} py-2 text-xs font-black">${item?.approved?'已核准｜點擊撤銷':'核准目前 Frame'}</button><label class="mt-2 flex items-center justify-between rounded-xl bg-white/10 p-2 text-xs font-black"><span>加入匯出</span><input id="reviewHeroExportInput" type="checkbox" ${item?.exportSelected?'checked':''}></label>${issueBadges||'<div class="mt-3 rounded-xl bg-emerald-500/20 p-2 text-xs text-emerald-200">沒有像素錯誤</div>'}`;
  document.getElementById('reviewHeroApproveBtn')?.addEventListener('click',()=>toggleFrameReviewApproval(frame.id));document.getElementById('reviewHeroExportInput')?.addEventListener('change',event=>{replaceFrame({...frame,state:{...frame.state,exportSelected:event.target.checked}},{preserveReview:true});runReview();refresh();});updateReviewTransform();
}

function reviewIssueText(issue){const labels={'render.blank':'空白或全透明','render.lowContent':'可見內容過少','render.edgeTouch':'內容碰到輸出邊界','render.safeMargin':'侵入安全留白','render.opaqueBackground':'疑似背景未移除','render.fileTooLarge':'檔案過大','package.duplicateFilename':'重複檔名','review.pendingApproval':'尚未核准','render.sizeMismatch':'輸出尺寸不符','render.missing':'尚未渲染','destination.role.exact':'角色數量不符','destination.role.min':'角色數量不足','destination.role.max':'角色數量過多','destination.role.allowedCount':'貼圖數量不符合 Profile','destination.output.size':'角色輸出尺寸不符','destination.output.fileSize':'檔案超過 Profile 上限','destination.package.empty':'沒有可輸出檔案'};return labels[issue.code]||issue.message||issue.code;}
function renderReviewProgress(){const holder=document.getElementById('reviewProgressBar');if(!holder)return;const progress=getReviewProgress(allReviewItems());holder.innerHTML=`<div class="flex items-center justify-between text-xs font-black"><span>已核准 ${progress.approved}/${progress.selected}</span><span>${progress.percent}% · 錯誤 ${progress.withErrors} · 警告 ${progress.withWarnings} · 排除 ${progress.excluded}</span></div><div class="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full ${progress.ready?'bg-emerald-500':'bg-sky-500'}" style="width:${progress.percent}%"></div></div>`;}
function renderReviewInspector(){const gate=document.getElementById('reviewGateStatus'),list=document.getElementById('reviewIssueList');if(!gate||!list)return;runReview();const report=state.reviewReport,progress=getReviewProgress(allReviewItems());gate.innerHTML=`<div class="rounded-2xl ${report.canPackage?'bg-emerald-500/20 text-emerald-200':'bg-white/10'} p-3"><div class="text-2xl font-black">${progress.approved}/${progress.selected}</div><div class="text-xs">已核准 · ${report.summary.errors} errors · ${report.summary.warnings} warnings</div><div class="mt-2 text-xs font-black">${report.canPackage?'✓ Review 完成，可進入 Package':'尚未通過品質門檻'}</div></div>`;const issues=report.issues.filter(issue=>issue.code!=='review.pendingApproval');if(!issues.length){list.innerHTML='<div class="rounded-xl bg-emerald-500/20 p-3 text-xs text-emerald-200">沒有自動檢查問題</div>';return;}list.innerHTML=issues.map(issue=>`<button data-review-issue-frame="${issue.frameId||''}" class="block w-full rounded-xl ${issue.severity==='error'?'bg-rose-500/20 text-rose-100':issue.severity==='warning'?'bg-amber-500/20 text-amber-100':'bg-white/10'} p-3 text-left text-xs"><span class="font-black">${issue.severity.toUpperCase()}</span><br>${escapeHtml(reviewIssueText(issue))}</button>`).join('');list.querySelectorAll('[data-review-issue-frame]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.reviewIssueFrame){selectFrame(button.dataset.reviewIssueFrame);state.activeEditor='review';resetReviewViewport();refresh();document.getElementById('stage-review')?.scrollIntoView({behavior:'smooth',block:'start'});}}));}
function refreshReviewControls(){const filter=document.getElementById('reviewFilterInput'),sort=document.getElementById('reviewSortInput');if(filter)filter.value=state.settings.reviewFilter;if(sort)sort.value=state.settings.reviewSort;document.querySelectorAll('.review-bg').forEach(button=>button.classList.toggle('ring-2',button.dataset.reviewBg===state.settings.reviewBackground));const exportButton=document.getElementById('exportZipBtn');if(exportButton){exportButton.disabled=!state.reviewReport?.canPackage;exportButton.classList.toggle('opacity-40',exportButton.disabled);exportButton.title=exportButton.disabled?'Review 尚未核准或仍有錯誤':'';}}
function toggleFrameReviewApproval(frameId){const item=allReviewItems().find(entry=>entry.frameId===frameId);if(!item)return;if(!item.approved&&item.hasErrors){alert('此 Frame 仍有錯誤，無法核准。');return;}setFrames(frames().map(frame=>frame.id===frameId?setFrameReviewApproval(frame,!item.approved):frame));runReview();refresh();}
function setCurrentReviewApproval(approved){const item=selectedReviewItem();if(!item)return;if(approved&&item.hasErrors){alert('此 Frame 仍有錯誤，無法核准。');return;}setFrames(frames().map(frame=>frame.id===item.frameId?setFrameReviewApproval(frame,approved):frame));runReview();refresh();}
function batchReviewExport(mode){const ids=visibleReviewItems().map(item=>item.frameId);if(mode==='invert')setFrames(invertFramesExportSelection(frames(),ids));else setFrames(setFramesExportSelection(frames(),ids,mode==='all'));runReview();refresh();}
function approveVisibleClean(){const items=visibleReviewItems().filter(item=>item.exportSelected&&!item.hasErrors),ids=items.map(item=>item.frameId);setFrames(setFramesReviewApproval(frames(),ids,true));runReview();refresh();}
function revokeVisibleApproval(){const ids=visibleReviewItems().map(item=>item.frameId);setFrames(setFramesReviewApproval(frames(),ids,false));runReview();refresh();}
function navigateReview(direction){const items=visibleReviewItems();const next=nextReviewFrameId(items,state.selectedFrameId,direction);if(next){selectFrame(next);state.activeEditor='review';resetReviewViewport();refresh();}}
function navigateNextIssue(){runReview();const ids=[...new Set(state.reviewReport.issues.filter(issue=>issue.frameId&&issue.code!=='review.pendingApproval').map(issue=>issue.frameId))];if(!ids.length)return;const current=ids.indexOf(state.selectedFrameId),next=ids[(current+1+ids.length)%ids.length];selectFrame(next);state.activeEditor='review';resetReviewViewport();refresh();}
function setReviewZoom(value,anchor={x:0,y:0}){state.reviewView=zoomRefineView(state.reviewView,value,anchor);state.settings.reviewZoom=state.reviewView.zoom;updateReviewTransform();}
function resetReviewViewport(){state.reviewView=resetRefineView(state.reviewView);state.settings.reviewZoom=1;updateReviewTransform();}
function updateReviewTransform(){const layer=document.getElementById('reviewTransformLayer');if(layer)layer.style.transform=refineViewTransform(state.reviewView);const button=document.getElementById('reviewZoomResetBtn');if(button)button.textContent=`${Math.round(state.reviewView.zoom*100)}%`;}
function bindReviewViewport(viewport){if(!viewport)return;viewport.addEventListener('wheel',event=>{event.preventDefault();state.activeEditor='review';const rect=viewport.getBoundingClientRect(),anchor={x:event.clientX-rect.left-rect.width/2,y:event.clientY-rect.top-rect.height/2};setReviewZoom(state.reviewView.zoom*(event.deltaY>0?.9:1.1),anchor);},{passive:false});viewport.addEventListener('pointerdown',event=>{if(event.button!==0&&event.button!==1)return;state.activeEditor='review';state.reviewPan={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originX:state.reviewView.panX,originY:state.reviewView.panY};viewport.setPointerCapture?.(event.pointerId);viewport.style.cursor='grabbing';});viewport.addEventListener('pointermove',event=>{if(!state.reviewPan)return;state.reviewView={...state.reviewView,panX:state.reviewPan.originX+event.clientX-state.reviewPan.startX,panY:state.reviewPan.originY+event.clientY-state.reviewPan.startY};updateReviewTransform();});const end=()=>{state.reviewPan=null;viewport.style.cursor='grab';};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);}
function reorderFrame(fromId,toId){if(!fromId||fromId===toId)return;const list=[...frames()],from=list.findIndex(frame=>frame.id===fromId),to=list.findIndex(frame=>frame.id===toId);if(from<0||to<0)return;const[item]=list.splice(from,1);list.splice(to,0,item);setFrames(list);state.draggedReviewFrameId=null;resetFrameHistory();runReview();refresh();}

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
async function downloadZip(){return state.packageController?.exportPackage();}
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
