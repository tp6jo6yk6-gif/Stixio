// Grid helpers for splitting large artwork sheets into sticker units.
// Pure functions only: no DOM, no canvas context.

export function createGridConfig({
  layout = 'auto',
  rows = 1,
  cols = 1,
  marginX = 0,
  marginY = 0,
  gapX = 0,
  gapY = 0,
  snapToPixels = true,
  minCellSize = 8
} = {}) {
  const normalized = normalizeLayout({ layout, rows, cols });
  return {
    layout: normalized.layout,
    rows: normalized.rows,
    cols: normalized.cols,
    marginX: Math.max(0, Number(marginX) || 0),
    marginY: Math.max(0, Number(marginY) || 0),
    gapX: Math.max(0, Number(gapX) || 0),
    gapY: Math.max(0, Number(gapY) || 0),
    snapToPixels: snapToPixels !== false,
    minCellSize: Math.max(1, Number(minCellSize) || 8)
  };
}

export function normalizeLayout({ layout = 'auto', rows = 1, cols = 1 } = {}) {
  if (layout === '1x1' || layout === 'auto') return { layout, rows: 1, cols: 1 };
  if (layout === '2x2') return { layout, rows: 2, cols: 2 };
  if (layout === '3x3') return { layout, rows: 3, cols: 3 };
  if (layout === '4x4') return { layout, rows: 4, cols: 4 };
  if (layout === '5x5') return { layout, rows: 5, cols: 5 };
  if (layout === '5x8') return { layout, rows: 5, cols: 8 };
  if (layout === '8x5') return { layout, rows: 8, cols: 5 };
  return {
    layout: 'custom',
    rows: Math.max(1, Math.floor(Number(rows) || 1)),
    cols: Math.max(1, Math.floor(Number(cols) || 1))
  };
}

export function calculateGridBoxes(imageWidth, imageHeight, config = {}) {
  const grid = createGridConfig(config);
  const safeGrid = clampGridConfigToImage(grid, imageWidth, imageHeight);
  const availableWidth = imageWidth - safeGrid.marginX * 2 - safeGrid.gapX * Math.max(0, safeGrid.cols - 1);
  const availableHeight = imageHeight - safeGrid.marginY * 2 - safeGrid.gapY * Math.max(0, safeGrid.rows - 1);
  const cellWidth = availableWidth / safeGrid.cols;
  const cellHeight = availableHeight / safeGrid.rows;
  const boxes = [];

  for (let row = 0; row < safeGrid.rows; row++) {
    for (let col = 0; col < safeGrid.cols; col++) {
      const raw = {
        row,
        col,
        x: safeGrid.marginX + col * (cellWidth + safeGrid.gapX),
        y: safeGrid.marginY + row * (cellHeight + safeGrid.gapY),
        width: cellWidth,
        height: cellHeight,
        exportSelected: true
      };
      boxes.push(normalizeGridBox(raw, imageWidth, imageHeight, safeGrid.snapToPixels));
    }
  }

  return boxes;
}

export function calculateGridDetectionResult(imageWidth, imageHeight, config = {}) {
  const grid = createGridConfig(config);
  const safeGrid = clampGridConfigToImage(grid, imageWidth, imageHeight);
  const boxes = calculateGridBoxes(imageWidth, imageHeight, safeGrid);
  const quality = evaluateGridQuality(imageWidth, imageHeight, safeGrid, boxes);
  return {
    strategy: 'grid',
    image: { width: imageWidth, height: imageHeight },
    config: safeGrid,
    boxes,
    quality
  };
}

export function clampGridConfigToImage(grid, imageWidth, imageHeight) {
  const maxMarginX = Math.max(0, imageWidth / 2 - grid.minCellSize);
  const maxMarginY = Math.max(0, imageHeight / 2 - grid.minCellSize);
  const marginX = Math.min(grid.marginX, maxMarginX);
  const marginY = Math.min(grid.marginY, maxMarginY);

  const maxGapX = grid.cols > 1
    ? Math.max(0, (imageWidth - marginX * 2 - grid.minCellSize * grid.cols) / (grid.cols - 1))
    : 0;
  const maxGapY = grid.rows > 1
    ? Math.max(0, (imageHeight - marginY * 2 - grid.minCellSize * grid.rows) / (grid.rows - 1))
    : 0;

  return {
    ...grid,
    marginX,
    marginY,
    gapX: Math.min(grid.gapX, maxGapX),
    gapY: Math.min(grid.gapY, maxGapY)
  };
}

export function normalizeGridBox(box, imageWidth, imageHeight, snapToPixels = true) {
  let x = box.x;
  let y = box.y;
  let width = box.width;
  let height = box.height;

  if (snapToPixels) {
    x = Math.round(x);
    y = Math.round(y);
    const right = Math.round(box.x + box.width);
    const bottom = Math.round(box.y + box.height);
    width = right - x;
    height = bottom - y;
  }

  x = clamp(x, 0, imageWidth);
  y = clamp(y, 0, imageHeight);
  width = clamp(width, 1, imageWidth - x);
  height = clamp(height, 1, imageHeight - y);

  return {
    ...box,
    x,
    y,
    width,
    height
  };
}

export function evaluateGridQuality(imageWidth, imageHeight, grid, boxes) {
  const issues = [];
  const availableWidth = imageWidth - grid.marginX * 2 - grid.gapX * Math.max(0, grid.cols - 1);
  const availableHeight = imageHeight - grid.marginY * 2 - grid.gapY * Math.max(0, grid.rows - 1);
  const cellWidth = availableWidth / grid.cols;
  const cellHeight = availableHeight / grid.rows;

  if (cellWidth < grid.minCellSize) issues.push(issue('cell.width.small', 'Detected cells are very narrow.', 'error'));
  if (cellHeight < grid.minCellSize) issues.push(issue('cell.height.small', 'Detected cells are very short.', 'error'));
  if (grid.marginX * 2 > imageWidth * 0.6) issues.push(issue('margin.x.large', 'Horizontal margin consumes most of the image.', 'warning'));
  if (grid.marginY * 2 > imageHeight * 0.6) issues.push(issue('margin.y.large', 'Vertical margin consumes most of the image.', 'warning'));
  if (grid.gapX > cellWidth * 0.5) issues.push(issue('gap.x.large', 'Horizontal gap is large compared with cell width.', 'warning'));
  if (grid.gapY > cellHeight * 0.5) issues.push(issue('gap.y.large', 'Vertical gap is large compared with cell height.', 'warning'));

  const outOfBounds = boxes.some(box => box.x < 0 || box.y < 0 || box.x + box.width > imageWidth || box.y + box.height > imageHeight);
  if (outOfBounds) issues.push(issue('bounds', 'Some detected boxes extend outside the source image.', 'error'));

  return {
    score: Math.max(0, 100 - issues.reduce((sum, item) => sum + (item.severity === 'error' ? 40 : 15), 0)),
    issues,
    frameCount: boxes.length,
    cellWidth,
    cellHeight
  };
}

export function boxesToCuts(boxes) {
  const vCuts = [];
  const hCuts = [];

  boxes.forEach(box => {
    vCuts.push(box.x, box.x + box.width);
    hCuts.push(box.y, box.y + box.height);
  });

  return {
    vCuts: uniqueSorted(vCuts),
    hCuts: uniqueSorted(hCuts)
  };
}

function issue(code, message, severity = 'warning') {
  return { code, message, severity };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(value => Math.round(value * 1000) / 1000))).sort((a, b) => a - b);
}
