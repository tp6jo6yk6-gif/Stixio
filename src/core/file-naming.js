// Package filename helpers.
// These functions are pure and do not depend on DOM or app state.

export function getLineStickerFilename(orderIndex) {
  if (orderIndex === 0) return 'main.png';
  if (orderIndex === 1) return 'tab.png';
  return `${String(orderIndex - 1).padStart(2, '0')}.png`;
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
    prefix = '',
    suffix = '',
    extension = 'png'
  } = options;

  if (lineNamingMode) return getLineStickerFilename(exportOrderIndex);
  return getSequentialFilename(index, { prefix, suffix, extension });
}

export function buildPackageFilenames(items, options = {}) {
  return items.map((item, exportIndex) => ({
    ...item,
    fileName: getStickerFilename(item.index ?? exportIndex, {
      ...options,
      exportOrderIndex: exportIndex
    })
  }));
}
