import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const dist = 'dist';
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const entries = ['index.html', 'next.html', 'workshop.html', 'src', 'docs', 'public', 'manifest.json'];
for (const entry of entries) {
  if (!existsSync(entry)) continue;
  await cp(entry, `${dist}/${entry}`, { recursive: true });
}

console.log('Stixio static build complete.');
