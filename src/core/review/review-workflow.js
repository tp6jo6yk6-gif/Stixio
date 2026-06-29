import { createIssue, createReviewSummary, ReviewIssueSeverity, reviewFrames } from './review-engine.js';
import { reviewRenderedPixels } from './pixel-review.js';

export const ReviewFilterModes = Object.freeze({
  ALL: 'all',
  ERRORS: 'errors',
  WARNINGS: 'warnings',
  PENDING: 'pending',
  APPROVED: 'approved',
  SELECTED: 'selected',
  EXCLUDED: 'excluded'
});

export const ReviewSortModes = Object.freeze({
  FRAME_ORDER: 'frame-order',
  ISSUE_SEVERITY: 'issue-severity',
  FILE_SIZE_DESC: 'file-size-desc',
  NAME: 'name',
  SOURCE: 'source'
});

const SEVERITY_RANK = Object.freeze({
  [ReviewIssueSeverity.ERROR]: 3,
  [ReviewIssueSeverity.WARNING]: 2,
  [ReviewIssueSeverity.INFO]: 1,
  none: 0
});

export function runFullReview(frames = [], renderedMap = new Map(), options = {}) {
  const base = reviewFrames(frames, renderedMap, options);
  const issues = [...base.issues];
  const maxBytes = Math.max(0, Number(options.maxFileSizeKB || 0) * 1024);
  const packageItems = Array.isArray(options.packageItems) ? options.packageItems : [];
  const packageItemByFrame = new Map(packageItems.map(item => [item.artworkId, item]));

  frames.forEach((frame, index) => {
    const rendered = renderedMap.get(frame.id);
    if (!rendered) return;
    issues.push(...reviewRenderedPixels(rendered, frame, frame.name || `Frame ${index + 1}`, {
      safeAreaMargin: options.safeAreaMargin ?? options.safeMargin ?? 0,
      requireTransparency: options.requireTransparency !== false,
      blankRatioThreshold: options.blankRatioThreshold,
      lowContentRatioThreshold: options.lowContentRatioThreshold,
      edgeTouchRatioThreshold: options.edgeTouchRatioThreshold,
      opaqueRatioThreshold: options.opaqueRatioThreshold
    }));

    const bytes = estimateRenderedBytes(rendered);
    if (maxBytes > 0 && bytes > maxBytes) {
      issues.push(createIssue({
        code: 'render.fileTooLarge',
        message: `${frame.name || `Frame ${index + 1}`} is approximately ${Math.ceil(bytes / 1024)}KB, above the ${options.maxFileSizeKB}KB warning limit.`,
        severity: ReviewIssueSeverity.WARNING,
        frameId: frame.id,
        metadata: { bytes, maxBytes }
      }));
    }
  });

  const duplicateGroups = findDuplicateFileNames(packageItems);
  duplicateGroups.forEach(group => {
    group.items.forEach(item => {
      issues.push(createIssue({
        code: 'package.duplicateFilename',
        message: `Duplicate output filename: ${group.fileName}.`,
        severity: ReviewIssueSeverity.ERROR,
        frameId: item.artworkId,
        metadata: { fileName: group.fileName, artworkIds: group.items.map(entry => entry.artworkId) }
      }));
    });
  });

  frames.forEach(frame => {
    if (frame.state?.exportSelected === false) return;
    if (!frame.state?.reviewApproved) {
      const item = packageItemByFrame.get(frame.id);
      issues.push(createIssue({
        code: 'review.pendingApproval',
        message: `${frame.name || item?.fileName || 'Frame'} has not been approved in Review.`,
        severity: ReviewIssueSeverity.INFO,
        frameId: frame.id
      }));
    }
  });

  const summary = createReviewSummary(issues);
  const selectedFrames = frames.filter(frame => frame.state?.visible !== false && frame.state?.exportSelected !== false);
  const allSelectedApproved = selectedFrames.length > 0 && selectedFrames.every(frame => frame.state?.reviewApproved === true);
  const hasErrors = summary.errors > 0;

  return {
    issues,
    summary,
    selectedCount: selectedFrames.length,
    approvedCount: selectedFrames.filter(frame => frame.state?.reviewApproved === true).length,
    allSelectedApproved,
    ready: !hasErrors && allSelectedApproved,
    canPackage: !hasErrors && allSelectedApproved
  };
}

