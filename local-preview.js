const CHECKLIST_KEY = 'stixio-local-preview-checklist';
const frame = document.getElementById('stixioFrame');
const statusBox = document.getElementById('previewStatus');
const resultsBox = document.getElementById('smokeResults');

bindButtons(['loadDemoBtn', 'loadDemoTop'], loadDemoSheet);
bindButtons(['runSmokeBtn', 'runSmokeTop'], runSmokeTests);
bindButtons(['reloadAppBtn', 'reloadAppTop'], reloadApp);
bindButtons(['openAppTop'], () => window.open('./index.html', '_blank', 'noopener'));
bindButtons(['clearChecksBtn'], clearChecklist);

restoreChecklist();
frame.addEventListener('load', () => setStatus('Stixio 已載入，可以開始操作。', 'pass'));

function bindButtons(ids, handler) {
  for (const id of ids) document.getElementById(id)?.addEventListener('click', handler);
}

function appWindow() {
  const win = frame.contentWindow;
  if (!win) throw new Error('無法取得 Stixio 預覽視窗。');
  return win;
}

function appDocument() {
  const doc = frame.contentDocument;
  if (!doc) throw new Error('無法取得 Stixio 預覽文件。');
  return doc;
}

async function waitFor(selector, { timeout = 8000, count = 1 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const matches = [...appDocument().querySelectorAll(selector)];
    if (matches.length >= count) return count === 1 ? matches[0] : matches;
    await sleep(60);
  }
  throw new Error(`等待 ${selector} 超時。`);
}

async function waitForCondition(check, message, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await sleep(80);
  }
  throw new Error(message);
}

async function loadDemoSheet() {
  try {
    setStatus('正在生成並載入 2×2 示範圖……', 'running');
    resultsBox.innerHTML = '';

    const layoutButton = await waitFor('[data-layout="2x2"]');
    layoutButton.click();
    await sleep(120);

    const input = await waitFor('#fileInput');
    const blob = await createDemoSheetBlob();
    const win = appWindow();
    const file = new win.File([blob], 'stixio-demo-2x2.png', { type: 'image/png' });
    const transfer = new win.DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new win.Event('change', { bubbles: true }));

    await waitForCondition(
      () => appDocument().querySelectorAll('#reviewGrid img').length >= 4,
      '示範素材已送入，但沒有產生 4 張 Review 圖片。',
      15000
    );

    const count = appDocument().querySelectorAll('#reviewGrid img').length;
    setStatus(`示範圖載入完成，目前有 ${count} 張 Review 圖片。`, 'pass');
    markChecklist('import', true);
  } catch (error) {
    setStatus(error.message || '示範圖載入失敗。', 'fail');
  }
}

async function runSmokeTests() {
  resultsBox.innerHTML = '';
  setStatus('正在執行可點擊煙霧測試……', 'running');

  const checks = [
    ['App 啟動', testAppBoot],
    ['2×2 示範素材', testDemoArtwork],
    ['網格歸零', testGridReset],
    ['Viewport 縮放', testViewportZoom],
    ['深色模式', testDarkMode],
    ['Package 控制', testPackageControls],
    ['Workspace 清除入口', testWorkspaceResetControl]
  ];

  let passed = 0;
  for (const [name, check] of checks) {
    try {
      const detail = await check();
      renderResult(name, true, detail || '通過');
      passed += 1;
    } catch (error) {
      renderResult(name, false, error.message || '失敗');
    }
  }

  const complete = passed === checks.length;
  setStatus(
    complete ? `煙霧測試完成：${passed}/${checks.length} 全部通過。` : `煙霧測試完成：${passed}/${checks.length} 通過。`,
    complete ? 'pass' : 'fail'
  );
}

async function testAppBoot() {
  await waitFor('#fileInput');
  await waitFor('#sourceCanvas');
  await waitFor('#refineCanvas');
  await waitFor('#uxThemeToggle');
  return '正式 Workshop、UX Controller 與兩張畫布已啟動';
}

async function testDemoArtwork() {
  if (appDocument().querySelectorAll('#reviewGrid img').length < 4) await loadDemoSheet();
  const cards = await waitFor('#reviewGrid img', { count: 4, timeout: 15000 });
  markChecklist('import', true);
  return `Review 已產生 ${cards.length} 張圖片`;
}

async function testGridReset() {
  const win = appWindow();
  const ids = ['marginXInput', 'marginYInput', 'gapXInput', 'gapYInput'];
  for (const id of ids) {
    const input = await waitFor(`#${id}`);
    input.value = '17';
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
  }

  (await waitFor('#uxGridReset')).click();
  await sleep(100);
  const values = ids.map(id => appDocument().getElementById(id)?.value);
  if (!values.every(value => value === '0')) throw new Error(`仍有非零值：${values.join(', ')}`);
  return 'Margin X/Y 與 Gap X/Y 均為 0';
}

