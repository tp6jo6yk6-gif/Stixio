import { readdir, readFile, rename, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const renames = [
  ['workshop.html', 'workshop.html'],
  ['workshop-legacy.html', 'workshop-legacy.html'],
  ['src/ui/stixio-workshop-app.js', 'src/ui/stixio-workshop-app.js'],
  ['docs/Sticker-INTEGRATION.md', 'docs/WORKSHOP-ARCHITECTURE.md'],
  ['tests/workshop-integration.test.js', 'tests/workshop-integration.test.js'],
  ['src/core/sticker-presets.js', 'src/core/sticker-presets.js'],
  ['src/destinations/sticker-package.json', 'src/destinations/sticker-package.json']
];

for (const [from, to] of renames) {
  if (!existsSync(from)) continue;
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
}

const replacements = [
  ['Stixio Workshop', 'Stixio Workshop'],
  ['Stixio Workshop', 'Stixio Workshop'],
  ['Stixio Workshop', 'Stixio Workshop'],
  ['Sticker production workspace', 'Sticker production workspace'],
  ['Stixio Workshop 架構整合', 'Stixio Workshop 架構整合'],
  ['貼圖輸出規格', '貼圖輸出規格'],
  ['貼圖規格切換', '貼圖規格切換'],
  ['貼圖尺寸與用途預設', '貼圖尺寸與用途預設'],
  ['Sticker category/output presets', 'Sticker category/output presets'],
  ['Sticker platform presets', 'Sticker platform presets'],
  ['Sticker Package', 'Sticker Package'],
  ['Sticker Package', 'Sticker Package'],
  ['Workshop', 'Workshop'],
  ['Workshop integration', 'Workshop integration'],
  ['Workshop architecture integration', 'Workshop architecture integration'],
  ['Workshop', 'Workshop'],
  ['貼圖功能', '貼圖功能'],
  ['貼圖規格', '貼圖規格'],
  ['貼圖類型', '貼圖類型'],
  ['Sticker', 'Sticker'],
  ['initStixioWorkshop', 'initStixioWorkshop'],
  ['stixio-workshop-app.js', 'stixio-workshop-app.js'],
  ['workshop.html', 'workshop.html'],
  ['workshop-legacy.html', 'workshop-legacy.html'],
  ['Sticker-INTEGRATION.md', 'WORKSHOP-ARCHITECTURE.md'],
  ['workshop-integration.test.js', 'workshop-integration.test.js'],
  ['stixio-workshop', 'stixio-workshop'],
  ['sticker-presets.js', 'sticker-presets.js'],
  ['sticker-package.json', 'sticker-package.json'],
  ['StickerCategories', 'StickerCategories'],
  ['AssetRoles', 'AssetRoles'],
  ['Sticker_PRESETS', 'STICKER_PRESETS'],
  ['getStickerPresets', 'getStickerPresets'],
  ['getStickerPreset', 'getStickerPreset'],
  ['applyStickerPreset', 'applyStickerPreset'],
  ['getStickerPackageFilename', 'getStickerPackageFilename'],
  ['getRolePackageFilename', 'getRolePackageFilename'],
  ['packageNamingMode', 'packageNamingMode'],
  ['stickerCategory', 'stickerCategory'],
  ['sticker-preview', 'sticker-preview'],
  ['ReviewBackgrounds.Sticker', 'ReviewBackgrounds.STICKER'],
  ["destinationKey: exportOptions.destinationKey || 'workshop'", "destinationKey: exportOptions.destinationKey || 'workshop'"],
  ["destinationKey: 'workshop'", "destinationKey: 'workshop'"],
  ["key: 'workshop'", "key: 'workshop'"],
  ["name: 'Sticker'", "name: 'Workshop'"],
  ["name: 'Sticker Package'", "name: 'Sticker Package'"],
  ["naming: 'sticker-package'", "naming: 'sticker-package'"],
  ["packageRules.naming === 'sticker-package'", "packageRules.naming === 'sticker-package'"],
  ['sticker-package', 'sticker-package'],
  ['sticker-packages', 'sticker-workshop'],
  ['stixio-workshop', 'stixio-workshop']
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
