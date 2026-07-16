import {
  AssetRoles,
  PackageCompressionModes,
  PackageFolderModes,
  PackageJobStatuses,
  PlatformSpecStatuses,
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
    renderDeliverySummary(snapshot);
    renderPreflight(snapshot);
    renderEntries(snapshot);
    renderHistory();
    renderJob(snapshot);
    syncSettingsControls();
  }

  function createSnapshot() {
    const frames = adapter.getExportFrames();
    const allFrames = adapter.getAllFrames?.() || frames;
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
    const platformSpec = adapter.getPlatformSpec?.() || null;
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
    return { frames, allFrames, packagePlan, platformSpec, entries, reviewReport, preflight, manifest, output, settings: local.settings };
  }

  function renderDeliverySummary(snapshot) {
    const holder = document.querySelector('#packageDeliverySummary');
    if (!holder) return;
    const roleCounts = snapshot.entries.reduce((counts, entry) => {
      const key = entry.role || AssetRoles.STICKER;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    const selectedIds = new Set(snapshot.frames.map(frame => frame.id));
    const backupCount = snapshot.allFrames.filter(frame => !selectedIds.has(frame.id) && frame.state?.visible !== false).length;
    const stickers = roleCounts[AssetRoles.STICKER] || 0;
    const hasMain = (roleCounts[AssetRoles.MAIN] || 0) > 0;
    const hasTab = (roleCounts[AssetRoles.TAB] || 0) > 0;
    const errors = snapshot.preflight.summary.errors;
    const warnings = snapshot.preflight.summary.warnings;
    const planned = isPlannedPlatform(snapshot);
    const ready = snapshot.preflight.ready && !planned;
    const statusLabel = planned ? `${snapshot.platformSpec.statusLabel || '即將支援'} · 此規格尚未開放輸出` : ready ? '可交付' : '需回 Review';
    const statusClass = planned ? 'bg-amber-50 text-amber-800 ring-amber-100' : ready ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' : 'bg-rose-50 text-rose-800 ring-rose-100';
    const specTitle = formatPlatformTitle(snapshot.platformSpec, snapshot.packagePlan);
    const namingRule = formatNamingRule(snapshot.platformSpec);
    const contentStructure = formatContentStructure({ main: hasMain, tab: hasTab, stickers, backupCount });
    holder.innerHTML = `<div class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Delivery Summary</p>
          <h3 class="mt-1 text-lg font-black text-slate-950">交付摘要</h3>
        </div>
        <div class="rounded-2xl px-4 py-2 text-sm font-black ring-1 ${statusClass}">${statusLabel}</div>
      </div>
      <div class="mt-4 grid gap-2 md:grid-cols-4">
        ${summaryTile('交付規格', specTitle, 'SPEC', planned ? 'bg-amber-50 text-amber-800 ring-amber-100' : 'bg-white text-slate-800 ring-slate-100')}
        ${summaryTile('命名規則', namingRule, 'NAME', 'bg-white text-slate-800 ring-slate-100')}
        ${summaryTile('內容結構', contentStructure, 'SET', 'bg-white text-slate-800 ring-slate-100')}
        ${summaryTile('備選', `${backupCount} 張`, 'ALT', 'bg-white text-sky-800 ring-sky-100')}
      </div>
      <div class="mt-2 grid gap-2 md:grid-cols-1">
        ${summaryTile('檢查', `${errors} 錯誤 · ${warnings} 警告`, 'QA', errors ? 'bg-rose-50 text-rose-800 ring-rose-100' : 'bg-emerald-50 text-emerald-800 ring-emerald-100')}
      </div>
    </div>`;
  }
  function renderWorkspaceShell() {
    return `<section id="stage-package" class="scroll-mt-40 rounded-[1.75rem] border border-amber-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Delivery Confirmation</p>
          <h2 class="text-xl font-black">交付確認</h2>
          <p class="mt-1 text-xs font-bold text-slate-400">Review 已完成編排與命名；這裡只確認內容、下載 PNG 或產生交付 ZIP。</p>
        </div>
        <button id="packageBackToReviewBtn" class="inline-flex h-11 items-center gap-2 rounded-2xl bg-sky-50 px-4 text-xs font-black text-sky-700 ring-1 ring-sky-100">${iconMark('←')}<span>回 Review 調整編排</span></button>
      </div>
      <div id="packageDeliverySummary" class="mt-4"></div>
      <div id="packagePreflight" class="mt-4"></div>
      <div id="packageProgress" class="mt-4"></div>
      <div class="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <button id="packageExportBtn" class="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-3xl bg-amber-400 px-5 text-sm font-black text-slate-950 shadow-sm">${iconMark('ZIP')}<span>產生交付 ZIP</span></button>
        <button id="packageDownloadAllPngBtn" class="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-3xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm">${iconMark('PNG')}<span>下載全部 PNG</span></button>
        <button id="packageCancelBtn" class="hidden min-h-[64px] rounded-3xl bg-rose-100 px-5 text-sm font-black text-rose-700">取消輸出</button>
      </div>
      <details id="packageFileDetails" class="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
        <summary class="cursor-pointer select-none text-sm font-black text-slate-700">查看交付明細 <span id="packageFileCount" class="ml-2 text-xs font-black text-slate-400"></span></summary>
        <div class="mt-3 grid gap-4 xl:grid-cols-[1fr_280px]">
          <div id="packageFileList" class="space-y-2"></div>
          <div><h3 class="text-sm font-black">最近輸出</h3><div id="packageHistory" class="mt-2 space-y-2"></div></div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button id="packageManifestJsonBtn" class="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-700">${iconMark('DOC')}<span>下載清單</span></button>
          <button id="packageCopyManifestBtn" class="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-700">${iconMark('COPY')}<span>複製清單</span></button>
        </div>
      </details>
    </section>`;
  }
  function renderSettingsShell() {
    const naming = adapter.getNamingSettings();
    return `<section class="rounded-[1.75rem] border border-amber-300 bg-slate-950 p-5 text-white shadow-sm">
      <p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Delivery · Confirm</p>
      <h2 class="mt-1 text-lg font-black">交付確認</h2>
      <p class="mt-1 text-xs font-bold text-slate-400">主流程只需要確認與輸出；需要改順序、數量、Main 或 Tab 時請回 Review。</p>
      <div id="reviewSummary" class="mt-4 space-y-2 text-sm"></div>
      <button id="downloadSelectedBtn" class="mt-4 w-full rounded-2xl bg-emerald-300 py-3 text-sm font-black text-slate-950">下載目前選取 PNG</button>
      <details id="packageAdvancedSettings" class="mt-4 rounded-2xl bg-white/5 p-3">
        <summary class="cursor-pointer select-none text-xs font-black text-slate-300">進階交付設定</summary>
        <div class="mt-3">
          <label class="block text-xs font-black text-slate-300">ZIP 檔名<input id="packageZipBaseNameInput" value="${escapeHtml(local.settings.zipBaseName)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label>
          <label class="mt-3 block text-xs font-black text-slate-300">ZIP 根資料夾<input id="packageRootFolderInput" value="${escapeHtml(local.settings.rootFolder)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label>
          <label class="mt-3 block text-xs font-black text-slate-300">資料夾模式<select id="packageFolderModeInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="flat">全部同層</option><option value="role">依角色分層</option><option value="source">依來源分層</option><option value="source-role">來源與角色分層</option></select></label>
          <label class="mt-3 block text-xs font-black text-slate-300">命名模式<select id="packageNamingModeInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="package">貼圖準則命名</option><option value="sequential">連號命名</option></select></label>
          <div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">前綴<input id="filenamePrefixInput" value="${escapeHtml(naming.prefix)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label><label class="text-xs font-black text-slate-300">後綴<input id="filenameSuffixInput" value="${escapeHtml(naming.suffix)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div>
          <div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">壓縮方式<select id="packageCompressionInput" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"><option value="store">不壓縮 PNG</option><option value="deflate">DEFLATE</option></select></label><label class="text-xs font-black text-slate-300">壓縮等級<input id="packageCompressionLevelInput" type="number" min="1" max="9" value="${local.settings.compressionLevel}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-slate-200">${toggleOption('packageManifestJsonInput','DOC','JSON 清單','包含交付明細')}${toggleOption('packageManifestCsvInput','CSV','CSV 清單','給表格檢查')}${toggleOption('packageChecksumsInput','#','校驗碼','確認檔案完整')}${toggleOption('packageReadmeInput','TXT','說明檔','包含交付摘要')}</div>
          <div class="mt-3 grid grid-cols-2 gap-2"><label class="text-xs font-black text-slate-300">單檔警示 KB<input id="maxFileSizeKBInput" type="number" min="1" max="102400" value="${naming.maxFileSizeKB}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label><label class="text-xs font-black text-slate-300">整包警示 MB<input id="packageMaxTotalMBInput" type="number" min="1" max="4096" value="${Math.round(local.settings.maxPackageSizeBytes / 1024 / 1024)}" class="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-white"></label></div>
          <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 opacity-60">
            <div class="text-[10px] font-black uppercase tracking-widest text-slate-500">進階角色工具</div>
            <div class="mt-2 grid grid-cols-2 gap-2"><button id="packageAutoRolesBtn" class="rounded-xl bg-white/10 px-2 py-2 text-xs font-black text-slate-300">按 Profile 分配</button><button id="packageAllStickerBtn" class="rounded-xl bg-white/10 px-2 py-2 text-xs font-black text-slate-300">全部設為 Sticker</button></div>
          </div>
        </div>
      </details>
    </section>`;
  }
  function bindEvents(workspace, settingsRoot) {
    workspace.querySelector('#packageBackToReviewBtn')?.addEventListener('click', () => adapter.openReview?.());
    workspace.querySelector('#packageDownloadAllPngBtn')?.addEventListener('click', downloadAllPngs);
    workspace.querySelector('#packageManifestJsonBtn')?.addEventListener('click', () => downloadManifest('json'));
    workspace.querySelector('#packageCopyManifestBtn')?.addEventListener('click', copyManifest);
    workspace.querySelector('#packageExportBtn')?.addEventListener('click', exportPackage);
    workspace.querySelector('#packageCancelBtn')?.addEventListener('click', cancelExport);
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
    const readyMessage = snapshot.preflight.ready
      ? '檢查通過，可以下載 PNG 或產生交付 ZIP。'
      : `需要回 Review 修正：${escapeHtml(snapshot.preflight.errors[0]?.message || '尚有交付問題')}`;
    holder.innerHTML = `<div class="rounded-3xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-black text-slate-950">內容檢查</h3>
        <div class="rounded-2xl ${snapshot.preflight.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'} px-3 py-2 text-xs font-black">${readyMessage}</div>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-4">
        ${metric(summary.imageCount, 'PNG 張數', 'PIC', 'bg-slate-950 text-white')}
        ${metric(summary.totalSizeLabel, '總大小', 'KB', 'bg-slate-100')}
        ${metric(summary.errors, '錯誤', '!', summary.errors ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}
        ${metric(summary.warnings, '警告', '?', 'bg-amber-100 text-amber-800')}
      </div>
    </div>`;
  }
  function renderEntries(snapshot) {
    const holder = document.querySelector('#packageFileList');
    const count = document.querySelector('#packageFileCount');
    if (count) count.textContent = `${snapshot.preflight.summary.imageCount} files · ${snapshot.preflight.summary.totalSizeLabel}`;
    holder.innerHTML = snapshot.entries.length
      ? snapshot.entries.map(entry => `<button data-package-frame="${entry.frameId}" class="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left"><span class="grid h-9 w-9 place-items-center rounded-xl ${entry.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} text-xs font-black">${entry.approved ? 'OK' : '!'}</span><span class="min-w-0"><span class="block truncate text-xs font-black">${escapeHtml(entry.path)}</span><span class="block truncate text-[10px] text-slate-400">${entry.approved ? '已核准' : '未核准'} · ${escapeHtml(entry.sourceName)} · ${entry.width}x${entry.height}</span></span><span class="text-xs font-black">${formatBytes(entry.bytes)}</span></button>`).join('')
      : '<div class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">尚未選取可交付圖片</div>';
    holder.querySelectorAll('[data-package-frame]').forEach(button => button.addEventListener('click', () => adapter.openFrame(button.dataset.packageFrame)));
  }
  function renderHistory() {
    const holder = document.querySelector('#packageHistory');
    holder.innerHTML = local.history.length
      ? local.history.map(item => `<div class="rounded-2xl bg-slate-50 p-3 text-xs"><div class="font-black">${escapeHtml(item.fileName)}</div><div class="mt-1 text-slate-400">${item.fileCount} files · ${item.sizeLabel}</div><div class="mt-1 font-black ${item.verified ? 'text-emerald-600' : 'text-rose-600'}">${item.verified ? 'ZIP 已驗證' : '驗證失敗'}</div></div>`).join('')
      : '<div class="rounded-2xl bg-slate-50 p-3 text-xs text-slate-400">尚未輸出任何檔案</div>';
  }
  function renderJob(snapshot = createSnapshot()) {
    const holder = document.querySelector('#packageProgress');
    const running = isRunning();
    holder.innerHTML = running || [PackageJobStatuses.COMPLETE, PackageJobStatuses.FAILED, PackageJobStatuses.CANCELLED].includes(local.job.status)
      ? `<div class="rounded-2xl bg-slate-950 p-3 text-white"><div class="flex justify-between text-xs font-black"><span>${stageLabel(local.job.stage)}</span><span>${local.job.progress}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div class="h-full bg-amber-400" style="width:${local.job.progress}%"></div></div>${local.job.current ? `<div class="mt-2 truncate text-[10px] text-slate-400">${escapeHtml(local.job.current)}</div>` : ''}${local.job.error ? `<div class="mt-2 text-xs text-rose-300">${escapeHtml(local.job.error)}</div>` : ''}</div>`
      : '';
    const planned = isPlannedPlatform(snapshot);
    const disabled = running || !snapshot.preflight.ready || planned;
    ['packageExportBtn', 'packageDownloadAllPngBtn', 'exportZipBtn'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = disabled;
      button.classList.toggle('opacity-40', disabled);
      button.title = planned ? '此規格尚未開放輸出' : '';
    });
    document.querySelector('#packageCancelBtn')?.classList.toggle('hidden', !running);
  }

  async function exportPackage() {
    if (isRunning()) return;
    const snapshot = createSnapshot();
    if (isPlannedPlatform(snapshot)) {
      adapter.alert('此規格尚未開放輸出');
      return;
    }
    if (!snapshot.preflight.ready) {
      const issue = snapshot.preflight.errors[0];
      if (issue?.frameId) adapter.openFrame(issue.frameId);
      adapter.alert(issue?.message || 'Package 尚未通過交付檢查');
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
      if (!cancelled) adapter.alert(error.message || 'ZIP 產生失敗');
    }
  }

  function cancelExport() {
    local.job.controller?.abort();
  }

  function downloadAllPngs() {
    const snapshot = createSnapshot();
    if (isPlannedPlatform(snapshot)) return adapter.alert('此規格尚未開放輸出');
    if (!snapshot.preflight.ready) return adapter.alert(snapshot.preflight.errors[0]?.message || 'Package 尚未通過交付檢查');
    snapshot.entries.forEach((entry, index) => setTimeout(() => adapter.downloadDataUrl(entry.canvas.toDataURL('image/png'), entry.fileName), index * 80));
  }

  function downloadManifest(format = 'json') {
    const snapshot = createSnapshot();
    if (!snapshot.entries.length) return adapter.alert('尚未選取可交付圖片');
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
      setTimeout(() => { if (button.isConnected) button.innerHTML = `${iconMark('COPY')}<span>複製清單</span>`; }, 1200);
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

  function exportState() {
    return {
      settings: cloneProjectValue(local.settings),
      history: cloneProjectValue(local.history)
    };
  }

  function importState(value = null) {
    const next = value || {};
    local.settings = createPackageDeliverySettings(next.settings || {});
    local.history = Array.isArray(next.history) ? cloneProjectValue(next.history).slice(0, 20) : [];
    local.job = createIdleJob();
    refresh();
  }

  return { mount, refresh, exportPackage, cancelExport, getSnapshot: createSnapshot, exportState, importState };
}

function isPlannedPlatform(snapshot) {
  return snapshot.platformSpec?.status === PlatformSpecStatuses.PLANNED;
}

function formatPlatformTitle(platformSpec, packagePlan) {
  const label = platformSpec?.deliveryLabel || platformSpec?.label || packagePlan?.destinationName || packagePlan?.profileName || '目前交付規格';
  return platformSpec?.statusLabel ? `${label} · ${platformSpec.statusLabel}` : label;
}

function formatNamingRule(platformSpec) {
  const naming = platformSpec?.naming || {};
  if (naming.main || naming.tab) {
    return [naming.main, naming.tab, naming.stickerStart].filter(Boolean).join(' / ');
  }
  return naming.stickerStart ? `${naming.stickerStart}, 02.png...` : '依目前檔名規則';
}

function formatContentStructure({ main = false, tab = false, stickers = 0, backupCount = 0 } = {}) {
  return `Main ${main ? '1' : '0'} · Tab ${tab ? '1' : '0'} · 貼圖 ${stickers} · 備選 ${backupCount}`;
}

function iconMark(label) {
  return `<span aria-hidden="true" class="grid h-7 min-w-7 place-items-center rounded-xl bg-white/70 px-2 text-[10px] font-black text-slate-950 shadow-sm">${label}</span>`;
}

function toggleOption(id, icon, title, description) {
  return `<label class="flex min-h-[64px] items-center gap-2 rounded-2xl bg-white/10 p-2"><input id="${id}" type="checkbox" class="h-4 w-4 accent-amber-400"><span class="grid h-9 min-w-9 place-items-center rounded-xl bg-white/15 px-2 text-[10px] font-black">${icon}</span><span class="min-w-0"><span class="block truncate">${title}</span><span class="block truncate text-[10px] text-slate-400">${description}</span></span></label>`;
}

function summaryTile(label, value, icon, className) {
  return `<div class="rounded-2xl p-3 ring-1 ${className}"><div class="flex items-center justify-between gap-2"><div class="min-w-0 text-sm font-black">${value}</div><span class="grid h-8 min-w-8 place-items-center rounded-xl bg-white/70 px-2 text-[10px] font-black text-slate-950">${icon}</span></div><div class="mt-1 text-[10px] font-black uppercase tracking-widest opacity-70">${label}</div></div>`;
}

function metric(value, label, icon, className) {
  return `<div class="rounded-2xl ${className} p-3"><div class="flex items-center justify-between gap-2"><div class="text-2xl font-black">${value}</div><span class="grid h-8 min-w-8 place-items-center rounded-xl bg-white/60 px-2 text-[10px] font-black text-slate-950">${icon}</span></div><div class="mt-1 text-[10px] font-black uppercase tracking-widest opacity-70">${label}</div></div>`;
}

function stageLabel(stage) {
  return ({
    idle: '待命',
    preparing: '準備檔案',
    hashing: '計算 SHA-256',
    compressing: '產生 ZIP',
    verifying: '驗證 ZIP',
    complete: '完成',
    cancelled: '已取消',
    failed: '失敗'
  })[stage] || stage;
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

function cloneProjectValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
