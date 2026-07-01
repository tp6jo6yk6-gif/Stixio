import { initStixioWorkshop } from './stixio-workshop-app-v2.js';
import { enhanceWorkshopUx } from './workshop-ux.js';
import { bridgeWorkshopLegacyControls } from './workshop-ux-bridge.js';
import { installBetaHardening } from './beta-hardening.js';

const root = document.getElementById('app');
const diagnostics = installBetaHardening({ version: '1.0.0' });

try {
  document.documentElement.dataset.stixioBootStage = 'workshop';
  initStixioWorkshop(root);
  document.documentElement.dataset.stixioBootStage = 'ux';
  enhanceWorkshopUx(root);
  bridgeWorkshopLegacyControls(root);
  document.documentElement.dataset.stixioReady = 'true';
  document.documentElement.dataset.stixioBootStage = 'ready';
  window.dispatchEvent(new CustomEvent('stixio:ready'));
} catch (error) {
  document.documentElement.dataset.stixioBootError = 'true';
  const stage = document.documentElement.dataset.stixioBootStage || 'unknown';
  diagnostics?.reportError(error, { source: `bootstrap:${stage}`, userVisible: true });
  console.error('Stixio bootstrap failed.', error);
  if (root) {
    root.innerHTML = `<div id="stixioBootStatus" data-error="true" role="alert"><div><strong>Stixio 無法啟動</strong><p>啟動階段：${stage}。請重新整理；若問題持續，請下載診斷資訊並聯絡支援。</p></div></div>`;
  }
}
