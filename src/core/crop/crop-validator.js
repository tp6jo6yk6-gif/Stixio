export function validateRegion(region, canvas = null) {
  const issues = [];
  if (!region.id) issues.push(issue('region.id', 'Region id is required.', 'error'));
  if (!region.bounds) issues.push(issue('region.bounds', 'Region bounds are required.', 'error'));

  if (region.bounds) {
    if (region.bounds.width <= 0) issues.push(issue('region.width', 'Region width must be greater than zero.', 'error'));
    if (region.bounds.height <= 0) issues.push(issue('region.height', 'Region height must be greater than zero.', 'error'));
    if (canvas) {
      if (region.bounds.x < 0) issues.push(issue('region.left', 'Region extends beyond the left canvas edge.', 'warning'));
      if (region.bounds.y < 0) issues.push(issue('region.top', 'Region extends beyond the top canvas edge.', 'warning'));
      if (region.bounds.x + region.bounds.width > canvas.width) issues.push(issue('region.right', 'Region extends beyond the right canvas edge.', 'warning'));
      if (region.bounds.y + region.bounds.height > canvas.height) issues.push(issue('region.bottom', 'Region extends beyond the bottom canvas edge.', 'warning'));
    }
  }

  return issues;
}

export function validateRegions(regions, canvas = null) {
  return regions.flatMap(region => validateRegion(region, canvas).map(item => ({ ...item, regionId: region.id })));
}

export function clampRegionToCanvas(region, canvas) {
  if (!canvas) return region;
  const width = Math.min(region.bounds.width, canvas.width);
  const height = Math.min(region.bounds.height, canvas.height);
  const x = Math.min(Math.max(0, region.bounds.x), Math.max(0, canvas.width - width));
  const y = Math.min(Math.max(0, region.bounds.y), Math.max(0, canvas.height - height));
  return {
    ...region,
    bounds: { x, y, width, height }
  };
}

function issue(code, message, severity = 'warning') {
  return { code, message, severity };
}