export function buildReviewItems({
  frames = [],
  renderedMap = new Map(),
  issues = [],
  packageItems = [],
  sourceNames = new Map()
} = {}) {
  const issuesByFrame = new Map();
  issues.forEach(issue => {
    if (!issue.frameId) return;
    if (!issuesByFrame.has(issue.frameId)) issuesByFrame.set(issue.frameId, []);
    issuesByFrame.get(issue.frameId).push(issue);
  });
  const packageByFrame = new Map(packageItems.map(item => [item.artworkId, item]));

  return frames.map((frame, index) => {
    const frameIssues = issuesByFrame.get(frame.id) || [];
    const bytes = estimateRenderedBytes(renderedMap.get(frame.id));
    const highestSeverity = highestIssueSeverity(frameIssues);
    return {
      frameId: frame.id,
      frame,
      index,
      name: frame.name || `Frame ${index + 1}`,
      sourceImageId: frame.sourceImageId,
      sourceName: sourceNames.get(frame.sourceImageId) || frame.sourceImageId || '',
      fileName: packageByFrame.get(frame.id)?.fileName || '',
      bytes,
      kb: Math.ceil(bytes / 1024),
      exportSelected: frame.state?.visible !== false && frame.state?.exportSelected !== false,
      approved: frame.state?.reviewApproved === true,
      approvedAt: frame.state?.reviewApprovedAt || null,
      issues: frameIssues,
      issueCounts: {
        errors: frameIssues.filter(issue => issue.severity === ReviewIssueSeverity.ERROR).length,
        warnings: frameIssues.filter(issue => issue.severity === ReviewIssueSeverity.WARNING).length,
        info: frameIssues.filter(issue => issue.severity === ReviewIssueSeverity.INFO).length
      },
      highestSeverity,
      severityRank: SEVERITY_RANK[highestSeverity || 'none'] || 0,
      hasErrors: frameIssues.some(issue => issue.severity === ReviewIssueSeverity.ERROR),
      hasWarnings: frameIssues.some(issue => issue.severity === ReviewIssueSeverity.WARNING)
    };
  });
}

