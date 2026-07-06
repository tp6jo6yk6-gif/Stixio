export const REFINE_WORKSPACE_EVENTS = String.raw`function bindRefineEvents(root) {
  root.querySelector('#chromaEnabledInput')?.addEventListener('change', event => updateRefineSetting('chromaEnabled', event.target.checked));
  root.querySelector('#chromaColorInput')?.addEventListener('input', event => updateRefineSetting('chromaColor', hexToRgb(event.target.value)));
  root.querySelector('#pickerBtn')?.addEventListener('click', () => {
    state.settings.maskTool = 'picker';
    refreshMaskToolButtons();
  });
  root.querySelector('#exteriorInput')?.addEventListener('change', event => updateRefineSetting('exteriorOnly', event.target.checked));
  root.querySelector('#despeckleInput')?.addEventListener('change', event => updateRefineSetting('autoDespeckle', event.target.checked));

  bindRange(root, 'toleranceInput', 'tolerance');
  bindRange(root, 'despeckleSizeInput', 'despeckleMinSize');
  bindRange(root, 'shrinkInput', 'shrinkRadius');
  bindRange(root, 'featherInput', 'featherRadius');
  bindRange(root, 'borderSizeInput', 'whiteBorderSize');
  bindRange(root, 'maskSizeInput', 'maskSize', false);
  bindRange(root, 'maskOverlayOpacityInput', 'maskOverlayOpacity', false, drawRefineCanvas);

  root.querySelector('#borderInput')?.addEventListener('change', event => updateRefineSetting('whiteBorderEnabled', event.target.checked));
  root.querySelector('#borderColorInput')?.addEventListener('input', event => updateRefineSetting('borderColor', event.target.value));
  root.querySelector('#renderSelectedBtn')?.addEventListener('click', renderSelectedRefineNow);
  root.querySelector('#renderAllBtn')?.addEventListener('click', () => {
    clearRenderCache();
    renderAll();
    refresh();
  });
  root.querySelector('#resetRefineSettingsBtn')?.addEventListener('click', resetRefineSettings);

  root.querySelectorAll('.mask-tool').forEach(button => {
    button.addEventListener('click', () => {
      state.settings.maskTool = button.dataset.maskTool;
      refreshMaskToolButtons();
      updateBrushCursor();
    });
  });
  root.querySelectorAll('.magic-action').forEach(button => {
    button.addEventListener('click', () => {
      state.settings.magicAction = button.dataset.magicAction;
      refreshMaskToolButtons();
    });
  });
  root.querySelector('#magicContiguousInput')?.addEventListener('change', event => {
    state.settings.magicContiguous = event.target.checked;
  });
  root.querySelector('#maskOverlayInput')?.addEventListener('change', event => {
    state.settings.maskOverlayVisible = event.target.checked;
    drawRefineCanvas();
  });
  root.querySelectorAll('.refine-view').forEach(button => {
    button.addEventListener('click', () => {
      state.settings.refineViewMode = button.dataset.refineView;
      rerenderShell();
    });
  });

  root.querySelector('#maskUndoBtn')?.addEventListener('click', () => stepMaskHistory(-1));
  root.querySelector('#maskRedoBtn')?.addEventListener('click', () => stepMaskHistory(1));
  root.querySelector('#maskClearBtn')?.addEventListener('click', clearSelectedMask);
  root.querySelector('#resetSelectedRefineBtn')?.addEventListener('click', resetSelectedRefine);
  root.querySelector('#applyRefineBtn')?.addEventListener('click', applySelectedRefine);
  root.querySelector('#zoomOutBtn')?.addEventListener('click', () => setRefineZoom(state.refineView.zoom / 1.2));
  root.querySelector('#zoomResetBtn')?.addEventListener('click', resetRefineViewport);
  root.querySelector('#zoomInBtn')?.addEventListener('click', () => setRefineZoom(state.refineView.zoom * 1.2));

  bindSelectionEvents(root);
  const refineCanvas = root.querySelector('#refineCanvas');
  if (refineCanvas) bindRefineCanvas(refineCanvas);
  const refineViewport = root.querySelector('#refineViewport');
  if (refineViewport) bindRefineViewport(refineViewport);
}

`;
