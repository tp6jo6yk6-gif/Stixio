import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const dist = 'dist';
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const entries = [
  'index.html',
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

const indexPath = `${dist}/index.html`;
const buildSha = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || 'development';
const indexHtml = (await readFile(indexPath, 'utf8')).replaceAll('__STIXIO_BUILD_SHA__', buildSha);
if (/https:\/\/(cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)/i.test(indexHtml)) {
  throw new Error('Runtime CDN dependency detected in dist/index.html.');
}
await writeFile(indexPath, indexHtml);

const requiredFiles = [
  `${dist}/public/vendor/tailwindcss-browser-4.3.2.js`,
  `${dist}/public/vendor/jszip-3.10.1.min.js`,
  `${dist}/public/icons/stixio-icon.svg`,
  `${dist}/public/icons/stixio-maskable.svg`,
  `${dist}/src/ui/beta-hardening.js`
];
for (const path of requiredFiles) {
  if (!existsSync(path)) throw new Error(`Static build is missing required Beta asset: ${path}`);
}

console.log(`Stixio static build complete (${buildSha.slice(0, 12)}).`);
