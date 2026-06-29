import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/core/package-workflow.js';
let source = await readFile(path, 'utf8');

source = source.replace(
  ".replace(/^[. ]+|[. ]+$/g, '')",
  ".replace(/^[. -]+|[. ]+$/g, '')"
);
source = source.replace(
  ".replace(/-+/g, '-');",
  ".replace(/-+/g, '-')\n    .replace(/\\s*-\\s*/g, '-');"
);
source = source.replace(
  "const raw = String(value || fallback).replace(/\\.zip$/i, '');",
  "const raw = String(value || fallback).trim().replace(/\\.zip$/i, '');"
);
source = source.replace(
  "if (!entry.canvas) errors.push(packageIssue('package.canvas.missing', `${entry.name || entry.path} has no rendered PNG.`, 'error', entry));",
  "if (!entry.canvas && !entry.base64 && !entry.bytesData) errors.push(packageIssue('package.canvas.missing', `${entry.name || entry.path} has no rendered PNG.`, 'error', entry));"
);

await writeFile(path, source, 'utf8');
console.log('Package core compatibility applied.');
