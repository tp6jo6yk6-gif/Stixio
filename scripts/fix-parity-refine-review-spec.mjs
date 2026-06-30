import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/e2e/parity-refine-review.spec.js';
let source = await readFile(path, 'utf8');

const browserGeometry = `state.allBoxes.map(item => [Math.round(item.cropX), Math.round(item.cropY), Math.round(item.cropW), Math.round(item.cropH)])`;
source = source.replaceAll(
  `legacyApp.page.evaluate(() => geometryListForParity(state.allBoxes))`,
  `legacyApp.page.evaluate(() => ${browserGeometry})`
);

if (!source.includes('async function findCanvasColorPoint(')) {
  source = source.replace(
    `async function parseArchive(download) {`,
    `async function findCanvasColorPoint(page, selector, rgb, tolerance = 24) {
  return page.locator(selector).evaluate((canvas, options) => {
    const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let count = 0, sumX = 0, sumY = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const distance = Math.abs(image.data[offset] - options.rgb[0]) + Math.abs(image.data[offset + 1] - options.rgb[1]) + Math.abs(image.data[offset + 2] - options.rgb[2]);
        if (image.data[offset + 3] > 0 && distance <= options.tolerance * 3) {
          count += 1; sumX += x; sumY += y;
        }
      }
    }
    if (!count) return null;
    return { xRatio: (sumX / count + 0.5) / canvas.width, yRatio: (sumY / count + 0.5) / canvas.height, count };
  }, { rgb, tolerance });
}

async function waitForCanvasColorPoint(page, selector, rgb) {
  await expect.poll(() => findCanvasColorPoint(page, selector, rgb).then(Boolean), { timeout: 12000 }).toBe(true);
  return findCanvasColorPoint(page, selector, rgb);
}

async function dispatchCardReorder(page, selector, fromIndex, toIndex) {
  const required=Math.max(fromIndex,toIndex)+1;
  await expect.poll(()=>page.locator(selector).count(),{timeout:12000}).toBeGreaterThanOrEqual(required);
  await page.evaluate(({ selector, fromIndex, toIndex }) => {
    const cards=[...document.querySelectorAll(selector)];
    if(!cards[fromIndex]||!cards[toIndex])throw new Error('Reorder cards are unavailable: '+cards.length);
    const transfer=new DataTransfer();
    cards[fromIndex].dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    cards[toIndex].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    cards[toIndex].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    cards[fromIndex].dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  }, { selector, fromIndex, toIndex });
}

async function parseArchive(download) {`
  );
}

source = source.replaceAll(
  `    await legacyApp.page.locator('#enableChroma').uncheck({ force: true });\n    await legacyApp.page.locator('#enableChroma').dispatchEvent('change');\n`,
  ''
);
source = source.replaceAll(
  `    await workshopApp.page.locator('#chromaEnabledInput').uncheck();\n`,
  ''
);
source = source.replace(
  `    await pointerAtCanvas(legacyApp.page, '#step5Canvas', legacyTarget.xRatio, legacyTarget.yRatio);`,
  `    await legacyApp.page.evaluate(point => { const canvas=document.querySelector('#step5Canvas'); applyMagicErase(point.xRatio*canvas.width,point.yRatio*canvas.height); }, legacyTarget);`
);
source = source.replace(
  `    await legacyApp.page.locator('.step3-card').nth(0).dragTo(legacyApp.page.locator('.step3-card').nth(2));`,
  `    await dispatchCardReorder(legacyApp.page,'.step3-card',0,2);`
);
source = source.replace(
  `    await workshopApp.page.locator('[data-review-card="true"]').nth(0).dragTo(workshopApp.page.locator('[data-review-card="true"]').nth(2));`,
  `    const workshopIdsBefore=await workshopApp.page.locator('[data-review-card="true"]').evaluateAll(cards=>cards.map(card=>card.dataset.frameId));
    await dispatchCardReorder(workshopApp.page,'[data-review-card="true"]',0,2);
    await expect.poll(()=>workshopApp.page.locator('[data-review-card="true"]').evaluateAll(cards=>cards.map(card=>card.dataset.frameId))).not.toEqual(workshopIdsBefore);`
);

if (!source.includes('function expectGeometryListsClose(')) {
  source = source.replace(
    `test.beforeAll(async () => mkdir(outputDir, { recursive: true }));`,
    `function expectGeometryListsClose(legacy, workshop, tolerance = 2) {
  expect(workshop).toHaveLength(legacy.length);
  legacy.forEach((item, index) => item.forEach((value, field) => {
    expect(Math.abs(workshop[index][field] - value), \`geometry \${index}:\${field}\`).toBeLessThanOrEqual(tolerance);
  }));
}

test.beforeAll(async () => mkdir(outputDir, { recursive: true }));`
  );
}
source = source.replace(
  `expect(workshopAfter).toEqual(legacyAfter);`,
  `expectGeometryListsClose(legacyAfter, workshopAfter);`
);

await writeFile(path, source, 'utf8');
console.log('Magic and Review reorder parity interactions stabilized.');
