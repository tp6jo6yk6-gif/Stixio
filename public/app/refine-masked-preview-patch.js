(() => {
  if (window.__stixioRefineMaskedPreviewPatch) return;
  window.__stixioRefineMaskedPreviewPatch = true;

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  const DELETE_MARK_STRENGTH = 0.34;
  const LOUPE_SIZE = 148;
  const SAMPLE_SIZE = 26;

  installVisualLockStyles();
  installFlowStabilityCleanup();
  installMagicLoupe();

  function installVisualLockStyles() {
    if (document.getElementById('stixio-refine-visual-lock')) return;
    const style = document.createElement('style');
    style.id = 'stixio-refine-visual-lock';
    style.textContent = `
      #stage-refine #refineWorkspace {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      #stage-refine #refineViewport,
      #stage-refine #refineResultPane {
        display: grid !important;
        min-height: 430px !important;
      }

      #stage-refine #refineCanvas,
      #stage-refine #refineOutputCanvas {
        image-rendering: auto;
      }

      #stage-refine [data-refine-view],
      #stage-refine .stixio-hidden-by-stability,
      #stage-review .stixio-hidden-by-stability,
      #stage-package .stixio-hidden-by-stability {
        display: none !important;
      }

      #stage-review #reviewHeroStage,
      #stage-review #reviewHeroMeta,
      #stage-review [data-review-bg],
      #stage-review #reviewZoomOutBtn,
      #stage-review #reviewZoomResetBtn,
      #stage-review #reviewZoomInBtn,
      #stage-review #reviewPrevBtn,
      #stage-review #reviewNextBtn,
      #stage-review #toggleSafeGuideBtn,
      #stage-review #toggleContentBoundsBtn {
        display: none !important;
      }

      #stage-review #reviewGrid {
        grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)) !important;
        align-items: start;
      }

      #stage-review #reviewGrid > * {
        min-height: 156px;
      }

      #refineMagicLoupe {
        position: fixed;
        z-index: 90;
        width: 74px;
        height: 74px;
        border-radius: 999px;
        border: 2px solid #0f172a;
        background: #fff;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.26), inset 0 0 0 1px rgba(255, 255, 255, 0.88);
        pointer-events: none;
      }

      #refineMagicLoupe[hidden] {
        display: none !important;
      }

      @media (max-width: 1023px) {
        #stage-refine #refineWorkspace {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installFlowStabilityCleanup() {
    const run = () => applyFlowStabilityCleanup();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    const observer = new MutationObserver(run);
    const startObserver = () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }

  function applyFlowStabilityCleanup() {
    lockRefineVisualFlow();
    simplifyReviewFlow();
    quietPackageFlow();
  }

  function hideNode(node) {
    if (!node) return;
    node.classList.add('stixio-hidden-by-stability');
    node.setAttribute('aria-hidden', 'true');
  }

  function hideClosestPanel(node) {
    if (!node) return;
    hideNode(node.closest('label') || node.closest('.grid') || node.closest('div') || node);
  }

  function hidePackageControl(node) {
    if (!node) return;
    if (node.matches('label, button')) {
      hideNode(node);
      return;
    }

    const field = node.closest('label') || node.closest('div');
    hideNode(field || node);
  }

  function lockRefineVisualFlow() {
    const stage = document.getElementById('stage-refine');
    if (!stage) return;

    stage.querySelectorAll('[data-refine-view]').forEach(button => hideClosestPanel(button));

    const heading = stage.querySelector('h2');
    if (heading) heading.textContent = '單張遮罩修補與成品預覽';

    const viewportHint = stage.querySelector('#refineViewport .absolute.bottom-3.left-3');
    if (viewportHint) viewportHint.textContent = '淡紅＝將去背 · 其他保留原色';
  }

  function simplifyReviewFlow() {
    const stage = document.getElementById('stage-review');
    if (!stage) return;

    const heading = stage.querySelector('h2');
    if (heading) heading.textContent = '縮圖總覽、品質檢查與核准';

    const description = stage.querySelector('h2 + p');
    if (description) description.textContent = '集中檢查全部 Frame，保留搜尋、篩選、排序、核准與排除。';

    const hero = document.getElementById('reviewHeroStage');
    if (hero) hideNode(hero.closest('.grid') || hero);
    hideNode(document.getElementById('reviewHeroMeta'));

    ['reviewPrevBtn', 'reviewNextBtn', 'toggleSafeGuideBtn', 'toggleContentBoundsBtn', 'reviewZoomOutBtn', 'reviewZoomResetBtn', 'reviewZoomInBtn'].forEach(id => hideNode(document.getElementById(id)));
    stage.querySelectorAll('[data-review-bg]').forEach(button => hideNode(button));
  }

  function quietPackageFlow() {
    const stage = document.getElementById('stage-package');
    if (!stage) return;

    const heading = stage.querySelector('h2');
    if (heading && /Manifest|完整性|封裝|交付/.test(heading.textContent || '')) {
      heading.textContent = '角色規格、ZIP、Manifest 與專案輸出';
    }

    const advancedTerms = ['資料夾結構', '命名模式', '前綴', '後綴', '壓縮方式', '壓縮等級', 'CSV Manifest', '進階'];
    stage.querySelectorAll('label, button, div').forEach(node => {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 36) return;
      if (advancedTerms.some(term => text.includes(term))) hidePackageControl(node);
    });
  }

  function isRefineSourceDraw(ctx, source) {
    return ctx?.canvas?.id === 'refineCanvas'
      && ctx.globalAlpha === 1
      && (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || (window.ImageBitmap && source instanceof ImageBitmap));
  }

  function isRefineMaskOverlay(ctx, source) {
    return ctx?.canvas?.id === 'refineCanvas'
      && source instanceof HTMLCanvasElement
      && source.id !== 'refineCanvas'
      && ctx.globalAlpha > 0
      && ctx.globalAlpha < 1;
  }

  function readBackgroundColor() {
    const value = document.getElementById('chromaColorInput')?.value || '#ffffff';
    const hex = value.replace('#', '').padEnd(6, 'f').slice(0, 6);
    return [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16) || 255);
  }

  function readTolerance() {
    const value = Number(document.getElementById('toleranceInput')?.value);
    return Number.isFinite(value) ? Math.max(5, Math.min(160, value)) : 30;
  }

  function isExteriorOnlyEnabled() {
    return document.getElementById('exteriorInput')?.checked !== false;
  }

  function tintDeletePixel(image, offset) {
    const strength = DELETE_MARK_STRENGTH;
    image.data[offset] = Math.min(255, Math.round(image.data[offset] * (1 - strength) + 255 * strength));
    image.data[offset + 1] = Math.round(image.data[offset + 1] * (1 - strength));
    image.data[offset + 2] = Math.round(image.data[offset + 2] * (1 - strength));
  }

  function matchesBackground(image, offset, target, tolerance) {
    if (image.data[offset + 3] <= 8) return false;
    const distance = Math.abs(image.data[offset] - target[0])
      + Math.abs(image.data[offset + 1] - target[1])
      + Math.abs(image.data[offset + 2] - target[2]);
    return distance <= tolerance;
  }

  function markAllMatchingBackground(image, target, tolerance) {
    for (let offset = 0; offset < image.data.length; offset += 4) {
      if (matchesBackground(image, offset, target, tolerance)) tintDeletePixel(image, offset);
    }
  }

  function markExteriorBackground(image, width, height, target, tolerance) {
    const visited = new Uint8Array(width * height);
    const queue = [];

    const canMark = index => !visited[index] && matchesBackground(image, index * 4, target, tolerance);
    const enqueue = index => {
      if (!canMark(index)) return;
      visited[index] = 1;
      queue.push(index);
    };

    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }

    for (let y = 1; y < height - 1; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      tintDeletePixel(image, index * 4);

      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y < height - 1) enqueue(index + width);
    }
  }

  function applyAutoDeleteMarks(ctx) {
    const canvas = ctx.canvas;
    if (!canvas?.width || !canvas?.height) return;

    let image;
    try {
      image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }

    const target = readBackgroundColor();
    const tolerance = readTolerance() * 3;
    if (isExteriorOnlyEnabled()) {
      markExteriorBackground(image, canvas.width, canvas.height, target, tolerance);
    } else {
      markAllMatchingBackground(image, target, tolerance);
    }

    ctx.putImageData(image, 0, 0);
  }

  function drawDeleteMaskOnly(ctx, maskCanvas) {
    const canvas = ctx.canvas;
    if (!canvas?.width || !canvas?.height || !maskCanvas?.width || !maskCanvas?.height) return false;

    const maskBuffer = document.createElement('canvas');
    maskBuffer.width = canvas.width;
    maskBuffer.height = canvas.height;
    const maskCtx = maskBuffer.getContext('2d', { willReadFrequently: true });
    maskCtx.imageSmoothingEnabled = false;
    originalDrawImage.call(maskCtx, maskCanvas, 0, 0, canvas.width, canvas.height);

    let image;
    let mask;
    try {
      image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      mask = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return false;
    }

    for (let offset = 0; offset < mask.data.length; offset += 4) {
      if (mask.data[offset + 3] <= 0) continue;
      const red = mask.data[offset];
      const green = mask.data[offset + 1];
      if (red > 128 && red > green) tintDeletePixel(image, offset);
    }

    ctx.putImageData(image, 0, 0);
    return true;
  }

  CanvasRenderingContext2D.prototype.drawImage = function patchedDrawImage(source, ...args) {
    if (isRefineMaskOverlay(this, source)) {
      if (drawDeleteMaskOnly(this, source)) return;
    }

    const result = originalDrawImage.call(this, source, ...args);
    if (isRefineSourceDraw(this, source)) applyAutoDeleteMarks(this);
    return result;
  };

  function getLoupe() {
    let loupe = document.getElementById('refineMagicLoupe');
    if (!loupe) {
      loupe = document.createElement('canvas');
      loupe.id = 'refineMagicLoupe';
      loupe.width = LOUPE_SIZE;
      loupe.height = LOUPE_SIZE;
      loupe.hidden = true;
      document.body.appendChild(loupe);
    }
    return loupe;
  }

  function hideLoupe() {
    const loupe = document.getElementById('refineMagicLoupe');
    if (loupe) loupe.hidden = true;
  }

  function isMagicActive() {
    return Boolean(document.querySelector('#stage-refine .mask-tool[data-mask-tool="magic"].bg-emerald-300'));
  }

  function installMagicLoupe() {
    document.addEventListener('pointermove', event => {
      const viewport = document.getElementById('refineViewport');
      const canvas = document.getElementById('refineCanvas');
      if (!viewport || !canvas || !isMagicActive() || !viewport.contains(event.target)) {
        hideLoupe();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        hideLoupe();
        return;
      }

      const loupe = getLoupe();
      const ctx = loupe.getContext('2d');
      if (!ctx || !canvas.width || !canvas.height) return;

      const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
      const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
      const sx = Math.max(0, Math.min(canvas.width - SAMPLE_SIZE, canvasX - SAMPLE_SIZE / 2));
      const sy = Math.max(0, Math.min(canvas.height - SAMPLE_SIZE, canvasY - SAMPLE_SIZE / 2));

      ctx.clearRect(0, 0, loupe.width, loupe.height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(loupe.width / 2, loupe.height / 2, loupe.width / 2 - 3, 0, Math.PI * 2);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, sx, sy, SAMPLE_SIZE, SAMPLE_SIZE, 0, 0, loupe.width, loupe.height);
      ctx.restore();

      const center = loupe.width / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(center - 12, center);
      ctx.lineTo(center + 12, center);
      ctx.moveTo(center, center - 12);
      ctx.lineTo(center, center + 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(center, center, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fca5a5';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      loupe.style.left = `${event.clientX + 18}px`;
      loupe.style.top = `${event.clientY - 86}px`;
      loupe.hidden = false;
    }, true);

    document.addEventListener('pointerleave', hideLoupe, true);
  }
})();
