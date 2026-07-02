import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/workshop-ux.js';
const marker = '// WORKSHOP_UX_OBSERVER_LOOP_FIX';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Workshop UX observer loop fix already present.');
    return;
  }

  const scheduleBefore = `  const scheduleInstall = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      installControls();
      installViewports();
    });
  };

  const observer = new MutationObserver(scheduleInstall);
  observer.observe(root, { childList: true, subtree: true });`;

  const scheduleAfter = `  ${marker}
  const scheduleInstall = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      observer.disconnect();
      try {
        installControls();
        installViewports();
      } finally {
        observer.observe(root, { childList: true, subtree: true });
        scheduled = false;
      }
    });
  };

  const observer = new MutationObserver(scheduleInstall);
  observer.observe(root, { childList: true, subtree: true });`;

  const labelBefore = `    root.querySelectorAll(\`[data-ux-zoom-label="\${canvasId}"]\`).forEach(label => {
      label.textContent = \`\${Math.round(state.zoom * 100)}%\`;
    });`;

  const labelAfter = `    const zoomLabel = \`\${Math.round(state.zoom * 100)}%\`;
    root.querySelectorAll(\`[data-ux-zoom-label="\${canvasId}"]\`).forEach(label => {
      if (label.textContent !== zoomLabel) label.textContent = zoomLabel;
    });`;

  if (!source.includes(scheduleBefore)) throw new Error('Workshop UX observer scheduler target not found.');
  if (!source.includes(labelBefore)) throw new Error('Workshop UX zoom label target not found.');

  await writeFile(path, source.replace(scheduleBefore, scheduleAfter).replace(labelBefore, labelAfter));
  console.log('Workshop UX observer loop fix installed.');
}

await main();
