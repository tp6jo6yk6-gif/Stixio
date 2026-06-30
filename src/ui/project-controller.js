import {
  WORKSHOP_PROJECT_EXTENSION,
  createProjectStorage,
  createStixioProjectArchive,
  parseStixioProjectArchive,
  projectSummary
} from '../core/index.js';

export function createProjectController(adapter, options = {}) {
  if (!adapter) throw new Error('Project controller requires an adapter.');
  const storage = options.storage || createProjectStorage(options.storageOptions || {});
  const autosaveDelay = Math.max(250, Number(options.autosaveDelay || 1200));
  const local = {
    mounted: false,
    initialized: false,
    dirty: false,
    saving: false,
    exporting: false,
    lastFingerprint: null,
    lastSavedAt: null,
    autosaveTimer: null,
    pollTimer: null,
    recentOpen: false,
    status: '尚未儲存',
    error: null
  };

  function mount(root = document) {
    const holder = root.querySelector?.('#projectToolbarRoot') || document.querySelector('#projectToolbarRoot');
    if (!holder) return false;
    holder.innerHTML = renderToolbar();
    bindEvents(holder);
    local.mounted = true;
    refresh();
    if (!local.initialized) initialize();
    return true;
  }

  async function initialize() {
    local.initialized = true;
    try {
      const autosave = await storage.getLatestAutosave();
      if (autosave && adapter.isProjectEmpty?.()) {
        await restoreSnapshot(autosave, { status: '已恢復自動保存', saveToLibrary: false });
      }
      local.lastFingerprint = await adapter.getProjectFingerprint();
      startChangePolling();
    } catch (error) {
      setError(error);
    }
    refresh();
  }

  function renderToolbar() {
    return `<div class="mx-auto max-w-[1600px] px-5 pb-3">
      <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-900/10 bg-white p-2 shadow-sm">
        <input id="projectNameInput" class="min-w-[180px] flex-1 rounded-xl bg-slate-50 px-3 py-2 text-sm font-black" aria-label="專案名稱">
        <button id="projectNewBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">新建</button>
        <button id="projectSaveBtn" class="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950">儲存</button>
        <button id="projectSaveAsBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">另存</button>
        <label class="cursor-pointer rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">開啟<input id="projectOpenInput" type="file" accept="${WORKSHOP_PROJECT_EXTENSION},application/x-stixio-project,application/zip" class="hidden"></label>
        <button id="projectExportBtn" class="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">匯出 .stixio</button>
        <button id="projectRecentBtn" class="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">最近專案</button>
        <span id="projectAutosaveStatus" class="ml-auto rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500"></span>
      </div>
      <div id="projectProgress" class="mt-2 hidden rounded-xl bg-slate-950 p-3 text-xs font-black text-white"></div>
      <div id="projectRecentPanel" class="mt-2 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"></div>
    </div>`;
  }

  function bindEvents(holder) {
    holder.querySelector('#projectNameInput').addEventListener('input', event => {
      adapter.renameProject(event.target.value || 'Untitled Project');
      markDirty('名稱已修改');
    });
    holder.querySelector('#projectNewBtn').addEventListener('click', newProject);
    holder.querySelector('#projectSaveBtn').addEventListener('click', () => saveProject());
    holder.querySelector('#projectSaveAsBtn').addEventListener('click', saveProjectAs);
    holder.querySelector('#projectExportBtn').addEventListener('click', exportProject);
    holder.querySelector('#projectRecentBtn').addEventListener('click', toggleRecent);
    holder.querySelector('#projectOpenInput').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) await openProjectFile(file);
    });
    if (!globalThis.__stixioProjectShortcutsBound) {
      globalThis.__stixioProjectShortcutsBound = true;
      window.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          saveProject();
        }
      });
      window.addEventListener('beforeunload', event => {
        if (!local.dirty) return;
        event.preventDefault();
        event.returnValue = '';
      });
    }
  }

  async function newProject() {
    if (local.dirty && !adapter.confirm('目前專案有尚未儲存的變更，確定要建立新專案？')) return;
    const previousId = adapter.getProjectInfo().id;
    await adapter.resetProject();
    if (previousId) await storage.clearAutosave(previousId);
    local.dirty = false;
    local.lastSavedAt = null;
    local.lastFingerprint = await adapter.getProjectFingerprint();
    local.status = '新專案';
    local.error = null;
    closeRecent();
    refresh();
  }

  async function saveProject({ snapshot = null, status = '已儲存' } = {}) {
    if (local.saving) return null;
    local.saving = true;
    local.status = '儲存中…';
    refresh();
    try {
      const project = snapshot || await adapter.captureProjectSnapshot();
      const saved = await storage.saveProject(project);
      await storage.clearAutosave(saved.id);
      local.dirty = false;
      local.lastSavedAt = saved.updatedAt;
      local.lastFingerprint = await adapter.getProjectFingerprint();
      local.status = status;
      local.error = null;
      return saved;
    } catch (error) {
      setError(error);
      return null;
    } finally {
      local.saving = false;
      refresh();
    }
  }

  async function saveProjectAs() {
    const current = await adapter.captureProjectSnapshot();
    const suggested = `${current.name || 'Untitled Project'} Copy`;
    const name = adapter.prompt('另存新專案名稱', suggested);
    if (!name) return;
    const copyId = createId('project');
    const copy = {
      ...current,
      id: copyId,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      document: { ...current.document, id: copyId, name }
    };
    await restoreSnapshot(copy, { status: '已另存新專案', saveToLibrary: true });
  }

  async function exportProject() {
    if (local.exporting) return;
    local.exporting = true;
    local.error = null;
    updateProgress('準備專案', 0);
    refresh();
    try {
      const snapshot = await adapter.captureProjectSnapshot();
      const result = await createStixioProjectArchive({
        snapshot,
        JSZipClass: adapter.getJSZipClass(),
        previewDataUrl: adapter.getProjectPreviewDataUrl?.() || null,
        onProgress(update) {
          updateProgress(stageLabel(update.stage), update.percent || 0, update.current);
        }
      });
      adapter.downloadBlob(result.blob, result.fileName);
      local.status = '已匯出 .stixio';
      updateProgress('匯出完成', 100);
      setTimeout(clearProgress, 1500);
    } catch (error) {
      setError(error);
      updateProgress('匯出失敗', 0, error.message);
    } finally {
      local.exporting = false;
      refresh();
    }
  }

  async function openProjectFile(file) {
    if (local.dirty && !adapter.confirm('目前專案有尚未儲存的變更，確定要開啟其他專案？')) return;
    updateProgress('讀取專案', 10, file.name);
    try {
      const parsed = await parseStixioProjectArchive({ blob: file, JSZipClass: adapter.getJSZipClass() });
      await restoreSnapshot(parsed.snapshot, { status: '專案已開啟', saveToLibrary: true });
      updateProgress('專案已開啟', 100);
      setTimeout(clearProgress, 1200);
    } catch (error) {
      setError(error);
      updateProgress('無法開啟專案', 0, error.message);
      adapter.alert(error.message || '無法開啟 .stixio 專案。');
    }
  }

  async function restoreSnapshot(snapshot, { status = '專案已恢復', saveToLibrary = false } = {}) {
    await adapter.restoreProjectSnapshot(snapshot);
    if (saveToLibrary) await storage.saveProject(snapshot);
    await storage.saveAutosave(snapshot);
    local.dirty = false;
    local.lastSavedAt = snapshot.updatedAt || new Date().toISOString();
    local.lastFingerprint = await adapter.getProjectFingerprint();
    local.status = status;
    local.error = null;
    closeRecent();
    refresh();
  }

  function markDirty(status = '尚未儲存') {
    local.dirty = true;
    local.status = status;
    local.error = null;
    scheduleAutosave();
    refresh();
  }

  function startChangePolling() {
    clearInterval(local.pollTimer);
    local.pollTimer = setInterval(async () => {
      try {
        const fingerprint = await adapter.getProjectFingerprint();
        if (local.lastFingerprint == null) {
          local.lastFingerprint = fingerprint;
          return;
        }
        if (fingerprint !== local.lastFingerprint) {
          local.lastFingerprint = fingerprint;
          markDirty('自動保存排程中');
        }
      } catch {
        // Avoid interrupting editing when a transient canvas is unavailable.
      }
    }, Math.max(400, Math.floor(autosaveDelay / 2)));
  }

  function scheduleAutosave() {
    clearTimeout(local.autosaveTimer);
    local.autosaveTimer = setTimeout(runAutosave, autosaveDelay);
  }

  async function runAutosave() {
    if (!local.dirty || local.saving || local.exporting) return;
    local.status = '自動保存中…';
    refresh();
    try {
      const snapshot = await adapter.captureProjectSnapshot();
      const saved = await storage.saveAutosave(snapshot);
      local.lastSavedAt = saved.updatedAt;
      local.status = '已自動保存';
      local.error = null;
    } catch (error) {
      setError(error);
    }
    refresh();
  }

  async function toggleRecent() {
    local.recentOpen = !local.recentOpen;
    await renderRecent();
  }

  function closeRecent() {
    local.recentOpen = false;
    const panel = document.querySelector('#projectRecentPanel');
    panel?.classList.add('hidden');
  }

  async function renderRecent() {
    const panel = document.querySelector('#projectRecentPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !local.recentOpen);
    if (!local.recentOpen) return;
    const projects = await storage.listProjects();
    panel.innerHTML = `<div class="mb-2 flex items-center justify-between"><div class="text-sm font-black">最近專案</div><button id="projectRecentCloseBtn" class="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">關閉</button></div><div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">${projects.length ? projects.map(recentCard).join('') : '<div class="rounded-xl bg-slate-50 p-4 text-xs text-slate-400">尚無已儲存專案</div>'}</div>`;
    panel.querySelector('#projectRecentCloseBtn')?.addEventListener('click', closeRecent);
    panel.querySelectorAll('[data-project-open]').forEach(button => button.addEventListener('click', async () => {
      if (local.dirty && !adapter.confirm('目前有尚未儲存的變更，確定開啟此專案？')) return;
      const project = await storage.loadProject(button.dataset.projectOpen);
      if (project) await restoreSnapshot(project, { status: '已開啟最近專案', saveToLibrary: false });
    }));
    panel.querySelectorAll('[data-project-duplicate]').forEach(button => button.addEventListener('click', async () => {
      await storage.duplicateProject(button.dataset.projectDuplicate);
      await renderRecent();
    }));
    panel.querySelectorAll('[data-project-delete]').forEach(button => button.addEventListener('click', async () => {
      if (!adapter.confirm('確定刪除此專案？')) return;
      await storage.deleteProject(button.dataset.projectDelete);
      await storage.clearAutosave(button.dataset.projectDelete);
      await renderRecent();
    }));
  }

  function refresh() {
    if (!local.mounted) return;
    const info = adapter.getProjectInfo();
    const input = document.querySelector('#projectNameInput');
    if (input && document.activeElement !== input) input.value = info.name || 'Untitled Project';
    const status = document.querySelector('#projectAutosaveStatus');
    if (status) {
      status.textContent = local.error ? `錯誤 · ${local.error}` : `${local.dirty ? '● ' : '✓ '}${local.status}${local.lastSavedAt ? ` · ${formatTime(local.lastSavedAt)}` : ''}`;
      status.className = `ml-auto rounded-full px-3 py-1 text-[10px] font-black ${local.error ? 'bg-rose-100 text-rose-700' : local.dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`;
    }
    const save = document.querySelector('#projectSaveBtn');
    if (save) save.disabled = local.saving;
    const exportButton = document.querySelector('#projectExportBtn');
    if (exportButton) exportButton.disabled = local.exporting;
  }

  function updateProgress(label, percent, detail = null) {
    const holder = document.querySelector('#projectProgress');
    if (!holder) return;
    holder.classList.remove('hidden');
    holder.innerHTML = `<div class="flex justify-between"><span>${escapeHtml(label)}</span><span>${Math.round(percent)}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div class="h-full bg-emerald-300" style="width:${Math.max(0, Math.min(100, percent))}%"></div></div>${detail ? `<div class="mt-1 truncate text-[10px] text-slate-400">${escapeHtml(detail)}</div>` : ''}`;
  }

  function clearProgress() {
    document.querySelector('#projectProgress')?.classList.add('hidden');
  }

  function setError(error) {
    local.error = String(error?.message || error || 'Unknown project error');
    local.status = '專案操作失敗';
    refresh();
  }

  return {
    mount,
    initialize,
    refresh,
    markDirty,
    saveProject,
    exportProject,
    openProjectFile,
    restoreSnapshot,
    getStorage: () => storage,
    getState: () => ({ ...local })
  };
}

function recentCard(project) {
  return `<article class="rounded-2xl border border-slate-200 p-3"><div class="truncate text-sm font-black">${escapeHtml(project.name)}</div><div class="mt-1 text-[10px] text-slate-400">${project.sourceCount} sources · ${project.frameCount} Frames · ${formatTime(project.updatedAt)}</div><div class="mt-3 grid grid-cols-3 gap-1"><button data-project-open="${project.id}" class="rounded-lg bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700">開啟</button><button data-project-duplicate="${project.id}" class="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black">複製</button><button data-project-delete="${project.id}" class="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700">刪除</button></div></article>`;
}

function stageLabel(stage) {
  return ({ hashing: '建立校驗碼', compressing: '封裝專案', complete: '驗證完成' })[stage] || stage;
}

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
