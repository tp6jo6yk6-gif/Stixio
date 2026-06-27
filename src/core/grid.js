// Grid helpers for splitting large artwork sheets into sticker units.
// Pure functions only: no DOM, no canvas context.

export function createGridConfig({
  layout = 'auto',
  rows = 1,
  cols = 1,
  marginX = 0,
  marginY = 0,
  gapX = 0,
  gapY = 0
} = {}) {
  const normalized = normalizeLayout({ layout, rows, cols });
  return {
    layout: normalized.layout,
    rows: normalized.rows,
    cols: normalized.cols,
    marginX: Number(marginX) || 0,
    marginY: Number(marginY) || 0,
    gapX: Number(gapX) || 0,
    gapY: Number(gapY) || 0
  };
}

export function normalizeLayout({ layout = 'auto', rows = 1, cols = 1 } = {}) {
  if (layout === '1x1' || layout === 'auto') return { layout, rows: 1, cols: 1 };
  if (layout === '2x2') return { layout, rows: 2, cols: 2 };
  if (layout === '3x3') return { layout, rows: 3, cols: 3 };
  if (layout === '4x4') return { layout, rows: 4, cols: 4 };
  if (layout === '5x5') return { layout, rows: 5, cols: 5 };
  return {
    layout: 'custom',
    rows: Math.max(1, Number(rows) || 1),
    cols: Math.max(1, Number(cols) || 1)
  };
}

export function calculateGridBoxes(imageWidth, imageHeight, config = {}) {
  const grid = createGridConfig(config);
  const availableWidth = imageWidth - grid.marginX * 2 - grid.gapX * Math.max(0, grid.cols - 1);
  const availableHeight = imageHeight - grid.marginY * 2 - grid.gapY * Math.max(0, grid.rows - 1);
  const cellWidth = availableWidth / grid.cols;
  const cellHeight = availableHeight / grid.rows;
  const boxes = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      boxes.push({
        row,
        col,
        x: grid.marginX + col * (cellWidth + grid.gapX),
        y: grid.marginY + row * (cellHeight + grid.gapY),
        width: cellWidth,
        height: cellHeight,
        exportSelected: true
      });
    }
  }

  return boxes;
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

function uniqueSorted(values) {
  return Array.from(new Set(values.map(value => Math.round(value * 1000) / 1000))).sort((a, b) => a - b);
}
