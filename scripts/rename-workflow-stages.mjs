import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing target: ${label}`);
  return source.replace(from, to);
}

const appPath = 'src/ui/stixio-workshop-app.js';
let app = await readFile(appPath, 'utf8');

app = replaceOnce(
  app,
  'Stixio architecture · Sticker production workspace',
  'Layout · Refine · Review · Package',
  'header workflow subtitle'
);

app = replaceOnce(
  app,
  '<button id="exportZipBtn" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Export ZIP</button>',
  '<button id="exportZipBtn" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Package · Export ZIP</button>',
  'package export button'
);

app = replaceOnce(
  app,
  `        </div>\n      </header>\n      <main class="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[360px_1fr_340px]">`,
  `        </div>\n        <nav aria-label="Workshop workflow" class="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-5 pb-4 md:grid-cols-4">\n          <a href="#stage-layout" class="rounded-2xl bg-slate-950 px-4 py-3 text-white"><span class="block text-xs font-black uppercase tracking-[.18em] text-emerald-300">Layout</span><span class="mt-1 block text-sm font-black">匯入與版面切割</span></a>\n          <a href="#stage-refine" class="rounded-2xl border border-slate-900/10 bg-white px-4 py-3"><span class="block text-xs font-black uppercase tracking-[.18em] text-rose-500">Refine</span><span class="mt-1 block text-sm font-black">細部修補</span></a>\n          <a href="#stage-review" class="rounded-2xl border border-slate-900/10 bg-white px-4 py-3"><span class="block text-xs font-black uppercase tracking-[.18em] text-sky-600">Review</span><span class="mt-1 block text-sm font-black">預覽與檢查</span></a>\n          <a href="#stage-package" class="rounded-2xl border border-slate-900/10 bg-white px-4 py-3"><span class="block text-xs font-black uppercase tracking-[.18em] text-amber-600">Package</span><span class="mt-1 block text-sm font-black">角色與輸出打包</span></a>\n        </nav>\n      </header>\n      <main class="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[360px_1fr_340px]">`,
  'workflow stage navigation'
);

app = replaceOnce(
  app,
  '<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Artwork Engine</p><h2 class="mt-1 text-xl font-black">多圖匯入</h2>',
  '<section id="stage-layout" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Layout · Artwork Engine</p><h2 class="mt-1 text-xl font-black">匯入與版面切割</h2>',
  'Layout import panel'
);

app = replaceOnce(app, '>Detection Engine</p><h2 class="mt-1 text-xl font-black">切割與智能貼合</h2>', '>Layout · Detection Engine</p><h2 class="mt-1 text-xl font-black">切割與智能貼合</h2>', 'Layout detection label');
app = replaceOnce(app, '<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Rules Engine</p><h2 class="mt-1 text-xl font-black">貼圖輸出規格</h2>', '<section id="stage-package" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><p class="text-[10px] font-black uppercase tracking-[.2em] text-amber-600">Package · Rules Engine</p><h2 class="mt-1 text-xl font-black">輸出規格與用途</h2>', 'Package rules panel');
app = replaceOnce(app, '>Refine Engine</p><h2 class="mt-1 text-xl font-black">去背與邊緣</h2>', '>Refine · Refine Engine</p><h2 class="mt-1 text-xl font-black">去背與邊緣</h2>', 'Refine engine label');
app = replaceOnce(app, '>Frame Editor</p><h2 class="text-xl font-black">原圖與九點裁切框</h2>', '>Layout · Frame Editor</p><h2 class="text-xl font-black">原圖與九點裁切框</h2>', 'Layout frame editor label');
app = replaceOnce(app, '<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Manual Refine</p>', '<section id="stage-refine" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-rose-500">Refine · Manual Tools</p>', 'Refine manual panel');
app = replaceOnce(app, '<section class="rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-emerald-600">Review + Package</p>', '<section id="stage-review" class="scroll-mt-40 rounded-[1.75rem] border border-slate-900/10 bg-white p-5 shadow-sm"><div class="flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-[.2em] text-sky-600">Review · Package</p>', 'Review board');
app = replaceOnce(app, '>Document Engine</p><h2 class="mt-1 text-xl font-black">原圖清單</h2>', '>Layout · Document Engine</p><h2 class="mt-1 text-xl font-black">原圖清單</h2>', 'Layout document label');
app = replaceOnce(app, '>Selected Frame</p>', '>Layout · Selected Frame</p>', 'Layout selected frame label');
app = replaceOnce(app, '>Review Engine</p>', '>Review · Review Engine</p>', 'Review engine label');

await writeFile(appPath, app, 'utf8');

const architecturePath = 'docs/architecture/ARCHITECTURE_V1.md';
let architecture = await readFile(architecturePath, 'utf8');
architecture = replaceOnce(
  architecture,
  '## Engines',
  `## Workflow stages\n\nThe user-facing workflow uses stage names instead of numbered steps:\n\n1. **Layout｜匯入與版面切割** — imports artwork, detects grids, creates Frames, and adjusts crop geometry. This replaces the former \`Step 1\` label.\n2. **Refine｜細部修補** — removes backgrounds, repairs masks, feathers edges, and applies borders.\n3. **Review｜預覽與檢查** — reviews rendered results, warnings, order, and export selection.\n4. **Package｜角色與輸出打包** — assigns main/tab/sticker roles, applies destination naming, and exports PNG or ZIP.\n\nThese are Workflow Engine stages. Artwork, Detection, Refine, Review, Rules, Render, and Package remain engine responsibilities beneath them.\n\n## Engines`,
  'architecture workflow stages'
);
architecture = architecture.replace(
  /## V1 rule[\s\S]*$/,
  `## Current production rule\n\nThe modular Workshop architecture is now the production application.\n\n- \`main/index.html\` directly starts \`src/ui/stixio-workshop-app.js\`.\n- User-facing workflow terminology is \`Layout → Refine → Review → Package\`.\n- Numbered \`Step 1 / Step 2 / Step 3\` labels are retired.\n- The stable legacy recovery points remain \`stable-legacy\` and \`v1.0.0-legacy-stable\`.\n`
);
await writeFile(architecturePath, architecture, 'utf8');

