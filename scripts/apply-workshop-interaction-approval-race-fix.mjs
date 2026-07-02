import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/ui/stixio-workshop-app-v2.js';
const marker = '// WORKSHOP_INTERACTION_APPROVAL_RACE_FIX';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found.`);
  return source.replace(before, after);
}

async function main() {
  let source = await readFile(path, 'utf8');
  if (source.includes(marker)) {
    console.log('Workshop interaction approval race fix already present.');
    return;
  }

  source = replaceOnce(
    source,
    `function renderSelectedLowQualityPreview(){const frame=selectedFrame(),source=sourceForFrame(frame);if(!frame||!source)return;cancelScheduledFullQuality();setPreviewInteractionActive(true);const geometry=`,
    `${marker}\nfunction renderSelectedLowQualityPreview(){const frame=selectedFrame(),source=sourceForFrame(frame);if(!frame||!source)return;const wasPreviewActive=state.previewInteractionActive;cancelScheduledFullQuality();setPreviewInteractionActive(true);const geometry=`,
    'Low-quality preview start'
  );

  source = replaceOnce(
    source,
    `const status=document.getElementById('refineStatus');if(status)status.dataset.previewQuality='low';}`,
    `const status=document.getElementById('refineStatus');if(status)status.dataset.previewQuality='low';if(!wasPreviewActive){invalidateAllReviewApprovals();invalidateReviewCaches();}}`,
    'Low-quality preview invalidation'
  );

  source = replaceOnce(
    source,
    `function scheduleRenderAll(delay=320){cancelScheduledFullQuality();const token=state.fullQualityJobToken;`,
    `function scheduleRenderAll(delay=320){if(!state.previewInteractionActive){invalidateAllReviewApprovals();invalidateReviewCaches();setPreviewInteractionActive(true);}cancelScheduledFullQuality();const token=state.fullQualityJobToken;`,
    'Full-quality scheduling invalidation'
  );

  source = replaceOnce(
    source,
    `function startFullQualityRender(token){if(token!==state.fullQualityJobToken)return;clearRenderCache();`,
    `function startFullQualityRender(token){if(token!==state.fullQualityJobToken)return;clearRenderCache(false);`,
    'Full-quality delayed cache clear'
  );

  await writeFile(path, source);
  console.log('Workshop interaction approval race fix installed.');
}

await main();
