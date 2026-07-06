import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  migrateWorkshopSource,
  rewriteWorkshopImports
} from '../src/ui/native-workspace-migrator.js';

async function generateNativeCore() {
  const [source, constants, renderer] = await Promise.all([
    readFile(new URL('../src/ui/stixio-workshop-app-v2.backup.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/native_migration/constants.txt', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/native_migration/render_block.txt', import.meta.url), 'utf8')
  ]);
  return migrateWorkshopSource(source, { constants, renderer });
}

test('migrates the complete legacy core into native activeEditor Workspaces', async () => {
  const nativeCore = await generateNativeCore();

  assert.match(nativeCore, /\/\/ NATIVE_WORKSPACE_RENDERING/);
  assert.match(nativeCore, /activeEditor: resolveInitialEditor\(\)/);
  assert.match(nativeCore, /function renderActiveWorkspace\(\)/);
  assert.match(nativeCore, /function renderLayoutWorkspace\(\)/);
  assert.match(nativeCore, /function renderRefineWorkspace\(\)/);
  assert.match(nativeCore, /function renderReviewWorkspace\(\)/);
  assert.match(nativeCore, /function renderPackageWorkspace\(\)/);
  assert.match(nativeCore, /function getWorkflowProgress\(\)/);

  assert.match(nativeCore, /function bindLayoutEvents\(root\)/);
  assert.match(nativeCore, /function bindRefineEvents\(root\)/);
  assert.match(nativeCore, /function bindReviewEvents\(root\)/);
  assert.match(nativeCore, /function bindPackageEvents\(root\)/);
  assert.doesNotMatch(nativeCore, /bindAllWorkspaceEvents/);
  assert.doesNotMatch(nativeCore, /NULL_WORKSPACE_CONTROL/);
  assert.doesNotMatch(nativeCore, /function stageLink\(/);
});

test('generated native core has valid JavaScript syntax', async () => {
  const nativeCore = await generateNativeCore();
  const directory = await mkdtemp(join(tmpdir(), 'stixio-native-'));
  const file = join(directory, 'native-core.mjs');

  try {
    await writeFile(file, nativeCore);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('migration is idempotent after the native marker is present', async () => {
  const nativeCore = await generateNativeCore();
  const constants = await readFile(new URL('../scripts/native_migration/constants.txt', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../scripts/native_migration/render_block.txt', import.meta.url), 'utf8');

  assert.equal(migrateWorkshopSource(nativeCore, { constants, renderer }), nativeCore);
});

test('runtime import rewriting resolves core and controller modules absolutely', () => {
  const source = [
    "from '../core/index.js'",
    "from './package-controller.js'",
    "from './project-controller.js'",
    "from './destination-controller.js'"
  ].join('\n');
  const rewritten = rewriteWorkshopImports(source, 'https://example.test/src/ui/native-workspace-runtime.js');

  assert.match(rewritten, /https:\/\/example\.test\/src\/core\/index\.js/);
  assert.match(rewritten, /https:\/\/example\.test\/src\/ui\/package-controller\.js/);
  assert.match(rewritten, /https:\/\/example\.test\/src\/ui\/project-controller\.js/);
  assert.match(rewritten, /https:\/\/example\.test\/src\/ui\/destination-controller\.js/);
});
