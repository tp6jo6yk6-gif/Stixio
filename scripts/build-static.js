import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { migrateWorkshopSource } from '../src/ui/native-workspace-migrator.js';

const dist = 'dist';
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const entries = [
  'index.html',
  '_headers',
  'legacy-preview.html',
  'local-preview.html',
  'local-preview.js',
  'next.html',
  'workshop.html',
  'src',
  'docs',
  'public',
  'manifest.json'
];

for (const entry of entries) {
  if (!existsSync(entry)) continue;
  await cp(entry, `${dist}/${entry}`, { recursive: true });
}

const [legacySource, constants, renderer] = await Promise.all([
  readFile('src/ui/stixio-workshop-app-v2.backup.js', 'utf8'),
  readFile('scripts/native_migration/constants.txt', 'utf8'),
  readFile('scripts/native_migration/render_block.txt', 'utf8')
]);
const nativeSource = migrateWorkshopSource(legacySource, { constants, renderer });
await writeFile(`${dist}/src/ui/stixio-workshop-app-v2.js`, nativeSource);

if (!nativeSource.includes('// NATIVE_WORKSPACE_RENDERING')) {
  throw new Error('Native Workspace build marker is missing.');
}

console.log('Stixio native Workspace static build complete.');
