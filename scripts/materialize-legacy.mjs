import { gunzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import part1 from '../src/legacy/payload-1.js';
import part2 from '../src/legacy/payload-2.js';
import part3 from '../src/legacy/payload-3.js';
import part4 from '../src/legacy/payload-4.js';
import part5 from '../src/legacy/payload-5.js';

const compressed = Buffer.from(part1 + part2 + part3 + part4 + part5, 'base64');
const html = gunzipSync(compressed).toString('utf8');

if (!html.startsWith('<!DOCTYPE html>') || !html.includes('</html>')) {
  throw new Error('Materialized legacy HTML failed integrity checks.');
}

await writeFile('index.html', html, 'utf8');
console.log(`Materialized index.html (${Buffer.byteLength(html, 'utf8')} bytes)`);
