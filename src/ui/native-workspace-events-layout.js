export const LAYOUT_WORKSPACE_EVENTS = String.raw`function bindLayoutEvents(root) {
  const fileInput = root.querySelector('#fileInput');
  fileInput?.addEventListener('change', event => importFiles(event.target.files));

  const dropZone = root.querySelector('#dropZone');
  dropZone?.addEventListener('dragover', event => event.preventDefault());
  dropZone?.addEventListener('drop', event => {
    event.preventDefault();
    importFiles(event.dataTransfer.files);
  });

  root.querySelectorAll('.layout-btn').forEach(button => {
    button.addEventListener('click', () => setLayoutMode(button.dataset.layout));
  });
  root.querySelector('#detectBtn')?.addEventListener('click', detectActiveSource);

  ['rowsInput', 'colsInput', 'marginXInput', 'marginYInput', 'gapXInput', 'gapYInput'].forEach(id => {
    root.querySelector('#' + id)?.addEventListener('input', readGridSettings);
  });

  root.querySelector('#smartSnapInput')?.addEventListener('change', event => {
    state.settings.smartSnap = event.target.checked;
    saveActiveSourceLayout();
  });

  bindSelectionEvents(root);
  const sourceCanvas = root.querySelector('#sourceCanvas');
  if (sourceCanvas) bindSourceCanvas(sourceCanvas);
}

`;
