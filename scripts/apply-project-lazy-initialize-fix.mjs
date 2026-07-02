import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/project-controller.js';
const marker = '// PROJECT_LAZY_INITIALIZE_FIX';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Project lazy initialization fix already present.');
    return;
  }

  const target = `    if (!local.initialized) initialize();`;
  const replacement = `    ${marker}
    if (!local.initialized) {
      const startInitialize = () => setTimeout(() => {
        if (!local.initialized) void initialize();
      }, 0);
      if (document.documentElement.dataset.stixioReady === 'true') startInitialize();
      else window.addEventListener('stixio:ready', startInitialize, { once: true });
    }`;

  if (!source.includes(target)) throw new Error('Project initialize target not found.');
  await writeFile(path, source.replace(target, replacement));
  console.log('Project lazy initialization fix installed.');
}

await main();
