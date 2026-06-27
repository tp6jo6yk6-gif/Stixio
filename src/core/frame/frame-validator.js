export function validateFrame(frame, canvas = null) {
  const issues = [];
  if (!frame.id) issues.push(issue('frame.id', 'Frame id is required.', 'error'));
  if (!frame.geometry) issues.push(issue('frame.geometry', 'Frame geometry is required.', 'error'));

  if (frame.geometry) {
    if (frame.geometry.width <= 0) issues.push(issue('frame.width', 'Frame width must be greater than zero.', 'error'));
    if (frame.geometry.height <= 0) issues.push(issue('frame.height', 'Frame height must be greater than zero.', 'error'));
    if (canvas) {
      if (frame.geometry.x < 0) issues.push(issue('frame.left', 'Frame extends beyond the left canvas edge.', 'warning'));
      if (frame.geometry.y < 0) issues.push(issue('frame.top', 'Frame extends beyond the top canvas edge.', 'warning'));
      if (frame.geometry.x + frame.geometry.width > canvas.width) issues.push(issue('frame.right', 'Frame extends beyond the right canvas edge.', 'warning'));
      if (frame.geometry.y + frame.geometry.height > canvas.height) issues.push(issue('frame.bottom', 'Frame extends beyond the bottom canvas edge.', 'warning'));
    }
  }

  return issues;
}

export function validateFrames(frames, canvas = null) {
  return frames.flatMap(frame => validateFrame(frame, canvas).map(item => ({ ...item, frameId: frame.id })));
}

export function clampFrameToCanvas(frame, canvas) {
  if (!canvas) return frame;
  const width = Math.min(frame.geometry.width, canvas.width);
  const height = Math.min(frame.geometry.height, canvas.height);
  const x = Math.min(Math.max(0, frame.geometry.x), Math.max(0, canvas.width - width));
  const y = Math.min(Math.max(0, frame.geometry.y), Math.max(0, canvas.height - height));
  return {
    ...frame,
    geometry: { ...frame.geometry, x, y, width, height }
  };
}

function issue(code, message, severity = 'warning') {
  return { code, message, severity };
}
