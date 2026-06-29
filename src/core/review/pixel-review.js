import { createIssue, ReviewIssueSeverity } from './review-engine.js';

export function reviewRenderedPixels(rendered, frame, frameName = frame?.name || 'Frame', options = {}) {
  const analysis = analyzeRenderedCanvas(rendered, options);
  const issues = [];

  if (!analysis.supported) return issues;

  if (analysis.nonTransparentRatio <= (options.blankRatioThreshold ?? 0.001)) {
    issues.push(createIssue({
      code: 'render.blank',
      message: `${frameName} appears blank or fully transparent.`,
      severity: ReviewIssueSeverity.ERROR,
      frameId: frame?.id,
      metadata: analysis
    }));
    return issues;
  }

  if (analysis.nonTransparentRatio < (options.lowContentRatioThreshold ?? 0.01)) {
    issues.push(createIssue({
      code: 'render.lowContent',
      message: `${frameName} has very little visible content.`,
      severity: ReviewIssueSeverity.WARNING,
      frameId: frame?.id,
      metadata: analysis
    }));
  }

  if (analysis.edgeAlphaCount > 0 && analysis.edgeAlphaRatio >= (options.edgeTouchRatioThreshold ?? 0.01)) {
    issues.push(createIssue({
      code: 'render.edgeTouch',
      message: `${frameName} touches the output edge and may be clipped.`,
      severity: ReviewIssueSeverity.WARNING,
      frameId: frame?.id,
      metadata: analysis
    }));
  }

  const safeAreaMargin = Math.max(0, Number(options.safeAreaMargin ?? options.safeEdgeMargin ?? 2) || 0);
  if (analysis.edgeMargins && Object.values(analysis.edgeMargins).some(margin => margin < safeAreaMargin)) {
    issues.push(createIssue({
      code: 'render.safeMargin',
      message: `${frameName} enters the ${safeAreaMargin}px safe-area margin.`,
      severity: ReviewIssueSeverity.WARNING,
      frameId: frame?.id,
      metadata: { ...analysis, safeAreaMargin }
    }));
  }

  if (
    options.requireTransparency !== false
    && analysis.nonTransparentRatio >= (options.opaqueRatioThreshold ?? 0.985)
  ) {
    issues.push(createIssue({
      code: 'render.opaqueBackground',
      message: `${frameName} is almost fully opaque; check for an unremoved background.`,
      severity: ReviewIssueSeverity.WARNING,
      frameId: frame?.id,
      metadata: analysis
    }));
  }

  return issues;
}

export function analyzeRenderedCanvas(rendered, options = {}) {
  if (!rendered || !rendered.width || !rendered.height) return { supported: false };
  const imageData = getCanvasImageData(rendered);
  if (!imageData) return { supported: false };

  const { width, height, data } = imageData;
  const alphaThreshold = options.alphaThreshold ?? 8;
  let alphaCount = 0;
  let edgeAlphaCount = 0;
  let translucentCount = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold && alpha < 247) translucentCount += 1;
      if (alpha <= alphaThreshold) continue;
      alphaCount += 1;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edgeAlphaCount += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const total = width * height;
  const bounds = alphaCount > 0
    ? {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      margin: Math.min(minX, minY, width - 1 - maxX, height - 1 - maxY)
    }
    : null;
  const edgeMargins = alphaCount > 0
    ? {
      top: minY,
      right: width - 1 - maxX,
      bottom: height - 1 - maxY,
      left: minX
    }
    : null;

  return {
    supported: true,
    width,
    height,
    alphaCount,
    total,
    nonTransparentRatio: total ? alphaCount / total : 0,
    transparentRatio: total ? (total - alphaCount) / total : 0,
    translucentCount,
    translucentRatio: total ? translucentCount / total : 0,
    edgeAlphaCount,
    edgeAlphaRatio: alphaCount ? edgeAlphaCount / alphaCount : 0,
    bounds,
    edgeMargins
  };
}

function getCanvasImageData(rendered) {
  if (typeof rendered.getContext === 'function') {
    const context = rendered.getContext('2d');
    if (!context || typeof context.getImageData !== 'function') return null;
    return context.getImageData(0, 0, rendered.width, rendered.height);
  }

  if (rendered.data && rendered.width && rendered.height) return rendered;
  return null;
}