export function filterReviewItems(items = [], { filter = ReviewFilterModes.ALL, query = '' } = {}) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  return items.filter(item => {
    if (normalizedQuery) {
      const haystack = `${item.name} ${item.fileName} ${item.sourceName}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    if (filter === ReviewFilterModes.ERRORS) return item.hasErrors;
    if (filter === ReviewFilterModes.WARNINGS) return item.hasWarnings;
    if (filter === ReviewFilterModes.PENDING) return item.exportSelected && !item.approved;
    if (filter === ReviewFilterModes.APPROVED) return item.approved;
    if (filter === ReviewFilterModes.SELECTED) return item.exportSelected;
    if (filter === ReviewFilterModes.EXCLUDED) return !item.exportSelected;
    return true;
  });
}

export function sortReviewItems(items = [], mode = ReviewSortModes.FRAME_ORDER) {
  const list = [...items];
  if (mode === ReviewSortModes.ISSUE_SEVERITY) {
    return list.sort((a, b) => b.severityRank - a.severityRank || a.index - b.index);
  }
  if (mode === ReviewSortModes.FILE_SIZE_DESC) {
    return list.sort((a, b) => b.bytes - a.bytes || a.index - b.index);
  }
  if (mode === ReviewSortModes.NAME) {
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.index - b.index);
  }
  if (mode === ReviewSortModes.SOURCE) {
    return list.sort((a, b) => a.sourceName.localeCompare(b.sourceName, undefined, { numeric: true }) || a.index - b.index);
  }
  return list.sort((a, b) => a.index - b.index);
}

export function getReviewProgress(items = []) {
  const selected = items.filter(item => item.exportSelected);
  const approved = selected.filter(item => item.approved);
  const withErrors = selected.filter(item => item.hasErrors);
  const withWarnings = selected.filter(item => item.hasWarnings);
  return {
    total: items.length,
    selected: selected.length,
    excluded: items.length - selected.length,
    approved: approved.length,
    pending: selected.length - approved.length,
    withErrors: withErrors.length,
    withWarnings: withWarnings.length,
    percent: selected.length ? Math.round(approved.length / selected.length * 100) : 0,
    ready: selected.length > 0 && approved.length === selected.length && withErrors.length === 0
  };
}

export function setFrameReviewApproval(frame, approved, timestamp = new Date().toISOString()) {
  return {
    ...frame,
    state: {
      ...frame.state,
      reviewApproved: Boolean(approved),
      reviewApprovedAt: approved ? timestamp : null
    }
  };
}

export function setFramesReviewApproval(frames = [], frameIds = [], approved = true, options = {}) {
  const ids = new Set(frameIds);
  const blockedIds = new Set(options.blockedFrameIds || []);
  return frames.map(frame => {
    if (!ids.has(frame.id) || blockedIds.has(frame.id)) return frame;
    return setFrameReviewApproval(frame, approved, options.timestamp);
  });
}

export function setFramesExportSelection(frames = [], frameIds = [], selected = true) {
  const ids = new Set(frameIds);
  return frames.map(frame => ids.has(frame.id)
    ? { ...frame, state: { ...frame.state, exportSelected: Boolean(selected) } }
    : frame);
}

export function invertFramesExportSelection(frames = [], frameIds = null) {
  const ids = frameIds ? new Set(frameIds) : null;
  return frames.map(frame => {
    if (ids && !ids.has(frame.id)) return frame;
    return {
      ...frame,
      state: {
        ...frame.state,
        exportSelected: frame.state?.exportSelected === false
      }
    };
  });
}

export function nextReviewFrameId(items = [], currentFrameId = null, direction = 1) {
  if (!items.length) return null;
  const index = items.findIndex(item => item.frameId === currentFrameId);
  if (index < 0) return items[0].frameId;
  const offset = direction < 0 ? -1 : 1;
  return items[(index + offset + items.length) % items.length].frameId;
}

export function highestIssueSeverity(issues = []) {
  if (issues.some(issue => issue.severity === ReviewIssueSeverity.ERROR)) return ReviewIssueSeverity.ERROR;
  if (issues.some(issue => issue.severity === ReviewIssueSeverity.WARNING)) return ReviewIssueSeverity.WARNING;
  if (issues.some(issue => issue.severity === ReviewIssueSeverity.INFO)) return ReviewIssueSeverity.INFO;
  return null;
}

export function findDuplicateFileNames(packageItems = []) {
  const groups = new Map();
  packageItems.forEach(item => {
    const fileName = String(item.fileName || '').trim().toLowerCase();
    if (!fileName) return;
    if (!groups.has(fileName)) groups.set(fileName, []);
    groups.get(fileName).push(item);
  });
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([fileName, items]) => ({ fileName, items }));
}

export function estimateRenderedBytes(rendered) {
  if (!rendered) return 0;
  if (Number.isFinite(rendered.byteLength)) return rendered.byteLength;
  if (typeof rendered.toDataURL === 'function') {
    const dataUrl = rendered.toDataURL('image/png');
    const base64 = String(dataUrl).split(',')[1] || '';
    return Math.max(0, Math.floor(base64.length * 3 / 4));
  }
  if (rendered.data?.byteLength) return rendered.data.byteLength;
  return 0;
}
