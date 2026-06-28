// LINE sticker output presets and role helpers.
// Keep platform rules outside the UI so Review, Render and Package share one source of truth.

export const LineStickerCategories = Object.freeze({
  NORMAL: 'normal',
  ANIMATED: 'animated',
  BIG: 'big',
  FULLSCREEN: 'fullscreen',
  EFFECT: 'effect'
});

export const LineAssetRoles = Object.freeze({
  STICKER: 'sticker',
  MAIN: 'main',
  TAB: 'tab',
  BACKGROUND: 'background',
  EFFECT_BACKGROUND: 'effect-background'
});

export const LINE_PRESETS = Object.freeze({
  [LineStickerCategories.NORMAL]: [
    preset('貼圖圖片', LineAssetRoles.STICKER, 370, 320, 15),
    preset('主要圖片', LineAssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', LineAssetRoles.TAB, 96, 74, 5)
  ],
  [LineStickerCategories.ANIMATED]: [
    preset('動態圖片', LineAssetRoles.STICKER, 320, 270, 10),
    preset('主要圖片', LineAssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', LineAssetRoles.TAB, 96, 74, 5)
  ],
  [LineStickerCategories.BIG]: [
    preset('大貼圖', LineAssetRoles.STICKER, 396, 660, 20),
    preset('主要圖片', LineAssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', LineAssetRoles.TAB, 96, 74, 5)
  ],
  [LineStickerCategories.FULLSCREEN]: [
    preset('貼圖圖片', LineAssetRoles.STICKER, 370, 320, 15),
    preset('全螢幕背景', LineAssetRoles.BACKGROUND, 480, 480, 20),
    preset('主要圖片', LineAssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', LineAssetRoles.TAB, 96, 74, 5)
  ],
  [LineStickerCategories.EFFECT]: [
    preset('貼圖圖片', LineAssetRoles.STICKER, 370, 320, 15),
    preset('特效背景', LineAssetRoles.EFFECT_BACKGROUND, 480, 480, 20),
    preset('主要圖片', LineAssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', LineAssetRoles.TAB, 96, 74, 5)
  ]
});

export function getLinePresets(category = LineStickerCategories.NORMAL) {
  return LINE_PRESETS[category] || LINE_PRESETS[LineStickerCategories.NORMAL];
}

export function getLinePreset(category, role = LineAssetRoles.STICKER) {
  return getLinePresets(category).find(item => item.role === role) || getLinePresets(category)[0];
}

export function applyLinePreset(settings = {}, category, role = LineAssetRoles.STICKER) {
  const selected = getLinePreset(category, role);
  return {
    ...settings,
    lineCategory: category,
    outputRole: selected.role,
    targetW: selected.width,
    targetH: selected.height,
    safeMargin: selected.safeMargin
  };
}

function preset(name, role, width, height, safeMargin) {
  return Object.freeze({ name, role, width, height, safeMargin });
}
