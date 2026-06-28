(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    items: [],
    active: 0,
    targetW: 370,
    targetH: 320,
    safeMargin: 15,
    tolerance: 30,
    align: 'center',
    border: false,
    lineNaming: true
  };

  const els = {};
  const categoryNames = {
    '370x320': '一般貼圖',
    '396x660': '大貼圖',
    '320x270': '動態貼圖'
  };

  document.addEventListener('DOMContentLoaded', () => {
    ['welcome','studio','dropZone','fileInput','addInput','demoBtn','statusText','scoreText','scoreBar','issueList','previewCanvas','safeGuide','thumbs','prevBtn','nextBtn','reprocessBtn','centerBtn','bottomBtn','markDoneBtn','optimizeBtn','downloadBtn','tolerance','toleranceOut','safeMargin','marginOut','sizePreset','borderToggle','lineNaming','imageCounter','previewStage'].forEach(id => els[id] = $(id));
    bindEvents();
    updateUI();
  });

  function bindEvents() {
    ['dragenter','dragover'].forEach(type => window.addEventListener(type, e => { e.preventDefault(); els.dropZone?.classList.add('is-over'); }));
    ['dragleave','drop'].forEach(type => window.addEventListener(type, e => { e.preventDefault(); els.dropZone?.classList.remove('is-over'); }));
    window.addEventListener('drop', e => handleFiles(Array.from(e.dataTransfer.files || [])));
    els.fileInput.addEventListener('change', e => { handleFiles(Array.from(e.target.files || [])); e.target.value=''; });
    els.addInput.addEventListener('change', e => { handleFiles(Array.from(e.target.files || [])); e.target.value=''; });
    els.demoBtn.addEventListener('click', () => { showStudio(); renderAll(); });
    els.prevBtn.addEventListener('click', () => selectItem(Math.max(0, state.active - 1)));
    els.nextBtn.addEventListener('click', () => selectItem(Math.min(state.items.length - 1, state.active + 1)));
    els.reprocessBtn.addEventListener('click', () => { reprocessActive(); renderAll(); });
    els.optimizeBtn.addEventListener('click', () => { optimizeAll(); renderAll(); });
    els.centerBtn.addEventListener('click', () => { setAlign('center'); });
    els.bottomBtn.addEventListener('click', () => { setAlign('bottom'); });
    els.markDoneBtn.addEventListener('click', () => { if (state.items[state.active]) state.items[state.active].done = true; selectItem(Math.min(state.items.length - 1, state.active + 1)); });
    els.downloadBtn.addEventListener('click', downloadZip);
    els.tolerance.addEventListener('input', e => { state.tolerance = +e.target.value; els.toleranceOut.value = state.tolerance; reprocessAllDebounced(); });
    els.safeMargin.addEventListener('input', e => { state.safeMargin = +e.target.value; els.marginOut.value = `${state.safeMargin}px`; renderAllDebounced(); });
    els.sizePreset.addEventListener('change', e => { const [w,h] = e.target.value.split('x').map(Number); state.targetW=w; state.targetH=h; renderAll(); });
    els.borderToggle.addEventListener('change', e => { state.border = e.target.checked; renderAll(); });
    els.lineNaming.addEventListener('change', e => { state.lineNaming = e.target.checked; updateStatus(); });
    window.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') els.prevBtn.click(); if (e.key === 'ArrowRight') els.nextBtn.click(); if (e.key === 'Enter') els.markDoneBtn.click(); });
  }

  async function handleFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return;
    showStudio();
    els.statusText.textContent = `正在匯入 ${imageFiles.length} 張圖片...`;
    for (const file of imageFiles) {
      const bitmap = await loadImage(file);
      const item = createItem(file.name, bitmap);
      state.items.push(item);
      processItem(item);
    }
    state.active = Math.max(0, state.items.length - imageFiles.length);
    renderAll();
  }

  function showStudio() {
    els.welcome.classList.add('hidden');
    els.studio.classList.remove('hidden');
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function createItem(name, img) {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name: name.replace(/\.[^/.]+$/, ''),
      img,
      crop: { x: 0, y: 0, w: img.width, h: img.height },
      done: false,
      issues: [],
      preview: null
    };
  }

  function processItem(item) {
    const src = document.createElement('canvas');
    src.width = item.img.width;
    src.height = item.img.height;
    const ctx = src.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(item.img, 0, 0);
    const data = ctx.getImageData(0, 0, src.width, src.height);
    const crop = findContentBox(data, src.width, src.height, state.tolerance);
    item.crop = crop || { x: 0, y: 0, w: src.width, h: src.height };
    item.done = false;
  }

  function findContentBox(imageData, w, h, tolerance) {
    const d = imageData.data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const alpha = d[i + 3];
        const distWhite = Math.abs(d[i] - 255) + Math.abs(d[i+1] - 255) + Math.abs(d[i+2] - 255);
        if (alpha > 12 && distWhite > tolerance) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    const pad = 8;
    const x = Math.max(0, minX - pad);
    const y = Math.max(0, minY - pad);
    const right = Math.min(w, maxX + pad + 1);
    const bottom = Math.min(h, maxY + pad + 1);
    return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
  }

  function renderAll() {
    renderPreview();
    renderThumbs();
    updateStatus();
  }

  const renderAllDebounced = debounce(renderAll, 60);
  const reprocessAllDebounced = debounce(() => { state.items.forEach(processItem); renderAll(); }, 120);

  function renderPreview() {
    const canvas = els.previewCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = state.targetW;
    canvas.height = state.targetH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const item = state.items[state.active];
    updateSafeGuide();
    if (!item) {
      drawEmpty(ctx, canvas);
      return;
    }
    const rendered = makeStickerCanvas(item);
    ctx.drawImage(rendered, 0, 0);
    item.preview = rendered;
  }

  function drawEmpty(ctx, canvas) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('請先匯入圖片', canvas.width / 2, canvas.height / 2);
  }

  function makeStickerCanvas(item) {
    const out = document.createElement('canvas');
    out.width = state.targetW;
    out.height = state.targetH;
    const ctx = out.getContext('2d');
    const temp = document.createElement('canvas');
    temp.width = item.crop.w;
    temp.height = item.crop.h;
    const tctx = temp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(item.img, item.crop.x, item.crop.y, item.crop.w, item.crop.h, 0, 0, item.crop.w, item.crop.h);
    chromaWhite(temp, state.tolerance);
    const scale = Math.min((state.targetW - state.safeMargin * 2) / temp.width, (state.targetH - state.safeMargin * 2) / temp.height);
    const dw = temp.width * scale;
    const dh = temp.height * scale;
    const dx = (state.targetW - dw) / 2;
    const dy = state.align === 'bottom' ? state.targetH - state.safeMargin - dh : (state.targetH - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (state.border) drawBorder(ctx, temp, dx, dy, dw, dh);
    ctx.drawImage(temp, dx, dy, dw, dh);
    item.issues = inspectItem(item, { dx, dy, dw, dh });
    return out;
  }

  function chromaWhite(canvas, tolerance) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const distWhite = Math.abs(d[i] - 255) + Math.abs(d[i+1] - 255) + Math.abs(d[i+2] - 255);
      if (distWhite <= tolerance) {
        d[i + 3] = 0;
        d[i] = d[i+1] = d[i+2] = 255;
      } else if (distWhite <= tolerance * 1.45) {
        d[i + 3] = Math.round(d[i + 3] * ((distWhite - tolerance) / (tolerance * 0.45)));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function drawBorder(ctx, source, dx, dy, dw, dh) {
    const border = Math.max(3, Math.round(Math.min(state.targetW, state.targetH) * 0.018));
    ctx.save();
    ctx.globalAlpha = 1;
    for (let r = border; r > 0; r -= 2) {
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const a = (Math.PI * 2 * i) / steps;
        ctx.drawImage(source, dx + Math.cos(a) * r, dy + Math.sin(a) * r, dw, dh);
      }
    }
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, state.targetW, state.targetH);
    ctx.restore();
  }

  function inspectItem(item, box) {
    const issues = [];
    if (box.dx < state.safeMargin - 1) issues.push('左側留白不足');
    if (box.dy < state.safeMargin - 1) issues.push('上方留白不足');
    if (box.dx + box.dw > state.targetW - state.safeMargin + 1) issues.push('右側留白不足');
    if (box.dy + box.dh > state.targetH - state.safeMargin + 1) issues.push('下方留白不足');
    const ratio = item.crop.w / item.crop.h;
    if (ratio > 3.2 || ratio < 0.25) issues.push('裁切比例異常，建議檢查');
    return issues;
  }

  function renderThumbs() {
    els.thumbs.innerHTML = '';
    state.items.forEach((item, idx) => {
      if (!item.preview) item.preview = makeStickerCanvas(item);
      const btn = document.createElement('button');
      btn.className = `thumb ${idx === state.active ? 'active' : ''} ${item.issues.length ? 'warn' : ''}`;
      btn.type = 'button';
      btn.title = item.issues.length ? item.issues.join('、') : item.name;
      const c = document.createElement('canvas');
      c.width = 76; c.height = 76;
      c.getContext('2d').drawImage(item.preview, 0, 0, 76, 76);
      const b = document.createElement('b');
      b.textContent = idx + 1;
      btn.append(c, b);
      btn.addEventListener('click', () => selectItem(idx));
      els.thumbs.appendChild(btn);
    });
  }

  function updateStatus() {
    const total = state.items.length;
    const ok = state.items.filter(item => item.done || item.issues.length === 0).length;
    const score = total ? Math.round((ok / total) * 100) : 0;
    els.statusText.textContent = total ? `${total} 張貼圖｜${categoryNames[`${state.targetW}x${state.targetH}`] || '自訂尺寸'}` : '尚未匯入圖片';
    els.scoreText.textContent = `${score}%`;
    els.scoreBar.style.width = `${score}%`;
    els.imageCounter.textContent = total ? `${state.active + 1} / ${total}` : '0 / 0';
    els.issueList.innerHTML = '';
    if (!total) {
      addIssue('匯入圖片後會自動檢查 Sticker 安全區。', 'ok');
      return;
    }
    const issueItems = state.items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.issues.length);
    if (!issueItems.length) {
      addIssue('全部看起來都符合基本安全區。', 'ok');
      return;
    }
    issueItems.slice(0, 8).forEach(({ item, idx }) => {
      const li = addIssue(`第 ${idx + 1} 張：${item.issues[0]}`, 'warn');
      li.addEventListener('click', () => selectItem(idx));
    });
  }

  function addIssue(text, type) {
    const li = document.createElement('li');
    li.className = type;
    li.textContent = text;
    els.issueList.appendChild(li);
    return li;
  }

  function updateSafeGuide() {
    const stage = els.previewStage.getBoundingClientRect();
    const canvas = els.previewCanvas.getBoundingClientRect();
    if (!canvas.width || !stage.width) return;
    const scaleX = canvas.width / state.targetW;
    const scaleY = canvas.height / state.targetH;
    els.safeGuide.style.display = 'block';
    els.safeGuide.style.left = `${canvas.left - stage.left + state.safeMargin * scaleX}px`;
    els.safeGuide.style.top = `${canvas.top - stage.top + state.safeMargin * scaleY}px`;
    els.safeGuide.style.width = `${(state.targetW - state.safeMargin * 2) * scaleX}px`;
    els.safeGuide.style.height = `${(state.targetH - state.safeMargin * 2) * scaleY}px`;
  }

  function selectItem(idx) {
    if (!state.items.length) return;
    state.active = Math.max(0, Math.min(idx, state.items.length - 1));
    renderAll();
  }

  function setAlign(mode) {
    state.align = mode;
    state.items.forEach(item => item.done = false);
    renderAll();
  }

  function reprocessActive() {
    const item = state.items[state.active];
    if (item) processItem(item);
  }

  function optimizeAll() {
    state.align = 'bottom';
    state.safeMargin = Math.max(12, state.safeMargin);
    els.safeMargin.value = state.safeMargin;
    els.marginOut.value = `${state.safeMargin}px`;
    state.items.forEach(item => { processItem(item); item.done = item.issues.length === 0; });
  }

  async function downloadZip() {
    if (!state.items.length) return alert('請先匯入圖片');
    const zip = new JSZip();
    state.items.forEach((item, idx) => {
      const canvas = makeStickerCanvas(item);
      const name = state.lineNaming ? lineName(idx) : `${item.name || idx + 1}.png`;
      zip.file(name, canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''), { base64: true });
    });
    els.downloadBtn.disabled = true;
    els.downloadBtn.textContent = '打包中...';
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sticker-packages-${state.targetW}x${state.targetH}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    els.downloadBtn.disabled = false;
    els.downloadBtn.textContent = '下載 ZIP';
  }

  function lineName(idx) {
    if (idx === 0) return 'main.png';
    if (idx === 1) return 'tab.png';
    return `${String(idx - 1).padStart(2, '0')}.png`;
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }
})();
