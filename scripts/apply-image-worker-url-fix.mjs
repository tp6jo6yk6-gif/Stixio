import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// IMAGE_WORKER_URL_FIX_V1';

async function main() {
  const source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Image worker URL fix already present.');
    return;
  }

  const before = `try{const workerUrl=new URL('./public/app/stixio-image-worker.js',document.baseURI);const worker=new Worker(workerUrl);`;
  const after = `try{${marker}const bundleScript=[...document.scripts].find(script=>script.src.includes('stixio-workshop-1.0.0.js'));const workerUrl=bundleScript?new URL('stixio-image-worker.js',bundleScript.src):new URL('../../public/app/stixio-image-worker.js',document.baseURI);const worker=new Worker(workerUrl);`;

  if (!source.includes(before)) throw new Error('Image worker URL target not found.');
  await writeFile(path, source.replace(before, after));
  console.log('Image worker URL fix installed.');
}

await main();
