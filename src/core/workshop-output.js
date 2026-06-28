import { AssetRoles, StickerCategories } from './sticker-presets.js';

export const PackageNamingModes = Object.freeze({
  PACKAGE: 'package',
  SEQUENTIAL: 'sequential'
});

export function getAvailableAssetRoles(category = StickerCategories.NORMAL) {
  const roles = [AssetRoles.STICKER, AssetRoles.MAIN, AssetRoles.TAB];
  if (category === StickerCategories.FULLSCREEN) roles.push(AssetRoles.BACKGROUND);
  if (category === StickerCategories.EFFECT) roles.push(AssetRoles.EFFECT_BACKGROUND);
  return roles;
}

export function createSourceLayoutSettings(settings = {}) {
  return {
    layoutMode: settings.layoutMode || 'auto',
    rows: clampInteger(settings.rows, 1, 12, 1),
    cols: clampInteger(settings.cols, 1, 12, 1),
    marginX: clampNumber(settings.marginX, 0, 500, 0),
    marginY: clampNumber(settings.marginY, 0, 500, 0),
    gapX: clampNumber(settings.gapX, 0, 500, 0),
    gapY: clampNumber(settings.gapY, 0, 500, 0),
    smartSnap: settings.smartSnap !== false
  };
}

export function applySourceLayoutSettings(settings = {}, sourceLayout = {}) {
  return {
    ...settings,
    ...createSourceLayoutSettings({ ...settings, ...sourceLayout })
  };
}

export function createPlatformNeutralRules({
  destinationKey = 'workshop',
  destinationName = 'Sticker Package',
  category = StickerCategories.NORMAL,
  targetW = 370,
  targetH = 320,
  safeMargin = 15,
  namingMode = PackageNamingModes.PACKAGE,
  prefix = '',
  suffix = '',
  maxFileSizeKB = 1000
} = {}) {
  const roles = getAvailableAssetRoles(category);
  return {
    key: String(destinationKey || 'workshop'),
    name: String(destinationName || 'Sticker Package'),
    version: '1.1.0',
    canvas: {
      width: clampInteger(targetW, 1, 8192, 370),
      height: clampInteger(targetH, 1, 8192, 320),
      safeMargin: clampNumber(safeMargin, 0, 4096, 15)
    },
    limits: {
      maxFileSizeBytes: Math.max(1, Number(maxFileSizeKB) || 1000) * 1024
    },
    package: {
      naming: namingMode === PackageNamingModes.SEQUENTIAL ? 'sequential' : 'sticker-package',
      extension: 'png',
      prefix: String(prefix || '').trim(),
      suffix: String(suffix || '').trim(),
      roles: roles.map(role => ({
        key: role,
        required: false,
        max: role === AssetRoles.STICKER ? null : 1
      })),
      requiredRoles: [],
      requiresMain: false,
      requiresTab: false,
      minStickers: 1,
      maxStickerItems: null
    }
  };
}

export function clampSafeMargin(safeMargin, targetW, targetH) {
  const max = Math.max(0, Math.floor(Math.min(Number(targetW) || 1, Number(targetH) || 1) / 2) - 1);
  return clampNumber(safeMargin, 0, max, Math.min(15, max));
}

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
