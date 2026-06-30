import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const parityTestPath = 'tests/e2e/parity-layout-refine-package.spec.js';
const secondTestPath = 'tests/e2e/parity-multisource-mask-review.spec.js';
const refineReviewTestPath = 'tests/e2e/parity-refine-review.spec.js';
const stressTestPath = 'tests/e2e/parity-stress.spec.js';
const profilesPath = 'src/core/destination-profiles.js';
const destinationControllerPath = 'src/ui/destination-controller.js';
const appPath = 'src/ui/stixio-workshop-app-v2.js';

let parityTest = await readFile(parityTestPath, 'utf8');
parityTest = parityTest.replace(
  "await page.waitForSelector('#fileInput');\n  await page.waitForSelector('#stage-package');",
  "await page.waitForSelector('#fileInput', { state: 'attached' });\n  await page.waitForSelector('#stage-package', { state: 'attached' });"
);
await writeFile(parityTestPath, parityTest, 'utf8');

let secondTest = await readFile(secondTestPath, 'utf8');
secondTest = secondTest.replace(
  `    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'source-a.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#ef4444') });
    await workshopApp.page.locator('[data-layout="2x2"]').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(4);
    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'source-b.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#3b82f6') });
    await workshopApp.page.locator('[data-layout="1x1"]').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(5);`,
  `    await workshopApp.page.locator('[data-layout="2x2"]').click();
    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'source-a.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#ef4444') });
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(4);
    await workshopApp.page.locator('#fileInput').setInputFiles({ name: 'source-b.svg', mimeType: 'image/svg+xml', buffer: panelSvg('#3b82f6') });
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(8);
    await workshopApp.page.locator('[data-layout="1x1"]').click();
    await workshopApp.page.locator('#detectBtn').click();
    await expect(workshopApp.page.locator('[data-review-card="true"]')).toHaveCount(5);`
);
await writeFile(secondTestPath, secondTest, 'utf8');

let refineReviewTest = await readFile(refineReviewTestPath, 'utf8');
refineReviewTest = refineReviewTest.replace(
  `    await legacyApp.page.locator('#enableChroma').uncheck({ force: true });
    await legacyApp.page.locator('#enableChroma').dispatchEvent('change');`,
  `    await legacyApp.page.locator('#enableChroma').check({ force: true });
    await legacyApp.page.locator('#enableChroma').dispatchEvent('change');
    await legacyApp.page.locator('#bgColorInput').fill('#000000');
    await legacyApp.page.locator('#bgColorInput').dispatchEvent('input');`
);
const legacyGeometryExpression = `state.allBoxes.map(box => [Math.round(box.cropX), Math.round(box.cropY), Math.round(box.cropW), Math.round(box.cropH)])`;
refineReviewTest = refineReviewTest.replace(
  `legacyApp.page.evaluate(() => geometryListForParity(state.allBoxes))`,
  `legacyApp.page.evaluate(() => ${legacyGeometryExpression})`
);
refineReviewTest = refineReviewTest.replace(
  `legacyApp.page.evaluate(() => geometryListForParity(state.allBoxes))`,
  `legacyApp.page.evaluate(() => ${legacyGeometryExpression})`
);
refineReviewTest = refineReviewTest.replace(
  `    await legacyApp.page.locator('.step3-card').nth(0).dragTo(legacyApp.page.locator('.step3-card').nth(2));`,
  `    await expect.poll(() => legacyApp.page.locator('.step3-card').count(), { timeout: 12000 }).toBe(4);
    await legacyApp.page.evaluate(() => {
      const cards = [...document.querySelectorAll('.step3-card')];
      const source = cards[0];
      const target = cards[2];
      if (!source || !target) throw new Error(\`Legacy reorder cards unavailable: \${cards.length}\`);
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
    });`
);
await writeFile(refineReviewTestPath, refineReviewTest, 'utf8');

let stressTest = await readFile(stressTestPath, 'utf8');
stressTest = stressTest.replace(
  `  return { path, snapshot: JSON.parse(archive['project.json'].value) };`,
  `  return { path, archive, snapshot: JSON.parse(archive['project.json'].value) };`
);
stressTest = stressTest.replace(
  `    const maskCount = exported.snapshot.document.frames.filter(frame => frame.custom?.protectMask?.dataUrl).length;
    expect(maskCount).toBe(40);
    stressResults.push({ scenario: 'forty-isolated-masks', maskCount, totalMs: Date.now() - startedAt });`,
  `    const manifestMaskCount = exported.snapshot.document.frames.filter(frame => frame.custom?.protectMask?.assetPath).length;
    const archiveMaskCount = Object.keys(exported.archive).filter(path => path.startsWith('masks/') && path.endsWith('.png')).length;
    expect(manifestMaskCount).toBe(40);
    expect(archiveMaskCount).toBe(40);
    stressResults.push({ scenario: 'forty-isolated-masks', manifestMaskCount, archiveMaskCount, totalMs: Date.now() - startedAt });`
);
await writeFile(stressTestPath, stressTest, 'utf8');

