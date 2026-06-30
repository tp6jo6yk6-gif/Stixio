import { mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import part1 from '../src/legacy/payload-1.js';
import part2 from '../src/legacy/payload-2.js';
import part3 from '../src/legacy/payload-3.js';
import part4 from '../src/legacy/payload-4.js';
import part5 from '../src/legacy/payload-5.js';

const outputDir = new URL('../.parity/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const compressed = Buffer.from(part1 + part2 + part3 + part4 + part5, 'base64');
const htmlBuffer = gunzipSync(compressed);
const html = htmlBuffer.toString('utf8');
const sha256 = createHash('sha256').update(htmlBuffer).digest('hex');

await writeFile(new URL('legacy-extracted.html', outputDir), html, 'utf8');

const inventory = {
  generatedAt: new Date().toISOString(),
  sha256,
  bytes: htmlBuffer.byteLength,
  title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
  ids: unique(matches(html, /\bid=["']([^"']+)["']/gi)),
  names: unique(matches(html, /\bname=["']([^"']+)["']/gi)),
  inputTypes: countValues(matches(html, /<input\b[^>]*\btype=["']([^"']+)["'][^>]*>/gi).map(value => value.toLowerCase())),
  tags: countValues(matches(html, /<([a-z][a-z0-9-]*)\b/gi).map(value => value.toLowerCase())),
  scriptCount: countMatches(html, /<script\b/gi),
  styleCount: countMatches(html, /<style\b/gi),
  canvasCount: countMatches(html, /<canvas\b/gi),
  buttonCount: countMatches(html, /<button\b/gi),
  selectCount: countMatches(html, /<select\b/gi),
  textareaCount: countMatches(html, /<textarea\b/gi),
  fileInputCount: countMatches(html, /<input\b[^>]*\btype=["']file["'][^>]*>/gi),
  keywordSignals: keywordSignals(html)
};

await writeFile(new URL('legacy-static-inventory.json', outputDir), JSON.stringify(inventory, null, 2), 'utf8');
await writeFile(new URL('legacy-sha256.txt', outputDir), `${sha256}  legacy-extracted.html\n`, 'utf8');

console.log(`Legacy HTML extracted: ${htmlBuffer.byteLength} bytes`);
console.log(`Legacy SHA-256: ${sha256}`);
console.log(`Legacy static IDs: ${inventory.ids.length}`);
console.log(`Legacy buttons: ${inventory.buttonCount}, canvases: ${inventory.canvasCount}, file inputs: ${inventory.fileInputCount}`);

function firstMatch(value, pattern) {
  const match = value.match(pattern);
  return match ? stripTags(match[1]).trim() : '';
}

function matches(value, pattern) {
  const output = [];
  let match;
  while ((match = pattern.exec(value))) output.push(match[1]);
  return output;
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function countValues(values) {
  return Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())].sort(([a], [b]) => a.localeCompare(b)));
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

function keywordSignals(value) {
  const text = stripTags(value).toLowerCase();
  const groups = {
    import: ['import', 'upload', 'open image', '匯入', '上傳', '選擇圖片'],
    layout: ['layout', 'grid', 'smart', 'detect', '切割', '網格', '智能', '偵測'],
    frame: ['frame', 'crop', 'handle', '裁切', '調框'],
    refine: ['refine', 'background', 'chroma', 'mask', '去背', '遮罩', '羽化', '去雜點'],
    review: ['review', 'approve', 'warning', '核准', '檢查', '警告'],
    package: ['package', 'zip', 'manifest', '下載', '封裝'],
    history: ['undo', 'redo', '復原', '重做'],
    viewport: ['zoom', 'pan', '縮放', '平移'],
    project: ['project', 'save', 'autosave', '專案', '儲存']
  };
  return Object.fromEntries(Object.entries(groups).map(([key, words]) => [key, words.filter(word => text.includes(word))]));
}
