// Package filename helpers.
// These functions are pure and do not depend on DOM or app state.

// Legacy order-based API retained for backwards compatibility.
// New package flows should use getRolePackageFilename with an explicit role.
export function getStickerPackageFilename(orderIndex) {
  if (orderIndex === 0) return 'main.png';
  if (orderIndex === 1) return 'tab.png';
  return `${String(orderIndex - 1).padStart(2, '0')}.png`;
}

export function getRolePackageFilename(role, stickerOrderIndex = 0) {
  if (role === 'main') return 'main.png';
  if (role === 'tab') return 'tab.png';
  if (role === 'background') return 'background.png';
  if (role === 'effect-background') return 'effect-background.png';
  return `${String(stickerOrderIndex + 1).padStart(2, '0')}.png`;
}

export function getSequentialFilename(index, { prefix = '', suffix = '', extension = 'png', pad = 0 } = {}) {
  const number = pad > 0 ? String(index + 1).padStart(pad, '0') : String(index + 1);
  const safePrefix = String(prefix || '').trim();
  const safeSuffix = String(suffix || '').trim();
  return `${safePrefix ? safePrefix + '_' : ''}${number}${safeSuffix ? '_' + safeSuffix : ''}.${extension}`;
}

export function getStickerFilename(index, options = {}) {
  const {
    packageNamingMode = false,
    exportOrderIndex = index,
    role = null,
    prefix = '',
    suffix = '',
    extension = 'png'
  } = options;

  if (packageNamingMode) {
    return role
      ? getRolePackageFilename(role, exportOrderIndex)
      : getStickerPackageFilename(exportOrderIndex);
  }
  return getSequentialFilename(index, { prefix, suffix, extension });
}

export function buildPackageFilenames(items, options = {}) {
  let stickerOrderIndex = 0;
  return items.map((item, exportIndex) => {
    const role = item.role || item.frame?.custom?.outputRole || item.box?.custom?.outputRole || 'sticker';
    const roleIndex = role === 'sticker' ? stickerOrderIndex++ : exportIndex;
    return {
      ...item,
      role,
      fileName: getStickerFilename(item.index ?? exportIndex, {
        ...options,
        role,
        exportOrderIndex: roleIndex
      })
    };
  });
}

export function createZipFileName({ prefix = '', targetW = 370, targetH = 320, baseName = 'stickers' } = {}) {
  const safePrefix = String(prefix || '').trim() || baseName;
  return `${safePrefix}_project_${targetW}x${targetH}.zip`;
}
