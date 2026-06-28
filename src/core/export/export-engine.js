// Export Engine
// Owns file delivery formats such as PNG, ZIP, and future formats.

import { getStickerFilename, createZipFileName } from '../file-naming.js';
import { renderFrameToCanvas } from '../render.js';
import { reviewFrames } from '../review/index.js';

export const ExportFormats = Object.freeze({
  PNG: 'png',
  ZIP: 'zip',
  JSON: 'json'
});

export function createExportJob({
  id = createId('export'),
  format = ExportFormats.PNG,
  destinationKey = null,
  packagePlan = null,
  items = [],
  fileName = 'stixio-export',
  metadata = {}
} = {}) {
  return {
    id,
    format,
    destinationKey,
    packagePlan,
    items,
    fileName,
    metadata,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createStickerExportItems(frames = [], renderedMap = new Map(), options = {}) {
  return frames
    .filter(frame => frame.state?.visible !== false && frame.state?.exportSelected !== false)
    .map((frame, index) => {
      const canvas = renderedMap.get(frame.id);
      return {
        frameId: frame.id,
        name: frame.name || `Frame ${index + 1}`,
        index,
        fileName: getStickerFilename(index, {
          lineNamingMode: options.lineNamingMode !== false,
          prefix: options.prefix || 'stixio'
        }),
        canvas
      };
    });
}

export function prepareRenderedExport({ sourceImage, frames = [], renderOptions = {}, renderedMap = new Map(), exportOptions = {} } = {}) {
  const nextRendered = new Map(renderedMap);
  frames.forEach(frame => {
    if (frame.state?.visible === false || frame.state?.exportSelected === false) return;
    if (!nextRendered.has(frame.id)) {
      const result = renderFrameToCanvas(sourceImage, frame, renderOptions);
      nextRendered.set(frame.id, result.canvas);
    }
  });

  const review = reviewFrames(frames, nextRendered, {
    targetW: renderOptions.targetW,
    targetH: renderOptions.targetH,
    maxFrames: exportOptions.maxFrames || null
  });

  const items = createStickerExportItems(frames, nextRendered, exportOptions);
  return { renderedMap: nextRendered, review, items };
}

export function createPngExport({ sourceImage, frame, renderOptions = {}, fileName = null } = {}) {
  if (!sourceImage) throw new Error('PNG export requires sourceImage.');
  if (!frame) throw new Error('PNG export requires frame.');
  const result = renderFrameToCanvas(sourceImage, frame, renderOptions);
  return {
    format: ExportFormats.PNG,
    frameId: frame.id,
    fileName: fileName || `${frame.name || 'stixio-frame'}.png`,
    canvas: result.canvas,
    result
  };
}

export async function createZipExport({
  sourceImage,
  frames = [],
  renderOptions = {},
  exportOptions = {},
  JSZipClass = globalThis.JSZip
} = {}) {
  if (!JSZipClass) throw new Error('JSZip is not available.');
  if (!sourceImage) throw new Error('ZIP export requires sourceImage.');
  const prepared = prepareRenderedExport({ sourceImage, frames, renderOptions, exportOptions });
  if (!prepared.review.ready && exportOptions.allowWarningsOnly === false) {
    throw new Error('Export review contains blocking errors.');
  }

  const zip = new JSZipClass();
  prepared.items.forEach(item => {
    if (!item.canvas) return;
    zip.file(
      item.fileName,
      item.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
      { base64: true }
    );
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  return {
    format: ExportFormats.ZIP,
    fileName: exportOptions.fileName || createZipFileName({
      prefix: exportOptions.prefix || 'stixio',
      targetW: renderOptions.targetW,
      targetH: renderOptions.targetH
    }),
    blob,
    items: prepared.items,
    review: prepared.review,
    renderedMap: prepared.renderedMap
  };
}

export function canvasToPngDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

export function markExportRunning(job) {
  return touchExportJob({ ...job, status: 'running' });
}

export function markExportComplete(job, result = {}) {
  return touchExportJob({ ...job, status: 'complete', result });
}

export function markExportFailed(job, error) {
  return touchExportJob({ ...job, status: 'failed', error: String(error?.message || error) });
}

export function touchExportJob(job) {
  return {
    ...job,
    updatedAt: new Date().toISOString()
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