const architectureReadmePath = 'docs/architecture/README.md';
await writeFile(architectureReadmePath, `# Stixio Architecture Docs\n\nThis folder documents the production Workshop architecture.\n\n## Production entry\n\n\`main/index.html\` starts the single modular application at \`src/ui/stixio-workshop-app.js\`.\n\n## User-facing workflow\n\n\`Layout → Refine → Review → Package\`\n\n- **Layout｜匯入與版面切割** replaces the former numbered first step.\n- **Refine｜細部修補** handles mask and edge repair.\n- **Review｜預覽與檢查** validates rendered results and order.\n- **Package｜角色與輸出打包** handles roles, names, PNG, and ZIP delivery.\n\n## Core documents\n\n- [ARCHITECTURE_V1.md](./ARCHITECTURE_V1.md)\n- [Workshop architecture](../WORKSHOP-ARCHITECTURE.md)\n\n## Core locations\n\n\`src/core/\` — engines and domain models  \n\`src/destinations/\` — destination profiles  \n\`src/ui/stixio-workshop-app.js\` — the only production UI\n`, 'utf8');

const workshopArchitecturePath = 'docs/WORKSHOP-ARCHITECTURE.md';
let workshopArchitecture = await readFile(workshopArchitecturePath, 'utf8');
workshopArchitecture = replaceOnce(
  workshopArchitecture,
  '## 功能歸屬',
  `## 使用者工作流程名稱\n\n\`Layout → Refine → Review → Package\`\n\n| 階段 | 中文名稱 | 主要工作 |\n|---|---|---|\n| Layout | 匯入與版面切割 | 匯入、多圖管理、智能偵測、網格、Frame 與裁切 |\n| Refine | 細部修補 | 去背、遮罩、保留／刪除筆刷、羽化與外框 |\n| Review | 預覽與檢查 | 預覽、警告、排序、匯出選取 |\n| Package | 角色與輸出打包 | main／tab／sticker 角色、命名、PNG 與 ZIP |\n\n原本的編號式第一階段已正式改名為 **Layout｜匯入與版面切割**。\n\n## 功能歸屬`,
  'Workshop workflow table'
);
await writeFile(workshopArchitecturePath, workshopArchitecture, 'utf8');

const acceptancePath = 'docs/FEATURE-ACCEPTANCE.md';
let acceptance = await readFile(acceptancePath, 'utf8');
acceptance = acceptance
  .replace('| 三階段工作流程 | ✅ | Step 1、Step 2、Step 3 完整存在 |', '| 四階段工作流程命名 | ✅ | Layout、Refine、Review、Package 完整存在 |')
  .replace('| Step 2／Step 3 導航 | ✅ | 正常進入修補及預覽頁 |', '| 工作流程階段名稱 | ✅ | Layout、Refine、Review、Package 對應正式架構 |');
await writeFile(acceptancePath, acceptance, 'utf8');

await writeFile('tests/workshop-workflow-naming.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\n\nconst root = new URL('../', import.meta.url);\nconst read = path => readFile(new URL(path, root), 'utf8');\n\ntest('Workshop uses architecture stage names instead of numbered steps', async () => {\n  const app = await read('src/ui/stixio-workshop-app.js');\n  assert.match(app, /Layout · Artwork Engine/);\n  assert.match(app, /匯入與版面切割/);\n  assert.match(app, /Refine · Manual Tools/);\n  assert.match(app, /Review · Package/);\n  assert.match(app, /Package · Rules Engine/);\n  assert.doesNotMatch(app, /Step\\s*1/i);\n});\n\ntest('architecture book defines Layout as the renamed first stage', async () => {\n  const files = await Promise.all([\n    read('docs/architecture/ARCHITECTURE_V1.md'),\n    read('docs/architecture/README.md'),\n    read('docs/WORKSHOP-ARCHITECTURE.md')\n  ]);\n  for (const content of files) {\n    assert.match(content, /Layout/);\n    assert.match(content, /Refine/);\n    assert.match(content, /Review/);\n    assert.match(content, /Package/);\n  }\n});\n`, 'utf8');

console.log('Workflow stage names updated.');
