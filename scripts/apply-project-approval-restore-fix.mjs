import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
let source = await readFile(path, 'utf8');

source = source.replace(
  'function clearRenderCache(){state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;invalidateAllReviewApprovals();}',
  'function clearRenderCache(invalidateApprovals=true){state.rendered.clear();state.renderKeys.clear();state.reviewReport=null;if(invalidateApprovals)invalidateAllReviewApprovals();}'
);
source = source.replace(
  'clearRenderCache();renderAll();\n      },\n      rerender:rerenderShell,',
  'clearRenderCache(options.invalidateApproval!==false);renderAll();\n      },\n      rerender:rerenderShell,'
);
source = source.replace(
  'state.packageController?.importState?.(snapshot.packageState||null);\n  clearRenderCache();renderAll();rerenderShell();',
  'state.packageController?.importState?.(snapshot.packageState||null);\n  clearRenderCache(false);renderAll();rerenderShell();'
);

await writeFile(path, source, 'utf8');
console.log('Project approval restore fix applied.');
