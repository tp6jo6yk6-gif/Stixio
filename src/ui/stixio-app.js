import {
  BRAND,
  calculateGridBoxes,
  getStickerPlacement,
  processStickerImageData,
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
  lineNamingMode: true,
  selectedId: null,
  mode: 'free'
};

const state = {
  source: null,
  artworks: [],
  rendered: new Map(),
  settings: { ...DEFAULT_SETTINGS }
};

export function initStixioApp(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = BRAND.name + ' - ' + BRAND.slogan;
  root.innerHTML = renderShell();
  bindEvents(root);
  refresh();
}

function renderShell() {
  return `
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <header class="border-b border-white/10 bg-slate-950/90 sticky top-0 z-20 backdrop-blur">
        <div class="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-400 text-slate-950 grid place-items-center font-black">S</div>
            <div>
              <h1 class="text-xl font-black tracking-tight">${BRAND.name}</h1>
              <p class="text-xs text-slate-400">${BRAND.slogan}</p>
            </div>
          </div>
          <div class="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span class="px-3 py-1 rounded-full bg-white/5 border border-white/10">Free: refine 1 sticker</span>
            <button id="loginBtn" class="px-3 py-1.5 rounded-lg bg-white text-slate-950 font-bold">Login for Starter</button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-5 py-6 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <aside class="space-y-4">
          <section class="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-2">Artwork</p>
            <label id="dropZone" class="block rounded-2xl border-2 border-dashed border-white/15 hover:border-emerald-300 cursor-pointer p-6 text-center transition">
              <input id="fileInput" type="file" accept="image/*" class="hidden" />
              <div class="text-4xl mb-3">＋</div>
              <div class="font-bold">Drop or choose artwork</div>
              <p class="text-sm text-slate-400 mt-1">Single sheet or one sticker image</p>
            </label>
          </section>

          <section class="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-4">
            <p class="text-xs uppercase tracking-[0.2em] text-emerald-300">Layout</p>
            <div class="grid grid-cols-2 gap-3">
              ${numberInput('rowsInput', 'Rows', DEFAULT_SETTINGS.rows, 1, 12)}
              ${numberInput('colsInput', 'Cols', DEFAULT_SETTINGS.cols, 1, 12)}
              ${numberInput('marginXInput', 'Margin X', DEFAULT_SETTINGS.marginX, 0, 500)}
              ${numberInput('marginYInput', 'Margin Y', DEFAULT_SETTINGS.marginY, 0, 500)}
              ${numberInput('gapXInput', 'Gap X', DEFAULT_SETTINGS.gapX, 0, 500)}
              ${numberInput('gapYInput', 'Gap Y', DEFAULT_SETTINGS.gapY, 0, 500)}
            </div>
            <button id="applyGridBtn" class="w-full rounded-xl bg-emerald-400 text-slate-950 font-black py-3">Apply Layout</button>
          </section>

          <section class="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-4">
            <p class="text-xs uppercase tracking-[0.2em] text-emerald-300">Refine</p>
            <label class="flex items-center justify-between gap-3 text-sm"><span>Remove white background</span><input id="chromaEnabled" type="checkbox" checked></label>
            <label class="flex items-center justify-between gap-3 text-sm"><span>Exterior only</span><input id="exteriorOnly" type="checkbox" checked></label>
            ${numberInput('toleranceInput', 'Tolerance', DEFAULT_SETTINGS.tolerance, 0, 255)}
            ${numberInput('shrinkInput', 'Shrink', DEFAULT_SETTINGS.shrinkRadius, 0, 10)}
            ${numberInput('featherInput', 'Feather', DEFAULT_SETTINGS.featherRadius, 0, 10)}
            <button id="renderBtn" class="w-full rounded-xl bg-white text-slate-950 font-black py-3">Render Selected</button>
          </section>

          <section class="rounded-3xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <p class="text-xs uppercase tracking-[0.2em] text-emerald-300">Package</p>
            <p class="text-sm text-slate-400">Free exports one selected PNG. Login unlocks collection ZIP.</p>
            <button id="downloadPngBtn" class="w-full rounded-xl bg-emerald-400 text-slate-950 font-black py-3">Download selected PNG</button>
            <button id="downloadZipBtn" class="w-full rounded-xl bg-white/10 text-white font-black py-3 border border-white/10">Export collection ZIP</button>
          </section>
        </aside>

        <section class="space-y-4">
          <div class="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-emerald-300">Layout Preview</p>
                <h2 class="text-lg font-black">Artwork sheet</h2>
              </div>
              <p id="statusText" class="text-sm text-slate-400">No artwork loaded</p>
            </div>
            <div class="bg-slate-900 rounded-2xl min-h-[360px] grid place-items-center overflow-auto border border-white/10">
              <canvas id="sourceCanvas" class="max-w-full"></canvas>
            </div>
          </div>

          <div class="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-emerald-300">Review</p>
                <h2 class="text-lg font-black">Sticker collection</h2>
              </div>
              <p id="limitText" class="text-sm text-slate-400">Free: select 1 sticker to refine/export</p>
            </div>
            <div id="artworkGrid" class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3"></div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function numberInput(id, label, value, min, max) {
  return `
    <label class="text-xs text-slate-400 space-y-1">
      <span>${label}</span>
      <input id="${id}" type="number" min="${min}" max="${max}" value="${value}" class="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-white font-bold">
    </label>
  `;
}

function bindEvents(root) {
  const fileInput = root.querySelector('#fileInput');
  const dropZone = root.querySelector('#dropZone');
  fileInput.addEventListener('change', event => loadFile(event.target.files?.[0]));
  dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('border-emerald-300'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-emerald-300'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('border-emerald-300');
    loadFile(event.dataTransfer.files?.[0]);
  });

  root.querySelector('#applyGridBtn').addEventListener('click', () => {
    readSettings(root);
    createArtworksFromSource();
    renderAll();
    refresh();
  });
  root.querySelector('#renderBtn').addEventListener('click', () => { readSettings(root); renderSelected(); refresh(); });
  root.querySelector('#downloadPngBtn').addEventListener('click', downloadSelectedPng);
  root.querySelector('#downloadZipBtn').addEventListener('click', downloadZipOrPromptLogin);
  root.querySelector('#loginBtn').addEventListener('click', () => alert('Starter login will unlock full collection export. Creator will add Workspace + Google Drive.'));
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
  state.settings.chromaEnabled = root.querySelector('#chromaEnabled').checked;
  state.settings.exteriorOnly = root.querySelector('#exteriorOnly').checked;
}

function numberValue(root, selector, fallback) {
  const value = Number(root.querySelector(selector)?.value);
  return Number.isFinite(value) ? value : fallback;
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  state.source = { id: createId('asset'), fileName: file.name, img };
  state.rendered.clear();
  createArtworksFromSource();
  renderAll();
  refresh();
}

function createArtworksFromSource() {
  if (!state.source) return;
  const boxes = calculateGridBoxes(state.source.img.width, state.source.img.height, state.settings);
  state.artworks = boxes.map((box, index) => ({
    id: createId('art'),
    index,
    sourceId: state.source.id,
    slice: box,
    metadata: {}
  }));
  state.settings.selectedId = state.artworks[0]?.id || null;
}

function renderAll() {
  state.rendered.clear();
  state.artworks.forEach(artwork => renderArtwork(artwork));
}

function renderSelected() {
  const artwork = getSelectedArtwork();
  if (artwork) renderArtwork(artwork);
}

function renderArtwork(artwork) {
  if (!state.source) return null;
  const { targetW, targetH } = state.settings;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, targetW, targetH);

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = artwork.slice.width;
  sourceCanvas.height = artwork.slice.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.drawImage(
    state.source.img,
    artwork.slice.x,
    artwork.slice.y,
    artwork.slice.width,
    artwork.slice.height,
    0,
    0,
    artwork.slice.width,
    artwork.slice.height
  );

  const raw = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const processed = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
  processStickerImageData(processed, {
    enabled: state.settings.chromaEnabled,
    chromaColor: state.settings.chromaColor,
    tolerance: state.settings.tolerance,
    exteriorOnly: state.settings.exteriorOnly,
    autoDespeckle: state.settings.autoDespeckle,
    shrinkRadius: state.settings.shrinkRadius,
    featherRadius: state.settings.featherRadius
  });
  sourceCtx.putImageData(processed, 0, 0);

  const placement = getStickerPlacement({
    width: artwork.slice.width,
    height: artwork.slice.height,
    cropW: artwork.slice.width,
    cropH: artwork.slice.height,
    offsetX: 0,
    offsetY: 0
  }, state.settings);

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, placement.drawX, placement.drawY, placement.drawW, placement.drawH);
  state.rendered.set(artwork.id, canvas);
  return canvas;
}

function refresh() {
  drawSourcePreview();
  renderArtworkGrid();
  const status = document.getElementById('statusText');
  if (status) status.textContent = state.source ? `${state.source.fileName} · ${state.artworks.length} stickers` : 'No artwork loaded';
}

function drawSourcePreview() {
  const canvas = document.getElementById('sourceCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!state.source) {
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
    return;
  }
  canvas.width = state.source.img.width;
  canvas.height = state.source.img.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.source.img, 0, 0);
  state.artworks.forEach(artwork => {
    const selected = artwork.id === state.settings.selectedId;
    ctx.strokeStyle = selected ? '#34d399' : '#f43f5e';
    ctx.lineWidth = selected ? 6 : 3;
    ctx.strokeRect(artwork.slice.x, artwork.slice.y, artwork.slice.width, artwork.slice.height);
  });
}

function renderArtworkGrid() {
  const grid = document.getElementById('artworkGrid');
  if (!grid) return;
  if (!state.artworks.length) {
    grid.innerHTML = '<div class="col-span-full rounded-2xl border border-white/10 p-10 text-center text-slate-400">Import artwork to begin.</div>';
    return;
  }
  grid.innerHTML = '';
  state.artworks.forEach((artwork, index) => {
    const canvas = state.rendered.get(artwork.id) || renderArtwork(artwork);
    const card = document.createElement('button');
    card.className = `rounded-2xl border p-2 bg-slate-900/80 text-left transition ${artwork.id === state.settings.selectedId ? 'border-emerald-300 ring-2 ring-emerald-300/30' : 'border-white/10 hover:border-white/30'}`;
    card.innerHTML = `
      <div class="aspect-[370/320] rounded-xl bg-[linear-gradient(45deg,#334155_25%,transparent_25%),linear-gradient(-45deg,#334155_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#334155_75%),linear-gradient(-45deg,transparent_75%,#334155_75%)] bg-[length:16px_16px] overflow-hidden grid place-items-center"></div>
      <div class="flex items-center justify-between mt-2 text-xs text-slate-400">
        <span>#${index + 1}</span>
        <span>${artwork.id === state.settings.selectedId ? 'Selected' : 'Preview'}</span>
      </div>
    `;
    const holder = card.querySelector('div');
    const preview = document.createElement('img');
    preview.src = canvas.toDataURL('image/png');
    preview.className = 'max-w-full max-h-full object-contain';
    holder.appendChild(preview);
    card.addEventListener('click', () => {
      state.settings.selectedId = artwork.id;
      refresh();
    });
    grid.appendChild(card);
  });
}

function getSelectedArtwork() {
  return state.artworks.find(item => item.id === state.settings.selectedId) || state.artworks[0] || null;
}

function downloadSelectedPng() {
  const artwork = getSelectedArtwork();
  if (!artwork) return alert('Please import artwork first.');
  const canvas = state.rendered.get(artwork.id) || renderArtwork(artwork);
  downloadDataUrl(canvas.toDataURL('image/png'), getStickerFilename(0, { lineNamingMode: false, prefix: 'stixio' }));
}

async function downloadZipOrPromptLogin() {
  if (state.settings.mode === 'free') {
    alert('Free exports one PNG. Login unlocks full collection ZIP. Creator adds Workspace + Google Drive.');
    return;
  }
  if (!window.JSZip) return alert('JSZip is not loaded.');
  const zip = new JSZip();
  state.artworks.forEach((artwork, index) => {
    const canvas = state.rendered.get(artwork.id) || renderArtwork(artwork);
    const fileName = getStickerFilename(index, { lineNamingMode: state.settings.lineNamingMode });
    zip.file(fileName, canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''), { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, createZipFileName({ prefix: 'stixio', targetW: state.settings.targetW, targetH: state.settings.targetH }));
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
