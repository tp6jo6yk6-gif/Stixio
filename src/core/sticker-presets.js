// Sticker sticker output presets and role helpers.
// Keep platform rules outside the UI so Review, Render and Package share one source of truth.

export const StickerCategories = Object.freeze({
  NORMAL: 'normal',
  ANIMATED: 'animated',
  BIG: 'big',
  FULLSCREEN: 'fullscreen',
  EFFECT: 'effect'
});

export const AssetRoles = Object.freeze({
  STICKER: 'sticker',
  MAIN: 'main',
  TAB: 'tab',
  BACKGROUND: 'background',
  EFFECT_BACKGROUND: 'effect-background'
});

export const Sticker_PRESETS = Object.freeze({
  [StickerCategories.NORMAL]: [
    preset('貼圖圖片', AssetRoles.STICKER, 370, 320, 15),
    preset('主要圖片', AssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', AssetRoles.TAB, 96, 74, 5)
  ],
  [StickerCategories.ANIMATED]: [
    preset('動態圖片', AssetRoles.STICKER, 320, 270, 10),
    preset('主要圖片', AssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', AssetRoles.TAB, 96, 74, 5)
  ],
  [StickerCategories.BIG]: [
    preset('大貼圖', AssetRoles.STICKER, 396, 660, 20),
    preset('主要圖片', AssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', AssetRoles.TAB, 96, 74, 5)
  ],
  [StickerCategories.FULLSCREEN]: [
    preset('貼圖圖片', AssetRoles.STICKER, 370, 320, 15),
    preset('全螢幕背景', AssetRoles.BACKGROUND, 480, 480, 20),
    preset('主要圖片', AssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', AssetRoles.TAB, 96, 74, 5)
  ],
  [StickerCategories.EFFECT]: [
    preset('貼圖圖片', AssetRoles.STICKER, 370, 320, 15),
    preset('特效背景', AssetRoles.EFFECT_BACKGROUND, 480, 480, 20),
    preset('主要圖片', AssetRoles.MAIN, 240, 240, 10),
    preset('標籤圖片', AssetRoles.TAB, 96, 74, 5)
  ]
});

export function getStickerPresets(category = StickerCategories.NORMAL) {
  return Sticker_PRESETS[category] || Sticker_PRESETS[StickerCategories.NORMAL];
}

export function getStickerPreset(category, role = AssetRoles.STICKER) {
  return getStickerPresets(category).find(item => item.role === role) || getStickerPresets(category)[0];
}

export function applyStickerPreset(settings = {}, category, role = AssetRoles.STICKER) {
  const selected = getStickerPreset(category, role);
  return {
    ...settings,
    stickerCategory: category,
    outputRole: selected.role,
    targetW: selected.width,
    targetH: selected.height,
    safeMargin: selected.safeMargin
  };
}

function preset(name, role, width, height, safeMargin) {
  return Object.freeze({ name, role, width, height, safeMargin });
}