let profiles = await readFile(profilesPath, 'utf8');
profiles = profiles.replace(
  `  suffix = '',
  renderedMap = null
} = {}) {`,
  `  suffix = '',
  renderedMap = null,
  identityFrames = frames
} = {}) {`
);
profiles = profiles.replace(
  `  const counters = {};
  const items = frames.map((frame, order) => {
    const requestedRole = frame.state?.packageRole || frame.custom?.outputRole || fallback;
    const roleKey = allowed.has(requestedRole) ? requestedRole : fallback;
    counters[roleKey] = (counters[roleKey] || 0) + 1;
    const roleRule = getDestinationRoleRule(profile, roleKey);
    const index = counters[roleKey];
    const fileName = namingMode === 'sequential'
      ? sequentialFileName(order + 1, profile.output.extension, prefix, suffix)
      : destinationFileName(roleRule, index, profile.output.extension, prefix, suffix);`,
  `  const identityCounters = {};
  const identityRoleIndex = new Map();
  const identityOrder = new Map();
  (identityFrames || frames).forEach((frame, order) => {
    const requestedRole = frame.state?.packageRole || frame.custom?.outputRole || fallback;
    const roleKey = allowed.has(requestedRole) ? requestedRole : fallback;
    identityCounters[roleKey] = (identityCounters[roleKey] || 0) + 1;
    identityRoleIndex.set(frame.id, identityCounters[roleKey]);
    identityOrder.set(frame.id, order);
  });
  const fallbackCounters = {};
  const items = frames.map((frame, order) => {
    const requestedRole = frame.state?.packageRole || frame.custom?.outputRole || fallback;
    const roleKey = allowed.has(requestedRole) ? requestedRole : fallback;
    fallbackCounters[roleKey] = (fallbackCounters[roleKey] || 0) + 1;
    const roleRule = getDestinationRoleRule(profile, roleKey);
    const index = identityRoleIndex.get(frame.id) || fallbackCounters[roleKey];
    const stableOrder = identityOrder.has(frame.id) ? identityOrder.get(frame.id) : order;
    const fileName = namingMode === 'sequential'
      ? sequentialFileName(stableOrder + 1, profile.output.extension, prefix, suffix)
      : destinationFileName(roleRule, index, profile.output.extension, prefix, suffix);`
);
await writeFile(profilesPath, profiles, 'utf8');

let controller = await readFile(destinationControllerPath, 'utf8');
controller = controller.replace(
  `      suffix: options.suffix,
      renderedMap: options.renderedMap
    });`,
  `      suffix: options.suffix,
      renderedMap: options.renderedMap,
      identityFrames: options.identityFrames || frames
    });`
);
await writeFile(destinationControllerPath, controller, 'utf8');

let app = await readFile(appPath, 'utf8');
app = app.replace(
  `function packagePlan(list=frames()){return state.destinationController?.buildPlan?.(list,{namingMode:state.settings.packageNamingMode==='sequential'?'sequential':'profile',prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,renderedMap:state.rendered})`,
  `function packagePlan(list=frames()){return state.destinationController?.buildPlan?.(list,{namingMode:state.settings.packageNamingMode==='sequential'?'sequential':'profile',prefix:state.settings.filenamePrefix,suffix:state.settings.filenameSuffix,renderedMap:state.rendered,identityFrames:frames()})`
);
await writeFile(appPath, app, 'utf8');

const artifactRoot = 'parity-results/patched-sources';
await mkdir(`${artifactRoot}/src/core`, { recursive: true });
await mkdir(`${artifactRoot}/src/ui`, { recursive: true });
await mkdir(`${artifactRoot}/tests/e2e`, { recursive: true });
for (const sourcePath of [profilesPath, destinationControllerPath, appPath, parityTestPath, secondTestPath, refineReviewTestPath, stressTestPath]) {
  await copyFile(sourcePath, `${artifactRoot}/${sourcePath}`);
}

console.log('RC1 parity fixes applied and copied to parity artifacts.');
