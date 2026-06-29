import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/package-controller.js';
let source = await readFile(path, 'utf8');

source = source.replace(
  'return { frames, packagePlan, entries, reviewReport, preflight, manifest, output };',
  'return { frames, packagePlan, entries, reviewReport, preflight, manifest, output, settings: local.settings };'
);
source = source.replace(
  "${snapshot.preflight.ready ? '✓ Package 已通過預檢，可產生 ZIP' : escapeHtml(snapshot.preflight.errors[0]?.message || 'Package 尚未就緒')}",
  "${snapshot.preflight.ready ? '✓ Package 已通過預檢，可產生 ZIP' : `Package 尚未就緒 · ${escapeHtml(snapshot.preflight.errors[0]?.message || '請完成 Review 與角色設定')}` }"
);

await writeFile(path, source, 'utf8');
console.log('Package controller fixes applied.');
