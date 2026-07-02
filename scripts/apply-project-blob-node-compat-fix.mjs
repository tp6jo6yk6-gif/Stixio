import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/core/project-workflow.js';
const marker = '// PROJECT_BLOB_NODE_COMPAT_V1';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Project Blob Node compatibility already present.');
    return;
  }

  const before = `    source.blob = new Blob([bytes], { type: source.mimeType });
    source.uri = null;`;
  const after = `    source.blob = new Blob([bytes], { type: source.mimeType });
    ${marker}
    source.uri = typeof window === 'undefined' && typeof Buffer !== 'undefined'
      ? \`data:\${source.mimeType};base64,\${Buffer.from(bytes).toString('base64')}\`
      : null;`;

  if (!source.includes(before)) throw new Error('Blob archive parse compatibility target not found.');
  await writeFile(path, source.replace(before, after));
  console.log('Project Blob Node compatibility installed.');
}

await main();
