import { AssetRoles, StickerCategories } from './sticker-presets.js';
import { getRolePackageFilename, getSequentialFilename } from './file-naming.js';
import { getStickerPlacement, renderFrameToCanvas } from './render.js';

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

export function clampSafeMargin(safeMargin, targetW, targetH) {
  const max = Math.max(0, Math.floor(Math.min(Number(targetW) || 1, Number(targetH) || 1) / 2) - 1);
  return clampNumber(safeMargin, 0, max, Math.min(15, max));
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
      safeMargin: clampSafeMargin(safeMargin, targetW, targetH)
    },
    limits: {
      maxFileSizeBytes: Math.max(1, Number(maxFileSizeKB) || 1000) * 1024
    },
    package: {
      naming: namingMode === PackageNamingModes.SEQUENTIAL ? 'sequential' : 'sticker-package',
      extension: 'png',
      prefix: String(prefix || '').trim(),
      suffix: String(suffix || '').trim(),
      roles: roles.map(role => ({ key: role, required: false, max: role === AssetRoles.STICKER ? null : 1 })),
      requiredRoles: [],
      requiresMain: false,
      requiresTab: false,
      minStickers: 1,
      maxStickerItems: null
    }
  };
}

export function buildWorkshopPackagePlan(frames = [], options = {}) {
  const allowedRoles = new Set(getAvailableAssetRoles(options.category));
  let stickerIndex = 0;
  const items = frames.map((frame, order) => {
    const requestedRole = frame.state?.packageRole || frame.custom?.outputRole || AssetRoles.STICKER;
    const role = allowedRoles.has(requestedRole) ? requestedRole : AssetRoles.STICKER;
    const currentStickerIndex = role === AssetRoles.STICKER ? stickerIndex++ : 0;
    const fileName = options.namingMode === PackageNamingModes.SEQUENTIAL
      ? getSequentialFilename(order, {
        prefix: options.prefix || '',
        suffix: options.suffix || '',
        extension: 'png'
      })
      : getRolePackageFilename(role, currentStickerIndex);
    return {
      artworkId: frame.id,
      role,
      roleLabel: role,
      order,
      stickerIndex: role === AssetRoles.STICKER ? currentStickerIndex + 1 : null,
      fileName
    };
  });

  const counts = items.reduce((result, item) => {
    result[item.role] = (result[item.role] || 0) + 1;
    return result;
  }, {});
  const errors = [];
  const warnings = [];

  for (const role of [AssetRoles.MAIN, AssetRoles.TAB, AssetRoles.BACKGROUND, AssetRoles.EFFECT_BACKGROUND]) {
    if ((counts[role] || 0) > 1) errors.push({ code: `package.${role}.max`, message: `Only one ${role} image is allowed.`, severity: 'error' });
  }
  if (!(counts[AssetRoles.STICKER] || 0)) errors.push({ code: 'package.sticker.min', message: 'At least one sticker image is required.', severity: 'error' });

  const names = new Set();
  items.forEach(item => {
    if (names.has(item.fileName)) errors.push({ code: 'package.filename.duplicate', message: `Duplicate filename: ${item.fileName}.`, severity: 'error' });
    names.add(item.fileName);
  });

  return {
    destinationKey: options.destinationKey || 'workshop',
    items,
    validation: { errors, warnings, counts },
    ready: errors.length === 0,
    metadata: { generatedAt: new Date().toISOString(), rulesVersion: '1.1.0' }
  };
}

export function renderWorkshopFrame(sourceImage, frame, options = {}) {
  const base = renderFrameToCanvas(sourceImage, frame, options);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(options.targetW || 370));
  canvas.height = Math.max(1, Math.round(options.targetH || 320));
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = options.highQuality === false ? 'medium' : 'high';

  const placement = getStickerPlacement({
    cropW: base.refinedCanvas.width,
    cropH: base.refinedCanvas.height
  }, {
    ...options,
    offsetX: frame.custom?.offsetX ?? frame.state?.offsetX ?? 0,
    offsetY: frame.custom?.offsetY ?? frame.state?.offsetY ?? 0
  });
  context.drawImage(base.refinedCanvas, placement.drawX, placement.drawY, placement.drawW, placement.drawH);

  return { ...base, canvas, placement, options: { ...base.options, ...options } };
}

export function estimateCanvasPngBytes(canvas) {
  if (!canvas?.toDataURL) return 0;
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const comma = dataUrl.indexOf(',');
    const payloadLength = comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
    return Math.max(0, Math.floor(payloadLength * 0.75));
  } catch {
    return 0;
  }
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
