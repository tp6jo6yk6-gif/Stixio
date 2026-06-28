import { readdir, readFile, rename, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const renames = [
  ['stixio-line.html', 'workshop.html'],
  ['line.html', 'workshop-legacy.html'],
  ['src/ui/stixio-line-app.js', 'src/ui/stixio-workshop-app.js'],
  ['docs/LINE-INTEGRATION.md', 'docs/WORKSHOP-ARCHITECTURE.md'],
  ['tests/line-integration.test.js', 'tests/workshop-integration.test.js'],
  ['src/core/line-presets.js', 'src/core/sticker-presets.js'],
  ['src/destinations/line-sticker.json', 'src/destinations/sticker-package.json']
];

for (const [from, to] of renames) {
  if (!existsSync(from)) continue;
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
}

const replacements = [
  ['Stixio LINE Studio', 'Stixio Workshop'],
  ['LINE Sticker Studio v2', 'Stixio Workshop'],
  ['LINE Sticker Studio', 'Stixio Workshop'],
  ['LINE workflow parity', 'Sticker production workspace'],
  ['LINE 功能整合到 Stixio 架構', 'Stixio Workshop 架構整合'],
  ['LINE 尺寸規格', '貼圖輸出規格'],
  ['LINE 規格切換', '貼圖規格切換'],
  ['LINE 五類尺寸與用途預設', '貼圖尺寸與用途預設'],
  ['LINE category/output presets', 'Sticker category/output presets'],
  ['LINE platform presets', 'Sticker platform presets'],
  ['LINE Stickers', 'Sticker Package'],
  ['LINE Sticker', 'Sticker Package'],
  ['LINE Studio', 'Workshop'],
  ['LINE integration', 'Workshop integration'],
  ['LINE architecture integration', 'Workshop architecture integration'],
  ['LINE-to-Stixio', 'Workshop'],
  ['LINE 功能', '貼圖功能'],
  ['LINE 規格', '貼圖規格'],
  ['LINE 類型', '貼圖類型'],
  ['LINE', 'Sticker'],
  ['initStixioLineApp', 'initStixioWorkshop'],
  ['stixio-line-app.js', 'stixio-workshop-app.js'],
  ['stixio-line.html', 'workshop.html'],
  ['line.html', 'workshop-legacy.html'],
  ['LINE-INTEGRATION.md', 'WORKSHOP-ARCHITECTURE.md'],
  ['line-integration.test.js', 'workshop-integration.test.js'],
  ['stixio-line-integration', 'stixio-workshop'],
  ['line-presets.js', 'sticker-presets.js'],
  ['line-sticker.json', 'sticker-package.json'],
  ['LineStickerCategories', 'StickerCategories'],
  ['LineAssetRoles', 'AssetRoles'],
  ['LINE_PRESETS', 'STICKER_PRESETS'],
  ['getLinePresets', 'getStickerPresets'],
  ['getLinePreset', 'getStickerPreset'],
  ['applyLinePreset', 'applyStickerPreset'],
  ['getLineStickerFilename', 'getStickerPackageFilename'],
  ['getLineRoleFilename', 'getRolePackageFilename'],
  ['lineNamingMode', 'packageNamingMode'],
  ['lineCategory', 'stickerCategory'],
  ['line-preview', 'sticker-preview'],
  ['ReviewBackgrounds.LINE', 'ReviewBackgrounds.STICKER'],
  ["destinationKey: exportOptions.destinationKey || 'line'", "destinationKey: exportOptions.destinationKey || 'workshop'"],
  ["destinationKey: 'line'", "destinationKey: 'workshop'"],
  ["key: 'line'", "key: 'workshop'"],
  ["name: 'LINE'", "name: 'Workshop'"],
  ["name: 'Sticker Stickers'", "name: 'Sticker Package'"],
  ["naming: 'line-sticker'", "naming: 'sticker-package'"],
  ["packageRules.naming === 'line-sticker'", "packageRules.naming === 'sticker-package'"],
  ['line-sticker', 'sticker-package'],
  ['line-stickers', 'sticker-workshop'],
  ['stixio-line', 'stixio-workshop']
];

const textExtensions = new Set(['.js', '.mjs', '.json', '.md', '.html', '.txt', '.css']);
const files = await walk('.');
for (const file of files) {
  if (file.includes('/.git/') || file.includes('/node_modules/') || file.includes('/dist/')) continue;
  if (file.startsWith('.github/workflows/')) continue;
  if (!textExtensions.has(path.extname(file))) continue;
  const content = await readFile(file, 'utf8');
  let next = content;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== content) await writeFile(file, next, 'utf8');
}

console.log('Workshop migration complete.');

async function walk(dir) {
  const entries = await readdir(dir);
  const output = [];
  for (const entry of entries) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) output.push(...await walk(full));
    else output.push(full.replace(/^\.\//, ''));
  }
  return output;
}
