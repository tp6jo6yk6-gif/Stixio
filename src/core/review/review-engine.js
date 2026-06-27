// Review Engine
// Owns preview state and review checks. It does not mutate frames.

export const ReviewBackgrounds = Object.freeze({
  TRANSPARENT: 'transparent',
  WHITE: 'white',
  BLACK: 'black',
  CHECKER: 'checker',
  LINE: 'line-preview'
});

export function createReviewSession({
  documentId,
  selectedFrameId = null,
  background = ReviewBackgrounds.CHECKER,
  zoom = 1,
  filters = {}
} = {}) {
  return {
    id: createId('review'),
    documentId,
    selectedFrameId,
    background,
    zoom,
    filters,
    issues: [],
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
  return touchReviewSession({ ...session, issues });
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
