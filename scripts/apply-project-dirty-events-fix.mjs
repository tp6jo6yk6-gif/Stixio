import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// PROJECT_DIRTY_EVENTS_V1';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Project dirty event tracking already present.');
    return;
  }

  const bindTarget = `  bindGlobalEvents();\n}`;
  const bindReplacement = `  bindGlobalEvents();\n  installProjectDirtyEventTracking(root);\n}`;
  if (!source.includes(bindTarget)) throw new Error('Static event binding target not found.');

  const helperTarget = `function bindGlobalEvents(){`;
  const helperReplacement = `${marker}\nfunction installProjectDirtyEventTracking(root){\n  if(!root||root.dataset.projectDirtyTracking==='true')return;\n  root.dataset.projectDirtyTracking='true';\n  const markDirty=event=>{\n    const target=event.target;\n    if(!(target instanceof Element)||target.closest('#projectToolbarRoot'))return;\n    if(!target.matches('input,select,textarea'))return;\n    state.projectController?.markDirty('自動保存排程中');\n  };\n  root.addEventListener('input',markDirty,true);\n  root.addEventListener('change',markDirty,true);\n}\nfunction bindGlobalEvents(){`;
  if (!source.includes(helperTarget)) throw new Error('Global event helper target not found.');

  await writeFile(path, source.replace(bindTarget, bindReplacement).replace(helperTarget, helperReplacement));
  console.log('Project dirty event tracking installed.');
}

await main();
