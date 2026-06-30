import { readFile, writeFile } from 'node:fs/promises';

const parityTestPath = 'tests/e2e/parity-layout-refine-package.spec.js';
const secondTestPath = 'tests/e2e/parity-multisource-mask-review.spec.js';
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

console.log('RC1 parity fixes applied.');
