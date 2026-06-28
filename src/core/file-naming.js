// Package filename helpers.
// These functions are pure and do not depend on DOM or app state.

export function getLineStickerFilename(orderIndex) {
  return `${String(orderIndex + 1).padStart(2, '0')}.png`;
}

export function getLineRoleFilename(role, stickerOrderIndex = 0) {
  if (role === 'main') return 'main.png';
  if (role === 'tab') return 'tab.png';
  if (role === 'background') return 'background.png';
  if (role === 'effect-background') return 'effect-background.png';
  return getLineStickerFilename(stickerOrderIndex);
}

export function getSequentialFilename(index, { prefix = '', suffix = '', extension = 'png', pad = 0 } = {}) {
  const number = pad > 0 ? String(index + 1).padStart(pad, '0') : String(index + 1);
  const safePrefix = String(prefix || '').trim();
  const safeSuffix = String(suffix || '').trim();
  return `${safePrefix ? safePrefix + '_' : ''}${number}${safeSuffix ? '_' + safeSuffix : ''}.${extension}`;
}

export function getStickerFilename(index, options = {}) {
  const {
    lineNamingMode = false,
    exportOrderIndex = index,
    role = 'sticker',
    prefix = '',
    suffix = '',
    extension = 'png'
  } = options;

  if (lineNamingMode) return getLineRoleFilename(role, exportOrderIndex);
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
