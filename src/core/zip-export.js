import { buildPackageFilenames } from './file-naming.js';

export function createExportList(stickers, boxes, options = {}) {
  return stickers
    .map((sticker, index) => ({ sticker, box: boxes[index], index }))
    .filter(item => item.sticker && item.box && item.box.exportSelected !== false)
    .map(item => ({
      index: item.index,
      sticker: item.sticker,
      box: item.box
    }));
}

export function createZipPlan(stickers, boxes, options = {}) {
  const exportList = createExportList(stickers, boxes, options);
  const namedItems = buildPackageFilenames(exportList, options);
  return {
    items: namedItems.map(item => ({
      index: item.index,
      fileName: item.fileName,
      canvas: item.sticker.canvas,
      box: item.box
    })),
    fileName: createZipFileName(options)
  };
}

export function createZipFileName({ prefix = '', targetW = 370, targetH = 320, baseName = 'stickers' } = {}) {
  const safePrefix = String(prefix || '').trim() || baseName;
  return `${safePrefix}_project_${targetW}x${targetH}.zip`;
}

export function addZipPlanToJSZip(zip, zipPlan) {
  zipPlan.items.forEach(item => {
    const base64 = item.canvas
      .toDataURL('image/png')
      .replace(/^data:image\/(png|jpg);base64,/, '');
    zip.file(item.fileName, base64, { base64: true });
  });
  return zip;
}
