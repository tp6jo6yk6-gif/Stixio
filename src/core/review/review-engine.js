// Review Engine
// Owns preview state and output checks. It does not mutate frames.

export const ReviewBackgrounds = Object.freeze({
  TRANSPARENT: 'transparent',
  WHITE: 'white',
  BLACK: 'black',
  CHECKER: 'checker',
  Sticker: 'sticker-preview'
});

export const ReviewIssueSeverity = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
});

export function createReviewSession({
  documentId,
  selectedFrameId = null,
  background = ReviewBackgrounds.CHECKER,
  zoom = 1,
  filters = {},
  sortMode = 'frame-order'
} = {}) {
  return {
    id: createId('review'),
    documentId,
    selectedFrameId,
    background,
    zoom,
    filters,
    sortMode,
    issues: [],
    summary: createReviewSummary([]),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function setReviewBackground(session, background) {
  return touchReviewSession({ ...session, background });
}

export function setReviewZoom(session, zoom) {
  return touchReviewSession({ ...session, zoom: Math.max(0.1, Number(zoom) || 1) });
}

export function selectReviewFrame(session, frameId) {
  return touchReviewSession({ ...session, selectedFrameId: frameId });
}

export function setReviewIssues(session, issues = []) {
  return touchReviewSession({
    ...session,
    issues,
    summary: createReviewSummary(issues)
  });
}

export function reviewFrames(frames = [], renderedMap = new Map(), options = {}) {
  const issues = [];
  const targetW = options.targetW || 370;
  const targetH = options.targetH || 320;
  const maxFrames = options.maxFrames || null;

  if (!frames.length) {
    issues.push(createIssue({
      code: 'frames.empty',
      message: 'No frames detected.',
      severity: ReviewIssueSeverity.ERROR
    }));
  }

  if (maxFrames && frames.length > maxFrames) {
    issues.push(createIssue({
      code: 'frames.tooMany',
      message: `Frame count exceeds package limit: ${frames.length}/${maxFrames}.`,
      severity: ReviewIssueSeverity.ERROR
    }));
  }

  frames.forEach((frame, index) => {
    if (frame.state?.visible === false) {
      issues.push(createIssue({
        code: 'frame.hidden',
        message: `${frame.name || `Frame ${index + 1}`} is hidden.`,
        severity: ReviewIssueSeverity.WARNING,
        frameId: frame.id
      }));
    }

    if (frame.state?.exportSelected === false) {
      issues.push(createIssue({
        code: 'frame.notSelectedForExport',
        message: `${frame.name || `Frame ${index + 1}`} is not selected for export.`,
        severity: ReviewIssueSeverity.INFO,
        frameId: frame.id
      }));
    }

    if (!frame.geometry || frame.geometry.width <= 0 || frame.geometry.height <= 0) {
      issues.push(createIssue({
        code: 'frame.invalidGeometry',
        message: `${frame.name || `Frame ${index + 1}`} has invalid geometry.`,
        severity: ReviewIssueSeverity.ERROR,
        frameId: frame.id
      }));
    }

    const rendered = renderedMap.get(frame.id);
    if (!rendered) {
      issues.push(createIssue({
        code: 'render.missing',
        message: `${frame.name || `Frame ${index + 1}`} has not been rendered yet.`,
        severity: ReviewIssueSeverity.WARNING,
        frameId: frame.id
      }));
      return;
    }

    if (rendered.width !== targetW || rendered.height !== targetH) {
      issues.push(createIssue({
        code: 'render.sizeMismatch',
        message: `${frame.name || `Frame ${index + 1}`} render size is ${rendered.width}×${rendered.height}, expected ${targetW}×${targetH}.`,
        severity: ReviewIssueSeverity.ERROR,
        frameId: frame.id
      }));
    }
  });

  return {
    issues,
    summary: createReviewSummary(issues),
    ready: !issues.some(issue => issue.severity === ReviewIssueSeverity.ERROR)
  };
}

export function createReviewSummary(issues = []) {
  return {
    total: issues.length,
    errors: issues.filter(issue => issue.severity === ReviewIssueSeverity.ERROR).length,
    warnings: issues.filter(issue => issue.severity === ReviewIssueSeverity.WARNING).length,
    info: issues.filter(issue => issue.severity === ReviewIssueSeverity.INFO).length
  };
}

export function createIssue({ code, message, severity = ReviewIssueSeverity.WARNING, frameId = null, metadata = {} }) {
  return {
    id: createId('issue'),
    code,
    message,
    severity,
    frameId,
    metadata,
    createdAt: new Date().toISOString()
  };
}

export function getReviewBackgroundStyle(background) {
  if (background === ReviewBackgrounds.WHITE) return { background: '#ffffff' };
  if (background === ReviewBackgrounds.BLACK) return { background: '#020617' };
  if (background === ReviewBackgrounds.STICKER) return { background: '#06c755' };
  if (background === ReviewBackgrounds.TRANSPARENT) return { background: 'transparent' };
  return {
    background: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
    backgroundSize: '14px 14px'
  };
}

export function touchReviewSession(session) {
  return {
    ...session,
    updatedAt: new Date().toISOString()
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
