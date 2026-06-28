import { createZipFileName } from '../file-naming.js';
import { renderFrameToCanvas } from '../render.js';
import { reviewFrames } from '../review/index.js';
import { createPackagePlan } from '../package.js';
import { assertExportReviewReady, createStickerExportItems } from './export-engine.js';

// Export frames that belong to multiple source images in one Document.
export function prepareMultiSourceExport({
  sourceImages,
  frames = [],
  renderOptions = {},
  renderedMap = new Map(),
  exportOptions = {}
} = {}) {
  const resolveSource = createSourceResolver(sourceImages);
  const nextRendered = new Map(renderedMap);

  frames.forEach(frame => {
    if (frame.state?.visible === false || frame.state?.exportSelected === false) return;
    if (nextRendered.has(frame.id)) return;
    const sourceImage = resolveSource(frame.sourceImageId);
    if (!sourceImage) throw new Error(`Missing source image for Frame ${frame.name || frame.id}.`);
    nextRendered.set(frame.id, renderFrameToCanvas(sourceImage, frame, renderOptions).canvas);
  });

  const roleMap = exportOptions.roleMap || Object.fromEntries(
    frames.map(frame => [frame.id, frame.custom?.outputRole || 'sticker'])
  );
  const order = exportOptions.order || frames.map(frame => frame.id);
  const packagePlan = exportOptions.packagePlan || createPackagePlan({
    destinationKey: exportOptions.destinationKey || 'workshop',
    artworks: frames,
    rules: exportOptions.rules || defaultDestinationRules(renderOptions),
    roleMap,
    order
  });

  const review = reviewFrames(frames, nextRendered, {
    targetW: renderOptions.targetW,
    targetH: renderOptions.targetH,
    maxFrames: exportOptions.maxFrames || null
  });
  const items = createStickerExportItems(frames, nextRendered, {
    ...exportOptions,
    packagePlan,
    roleMap
  });

  return { renderedMap: nextRendered, review, items, packagePlan };
}

export async function createMultiSourceZipExport({
  sourceImages,
  frames = [],
  renderOptions = {},
  renderedMap = new Map(),
  exportOptions = {},
  JSZipClass = globalThis.JSZip
} = {}) {
  if (!JSZipClass) throw new Error('JSZip is not available.');
  const prepared = prepareMultiSourceExport({ sourceImages, frames, renderOptions, renderedMap, exportOptions });
  assertExportReviewReady(prepared.review, exportOptions);

  const zip = new JSZipClass();
  prepared.items.forEach(item => {
    if (!item.canvas) return;
    zip.file(item.fileName, item.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''), { base64: true });
  });

  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    fileName: exportOptions.fileName || createZipFileName({
      prefix: exportOptions.prefix || 'stixio',
      targetW: renderOptions.targetW,
      targetH: renderOptions.targetH
    }),
    ...prepared
  };
}

export function createSourceResolver(sourceImages) {
  if (sourceImages instanceof Map) return sourceId => sourceImages.get(sourceId) || null;
  if (Array.isArray(sourceImages)) {
    const map = new Map(sourceImages.map(source => [source.id, source]));
    return sourceId => map.get(sourceId) || null;
  }
  if (typeof sourceImages === 'function') return sourceImages;
  if (sourceImages && typeof sourceImages === 'object') return sourceId => sourceImages[sourceId] || null;
  return () => null;
}

function defaultDestinationRules(renderOptions = {}) {
  return {
    key: 'workshop',
    name: 'Sticker Package',
    version: '1.0.0',
    canvas: {
      width: renderOptions.targetW || 370,
      height: renderOptions.targetH || 320
    },
    package: {
      roles: ['main', 'tab', 'sticker', 'background', 'effect-background'],
      requiredRoles: [],
      maxStickerItems: null
    }
  };
}
