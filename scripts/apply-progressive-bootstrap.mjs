import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// BETA_PROGRESSIVE_BOOTSTRAP';
const source = await readFile(path, 'utf8');

function watchdogHelper(name) {
  return `function ${name}() {
  return new Promise(resolve => {
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(finish, 250);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(finish, 0));
    } else {
      setTimeout(finish, 0);
    }
  });
}`;
}

const existingHelperMatch = source.match(/function (nextBootstrap(?:Frame|Turn))\(\) \{[\s\S]*?\n\}/);
if (source.includes(marker)) {
  if (!existingHelperMatch) {
    throw new Error('Progressive Workshop bootstrap marker exists but its scheduling helper is missing.');
  }
  const [, helperName] = existingHelperMatch;
  const nextSource = source.replace(existingHelperMatch[0], watchdogHelper(helperName));
  if (nextSource === source) {
    console.log('Progressive Workshop bootstrap watchdog already present.');
    process.exit(0);
  }
  await writeFile(path, nextSource);
  console.log('Progressive Workshop bootstrap watchdog refreshed.');
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
    await nextBootstrapFrame();
    action();
    await nextBootstrapFrame();
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

${watchdogHelper('nextBootstrapFrame')}`;

await writeFile(path, source.replace(synchronousInit, progressiveInit));
console.log('Progressive Workshop bootstrap installed with watchdog.');
