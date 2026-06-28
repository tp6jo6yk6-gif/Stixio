// Export Engine
// Owns file delivery formats such as PNG, ZIP, and future formats.

import { createZipFileName } from '../file-naming.js';
import { renderFrameToCanvas } from '../render.js';
import { reviewFrames, ReviewIssueSeverity } from '../review/index.js';
import { createPackagePlan, createPackageItems, validatePackageRoles } from '../package.js';

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
  const packageItems = options.packagePlan?.items || createPackageItems(frames, options.roleMap || {}, options.packageRules || defaultPackageRules());
  const itemByFrameId = new Map(packageItems.map(item => [item.artworkId, item]));

  return frames
    .filter(frame => frame.state?.visible !== false && frame.state?.exportSelected !== false)
    .map((frame, index) => {
      const canvas = renderedMap.get(frame.id);
      const packageItem = itemByFrameId.get(frame.id);
      return {
        frameId: frame.id,
        name: frame.name || `Frame ${index + 1}`,
        index,
        role: packageItem?.role || 'sticker',
        roleLabel: packageItem?.roleLabel || 'Sticker',
        packageOrder: packageItem?.order ?? index,
        stickerIndex: packageItem?.stickerIndex || null,
        fileName: packageItem?.fileName || `${String(index + 1).padStart(2, '0')}.png`,
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

  const packagePlan = exportOptions.packagePlan || createPackagePlan({
    destinationKey: exportOptions.destinationKey || 'workshop',
    artworks: frames,
    rules: exportOptions.rules || defaultDestinationRules(),
    roleMap: exportOptions.roleMap || {},
    order: exportOptions.order || []
  });

  const review = reviewFrames(frames, nextRendered, {
    targetW: renderOptions.targetW,
    targetH: renderOptions.targetH,
    maxFrames: exportOptions.maxFrames || null
  });

  const packageValidationIssues = packagePlan.validation
    ? [
      ...packagePlan.validation.errors.map(issue => ({ ...issue, severity: ReviewIssueSeverity.ERROR })),
      ...packagePlan.validation.warnings.map(issue => ({ ...issue, severity: ReviewIssueSeverity.WARNING }))
    ]
    : [];

  const mergedReview = {
    ...review,
    issues: [...review.issues, ...packageValidationIssues],
    summary: summarizeReviewIssues([...review.issues, ...packageValidationIssues]),
    ready: review.ready && packageValidationIssues.every(issue => issue.severity !== ReviewIssueSeverity.ERROR)
  };

  const items = createStickerExportItems(frames, nextRendered, {
    ...exportOptions,
    packagePlan,
    packageRules: exportOptions.rules?.package || defaultPackageRules()
  });

  return { renderedMap: nextRendered, review: mergedReview, items, packagePlan };
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
  assertExportReviewReady(prepared.review, exportOptions);

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
    packagePlan: prepared.packagePlan,
    review: prepared.review,
    renderedMap: prepared.renderedMap
  };
}

export function assertExportReviewReady(review, exportOptions = {}) {
  const blockingIssues = getBlockingExportIssues(review);
  if (blockingIssues.length) {
    const first = blockingIssues[0];
    const message = first?.message || 'Export review contains blocking errors.';
    throw new Error(`ZIP export blocked: ${message}`);
  }

  const warningIssues = (review?.issues || []).filter(issue => issue.severity === ReviewIssueSeverity.WARNING);
  const allowsWarnings = exportOptions.allowWarnings === true || exportOptions.allowWarningsOnly === true;
  if (warningIssues.length && !allowsWarnings) {
    const first = warningIssues[0];
    throw new Error(`ZIP export blocked by warning: ${first.message}`);
  }

  return true;
}

export function getBlockingExportIssues(review) {
  return (review?.issues || []).filter(issue => issue.severity === ReviewIssueSeverity.ERROR);
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

function summarizeReviewIssues(issues = []) {
  return {
    total: issues.length,
    errors: issues.filter(issue => issue.severity === ReviewIssueSeverity.ERROR).length,
    warnings: issues.filter(issue => issue.severity === ReviewIssueSeverity.WARNING).length,
    info: issues.filter(issue => issue.severity === ReviewIssueSeverity.INFO).length
  };
}

function defaultDestinationRules() {
  return {
    key: 'workshop',
    name: 'Sticker Package',
    version: '1.0.0',
    canvas: { width: 370, height: 320 },
    package: defaultPackageRules()
  };
}

function defaultPackageRules() {
  return {
    naming: 'sticker-package',
    requiresMain: true,
    requiresTab: true,
    minStickers: 1,
    extension: 'png'
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
