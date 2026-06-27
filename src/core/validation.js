// Validation helpers for destination review.

export function validateSafeArea(placement, safeAreaRect) {
  const issues = [];
  if (placement.drawX < safeAreaRect.x) issues.push(createIssue('safeArea.left', 'Left edge is outside the safe area.'));
  if (placement.drawY < safeAreaRect.y) issues.push(createIssue('safeArea.top', 'Top edge is outside the safe area.'));
  if (placement.drawX + placement.drawW > safeAreaRect.x + safeAreaRect.width) issues.push(createIssue('safeArea.right', 'Right edge is outside the safe area.'));
  if (placement.drawY + placement.drawH > safeAreaRect.y + safeAreaRect.height) issues.push(createIssue('safeArea.bottom', 'Bottom edge is outside the safe area.'));
  return issues;
}

export function validateCanvasSize(output, rules) {
  const issues = [];
  if (output.width !== rules.canvas.width || output.height !== rules.canvas.height) {
    issues.push(createIssue('canvas.size', `Expected ${rules.canvas.width}x${rules.canvas.height}, got ${output.width}x${output.height}.`));
  }
  return issues;
}

export function validatePackagePlan(plan, rules) {
  const issues = [];
  const requiredRoles = rules.validation?.requiredRoles || [];
  for (const role of requiredRoles) {
    if (!plan.items.some(item => item.role === role)) {
      issues.push(createIssue('package.requiredRole', `Missing required role: ${role}.`));
    }
  }
  return issues;
}

export function createIssue(code, message, severity = 'warning') {
  return { code, message, severity };
}
