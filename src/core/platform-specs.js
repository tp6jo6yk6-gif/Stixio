import { DestinationProfileKeys } from './destination-profiles.js';
import { AssetRoles } from './sticker-presets.js';
import { applyLineStickerReviewRule } from './review/review-workflow.js';

export const PlatformSpecKeys = Object.freeze({
  MESSAGING_STANDARD: 'messaging-standard',
  GENERIC_PNG_PACK: 'generic-png-pack'
});

export const PlatformSpecStatuses = Object.freeze({
  AVAILABLE: 'available',
  PLANNED: 'planned'
});

export const PlatformSlotKeys = Object.freeze({
  MAIN: 'main',
  TAB: 'tab',
  STICKER: 'sticker',
  BACKUP: 'backup'
});

function sequentialStickerName(index) {
  return `${String(index + 1).padStart(2, '0')}.png`;
}

function unavailableReviewRule() {
  throw new Error('This platform spec is planned but not available yet.');
}

const MESSAGING_STANDARD_SPEC = Object.freeze({
  key: PlatformSpecKeys.MESSAGING_STANDARD,
  label: '訊息貼圖標準包',
  deliveryLabel: '訊息貼圖標準包',
  platformLabel: '通用貼圖平台',
  status: PlatformSpecStatuses.AVAILABLE,
  statusLabel: '目前可用',
  compatibilityLabel: '目前可對應 LINE',
  description: '用通用貼圖平台的標準包概念管理 main、tab 與貼圖張數；之後新增平台會接在同一份規格清單。',
  destinationProfileKey: DestinationProfileKeys.STANDARD,
  destinationRole: AssetRoles.STICKER,
  counts: Object.freeze([8, 16, 24, 32, 40]),
  stickerCounts: Object.freeze([8, 16, 24, 32, 40]),
  defaultStickerCount: 8,
  supportsMain: true,
  supportsTab: true,
  slots: Object.freeze({
    [PlatformSlotKeys.MAIN]: Object.freeze({
      key: PlatformSlotKeys.MAIN,
      label: 'Main',
      role: AssetRoles.MAIN,
      required: true,
      count: 1,
      fileName: 'main.png'
    }),
    [PlatformSlotKeys.TAB]: Object.freeze({
      key: PlatformSlotKeys.TAB,
      label: 'Tab',
      role: AssetRoles.TAB,
      required: true,
      count: 1,
      fileName: 'tab.png'
    }),
    [PlatformSlotKeys.STICKER]: Object.freeze({
      key: PlatformSlotKeys.STICKER,
      label: '貼圖',
      role: AssetRoles.STICKER,
      required: true,
      counts: Object.freeze([8, 16, 24, 32, 40]),
      fileNamePattern: '01.png',
      fileNameAt: sequentialStickerName
    }),
    [PlatformSlotKeys.BACKUP]: Object.freeze({
      key: PlatformSlotKeys.BACKUP,
      label: '備選',
      role: AssetRoles.STICKER,
      required: false,
      exportSelected: false
    })
  }),
  naming: Object.freeze({
    main: 'main.png',
    tab: 'tab.png',
    stickerStart: '01.png',
    stickerFileNameAt: sequentialStickerName,
    backup: '備選'
  }),
  applyReviewRule(frames, options = {}) {
    return applyLineStickerReviewRule(frames, options);
  },
  summary({ stickerCount = 8, main = true, tab = true } = {}) {
    const parts = [];
    if (main) parts.push('main');
    if (tab) parts.push('tab');
    parts.push(`${stickerCount} 張貼圖`);
    return `交付規格會使用 ${parts.join(' + ')}；超過數量會放入備選。`;
  }
});

const GENERIC_PNG_PACK_SPEC = Object.freeze({
  key: PlatformSpecKeys.GENERIC_PNG_PACK,
  label: '通用 PNG 貼圖包',
  deliveryLabel: '通用 PNG 貼圖包',
  platformLabel: '通用 PNG',
  status: PlatformSpecStatuses.PLANNED,
  statusLabel: '即將支援',
  compatibilityLabel: '規格骨架已建立',
  description: '預留給不含 main/tab 的一般 PNG 貼圖包；目前先顯示規格方向，完整套用流程之後再開放。',
  destinationProfileKey: DestinationProfileKeys.FLEXIBLE,
  destinationRole: AssetRoles.STICKER,
  counts: Object.freeze([8, 16, 24, 32, 40]),
  stickerCounts: Object.freeze([8, 16, 24, 32, 40]),
  defaultStickerCount: 8,
  supportsMain: false,
  supportsTab: false,
  slots: Object.freeze({
    [PlatformSlotKeys.STICKER]: Object.freeze({
      key: PlatformSlotKeys.STICKER,
      label: 'PNG',
      role: AssetRoles.STICKER,
      required: true,
      counts: Object.freeze([8, 16, 24, 32, 40]),
      fileNamePattern: '01.png',
      fileNameAt: sequentialStickerName
    }),
    [PlatformSlotKeys.BACKUP]: Object.freeze({
      key: PlatformSlotKeys.BACKUP,
      label: '備選',
      role: AssetRoles.STICKER,
      required: false,
      exportSelected: false
    })
  }),
  naming: Object.freeze({
    stickerStart: '01.png',
    stickerFileNameAt: sequentialStickerName,
    backup: '備選'
  }),
  applyReviewRule: unavailableReviewRule,
  summary({ stickerCount = 8 } = {}) {
    return `即將支援：預計使用 ${stickerCount} 張 PNG，檔名從 01.png 開始；目前尚不能套用。`;
  }
});

const PLATFORM_SPECS = Object.freeze([
  MESSAGING_STANDARD_SPEC,
  GENERIC_PNG_PACK_SPEC
]);

export function getAvailablePlatformSpecs() {
  return PLATFORM_SPECS;
}

export function getPlatformSpec(key = PlatformSpecKeys.MESSAGING_STANDARD) {
  return PLATFORM_SPECS.find(spec => spec.key === key) || PLATFORM_SPECS[0];
}

export function isPlatformSpecAvailable(key) {
  return getPlatformSpec(key).status === PlatformSpecStatuses.AVAILABLE;
}

export function getPlatformStickerCounts(key) {
  return [...getPlatformSpec(key).stickerCounts];
}

export function getPlatformSlots(key) {
  return getPlatformSpec(key).slots;
}

export function getPlatformNaming(key) {
  return getPlatformSpec(key).naming;
}

export function normalizePlatformStickerCount(key, value) {
  const spec = getPlatformSpec(key);
  const count = Number(value);
  return spec.stickerCounts.includes(count) ? count : spec.defaultStickerCount;
}

export function applyPlatformStickerReviewRule(frames, key, options = {}) {
  const spec = getPlatformSpec(key);
  if (!isPlatformSpecAvailable(spec.key)) {
    throw new Error(`${spec.label} is not available yet.`);
  }
  return spec.applyReviewRule(frames, options);
}
