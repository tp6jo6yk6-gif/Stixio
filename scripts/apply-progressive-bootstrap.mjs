import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// BETA_PROGRESSIVE_BOOTSTRAP';
const source = await readFile(path, 'utf8');

if (source.includes(marker)) {
  console.log('Progressive Workshop bootstrap already present.');
  process.exit(0);
}

const synchronousInit = `export function initStixioWorkshop(root = document.getElementById('app')) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = \`${'${BRAND.name}'} Workshop\`;
  root.innerHTML = renderShell();
  bindStaticEvents(root);
  mountDestinationController(root);
  mountPackageController(root);
  mountProjectController(root);
  refresh();
}`;

if (!source.includes(synchronousInit)) {
  throw new Error('Unable to locate the synchronous Workshop initializer.');
}

const progressiveInit = `${synchronousInit}

${marker}
export async function initStixioWorkshopProgressive(
  root = document.getElementById('app'),
  { onStage = null } = {}
) {
  if (!root) throw new Error('Stixio root element not found.');
  document.title = \`${'${BRAND.name}'} Workshop\`;

  const runStage = async (name, action) => {
    document.documentElement.dataset.stixioBootStage = name;
    onStage?.(name);
    await nextBootstrapTurn();
    action();
    await nextBootstrapTurn();
  };

  await runStage('shell', () => { root.innerHTML = renderShell(); });
  await runStage('events', () => bindStaticEvents(root));
  await runStage('destination', () => mountDestinationController(root));
  await runStage('package', () => mountPackageController(root));
  await runStage('project', () => mountProjectController(root));
  await runStage('refresh', refresh);
  document.documentElement.dataset.stixioBootStage = 'ready';
  return root;
}

function nextBootstrapTurn() {
  return new Promise(resolve => setTimeout(resolve, 0));
}`;

await writeFile(path, source.replace(synchronousInit, progressiveInit));
console.log('Progressive Workshop bootstrap installed.');
