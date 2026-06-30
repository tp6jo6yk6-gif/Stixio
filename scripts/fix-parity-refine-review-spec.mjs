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

async function parseArchive(download) {`
  );
}

const oldMagic = `    await importLegacy(legacyApp.page, repairSvg());
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#enableChroma').uncheck({ force: true });
    await legacyApp.page.locator('#enableChroma').dispatchEvent('change');
    await expect.poll(() => legacyAlpha(legacyApp.page, 0.29, 0.26)).toBeGreaterThan(0);
    await legacyApp.page.locator('#brushMagicBtn').click({ force: true });
    await pointerAtCanvas(legacyApp.page, '#step5Canvas', 0.29, 0.26);
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await expect.poll(() => legacyAlpha(legacyApp.page, 0.29, 0.26)).toBe(0);
    const legacy = {
      target: await legacyAlpha(legacyApp.page, 0.29, 0.26),
      neighbor: await legacyAlpha(legacyApp.page, 0.55, 0.3)
    };

    await importWorkshop(workshopApp.page, repairSvg());
    await workshopApp.page.locator('#chromaEnabledInput').uncheck();
    await workshopApp.page.locator('[data-mask-tool="magic"]').click();
    await workshopApp.page.locator('[data-magic-action="delete"]').click();
    await pointerAtCanvas(workshopApp.page, '#refineCanvas', 0.23, 0.23);
    await expect.poll(() => workshopAlpha(workshopApp.page, 0.29, 0.26)).toBe(0);
    const workshop = {
      target: await workshopAlpha(workshopApp.page, 0.29, 0.26),
      neighbor: await workshopAlpha(workshopApp.page, 0.55, 0.3)
    };`;

const newMagic = `    await importLegacy(legacyApp.page, repairSvg());
    await legacyApp.page.locator('#executeProcessBtn').click({ force: true });
    await legacyApp.page.locator('#enableChroma').uncheck({ force: true });
    await legacyApp.page.locator('#enableChroma').dispatchEvent('change');
    const legacyTarget = await waitForCanvasColorPoint(legacyApp.page, '#step5Canvas', [37, 99, 235]);
    const legacyNeighbor = await waitForCanvasColorPoint(legacyApp.page, '#step5Canvas', [239, 68, 68]);
    await legacyApp.page.locator('#brushMagicBtn').click({ force: true });
    await pointerAtCanvas(legacyApp.page, '#step5Canvas', legacyTarget.xRatio, legacyTarget.yRatio);
    await legacyApp.page.locator('#applyProtectBtn').click({ force: true });
    await expect.poll(() => legacyAlpha(legacyApp.page, legacyTarget.xRatio, legacyTarget.yRatio)).toBe(0);
    const legacy = {
      target: await legacyAlpha(legacyApp.page, legacyTarget.xRatio, legacyTarget.yRatio),
      neighbor: await legacyAlpha(legacyApp.page, legacyNeighbor.xRatio, legacyNeighbor.yRatio)
    };

    await importWorkshop(workshopApp.page, repairSvg());
    await workshopApp.page.locator('#chromaEnabledInput').uncheck();
    const workshopClick = await waitForCanvasColorPoint(workshopApp.page, '#refineCanvas', [37, 99, 235]);
    const workshopTarget = await waitForCanvasColorPoint(workshopApp.page, '#refineOutputCanvas', [37, 99, 235]);
    const workshopNeighbor = await waitForCanvasColorPoint(workshopApp.page, '#refineOutputCanvas', [239, 68, 68]);
    await workshopApp.page.locator('[data-mask-tool="magic"]').click();
    await workshopApp.page.locator('[data-magic-action="delete"]').click();
    await pointerAtCanvas(workshopApp.page, '#refineCanvas', workshopClick.xRatio, workshopClick.yRatio);
    await expect.poll(() => workshopAlpha(workshopApp.page, workshopTarget.xRatio, workshopTarget.yRatio)).toBe(0);
    const workshop = {
      target: await workshopAlpha(workshopApp.page, workshopTarget.xRatio, workshopTarget.yRatio),
      neighbor: await workshopAlpha(workshopApp.page, workshopNeighbor.xRatio, workshopNeighbor.yRatio)
    };`;

if (source.includes(oldMagic)) source = source.replace(oldMagic, newMagic);

await writeFile(path, source, 'utf8');
console.log('Review reorder scope and Magic color targeting fixed.');
