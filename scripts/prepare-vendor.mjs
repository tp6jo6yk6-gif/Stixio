import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const VENDOR_ASSETS = Object.freeze([
  {
    name: '@tailwindcss/browser 4.3.2',
    url: 'https://registry.npmjs.org/@tailwindcss/browser/-/browser-4.3.2.tgz',
    archiveSha256: 'c595ead3047e4198c132761f9505d406de24ecb5409dd74824b9376882119a72',
    archivePath: 'package/dist/index.global.js',
    outputPath: 'public/vendor/tailwindcss-browser-4.3.2.js',
    outputSha256: '0bc32045dd897c063f4966c608bbbe373e035fcafcb3dd8ee3b315d5e6165410'
  },
  {
    name: 'JSZip 3.10.1',
    url: 'https://registry.npmjs.org/jszip/-/jszip-3.10.1.tgz',
    archiveSha256: '5117f4a2a645aeb307bf3b829c575ad58135cc97e75291e594532ab5b5b21b23',
    archivePath: 'package/dist/jszip.min.js',
    outputPath: 'public/vendor/jszip-3.10.1.min.js',
    outputSha256: 'acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e'
  }
]);

export async function prepareVendorAssets({ fetchImpl = globalThis.fetch, baseDir = root } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required to prepare vendor assets.');
  const results = [];
  for (const asset of VENDOR_ASSETS) {
    const output = resolve(baseDir, asset.outputPath);
    const existing = await readVerifiedFile(output, asset.outputSha256);
    if (existing) {
      results.push({ ...asset, status: 'cached', bytes: existing.length });
      continue;
    }

    const response = await fetchWithRetry(fetchImpl, asset.url);
    if (!response.ok) throw new Error(`Unable to download ${asset.name}: HTTP ${response.status}.`);
    const archive = Buffer.from(await response.arrayBuffer());
    assertDigest(archive, asset.archiveSha256, `${asset.name} archive`);
    const content = extractTarEntry(gunzipSync(archive), asset.archivePath);
    assertDigest(content, asset.outputSha256, `${asset.name} browser bundle`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content);
    results.push({ ...asset, status: 'downloaded', bytes: content.length });
  }
  return results;
}

export function extractTarEntry(tarBuffer, wantedPath) {
  let offset = 0;
  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = readTarString(header.subarray(0, 100));
    const prefix = readTarString(header.subarray(345, 500));
    const path = prefix ? `${prefix}/${name}` : name;
    const sizeText = readTarString(header.subarray(124, 136)).trim();
    const size = Number.parseInt(sizeText || '0', 8);
    if (!Number.isFinite(size) || size < 0) throw new Error(`Invalid TAR size for ${path}.`);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > tarBuffer.length) throw new Error(`Truncated TAR entry ${path}.`);
    if (path === wantedPath) return Buffer.from(tarBuffer.subarray(contentStart, contentEnd));
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`Vendor bundle entry not found: ${wantedPath}.`);
}

async function fetchWithRetry(fetchImpl, url, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchImpl(url, { headers: { 'user-agent': 'stixio-vendor-preparer/1.0' } });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError || new Error(`Unable to download ${url}.`);
}

function readTarString(buffer) {
  const zero = buffer.indexOf(0);
  return buffer.subarray(0, zero >= 0 ? zero : buffer.length).toString('utf8').trim();
}

async function readVerifiedFile(path, expectedDigest) {
  try {
    const content = await readFile(path);
    return digest(content) === expectedDigest ? content : null;
  } catch {
    return null;
  }
}

function assertDigest(content, expected, label) {
  const actual = digest(content);
  if (actual !== expected) throw new Error(`${label} checksum mismatch. Expected ${expected}, received ${actual}.`);
}

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  const results = await prepareVendorAssets();
  results.forEach(result => console.log(`${result.status}: ${result.name} -> ${result.outputPath} (${result.bytes} bytes)`));
}
