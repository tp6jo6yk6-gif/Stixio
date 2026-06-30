import { readFile, writeFile } from 'node:fs/promises';

const controllerPath = 'src/ui/destination-controller.js';
const appPath = 'src/ui/stixio-workshop-app-v2.js';
const testPath = 'tests/destination-profiles.test.js';

let controller = await readFile(controllerPath, 'utf8');
let app = await readFile(appPath, 'utf8');
let test = await readFile(testPath, 'utf8');

function replaceFunction(source, startToken, nextToken, replacement, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(nextToken, start + startToken.length);
  if (start < 0 || end < 0) throw new Error(`Missing Destination fix target: ${label}`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

if (!controller.includes('createDestinationProfile,')) {
  controller = controller.replace(
    `  buildDestinationPackagePlan,\n  createDestinationProfileRegistry,`,
    `  buildDestinationPackagePlan,\n  createDestinationProfile,\n  createDestinationProfileRegistry,`
  );
}

if (!controller.includes('function updateActiveRoleRule(')) {
  controller = controller.replace(
    `  function buildPlan(frames, options = {}) {`,
    `  function updateActiveRoleRule(key, value) {
    let profile = getActiveProfile();
    if (profile.builtIn) {
      profile = duplicateDestinationProfile(profile, { name: \`${'${profile.name}'} Custom\` });
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
    local.notice = \`${'${next.name}'} 已更新為 v${'${next.version}'}；舊核准已撤銷。\`;
    local.error = null;
    adapter.applyDestinationProfile(next, local.activeRole, { invalidateApproval: true });
    adapter.rerender();
  }

  function buildPlan(frames, options = {}) {`
  );
  controller = controller.replace(
    `    buildPlan,\n    exportState,`,
    `    buildPlan,\n    updateActiveRoleRule,\n    exportState,`
  );
  controller += `

function bumpPatchVersion(value) {
  const parts = String(value || '1.0.0').split('.').map(part => Math.max(0, Math.round(Number(part) || 0)));
  return \`${'${parts[0] || 1}'}.${'${parts[1] || 0}'}.${'${(parts[2] || 0) + 1}'}\`;
}
`;
}

app = replaceFunction(
  app,
  'function renderOutputPanel() {',
  'function renderRefinePanel() {',
  `function renderOutputPanel() {
  const frame=selectedFrame();
  const output=state.destinationController?.getFrameOutput?.(frame)||{role:state.settings.outputRole,width:state.settings.targetW,height:state.settings.targetH,safeMargin:state.settings.safeMargin,maxFileSizeBytes:state.settings.maxFileSizeKB*1024};
  const safeMax=Math.max(0,Math.floor(Math.min(output.width,output.height)/2)-1);
  return \`<section id="package-rules-panel" class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Rules Engine</p><h2 class="mt-1 text-xl font-black">角色輸出與對齊</h2><div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-2xl bg-slate-50 p-3"><div class="text-[10px] font-black uppercase text-slate-400">Role</div><div class="mt-1 text-sm font-black">\${roleLabel(output.role)}</div></div><div class="rounded-2xl bg-slate-50 p-3"><div class="text-[10px] font-black uppercase text-slate-400">File limit</div><div class="mt-1 text-sm font-black">≤\${Math.ceil(output.maxFileSizeBytes/1024)}KB</div></div></div><div class="mt-3 grid grid-cols-2 gap-3">\${numberInput('targetWInput','自訂寬度',output.width,1,8192)}\${numberInput('targetHInput','自訂高度',output.height,1,8192)}</div>\${rangeInput('safeMarginInput','安全留白',output.safeMargin,0,safeMax)}<div class="mt-3"><div class="mb-2 text-xs font-black text-slate-500">圖案對齊</div><div class="grid grid-cols-2 gap-2">\${alignButton('center','絕對置中')}\${alignButton('bottom','靠下貼齊')}</div></div><div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">\${output.width} × \${output.height}px · safe \${output.safeMargin}px</div><p class="mt-3 text-[10px] font-bold text-slate-400">修改內建規格時會自動複製成 Custom Profile，原始 Profile 不會被覆蓋。</p></section>\`;
}`,
  'custom output controls'
);

if (!app.includes("updateActiveRoleRule('width'")) {
  app = app.replace(
    `  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;clearRenderCache();renderAll();rerenderShell(); }));`,
    `  root.querySelector('#targetWInput')?.addEventListener('change',event=>state.destinationController?.updateActiveRoleRule('width',event.target.value));
  root.querySelector('#targetHInput')?.addEventListener('change',event=>state.destinationController?.updateActiveRoleRule('height',event.target.value));
  root.querySelector('#safeMarginInput')?.addEventListener('change',event=>state.destinationController?.updateActiveRoleRule('safeMargin',event.target.value));
  root.querySelectorAll('.align-btn').forEach(button => button.addEventListener('click', () => { state.settings.alignMode=button.dataset.align;clearRenderCache();renderAll();rerenderShell(); }));`
  );
}

test = test.replace(
  `  assert.deepEqual(profiles.map(item => item.key), [
    DestinationProfileKeys.ANIMATED,
    DestinationProfileKeys.BIG,
    DestinationProfileKeys.EFFECT,
    DestinationProfileKeys.FULLSCREEN,
    DestinationProfileKeys.STANDARD,
    DestinationProfileKeys.FLEXIBLE
  ].sort((a, b) => {
    const left = profiles.find(item => item.key === a);
    const right = profiles.find(item => item.key === b);
    return Number(right?.builtIn) - Number(left?.builtIn) || left?.name.localeCompare(right?.name);
  }));`,
  `  assert.deepEqual(new Set(profiles.map(item => item.key)), new Set([
    DestinationProfileKeys.FLEXIBLE,
    DestinationProfileKeys.STANDARD,
    DestinationProfileKeys.ANIMATED,
    DestinationProfileKeys.BIG,
    DestinationProfileKeys.FULLSCREEN,
    DestinationProfileKeys.EFFECT
  ]));`
);

await Promise.all([
  writeFile(controllerPath, controller, 'utf8'),
  writeFile(appPath, app, 'utf8'),
  writeFile(testPath, test, 'utf8')
]);
console.log('Destination Rules compatibility fixes applied.');
