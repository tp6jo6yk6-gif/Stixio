import {
  DESTINATION_PROFILE_EXTENSION,
  DestinationProfileKeys,
  applyDestinationProfileToSettings,
  buildDestinationPackagePlan,
  createDestinationProfile,
  createDestinationProfileRegistry,
  destinationProfileSummary,
  duplicateDestinationProfile,
  getBuiltInDestinationProfile,
  getDestinationOutput,
  getDestinationRoleKeys,
  normalizeFramesForDestination,
  parseDestinationProfile,
  serializeDestinationProfile
} from '../core/index.js';

export function createDestinationController(adapter, options = {}) {
  if (!adapter) throw new Error('Destination controller requires an adapter.');

  const local = {
    registry: createDestinationProfileRegistry(),
    activeKey: options.activeKey || DestinationProfileKeys.FLEXIBLE,
    activeRole: 'sticker',
    editorOpen: false,
    editorText: '',
    notice: '',
    error: null
  };

  function mount(root = document) {
    const holder = root.querySelector?.('#destinationRulesRoot') || document.querySelector('#destinationRulesRoot');
    if (!holder) return false;
    holder.innerHTML = renderShell();
    bindEvents(holder);
    syncControls();
    return true;
  }

  function getActiveProfile() {
    return local.registry.get(local.activeKey) || getBuiltInDestinationProfile(DestinationProfileKeys.FLEXIBLE);
  }

  function renderShell() {
    const profiles = local.registry.list();
    const profile = getActiveProfile();
    const summary = destinationProfileSummary(profile);
    return `<section class="rounded-[1.75rem] border border-violet-200 bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">Destination Rules · Profile Engine</p>
          <h2 class="mt-1 text-xl font-black">目的地規格</h2>
          <p class="mt-1 text-xs font-bold text-slate-400">每個角色使用自己的尺寸、數量、檔案大小與命名規則。</p>
        </div>
        <span class="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-700">v${escapeHtml(profile.version)}</span>
      </div>
      <label class="mt-4 block text-xs font-black text-slate-500">Profile
        <select id="destinationProfileInput" class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          ${profiles.map(item => `<option value="${escapeHtml(item.key)}" ${item.key === local.activeKey ? 'selected' : ''}>${escapeHtml(item.name)}${item.builtIn ? '' : ' · Custom'}</option>`).join('')}
        </select>
      </label>
      <label class="mt-3 block text-xs font-black text-slate-500">目前編輯角色
        <select id="destinationRoleInput" class="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          ${profile.roles.map(role => `<option value="${escapeHtml(role.key)}" ${role.key === local.activeRole ? 'selected' : ''}>${escapeHtml(role.label)} · ${role.width}×${role.height}</option>`).join('')}
        </select>
      </label>
      <div class="mt-3 rounded-2xl bg-violet-50 p-3">
        <div class="text-sm font-black text-violet-900">${escapeHtml(summary.name)}</div>
        <div class="mt-1 text-xs text-violet-700">${escapeHtml(profile.description || '自訂目的地規格')}</div>
        <div id="destinationRoleSummary" class="mt-3 grid gap-2"></div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button id="destinationDuplicateBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">複製為自訂</button>
        <button id="destinationEditBtn" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">編輯 JSON</button>
        <button id="destinationExportBtn" class="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">匯出 Profile</button>
        <label class="cursor-pointer rounded-xl bg-sky-50 px-3 py-2 text-center text-xs font-black text-sky-700">匯入 Profile<input id="destinationImportInput" type="file" accept=".json,${DESTINATION_PROFILE_EXTENSION}" class="hidden"></label>
      </div>
      ${profile.builtIn ? '' : '<button id="destinationDeleteBtn" class="mt-2 w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">刪除自訂 Profile</button>'}
      <div id="destinationNotice" class="mt-3 hidden rounded-xl p-3 text-xs font-black"></div>
      <div id="destinationEditor" class="mt-3 ${local.editorOpen ? '' : 'hidden'}">
        <textarea id="destinationEditorText" class="h-72 w-full rounded-2xl bg-slate-950 p-3 font-mono text-[11px] text-emerald-200">${escapeHtml(local.editorText || serializeDestinationProfile(profile))}</textarea>
        <div class="mt-2 grid grid-cols-2 gap-2"><button id="destinationEditorCancelBtn" class="rounded-xl bg-slate-100 py-2 text-xs font-black">取消</button><button id="destinationEditorSaveBtn" class="rounded-xl bg-violet-500 py-2 text-xs font-black text-white">儲存 Profile</button></div>
      </div>
    </section>`;
  }

  function bindEvents(holder) {
    holder.querySelector('#destinationProfileInput')?.addEventListener('change', event => switchProfile(event.target.value));
    holder.querySelector('#destinationRoleInput')?.addEventListener('change', event => switchRole(event.target.value));
    holder.querySelector('#destinationDuplicateBtn')?.addEventListener('click', duplicateActiveProfile);
    holder.querySelector('#destinationEditBtn')?.addEventListener('click', openEditor);
    holder.querySelector('#destinationExportBtn')?.addEventListener('click', exportActiveProfile);
    holder.querySelector('#destinationDeleteBtn')?.addEventListener('click', deleteActiveProfile);
    holder.querySelector('#destinationImportInput')?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) await importProfileFile(file);
    });
    holder.querySelector('#destinationEditorCancelBtn')?.addEventListener('click', closeEditor);
    holder.querySelector('#destinationEditorSaveBtn')?.addEventListener('click', saveEditor);
    renderRoleSummary();
    renderNotice();
  }

  function syncControls() {
    const profile = getActiveProfile();
    if (!getDestinationRoleKeys(profile).includes(local.activeRole)) local.activeRole = profile.roles[0].key;
    const profileInput = document.querySelector('#destinationProfileInput');
    if (profileInput) profileInput.value = local.activeKey;
    const roleInput = document.querySelector('#destinationRoleInput');
    if (roleInput) roleInput.value = local.activeRole;
    renderRoleSummary();
    renderNotice();
  }

  function renderRoleSummary() {
    const holder = document.querySelector('#destinationRoleSummary');
    if (!holder) return;
    const profile = getActiveProfile();
    holder.innerHTML = profile.roles.map(role => {
      const count = role.exact != null ? `exact ${role.exact}` : role.allowedCounts?.length ? role.allowedCounts.join(' / ') : `${role.min ?? 0}–${role.max ?? '∞'}`;
      return `<div class="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-white/80 p-2 text-[10px]"><span class="font-black">${escapeHtml(role.label)} · ${role.width}×${role.height}</span><span class="text-right text-slate-500">${count} · ≤${Math.ceil(role.maxFileSizeBytes / 1024)}KB</span></div>`;
    }).join('');
  }

  function renderNotice() {
    const holder = document.querySelector('#destinationNotice');
    if (!holder) return;
    const message = local.error || local.notice;
    holder.classList.toggle('hidden', !message);
    holder.className = `mt-3 rounded-xl p-3 text-xs font-black ${local.error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'} ${message ? '' : 'hidden'}`;
    holder.textContent = message || '';
  }

  function switchProfile(key) {
    const profile = local.registry.get(key);
    if (!profile) return;
    local.activeKey = profile.key;
    local.activeRole = profile.roles.find(role => role.key === 'sticker')?.key || profile.roles[0].key;
    local.notice = `已切換至 ${profile.name} v${profile.version}；舊核准已撤銷。`;
    local.error = null;
    adapter.applyDestinationProfile(profile, local.activeRole, { invalidateApproval: true });
    adapter.rerender();
  }

  function switchRole(roleKey) {
    const profile = getActiveProfile();
    local.activeRole = getDestinationRoleKeys(profile).includes(roleKey) ? roleKey : profile.roles[0].key;
    adapter.applyDestinationProfile(profile, local.activeRole, { invalidateApproval: false, updateFrames: false });
    adapter.rerender();
  }

  function duplicateActiveProfile() {
    const source = getActiveProfile();
    const requestedName = adapter.prompt('自訂 Profile 名稱', `${source.name} Copy`);
    if (!requestedName) return;
    const custom = duplicateDestinationProfile(source, { name: requestedName });
    local.registry.register(custom);
    local.activeKey = custom.key;
    local.activeRole = custom.roles[0].key;
    local.notice = '已建立自訂 Profile，可使用 JSON 編輯完整規格。';
    local.error = null;
    adapter.applyDestinationProfile(custom, local.activeRole, { invalidateApproval: true });
    adapter.rerender();
  }

  function openEditor() {
    local.editorOpen = true;
    local.editorText = serializeDestinationProfile(getActiveProfile());
    adapter.rerender();
  }

  function closeEditor() {
    local.editorOpen = false;
    local.editorText = '';
    adapter.rerender();
  }

  function saveEditor() {
    const text = document.querySelector('#destinationEditorText')?.value || '';
    try {
      const parsed = parseDestinationProfile(text);
      const existing = local.registry.get(local.activeKey);
      const profile = existing?.builtIn ? duplicateDestinationProfile(parsed, { name: `${parsed.name} Custom` }) : { ...parsed, key: local.activeKey, builtIn: false };
      const saved = local.registry.register(profile);
      local.activeKey = saved.key;
      local.activeRole = saved.roles.find(role => role.key === local.activeRole)?.key || saved.roles[0].key;
      local.editorOpen = false;
      local.editorText = '';
      local.notice = `已儲存 ${saved.name} v${saved.version}。`;
      local.error = null;
      adapter.applyDestinationProfile(saved, local.activeRole, { invalidateApproval: true });
      adapter.rerender();
    } catch (error) {
      local.error = error.message || 'Profile 儲存失敗。';
      renderNotice();
    }
  }

  async function importProfileFile(file) {
    try {
      const parsed = parseDestinationProfile(await file.text());
      const saved = local.registry.register({ ...parsed, builtIn: false });
      local.activeKey = saved.key;
      local.activeRole = saved.roles[0].key;
      local.notice = `已匯入 ${saved.name} v${saved.version}。`;
      local.error = null;
      adapter.applyDestinationProfile(saved, local.activeRole, { invalidateApproval: true });
      adapter.rerender();
    } catch (error) {
      local.error = error.message || 'Profile 匯入失敗。';
      renderNotice();
      adapter.alert(local.error);
    }
  }

  function exportActiveProfile() {
    const profile = getActiveProfile();
    adapter.downloadText(serializeDestinationProfile(profile), `${profile.key}${DESTINATION_PROFILE_EXTENSION}`, 'application/json');
    local.notice = 'Profile 已匯出。';
    renderNotice();
  }

  function deleteActiveProfile() {
    const profile = getActiveProfile();
    if (profile.builtIn) return;
    if (!adapter.confirm(`確定刪除「${profile.name}」？`)) return;
    local.registry.remove(profile.key);
    local.activeKey = DestinationProfileKeys.FLEXIBLE;
    local.activeRole = 'sticker';
    local.notice = '自訂 Profile 已刪除，已切回 Workshop Flexible。';
    adapter.applyDestinationProfile(getActiveProfile(), local.activeRole, { invalidateApproval: true });
    adapter.rerender();
  }

  function updateActiveRoleRule(key, value) {
    let profile = getActiveProfile();
    if (profile.builtIn) {
      profile = duplicateDestinationProfile(profile, { name: `${profile.name} Custom` });
      local.registry.register(profile);
      local.activeKey = profile.key;
      local.notice = '內建 Profile 已複製為自訂版本，原規格未被修改。';
    }
    const numeric = Math.max(key === 'safeMargin' ? 0 : 1, Math.round(Number(value) || 0));
    const roles = profile.roles.map(role => role.key === local.activeRole ? { ...role, [key]: numeric } : role);
    const next = createDestinationProfile({
      ...profile,
      builtIn: false,
      version: bumpPatchVersion(profile.version),
      roles,
      updatedAt: new Date().toISOString()
    });
    local.registry.register(next);
    local.activeKey = next.key;
    local.notice = `${next.name} 已更新為 v${next.version}；舊核准已撤銷。`;
    local.error = null;
    adapter.applyDestinationProfile(next, local.activeRole, { invalidateApproval: true });
    adapter.rerender();
  }

  function buildPlan(frames, options = {}) {
    return buildDestinationPackagePlan(frames, {
      profile: getActiveProfile(),
      namingMode: options.namingMode,
      prefix: options.prefix,
      suffix: options.suffix,
      renderedMap: options.renderedMap
    });
  }

  function getFrameOutput(frame) {
    const role = frame?.state?.packageRole || frame?.custom?.outputRole || local.activeRole;
    return getDestinationOutput(getActiveProfile(), role);
  }

  function exportState() {
    return {
      activeKey: local.activeKey,
      activeRole: local.activeRole,
      activeVersion: getActiveProfile().version,
      customProfiles: local.registry.exportCustom()
    };
  }

  function importState(value = null) {
    const next = value || {};
    local.registry = createDestinationProfileRegistry({ customProfiles: next.customProfiles || [] });
    local.activeKey = local.registry.has(next.activeKey) ? next.activeKey : DestinationProfileKeys.FLEXIBLE;
    const profile = getActiveProfile();
    local.activeRole = profile.roles.some(role => role.key === next.activeRole) ? next.activeRole : profile.roles[0].key;
    if (next.activeVersion && next.activeVersion !== profile.version) local.notice = `Profile 已由 v${next.activeVersion} 更新為 v${profile.version}，請重新檢查 Review。`;
    local.error = null;
    adapter.applyDestinationProfile(profile, local.activeRole, { invalidateApproval: false });
    return profile;
  }

  return {
    mount,
    syncControls,
    getActiveProfile,
    getFrameOutput,
    buildPlan,
    updateActiveRoleRule,
    exportState,
    importState
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}


function bumpPatchVersion(value) {
  const parts = String(value || '1.0.0').split('.').map(part => Math.max(0, Math.round(Number(part) || 0)));
  return `${parts[0] || 1}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
}
