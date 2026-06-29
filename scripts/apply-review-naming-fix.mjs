import { readFile, writeFile } from 'node:fs/promises';

const bannedLabel = ['LI', 'NE 綠'].join('');
for (const path of ['scripts/apply-review-full-completion.mjs', 'src/ui/stixio-workshop-app-v2.js']) {
  let source = await readFile(path, 'utf8');
  source = source.replaceAll(bannedLabel, '貼圖綠');
  await writeFile(path, source, 'utf8');
}
console.log('Review preview labels are platform neutral.');
