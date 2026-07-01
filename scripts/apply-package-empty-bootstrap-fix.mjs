import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/package-controller.js';
const marker = '// PACKAGE_EMPTY_BOOTSTRAP_FIX';
const source = await readFile(path, 'utf8');

if (source.includes(marker)) {
  console.log('Empty Package bootstrap fix already present.');
  process.exit(0);
}

const target = `  function createSnapshot() {
    const frames = adapter.getExportFrames();
    frames.forEach(frame => adapter.ensureRendered(frame));`;

const replacement = `  function createSnapshot() {
    const frames = adapter.getExportFrames();

    ${marker}
    if (!frames.length) {
      const packagePlan = adapter.getPackagePlan(frames);
      const entries = [];
      const output = adapter.getOutputMetadata();
      const reviewReport = {
        issues: [],
        summary: { total: 0, errors: 0, warnings: 0, info: 0 },
        ready: false,
        canPackage: false,
        packagePlan
      };
      const preflight = createPackagePreflight({ entries, packagePlan, reviewReport, settings: local.settings });
      const manifest = createPackageManifest({
        entries,
        settings: local.settings,
        metadata: {
          documentId: output.documentId,
          documentName: output.documentName,
          targetW: output.targetW,
          targetH: output.targetH,
          category: output.category,
          safeMargin: output.safeMargin,
          destinationKey: packagePlan.destinationKey
        }
      });
      return { frames, packagePlan, entries, reviewReport, preflight, manifest, output, settings: local.settings };
    }

    frames.forEach(frame => adapter.ensureRendered(frame));`;

if (!source.includes(target)) {
  throw new Error('Unable to locate Package createSnapshot bootstrap path.');
}

await writeFile(path, source.replace(target, replacement));
console.log('Empty Package bootstrap fix installed.');
