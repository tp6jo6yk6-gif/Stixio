export function bridgeWorkshopLegacyControls(root = document.getElementById('app')) {
  if (!root || root.dataset.uxBridge === 'ready') return;
  root.dataset.uxBridge = 'ready';

  installBridgeStyle();

  root.addEventListener('click', event => {
    const legacyButton = event.target.closest?.('#zoomOutBtn, #zoomResetBtn, #zoomInBtn');
    if (!legacyButton) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const action = legacyButton.id === 'zoomOutBtn'
      ? 'out'
      : legacyButton.id === 'zoomInBtn'
        ? 'in'
        : 'reset';
    root.querySelector(`[data-ux-zoom="${action}"][data-canvas-id="refineCanvas"]`)?.click();
  }, true);
}

function installBridgeStyle() {
  if (document.getElementById('stixioUxBridgeStyle')) return;
  const style = document.createElement('style');
  style.id = 'stixioUxBridgeStyle';
  style.textContent = `
    [data-ux-toolbar] {
      position: absolute !important;
      top: .5rem !important;
      right: .5rem !important;
      left: auto !important;
      margin: 0 !important;
    }
  `;
  document.head.appendChild(style);
}
