import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/project-controller.js';
const markerV1 = '// PROJECT_LAZY_INITIALIZE_FIX';
const markerV2 = '// PROJECT_LAZY_INITIALIZE_FIX_V2';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(markerV2)) {
    console.log('Project lazy initialization V2 already present.');
    return;
  }

  const target = `    if (!local.initialized) initialize();`;
  const stale = `    ${markerV1}
    if (!local.initialized) {
      const startInitialize = () => setTimeout(() => {
        if (!local.initialized) void initialize();
      }, 0);
      if (document.documentElement.dataset.stixioReady === 'true') startInitialize();
      else window.addEventListener('stixio:ready', startInitialize, { once: true });
    }`;
  const replacement = `    ${markerV2}
    if (!local.initialized) {
      let initializeScheduled = false;
      const startInitialize = () => {
        if (initializeScheduled || local.initialized) return;
        initializeScheduled = true;
        setTimeout(() => {
          initializeScheduled = false;
          if (!local.initialized) void initialize();
        }, 0);
      };
      if (document.documentElement.dataset.stixioReady === 'true') startInitialize();
      else {
        window.addEventListener('stixio:ready', startInitialize, { once: true });
        queueMicrotask(() => {
          if (document.documentElement.dataset.stixioReady === 'true') startInitialize();
        });
      }
    }`;

  let next;
  if (source.includes(stale)) next = source.replace(stale, replacement);
  else if (source.includes(target)) next = source.replace(target, replacement);
  else throw new Error('Project initialize target not found.');

  await writeFile(path, next);
  console.log('Project lazy initialization V2 installed.');
}

await main();
