import { COMMON_WORKSPACE_EVENTS } from './native-workspace-events-common.js';
import { LAYOUT_WORKSPACE_EVENTS } from './native-workspace-events-layout.js';
import { REFINE_WORKSPACE_EVENTS } from './native-workspace-events-refine.js';
import { REVIEW_WORKSPACE_EVENTS } from './native-workspace-events-review.js';
import { PACKAGE_WORKSPACE_EVENTS } from './native-workspace-events-package.js';

const NATIVE_MARKER = '// NATIVE_WORKSPACE_RENDERING';
const STAGE_EVENT_BINDINGS = [
  COMMON_WORKSPACE_EVENTS,
  LAYOUT_WORKSPACE_EVENTS,
  REFINE_WORKSPACE_EVENTS,
  REVIEW_WORKSPACE_EVENTS,
  PACKAGE_WORKSPACE_EVENTS
].join('');

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
  next = replaceBetween(
    next,
    'function bindStaticEvents(root) {',
    '// DESTINATION_RULES_FULL_COMPLETION',
    STAGE_EVENT_BINDINGS,
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
