const NATIVE_MARKER = '// NATIVE_WORKSPACE_RENDERING';

export function migrateWorkshopSource(source, { constants, renderer }) {
  if (typeof source !== 'string' || !source.trim()) throw new TypeError('Workshop source is required.');
  if (source.includes(NATIVE_MARKER)) return source;
  if (!constants?.includes(NATIVE_MARKER)) throw new Error('Native Workspace constants are invalid.');
  if (!renderer?.includes('function renderActiveWorkspace()')) throw new Error('Native Workspace renderer is invalid.');

  let next = source;
  next = replaceExactlyOnce(next, 'const DEFAULT_MAX_FILE_SIZE_KB = 1000;', constants.trimEnd(), 'workflow constants');
  next = replaceExactlyOnce(
    next,
    "  activeEditor: 'layout',",
    "  activeEditor: resolveInitialEditor(),\n  workspaceView: createWorkspaceViewState(),",
    'activeEditor state'
  );
  next = replaceBetween(
    next,
    'function renderShell() {',
    'function renderImportPanel() {',
    `${renderer.trimEnd()}\n\n`,
    'native Workspace renderer'
  );
  next = replaceExactlyOnce(next, 'function bindStaticEvents(root) {', 'function bindAllWorkspaceEvents(root) {', 'legacy event binder');
  next = replaceExactlyOnce(
    next,
    '// DESTINATION_RULES_FULL_COMPLETION',
    `${renderStageEventBindings()}// DESTINATION_RULES_FULL_COMPLETION`,
    'stage event bindings'
  );
  next = replaceExactlyOnce(
    next,
    "openFrame:frameId=>{selectFrame(frameId);state.activeEditor='review';refresh();document.getElementById('stage-review')?.scrollIntoView({behavior:'smooth',block:'start'});},",
    "openFrame:frameId=>{selectFrame(frameId);setActiveEditor('review');},",
    'Package review navigation'
  );
  next = replaceExactlyOnce(
    next,
    'if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);}',
    'if(redoBtn)redoBtn.disabled=!canRedo(state.frameHistory);refreshWorkflowProgress();}',
    'workflow progress refresh'
  );

  return next;
}

export function rewriteWorkshopImports(source, moduleUrl) {
  const base = new URL(moduleUrl);
  const imports = [
    ['../core/index.js', new URL('../core/index.js', base).href],
    ['./package-controller.js', new URL('./package-controller.js', base).href],
    ['./project-controller.js', new URL('./project-controller.js', base).href],
    ['./destination-controller.js', new URL('./destination-controller.js', base).href]
  ];
  return imports.reduce((value, [relative, absolute]) => value.replaceAll(`'${relative}'`, `'${absolute}'`), source);
}

function replaceExactlyOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}.`);
  return source.replace(search, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${label}: anchors not found.`);
  if (source.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error(`${label}: start anchor is not unique.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function renderStageEventBindings() {
  return `function bindStaticEvents(root) {
  bindWorkflowNavigationEvents(root);
  if (state.activeEditor === 'layout') bindLayoutEvents(root);
  if (state.activeEditor === 'refine') bindRefineEvents(root);
  if (state.activeEditor === 'review') bindReviewEvents(root);
  if (state.activeEditor === 'package') bindPackageEvents(root);
}

function bindWorkflowNavigationEvents(root) {
  if (root.dataset.nativeWorkflowEvents === 'ready') return;
  root.dataset.nativeWorkflowEvents = 'ready';
  root.addEventListener('click', event => {
    const stage = event.target.closest?.('[data-workflow-stage]');
    if (stage && root.contains(stage)) {
      event.preventDefault();
      setActiveEditor(stage.dataset.workflowStage);
      return;
    }
    const move = event.target.closest?.('[data-workflow-direction]');
    if (move && root.contains(move)) {
      event.preventDefault();
      const index = WORKFLOW_STAGES.findIndex(item => item.id === state.activeEditor);
      const direction = move.dataset.workflowDirection === 'previous' ? -1 : 1;
      const target = WORKFLOW_STAGES[index + direction];
      if (target) setActiveEditor(target.id);
      return;
    }
    const collapse = event.target.closest?.('[data-workflow-collapse]');
    if (collapse && root.contains(collapse)) {
      event.preventDefault();
      toggleWorkspaceColumn(collapse.dataset.workflowCollapse);
      return;
    }
    const empty = event.target.closest?.('[data-workflow-empty-action]');
    if (!empty || !root.contains(empty)) return;
    event.preventDefault();
    const action = empty.dataset.workflowEmptyAction;
    if (action === 'file') root.querySelector('#fileInput')?.click();
    else setActiveEditor(action);
  });
}

function bindLayoutEvents(root) { bindAllWorkspaceEvents(createSafeEventRoot(root)); }
function bindRefineEvents(root) { bindAllWorkspaceEvents(createSafeEventRoot(root)); }
function bindReviewEvents(root) { bindAllWorkspaceEvents(createSafeEventRoot(root)); }
function bindPackageEvents(root) { bindAllWorkspaceEvents(createSafeEventRoot(root)); }

function createSafeEventRoot(root) {
  return {
    querySelector(selector) { return root.querySelector(selector) || NULL_WORKSPACE_CONTROL; },
    querySelectorAll(selector) { return root.querySelectorAll(selector); }
  };
}

const NULL_WORKSPACE_CONTROL = Object.freeze({
  addEventListener() {},
  setPointerCapture() {},
  classList: Object.freeze({ add() {}, remove() {}, toggle() {} }),
  dataset: Object.freeze({}),
  style: Object.freeze({}),
  value: '',
  checked: false,
  disabled: false,
  textContent: ''
});

`;
}
