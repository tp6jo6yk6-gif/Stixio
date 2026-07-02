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
if (indexHtml.includes('tailwindcss-browser')) {
  throw new Error('Tailwind browser runtime detected in dist/index.html.');
}
if (!indexHtml.includes('public/app/stixio-workshop-1.0.0.js')) {
  throw new Error('Stixio 1.0.0 browser bundle is not referenced by dist/index.html.');
}
await writeFile(indexPath, indexHtml);

const requiredFiles = [
  `${dist}/public/vendor/tailwind-3.4.17.css`,
  `${dist}/public/vendor/jszip-3.10.1.min.js`,
  `${dist}/public/app/stixio-workshop-1.0.0.js`,
  `${dist}/public/app/stixio-workshop-1.0.0.js.map`,
  `${dist}/public/app/stixio-image-worker.js`,
  `${dist}/public/icons/stixio-icon.svg`,
  `${dist}/public/icons/stixio-maskable.svg`
];
for (const path of requiredFiles) {
  if (!existsSync(path)) throw new Error(`Static build is missing required release asset: ${path}`);
}

const compiledCss = await readFile(`${dist}/public/vendor/tailwind-3.4.17.css`, 'utf8');
for (const token of ['.sticky', '.bg-\\[\\#f6f3ec\\]', '.font-black']) {
  if (!compiledCss.includes(token)) throw new Error(`Compiled Tailwind CSS is missing required selector ${token}.`);
}

const bundle = await readFile(`${dist}/public/app/stixio-workshop-1.0.0.js`, 'utf8');
if (bundle.length < 20000) throw new Error('Stixio 1.0.0 browser bundle is unexpectedly small.');
if (!bundle.includes('stixioReady')) throw new Error('Stixio 1.0.0 browser bundle is missing readiness signalling.');

const imageWorker = await readFile(`${dist}/public/app/stixio-image-worker.js`, 'utf8');
if (!imageWorker.includes('OffscreenCanvas') || !imageWorker.includes('convertToBlob')) {
  throw new Error('Stixio image worker is missing OffscreenCanvas thumbnail processing.');
}

console.log(`Stixio 1.0.0 static build complete (${buildSha.slice(0, 12)}).`);
