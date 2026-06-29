import {
  AssetRoles,
  PackageCompressionModes,
  PackageFolderModes,
  PackageJobStatuses,
  buildPackageEntries,
  createCompletePackageArchive,
  createPackageDeliverySettings,
  createPackageManifest,
  createPackageManifestCsv,
  createPackagePreflight,
  formatBytes
} from '../core/index.js';

export function createPackageController(adapter) {
  if (!adapter) throw new Error('Package controller requires an adapter.');

  const local = {
    settings: createPackageDeliverySettings({
      zipBaseName: 'stixio-package',
      folderMode: PackageFolderModes.FLAT,
      includeManifestJson: true,
      includeManifestCsv: false,
      includeChecksums: true,
      includeReadme: true,
      compression: PackageCompressionModes.STORE,
      compressionLevel: 6,
      maxPackageSizeMB: 200
    }),
    job: createIdleJob(),
    history: []
  };

  function mount(root = document) {
    const workspace = root.querySelector?.('#packageWorkspaceRoot') || document.querySelector('#packageWorkspaceRoot');
    const settingsRoot = root.querySelector?.('#packageSettingsRoot') || document.querySelector('#packageSettingsRoot');
    if (!workspace || !settingsRoot) return false;
    workspace.innerHTML = renderWorkspaceShell();
    settingsRoot.innerHTML = renderSettingsShell();
    bindEvents(workspace, settingsRoot);
    refresh();
    return true;
  }

  function refresh() {
    const workspace = document.querySelector('#packageWorkspaceRoot');
    const settingsRoot = document.querySelector('#packageSettingsRoot');
    if (!workspace || !settingsRoot) return;
    const snapshot = createSnapshot();
    renderPreflight(snapshot);
    renderEntries(snapshot);
    renderHistory();
    renderJob(snapshot);
    syncSettingsControls();
  }

  function createSnapshot() {
    const frames = adapter.getExportFrames();
    frames.forEach(frame => adapter.ensureRendered(frame));
    const packagePlan = adapter.getPackagePlan(frames);
    const entries = buildPackageEntries({
      items: packagePlan.items,
      frames,
      renderedMap: adapter.getRenderedMap(),
      sourceNames: adapter.getSourceNames(),
      settings: local.settings
    });
    const reviewReport = adapter.getReviewReport();
    const preflight = createPackagePreflight({ entries, packagePlan, reviewReport, settings: local.settings });
    const output = adapter.getOutputMetadata();
    const manifest = createPackageManifest({
      entries,
      settings: local.settings,
      metadata: {
        documentId: output.documentId,
        documentName: output.documentName,
        targetW: output.targetW,
        targetH: output.targetH,
        category: output.category,
        safeMargin: output.safeMargin,
        destinationKey: packagePlan.destinationKey
      }
    });
    return { frames, packagePlan, entries, reviewReport, preflight, manifest, output };
  }

  function renderWorkspaceShell() {
    return `<section id="stage-package" class="scroll-mt-40 rounded-[1.75rem] border border-amber-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Delivery Engine</p>
          <h2 class="text-xl font-black">封裝、Manifest 與完整性驗證</h2>
          <p class="mt-1 text-xs font-bold text-slate-400">確認最終路徑、檔案大小與核准狀態，再產生可驗證的 ZIP 交付包。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="packageDownloadAllPngBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">下載全部 PNG</button>
          <button id="packageManifestJsonBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">下載 Manifest</button>
          <button id="packageCopyManifestBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">複製 Manifest</button>
          <button id="packageExportBtn" class="rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950">產生 ZIP</button>
          <button id="packageCancelBtn" class="hidden rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-700">取消</button>
        </div>
      </div>
      <div id="packagePreflight" class="mt-4"></div>
      <div id="packageProgress" class="mt-4"></div>
      <div class="mt-4 grid gap-4 xl:grid-cols-[1fr_280px]">
        <div>
          <div class="mb-2 flex items-center justify-between"><h3 class="text-sm font-black">ZIP 內容</h3><span id="packageFileCount" class="text-xs font-black text-slate-400"></span></div>
          <div id="packageFileList" class="space-y-2"></div>
        </div>
        <div><h3 class="text-sm font-black">最近輸出</h3><div id="packageHistory" class="mt-2 space-y-2"></div></div>
      </div>
    </section>`;
  }

  function renderSettingsShell() {
    const naming = adapter.getNamingSettings();
    return `<section class="rounded-[1.75rem] border border-amber-300 bg-slate-950 p-5 text-white shadow-sm">
      <p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Package · Settings</p>
      <h2 class="mt-1 text-lg font-black">交付內容設定</h2>
      <label class="mt-4 block text-xs font-black text-slate-300">ZIP 檔名<input id="packageZipBaseNameInput" value="${escapeHtml(local.settings.zipBaseName)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label>
      <label class="mt-3 block text-xs font-black text-slate-300">ZIP 根目錄（可留空）<input id="packageRootFolderInput" value="${escapeHtml(local.settings.rootFolder)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label>
      <label class="mt-3 block text-xs font-black text-slate-300">資料夾結構<select id="packageFolderModeInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="flat">全部平放</option><option value="role">按角色分類</option><option value="source">按來源分類</option><option value="source-role">來源／角色雙層</option></select></label>
      <label class="mt-3 block text-xs font-black text-slate-300">命名模式<select id="packageNamingModeInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="package">角色命名</option><option value="sequential">自訂流水號</option></select></label>
      <div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">前綴<input id="filenamePrefixInput" value="${escapeHtml(naming.prefix)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label><label class="text-xs font-black text-slate-300">後綴<input id="filenameSuffixInput" value="${escapeHtml(naming.suffix)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div>
      <div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">壓縮方式<select id="packageCompressionInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="store">不重壓 PNG</option><option value="deflate">DEFLATE</option></select></label><label class="text-xs font-black text-slate-300">壓縮等級<input id="packageCompressionLevelInput" type="number" min="1" max="9" value="${local.settings.compressionLevel}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-slate-200"><label class="rounded-xl bg-white/10 p-2"><input id="packageManifestJsonInput" type="checkbox"> JSON Manifest</label><label class="rounded-xl bg-white/10 p-2"><input id="packageManifestCsvInput" type="checkbox"> CSV Manifest</label><label class="rounded-xl bg-white/10 p-2"><input id="packageChecksumsInput" type="checkbox"> SHA-256</label><label class="rounded-xl bg-white/10 p-2"><input id="packageReadmeInput" type="checkbox"> README</label></div>
      <div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">單檔警告 KB<input id="maxFileSizeKBInput" type="number" min="1" max="102400" value="${naming.maxFileSizeKB}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label><label class="text-xs font-black text-slate-300">總包警告 MB<input id="packageMaxTotalMBInput" type="number" min="1" max="4096" value="${Math.round(local.settings.maxPackageSizeBytes / 1024 / 1024)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div>
      <div class="mt-3 grid grid-cols-2 gap-2"><button id="packageAutoRolesBtn" class="rounded-xl bg-amber-400 px-2 py-2 text-xs font-black text-slate-950">快速分配 Main／Tab</button><button id="packageAllStickerBtn" class="rounded-xl bg-white/10 px-2 py-2 text-xs font-black">全部設為 Sticker</button></div>
      <div id="reviewSummary" class="mt-4 space-y-2 text-sm"></div>
      <button id="downloadSelectedBtn" class="mt-4 w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950">下載目前 PNG</button>
    </section>`;
  }

  function bindEvents(workspace, settingsRoot) {
    workspace.querySelector('#packageDownloadAllPngBtn').addEventListener('click', downloadAllPngs);
    workspace.querySelector('#packageManifestJsonBtn').addEventListener('click', () => downloadManifest('json'));
    workspace.querySelector('#packageCopyManifestBtn').addEventListener('click', copyManifest);
    workspace.querySelector('#packageExportBtn').addEventListener('click', exportPackage);
    workspace.querySelector('#packageCancelBtn').addEventListener('click', cancelExport);
    settingsRoot.querySelector('#packageZipBaseNameInput').addEventListener('input', event => setDeliverySetting('zipBaseName', event.target.value));
    settingsRoot.querySelector('#packageRootFolderInput').addEventListener('input', event => setDeliverySetting('rootFolder', event.target.value));
    settingsRoot.querySelector('#packageFolderModeInput').addEventListener('change', event => setDeliverySetting('folderMode', event.target.value));
    settingsRoot.querySelector('#packageCompressionInput').addEventListener('change', event => setDeliverySetting('compression', event.target.value));
    settingsRoot.querySelector('#packageCompressionLevelInput').addEventListener('change', event => setDeliverySetting('compressionLevel', Number(event.target.value)));
    settingsRoot.querySelector('#packageManifestJsonInput').addEventListener('change', event => setDeliverySetting('includeManifestJson', event.target.checked));
    settingsRoot.querySelector('#packageManifestCsvInput').addEventListener('change', event => setDeliverySetting('includeManifestCsv', event.target.checked));
    settingsRoot.querySelector('#packageChecksumsInput').addEventListener('change', event => setDeliverySetting('includeChecksums', event.target.checked));
    settingsRoot.querySelector('#packageReadmeInput').addEventListener('change', event => setDeliverySetting('includeReadme', event.target.checked));
    settingsRoot.querySelector('#packageMaxTotalMBInput').addEventListener('change', event => setDeliverySetting('maxPackageSizeMB', Number(event.target.value)));
    settingsRoot.querySelector('#packageNamingModeInput').addEventListener('change', event => adapter.updateNamingSetting('mode', event.target.value));
    settingsRoot.querySelector('#filenamePrefixInput').addEventListener('input', event => adapter.updateNamingSetting('prefix', event.target.value));
    settingsRoot.querySelector('#filenameSuffixInput').addEventListener('input', event => adapter.updateNamingSetting('suffix', event.target.value));
    settingsRoot.querySelector('#maxFileSizeKBInput').addEventListener('change', event => adapter.updateNamingSetting('maxFileSizeKB', Number(event.target.value)));
    settingsRoot.querySelector('#packageAutoRolesBtn').addEventListener('click', () => adapter.assignRoles('auto'));
    settingsRoot.querySelector('#packageAllStickerBtn').addEventListener('click', () => adapter.assignRoles('sticker'));
    settingsRoot.querySelector('#downloadSelectedBtn').addEventListener('click', adapter.downloadSelectedPng);
  }

  function setDeliverySetting(key, value) {
    local.settings = createPackageDeliverySettings({
      ...local.settings,
      [key]: value,
      maxPackageSizeMB: key === 'maxPackageSizeMB' ? value : local.settings.maxPackageSizeBytes / 1024 / 1024
    });
    refresh();
  }

  function syncSettingsControls() {
    const naming = adapter.getNamingSettings();
    setControlValue('packageFolderModeInput', local.settings.folderMode);
    setControlValue('packageCompressionInput', local.settings.compression);
    setControlValue('packageCompressionLevelInput', local.settings.compressionLevel);
    setControlValue('packageNamingModeInput', naming.mode);
    setControlValue('filenamePrefixInput', naming.prefix);
    setControlValue('filenameSuffixInput', naming.suffix);
    setControlValue('maxFileSizeKBInput', naming.maxFileSizeKB);
    setControlChecked('packageManifestJsonInput', local.settings.includeManifestJson);
    setControlChecked('packageManifestCsvInput', local.settings.includeManifestCsv);
    setControlChecked('packageChecksumsInput', local.settings.includeChecksums);
    setControlChecked('packageReadmeInput', local.settings.includeReadme);
  }

  function renderPreflight(snapshot) {
    const holder = document.querySelector('#packagePreflight');
    const summary = snapshot.preflight.summary;
    holder.innerHTML = `<div class="grid gap-2 sm:grid-cols-4">
      ${metric(summary.imageCount, 'PNG files', 'bg-slate-950 text-white')}
      ${metric(summary.totalSizeLabel, 'Estimated', 'bg-slate-100')}
      ${metric(summary.errors, 'Errors', summary.errors ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}
      ${metric(summary.warnings, 'Warnings', 'bg-amber-100 text-amber-800')}
    </div><div class="mt-3 rounded-2xl ${snapshot.preflight.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'} p-3 text-sm font-black">${snapshot.preflight.ready ? '✓ Package 已通過預檢，可產生 ZIP' : escapeHtml(snapshot.preflight.errors[0]?.message || 'Package 尚未就緒')}</div>`;
  }

  function renderEntries(snapshot) {
    const holder = document.querySelector('#packageFileList');
    document.querySelector('#packageFileCount').textContent = `${snapshot.preflight.summary.imageCount} files · ${snapshot.preflight.summary.totalSizeLabel}`;
    holder.innerHTML = snapshot.entries.length
      ? snapshot.entries.map(entry => `<button data-package-frame="${entry.frameId}" class="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left"><span class="rounded-xl ${entry.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} px-2 py-1 text-[10px] font-black">${entry.approved ? 'APPROVED' : 'PENDING'}</span><span class="min-w-0"><span class="block truncate text-xs font-black">${escapeHtml(entry.path)}</span><span class="block truncate text-[10px] text-slate-400">${escapeHtml(entry.name)} · ${escapeHtml(entry.sourceName)} · ${entry.width}×${entry.height}</span></span><span class="text-xs font-black">${formatBytes(entry.bytes)}</span></button>`).join('')
      : '<div class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">沒有可封裝檔案</div>';
    holder.querySelectorAll('[data-package-frame]').forEach(button => button.addEventListener('click', () => adapter.openFrame(button.dataset.packageFrame)));
  }

  function renderHistory() {
    const holder = document.querySelector('#packageHistory');
    holder.innerHTML = local.history.length
      ? local.history.map(item => `<div class="rounded-2xl bg-slate-50 p-3 text-xs"><div class="font-black">${escapeHtml(item.fileName)}</div><div class="mt-1 text-slate-400">${item.fileCount} files · ${item.sizeLabel}</div><div class="mt-1 font-black ${item.verified ? 'text-emerald-600' : 'text-rose-600'}">${item.verified ? '✓ ZIP verified' : 'Verification failed'}</div></div>`).join('')
      : '<div class="rounded-2xl bg-slate-50 p-3 text-xs text-slate-400">尚無輸出紀錄</div>';
  }

  function renderJob(snapshot = createSnapshot()) {
    const holder = document.querySelector('#packageProgress');
    const running = isRunning();
    holder.innerHTML = running || [PackageJobStatuses.COMPLETE, PackageJobStatuses.FAILED, PackageJobStatuses.CANCELLED].includes(local.job.status)
      ? `<div class="rounded-2xl bg-slate-950 p-3 text-white"><div class="flex justify-between text-xs font-black"><span>${stageLabel(local.job.stage)}</span><span>${local.job.progress}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div class="h-full bg-amber-400" style="width:${local.job.progress}%"></div></div>${local.job.current ? `<div class="mt-2 truncate text-[10px] text-slate-400">${escapeHtml(local.job.current)}</div>` : ''}${local.job.error ? `<div class="mt-2 text-xs text-rose-300">${escapeHtml(local.job.error)}</div>` : ''}</div>`
      : '';
    const disabled = running || !snapshot.preflight.ready;
    ['packageExportBtn', 'exportZipBtn'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = disabled;
      button.classList.toggle('opacity-40', disabled);
    });
    document.querySelector('#packageCancelBtn')?.classList.toggle('hidden', !running);
  }

  async function exportPackage() {
    if (isRunning()) return;
    const snapshot = createSnapshot();
    if (!snapshot.preflight.ready) {
      const issue = snapshot.preflight.errors[0];
      if (issue?.frameId) adapter.openFrame(issue.frameId);
      adapter.alert(issue?.message || 'Package 尚未通過預檢。');
      return;
    }
    const controller = new AbortController();
    local.job = { ...createIdleJob(), status: PackageJobStatuses.PREPARING, stage: PackageJobStatuses.PREPARING, controller };
    renderJob(snapshot);
    try {
      const result = await createCompletePackageArchive({
        entries: snapshot.entries,
        settings: local.settings,
        metadata: {
          documentId: snapshot.output.documentId,
          documentName: snapshot.output.documentName,
          targetW: snapshot.output.targetW,
          targetH: snapshot.output.targetH,
          category: snapshot.output.category,
          safeMargin: snapshot.output.safeMargin,
          destinationKey: snapshot.packagePlan.destinationKey
        },
        JSZipClass: adapter.getJSZipClass(),
        signal: controller.signal,
        onProgress(update) {
          local.job = { ...local.job, status: update.stage, stage: update.stage, progress: update.percent || 0, current: update.current || null };
          renderJob(snapshot);
        }
      });
      local.job = { ...local.job, status: PackageJobStatuses.COMPLETE, stage: PackageJobStatuses.COMPLETE, progress: 100, controller: null, result };
      local.history.unshift({ fileName: result.fileName, fileCount: result.verification.actualCount, sizeLabel: formatBytes(result.blob.size), verified: result.verification.verified });
      local.history = local.history.slice(0, 5);
      adapter.downloadBlob(result.blob, result.fileName);
      refresh();
    } catch (error) {
      const cancelled = error.name === 'AbortError';
      local.job = { ...local.job, status: cancelled ? PackageJobStatuses.CANCELLED : PackageJobStatuses.FAILED, stage: cancelled ? PackageJobStatuses.CANCELLED : PackageJobStatuses.FAILED, progress: local.job.progress, controller: null, error: cancelled ? null : String(error.message || error) };
      refresh();
      if (!cancelled) adapter.alert(error.message || 'ZIP 匯出失敗');
    }
  }

  function cancelExport() {
    local.job.controller?.abort();
  }

  function downloadAllPngs() {
    const snapshot = createSnapshot();
    if (!snapshot.preflight.ready) return adapter.alert(snapshot.preflight.errors[0]?.message || 'Package 尚未就緒。');
    snapshot.entries.forEach((entry, index) => setTimeout(() => adapter.downloadDataUrl(entry.canvas.toDataURL('image/png'), entry.fileName), index * 80));
  }

  function downloadManifest(format = 'json') {
    const snapshot = createSnapshot();
    if (!snapshot.entries.length) return adapter.alert('沒有可輸出的檔案。');
    const text = format === 'csv' ? createPackageManifestCsv(snapshot.entries) : JSON.stringify(snapshot.manifest, null, 2);
    adapter.downloadText(text, `${snapshot.settings.manifestBaseName}.${format}`, format === 'csv' ? 'text/csv' : 'application/json');
  }

  async function copyManifest() {
    const snapshot = createSnapshot();
    if (!snapshot.entries.length) return;
    const text = JSON.stringify(snapshot.manifest, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      const button = document.querySelector('#packageCopyManifestBtn');
      button.textContent = '已複製';
      setTimeout(() => { if (button.isConnected) button.textContent = '複製 Manifest'; }, 1200);
    } catch {
      adapter.downloadText(text, `${snapshot.settings.manifestBaseName}.json`, 'application/json');
    }
  }

  function isRunning() {
    return [PackageJobStatuses.PREPARING, PackageJobStatuses.HASHING, PackageJobStatuses.COMPRESSING, PackageJobStatuses.VERIFYING].includes(local.job.status);
  }

  function createIdleJob() {
    return { status: PackageJobStatuses.IDLE, stage: PackageJobStatuses.IDLE, progress: 0, current: null, controller: null, result: null, error: null };
  }

  return { mount, refresh, exportPackage, cancelExport, getSnapshot: createSnapshot };
}

function metric(value, label, className) {
  return `<div class="rounded-2xl ${className} p-3"><div class="text-2xl font-black">${value}</div><div class="text-[10px] font-black uppercase tracking-widest opacity-70">${label}</div></div>`;
}

function stageLabel(stage) {
  return ({ idle: '等待封裝', preparing: '準備檔案', hashing: '計算 SHA-256', compressing: '產生 ZIP', verifying: '驗證 ZIP', complete: '封裝完成', cancelled: '已取消', failed: '封裝失敗' })[stage] || stage;
}

function setControlValue(id, value) {
  const control = document.getElementById(id);
  if (control && document.activeElement !== control) control.value = value ?? '';
}

function setControlChecked(id, value) {
  const control = document.getElementById(id);
  if (control) control.checked = Boolean(value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
