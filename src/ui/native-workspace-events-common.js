export const COMMON_WORKSPACE_EVENTS = String.raw`function bindStaticEvents(root) {
  bindWorkflowNavigationEvents(root);
  bindCommonEvents(root);
  if (state.activeEditor === 'layout') bindLayoutEvents(root);
  if (state.activeEditor === 'refine') bindRefineEvents(root);
  if (state.activeEditor === 'review') bindReviewEvents(root);
  if (state.activeEditor === 'package') bindPackageEvents(root);
  bindGlobalEvents();
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
  root.addEventListener('keydown', event => {
    const tab = event.target.closest?.('[data-workflow-stage]');
    if (!tab || !root.contains(tab)) return;
    const index = WORKFLOW_STAGES.findIndex(item => item.id === tab.dataset.workflowStage);
    let targetIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = (index + 1) % WORKFLOW_STAGES.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = (index - 1 + WORKFLOW_STAGES.length) % WORKFLOW_STAGES.length;
    if (event.key === 'Home') targetIndex = 0;
    if (event.key === 'End') targetIndex = WORKFLOW_STAGES.length - 1;
    if (targetIndex == null) return;
    event.preventDefault();
    setActiveEditor(WORKFLOW_STAGES[targetIndex].id);
  });
}

function bindCommonEvents(root) {
  root.querySelector('#exportZipBtn')?.addEventListener('click', () => state.packageController?.exportPackage());
  root.querySelector('#undoBtn')?.addEventListener('click', undoFrames);
  root.querySelector('#redoBtn')?.addEventListener('click', redoFrames);
}

function bindSelectionEvents(root) {
  root.querySelector('#duplicateBtn')?.addEventListener('click', duplicateSelectedFrame);
  root.querySelector('#deleteBtn')?.addEventListener('click', deleteSelectedFrame);
  root.querySelector('#offsetXInput')?.addEventListener('change', event => setSelectedOffset('offsetX', event.target.value));
  root.querySelector('#offsetYInput')?.addEventListener('change', event => setSelectedOffset('offsetY', event.target.value));
  root.querySelectorAll('.nudge-btn').forEach(button => button.addEventListener('click', () => nudgeSelectedOffset(Number(button.dataset.nudgeX || 0), Number(button.dataset.nudgeY || 0))));
  root.querySelector('#resetOffsetBtn')?.addEventListener('click', resetSelectedOffset);
}

`;
