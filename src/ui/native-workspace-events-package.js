export const PACKAGE_WORKSPACE_EVENTS = String.raw`function bindPackageEvents(root) {
  root.querySelector('#targetWInput')?.addEventListener('change', event => {
    state.destinationController?.updateActiveRoleRule('width', event.target.value);
  });
  root.querySelector('#targetHInput')?.addEventListener('change', event => {
    state.destinationController?.updateActiveRoleRule('height', event.target.value);
  });
  root.querySelector('#safeMarginInput')?.addEventListener('change', event => {
    state.destinationController?.updateActiveRoleRule('safeMargin', event.target.value);
  });
  root.querySelectorAll('.align-btn').forEach(button => {
    button.addEventListener('click', () => {
      state.settings.alignMode = button.dataset.align;
      clearRenderCache();
      renderAll();
      rerenderShell();
    });
  });
}

`;