async function testViewportZoom() {
  const canvas = await waitFor('#sourceCanvas');
  const layer = await waitFor('[data-ux-transform-layer="sourceCanvas"]');
  const win = appWindow();
  canvas.dispatchEvent(new win.WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }));
  await sleep(80);
  if (!layer.style.transform || layer.style.transform.includes('scale(1)')) throw new Error('滾輪事件沒有改變縮放比例。');
  (await waitFor('[data-ux-zoom="reset"][data-canvas-id="sourceCanvas"]')).click();
  await sleep(60);
  if (!layer.style.transform.includes('scale(1)')) throw new Error('Viewport 無法回到 100%。');
  markChecklist('viewport', true);
  return '滾輪放大與 100% 重設正常';
}

async function testDarkMode() {
  const doc = appDocument();
  const button = await waitFor('#uxThemeToggle');
  const before = doc.body.classList.contains('stixio-dark');
  button.click();
  await sleep(60);
  const after = doc.body.classList.contains('stixio-dark');
  if (after === before) throw new Error('深色模式按鈕沒有切換 body 狀態。');
  button.click();
  await sleep(40);
  markChecklist('theme', true);
  return '深淺色可切換，並已還原原始狀態';
}

async function testPackageControls() {
  const selectors = [
    '#targetWInput',
    '#targetHInput',
    '#safeMarginInput',
    '#packageNamingModeInput',
    '#filenamePrefixInput',
    '#filenameSuffixInput',
    '#exportZipBtn'
  ];
  for (const selector of selectors) await waitFor(selector);
  markChecklist('package', true);
  return '尺寸、安全留白、命名與 ZIP 控制均存在';
}

async function testWorkspaceResetControl() {
  await waitFor('#uxClearWorkspace');
  return '清除按鈕存在；破壞性確認留給人工驗收';
}

function reloadApp() {
  setStatus('正在重新載入內嵌 Stixio……', 'running');
  resultsBox.innerHTML = '';
  frame.src = `./index.html?local-preview=1&t=${Date.now()}`;
}

function renderResult(name, pass, detail) {
  const item = document.createElement('div');
  item.className = `result ${pass ? 'pass' : 'fail'}`;
  item.innerHTML = `<strong>${pass ? '✓' : '✕'}</strong><div><strong>${escapeHtml(name)}</strong><div>${escapeHtml(detail)}</div></div>`;
  resultsBox.appendChild(item);
}

function setStatus(message, state = '') {
  statusBox.className = `status ${state}`.trim();
  statusBox.textContent = message;
}

function restoreChecklist() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { saved = {}; }
  document.querySelectorAll('[data-check]').forEach(input => {
    input.checked = Boolean(saved[input.dataset.check]);
    input.addEventListener('change', saveChecklist);
  });
}

function saveChecklist() {
  const state = {};
  document.querySelectorAll('[data-check]').forEach(input => { state[input.dataset.check] = input.checked; });
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}

function markChecklist(key, checked) {
  const input = document.querySelector(`[data-check="${key}"]`);
  if (!input) return;
  input.checked = checked;
  saveChecklist();
}

function clearChecklist() {
  document.querySelectorAll('[data-check]').forEach(input => { input.checked = false; });
  localStorage.removeItem(CHECKLIST_KEY);
  setStatus('人工驗收勾選已清除。', 'pass');
}

async function createDemoSheetBlob() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cells = [
    { x: 60, y: 60, color: '#fb7185', kind: 'face' },
    { x: 620, y: 60, color: '#60a5fa', kind: 'star' },
    { x: 60, y: 620, color: '#34d399', kind: 'bubble' },
    { x: 620, y: 620, color: '#a78bfa', kind: 'rocket' }
  ];

  for (const cell of cells) drawDemoSticker(ctx, cell);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法建立示範 PNG。')), 'image/png');
  });
}

function drawDemoSticker(ctx, { x, y, color, kind }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(15, 23, 42, .18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = color;

  if (kind === 'face') {
    roundedRect(ctx, 75, 85, 370, 350, 92);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(185, 225, 35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(335, 225, 35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 24; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(260, 280, 95, .2, Math.PI - .2); ctx.stroke();
  }

  if (kind === 'star') {
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? 200 : 88;
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const px = 260 + Math.cos(angle) * radius;
      const py = 260 + Math.sin(angle) * radius;
      index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(260, 260, 54, 0, Math.PI * 2); ctx.fill();
  }

  if (kind === 'bubble') {
    roundedRect(ctx, 55, 80, 410, 300, 80); ctx.fill();
    ctx.beginPath(); ctx.moveTo(165, 355); ctx.lineTo(120, 455); ctx.lineTo(250, 370); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    for (const cx of [165, 260, 355]) { ctx.beginPath(); ctx.arc(cx, 230, 25, 0, Math.PI * 2); ctx.fill(); }
  }

  if (kind === 'rocket') {
    ctx.beginPath(); ctx.ellipse(270, 230, 125, 205, .55, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(315, 185, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.moveTo(145, 375); ctx.lineTo(80, 485); ctx.lineTo(205, 420); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(245, 425); ctx.lineTo(230, 510); ctx.lineTo(310, 445); ctx.closePath(); ctx.fill();
  }

  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
