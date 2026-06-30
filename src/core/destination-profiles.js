import { AssetRoles, StickerCategories } from './sticker-presets.js';
import { estimateCanvasPngBytes } from './workshop-output.js';

export const DESTINATION_PROFILE_SCHEMA_VERSION = '1.0.0';
export const DESTINATION_PROFILE_MIME = 'application/x-stixio-destination-profile+json';
export const DESTINATION_PROFILE_EXTENSION = '.stixio-profile.json';

export const DestinationProfileKeys = Object.freeze({
  FLEXIBLE: 'workshop-flexible',
  STANDARD: 'messaging-standard',
  ANIMATED: 'messaging-animated',
  BIG: 'messaging-big',
  FULLSCREEN: 'messaging-fullscreen',
  EFFECT: 'messaging-effect'
});

const BUILT_IN_PROFILES = Object.freeze([
  profile({
    key: DestinationProfileKeys.FLEXIBLE,
    name: 'Workshop Flexible',
    description: '自由數量與角色的通用輸出，不強制 Main 或 Tab。',
    category: StickerCategories.NORMAL,
    roles: [
      role(AssetRoles.STICKER, 'Sticker', 370, 320, { min: 1, safeMargin: 15, maxFileSizeKB: 1000, sequence: 2 }),
      role(AssetRoles.MAIN, 'Main', 240, 240, { max: 1, safeMargin: 10, fileName: 'main.png' }),
      role(AssetRoles.TAB, 'Tab', 96, 74, { max: 1, safeMargin: 5, fileName: 'tab.png' })
    ]
  }),
  profile({
    key: DestinationProfileKeys.STANDARD,
    name: 'Messaging Standard Pack',
    description: '標準靜態貼圖包，Main、Tab 與指定貼圖數量。',
    category: StickerCategories.NORMAL,
    roles: [
      role(AssetRoles.STICKER, 'Sticker', 370, 320, { required: true, allowedCounts: [8, 16, 24, 32, 40], safeMargin: 15, maxFileSizeKB: 1000, sequence: 2 }),
      role(AssetRoles.MAIN, 'Main', 240, 240, { required: true, exact: 1, safeMargin: 10, maxFileSizeKB: 1000, fileName: 'main.png' }),
      role(AssetRoles.TAB, 'Tab', 96, 74, { required: true, exact: 1, safeMargin: 5, maxFileSizeKB: 500, fileName: 'tab.png' })
    ]
  }),
  profile({
    key: DestinationProfileKeys.ANIMATED,
    name: 'Messaging Animated Pack',
    description: '動態貼圖輸出角色與數量規格。',
    category: StickerCategories.ANIMATED,
    roles: [
      role(AssetRoles.STICKER, 'Animated Sticker', 320, 270, { required: true, allowedCounts: [8, 16, 24], safeMargin: 10, maxFileSizeKB: 1000, sequence: 2 }),
      role(AssetRoles.MAIN, 'Main', 240, 240, { required: true, exact: 1, safeMargin: 10, maxFileSizeKB: 1000, fileName: 'main.png' }),
      role(AssetRoles.TAB, 'Tab', 96, 74, { required: true, exact: 1, safeMargin: 5, maxFileSizeKB: 500, fileName: 'tab.png' })
    ]
  }),
  profile({
    key: DestinationProfileKeys.BIG,
    name: 'Messaging Big Sticker Pack',
    description: '直式大貼圖輸出角色與數量規格。',
    category: StickerCategories.BIG,
    roles: [
      role(AssetRoles.STICKER, 'Big Sticker', 396, 660, { required: true, allowedCounts: [8, 16, 24], safeMargin: 20, maxFileSizeKB: 1500, sequence: 2 }),
      role(AssetRoles.MAIN, 'Main', 240, 240, { required: true, exact: 1, safeMargin: 10, maxFileSizeKB: 1000, fileName: 'main.png' }),
      role(AssetRoles.TAB, 'Tab', 96, 74, { required: true, exact: 1, safeMargin: 5, maxFileSizeKB: 500, fileName: 'tab.png' })
    ]
  }),
  profile({
    key: DestinationProfileKeys.FULLSCREEN,
    name: 'Messaging Fullscreen Pack',
    description: '包含全螢幕背景角色的貼圖包。',
    category: StickerCategories.FULLSCREEN,
    roles: [
      role(AssetRoles.STICKER, 'Sticker', 370, 320, { required: true, allowedCounts: [8, 16, 24], safeMargin: 15, maxFileSizeKB: 1000, sequence: 2 }),
      role(AssetRoles.BACKGROUND, 'Fullscreen Background', 480, 480, { required: true, exact: 1, safeMargin: 20, maxFileSizeKB: 1500, fileName: 'background.png' }),
      role(AssetRoles.MAIN, 'Main', 240, 240, { required: true, exact: 1, safeMargin: 10, maxFileSizeKB: 1000, fileName: 'main.png' }),
      role(AssetRoles.TAB, 'Tab', 96, 74, { required: true, exact: 1, safeMargin: 5, maxFileSizeKB: 500, fileName: 'tab.png' })
    ]
  }),
  profile({
    key: DestinationProfileKeys.EFFECT,
    name: 'Messaging Effect Pack',
    description: '包含特效背景角色的貼圖包。',
    category: StickerCategories.EFFECT,
    roles: [
      role(AssetRoles.STICKER, 'Sticker', 370, 320, { required: true, allowedCounts: [8, 16, 24], safeMargin: 15, maxFileSizeKB: 1000, sequence: 2 }),
      role(AssetRoles.EFFECT_BACKGROUND, 'Effect Background', 480, 480, { required: true, exact: 1, safeMargin: 20, maxFileSizeKB: 1500, fileName: 'effect-background.png' }),
      role(AssetRoles.MAIN, 'Main', 240, 240, { required: true, exact: 1, safeMargin: 10, maxFileSizeKB: 1000, fileName: 'main.png' }),
      role(AssetRoles.TAB, 'Tab', 96, 74, { required: true, exact: 1, safeMargin: 5, maxFileSizeKB: 500, fileName: 'tab.png' })
    ]
  })
]);

export function listBuiltInDestinationProfiles() {
  return BUILT_IN_PROFILES.map(clone);
}

export function getBuiltInDestinationProfile(key = DestinationProfileKeys.FLEXIBLE) {
  const found = BUILT_IN_PROFILES.find(item => item.key === key);
  if (!found) throw new Error(`Unknown built-in Destination Profile: ${key}`);
  return clone(found);
}

export function createDestinationProfile(input = {}) {
  const normalized = normalizeDestinationProfile(input);
  const validation = validateDestinationProfile(normalized);
  if (!validation.ready) throw destinationProfileError(validation.errors);
  return normalized;
}

export function duplicateDestinationProfile(source, { key = null, name = null } = {}) {
  const profileValue = createDestinationProfile(source);
  return createDestinationProfile({
    ...profileValue,
    key: key || `${profileValue.key}-copy-${Date.now().toString(36)}`,
    name: name || `${profileValue.name} Copy`,
    builtIn: false,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function normalizeDestinationProfile(input = {}) {
  const now = new Date().toISOString();
  const roles = Array.isArray(input.roles) && input.roles.length
    ? input.roles.map(normalizeRoleRule)
    : [role(AssetRoles.STICKER, 'Sticker', 370, 320, { min: 1, safeMargin: 15, sequence: 2 })];
  return {
    schema: 'https://stixio.app/schemas/destination-profile/v1',
    schemaVersion: DESTINATION_PROFILE_SCHEMA_VERSION,
    key: sanitizeKey(input.key || `custom-${Date.now().toString(36)}`),
    name: String(input.name || 'Custom Destination').trim(),
    version: normalizeVersion(input.version || '1.0.0'),
    description: String(input.description || '').trim(),
    category: Object.values(StickerCategories).includes(input.category) ? input.category : StickerCategories.NORMAL,
    builtIn: Boolean(input.builtIn),
    output: {
      mimeType: input.output?.mimeType || 'image/png',
      extension: String(input.output?.extension || 'png').replace(/^\./, '').toLowerCase(),
      transparency: input.output?.transparency || 'required'
    },
    package: {
      folderMode: input.package?.folderMode || 'flat',
      rootFolder: String(input.package?.rootFolder || ''),
      namingVersion: Math.max(1, Math.round(Number(input.package?.namingVersion) || 1))
    },
    roles,
    metadata: clone(input.metadata || {}),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

export function validateDestinationProfile(profileValue) {
  const errors = [];
  const warnings = [];
  if (!profileValue || typeof profileValue !== 'object') errors.push(issue('destination.invalid', 'Destination Profile must be an object.'));
  if (!profileValue?.key) errors.push(issue('destination.key.missing', 'Destination Profile key is required.'));
  if (!profileValue?.name) errors.push(issue('destination.name.missing', 'Destination Profile name is required.'));
  if (!profileValue?.version) errors.push(issue('destination.version.missing', 'Destination Profile version is required.'));
  if (!Array.isArray(profileValue?.roles) || !profileValue.roles.length) errors.push(issue('destination.roles.missing', 'Destination Profile must define at least one role.'));
  const keys = new Set();
  for (const roleRule of profileValue?.roles || []) {
    if (!roleRule.key) errors.push(issue('destination.role.keyMissing', 'A role is missing its key.'));
    if (keys.has(roleRule.key)) errors.push(issue('destination.role.duplicate', `Duplicate role rule: ${roleRule.key}.`, { role: roleRule.key }));
    keys.add(roleRule.key);
    if (!positiveInteger(roleRule.width) || !positiveInteger(roleRule.height)) errors.push(issue('destination.role.sizeInvalid', `${roleRule.label || roleRule.key} must define a positive width and height.`, { role: roleRule.key }));
    if (roleRule.exact != null && (!nonNegativeInteger(roleRule.exact))) errors.push(issue('destination.role.exactInvalid', `${roleRule.label || roleRule.key} exact count is invalid.`, { role: roleRule.key }));
    if (roleRule.min != null && !nonNegativeInteger(roleRule.min)) errors.push(issue('destination.role.minInvalid', `${roleRule.label || roleRule.key} minimum count is invalid.`, { role: roleRule.key }));
    if (roleRule.max != null && !nonNegativeInteger(roleRule.max)) errors.push(issue('destination.role.maxInvalid', `${roleRule.label || roleRule.key} maximum count is invalid.`, { role: roleRule.key }));
    if (roleRule.min != null && roleRule.max != null && roleRule.min > roleRule.max) errors.push(issue('destination.role.rangeInvalid', `${roleRule.label || roleRule.key} minimum exceeds maximum.`, { role: roleRule.key }));
    if (roleRule.allowedCounts?.some(count => !nonNegativeInteger(count))) errors.push(issue('destination.role.allowedInvalid', `${roleRule.label || roleRule.key} has an invalid allowed count.`, { role: roleRule.key }));
    if (roleRule.safeMargin * 2 >= Math.min(roleRule.width, roleRule.height)) warnings.push(issue('destination.role.safeMarginLarge', `${roleRule.label || roleRule.key} safe margin leaves no usable center area.`, { role: roleRule.key }, 'warning'));
  }
  if (!keys.has(AssetRoles.STICKER)) warnings.push(issue('destination.sticker.missing', 'Profile has no Sticker role.', {}, 'warning'));
  return { ready: errors.length === 0, errors, warnings };
}

export function createDestinationProfileRegistry({ builtIns = listBuiltInDestinationProfiles(), customProfiles = [] } = {}) {
  const map = new Map();
  for (const item of [...builtIns, ...customProfiles]) {
    const normalized = createDestinationProfile(item);
    map.set(normalized.key, normalized);
  }
  return {
    list: () => [...map.values()].map(clone).sort((a, b) => Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name)),
    get: key => map.has(key) ? clone(map.get(key)) : null,
    has: key => map.has(key),
    register(value) {
      const normalized = createDestinationProfile(value);
      map.set(normalized.key, normalized);
      return clone(normalized);
    },
    remove(key) {
      const found = map.get(key);
      if (!found || found.builtIn) return false;
      return map.delete(key);
    },
    exportCustom: () => [...map.values()].filter(item => !item.builtIn).map(clone)
  };
}

export function getDestinationRoleRule(profileValue, roleKey = AssetRoles.STICKER) {
  const profile = createDestinationProfile(profileValue);
  return clone(profile.roles.find(item => item.key === roleKey) || profile.roles.find(item => item.key === AssetRoles.STICKER) || profile.roles[0]);
}

export function getDestinationRoleKeys(profileValue) {
  return createDestinationProfile(profileValue).roles.map(item => item.key);
}

export function getDestinationOutput(profileValue, roleKey = AssetRoles.STICKER) {
  const roleRule = getDestinationRoleRule(profileValue, roleKey);
  return {
    role: roleRule.key,
    width: roleRule.width,
    height: roleRule.height,
    safeMargin: roleRule.safeMargin,
    maxFileSizeBytes: roleRule.maxFileSizeBytes,
    mimeType: profileValue.output?.mimeType || 'image/png',
    extension: profileValue.output?.extension || 'png'
  };
}

export function applyDestinationProfileToSettings(settings = {}, profileValue, roleKey = null) {
  const profile = createDestinationProfile(profileValue);
  const requestedRole = roleKey || settings.outputRole || AssetRoles.STICKER;
  const output = getDestinationOutput(profile, requestedRole);
  return {
    ...settings,
    destinationProfileKey: profile.key,
    destinationProfileVersion: profile.version,
    stickerCategory: profile.category,
    outputRole: output.role,
    targetW: output.width,
    targetH: output.height,
    safeMargin: output.safeMargin,
    maxFileSizeKB: Math.max(1, Math.round(output.maxFileSizeBytes / 1024))
  };
}

export function normalizeFramesForDestination(frames = [], profileValue, { invalidateApproval = true } = {}) {
  const profile = createDestinationProfile(profileValue);
  const allowed = new Set(profile.roles.map(item => item.key));
  const fallback = profile.roles.find(item => item.key === AssetRoles.STICKER)?.key || profile.roles[0].key;
  return frames.map(frame => {
    const requested = frame.state?.packageRole || frame.custom?.outputRole || fallback;
    const roleKey = allowed.has(requested) ? requested : fallback;
    return {
      ...frame,
      state: {
        ...(frame.state || {}),
        packageRole: roleKey,
        ...(invalidateApproval ? { reviewApproved: false } : {})
      },
      custom: {
        ...(frame.custom || {}),
        outputRole: roleKey
      }
    };
  });
}

export function buildDestinationPackagePlan(frames = [], {
  profile: profileInput,
  namingMode = 'profile',
  prefix = '',
  suffix = '',
  renderedMap = null
} = {}) {
  const profile = createDestinationProfile(profileInput || getBuiltInDestinationProfile());
  const allowed = new Set(profile.roles.map(item => item.key));
  const fallback = profile.roles.find(item => item.key === AssetRoles.STICKER)?.key || profile.roles[0].key;
  const counters = {};
  const items = frames.map((frame, order) => {
    const requestedRole = frame.state?.packageRole || frame.custom?.outputRole || fallback;
    const roleKey = allowed.has(requestedRole) ? requestedRole : fallback;
    counters[roleKey] = (counters[roleKey] || 0) + 1;
    const roleRule = getDestinationRoleRule(profile, roleKey);
    const index = counters[roleKey];
    const fileName = namingMode === 'sequential'
      ? sequentialFileName(order + 1, profile.output.extension, prefix, suffix)
      : destinationFileName(roleRule, index, profile.output.extension, prefix, suffix);
    const canvas = renderedMap?.get?.(frame.id) || null;
    return {
      artworkId: frame.id,
      role: roleKey,
      roleLabel: roleRule.label,
      order,
      roleIndex: index,
      stickerIndex: roleKey === AssetRoles.STICKER ? index : null,
      fileName,
      expectedWidth: roleRule.width,
      expectedHeight: roleRule.height,
      safeMargin: roleRule.safeMargin,
      maxFileSizeBytes: roleRule.maxFileSizeBytes,
      actualWidth: canvas?.width || null,
      actualHeight: canvas?.height || null,
      estimatedBytes: canvas ? estimateCanvasPngBytes(canvas) : 0
    };
  });
  const validation = validateDestinationPackage({ profile, items });
  return {
    destinationKey: profile.key,
    destinationName: profile.name,
    profileVersion: profile.version,
    items,
    validation,
    ready: validation.errors.length === 0,
    metadata: {
      generatedAt: new Date().toISOString(),
      rulesVersion: profile.version,
      profileSchemaVersion: profile.schemaVersion
    }
  };
}

export function validateDestinationPackage({ profile: profileInput, items = [] } = {}) {
  const profile = createDestinationProfile(profileInput || getBuiltInDestinationProfile());
  const errors = [];
  const warnings = [];
  const counts = Object.fromEntries(profile.roles.map(item => [item.key, 0]));
  for (const item of items) counts[item.role] = (counts[item.role] || 0) + 1;

  for (const roleRule of profile.roles) {
    const count = counts[roleRule.key] || 0;
    if (roleRule.exact != null && count !== roleRule.exact) errors.push(issue('destination.role.exact', `${roleRule.label} requires exactly ${roleRule.exact}, found ${count}.`, { role: roleRule.key, expected: roleRule.exact, actual: count }));
    else {
      if ((roleRule.required || roleRule.min > 0) && count < Math.max(roleRule.min || 0, roleRule.required ? 1 : 0)) errors.push(issue('destination.role.min', `${roleRule.label} requires at least ${Math.max(roleRule.min || 0, 1)}, found ${count}.`, { role: roleRule.key, actual: count }));
      if (roleRule.max != null && count > roleRule.max) errors.push(issue('destination.role.max', `${roleRule.label} allows at most ${roleRule.max}, found ${count}.`, { role: roleRule.key, actual: count }));
    }
    if (roleRule.allowedCounts?.length && count > 0 && !roleRule.allowedCounts.includes(count)) errors.push(issue('destination.role.allowedCount', `${roleRule.label} count must be one of ${roleRule.allowedCounts.join(', ')}, found ${count}.`, { role: roleRule.key, actual: count, allowed: roleRule.allowedCounts }));
  }

  const seenNames = new Map();
  for (const item of items) {
    const previous = seenNames.get(item.fileName);
    if (previous) errors.push(issue('destination.filename.duplicate', `Duplicate output filename: ${item.fileName}.`, { frameId: item.artworkId, otherFrameId: previous.artworkId }));
    else seenNames.set(item.fileName, item);
    if (item.actualWidth != null && (item.actualWidth !== item.expectedWidth || item.actualHeight !== item.expectedHeight)) errors.push(issue('destination.output.size', `${item.fileName} must be ${item.expectedWidth}×${item.expectedHeight}, found ${item.actualWidth}×${item.actualHeight}.`, { frameId: item.artworkId, role: item.role }));
    if (item.maxFileSizeBytes && item.estimatedBytes > item.maxFileSizeBytes) errors.push(issue('destination.output.fileSize', `${item.fileName} exceeds ${Math.ceil(item.maxFileSizeBytes / 1024)}KB.`, { frameId: item.artworkId, role: item.role, actualBytes: item.estimatedBytes }));
  }
  if (!items.length) errors.push(issue('destination.package.empty', 'Destination package contains no output files.'));
  return { errors, warnings, counts, ready: errors.length === 0 };
}

export function serializeDestinationProfile(profileValue) {
  return JSON.stringify(createDestinationProfile(profileValue), null, 2);
}

export function parseDestinationProfile(text) {
  let value;
  try {
    value = typeof text === 'string' ? JSON.parse(text) : text;
  } catch (cause) {
    const error = new Error('Destination Profile JSON is invalid.');
    error.name = 'DestinationProfileParseError';
    error.cause = cause;
    throw error;
  }
  if (majorVersion(value?.schemaVersion || '1.0.0') > majorVersion(DESTINATION_PROFILE_SCHEMA_VERSION)) {
    const error = new Error(`Destination Profile schema ${value.schemaVersion} is newer than supported ${DESTINATION_PROFILE_SCHEMA_VERSION}.`);
    error.name = 'DestinationProfileVersionError';
    throw error;
  }
  return createDestinationProfile({ ...value, builtIn: false });
}

export function destinationProfileSummary(profileValue) {
  const profile = createDestinationProfile(profileValue);
  return {
    key: profile.key,
    name: profile.name,
    version: profile.version,
    category: profile.category,
    builtIn: profile.builtIn,
    roles: profile.roles.map(item => ({ key: item.key, label: item.label, width: item.width, height: item.height, exact: item.exact, min: item.min, max: item.max, allowedCounts: item.allowedCounts }))
  };
}

function profile({ key, name, description, category, roles }) {
  return Object.freeze(normalizeDestinationProfile({ key, name, description, category, roles, version: '1.0.0', builtIn: true }));
}

function role(key, label, width, height, options = {}) {
  return normalizeRoleRule({ key, label, width, height, ...options });
}

function normalizeRoleRule(input = {}) {
  const exact = input.exact == null ? null : Math.max(0, Math.round(Number(input.exact) || 0));
  const min = input.min == null ? null : Math.max(0, Math.round(Number(input.min) || 0));
  const max = input.max == null ? null : Math.max(0, Math.round(Number(input.max) || 0));
  const allowedCounts = Array.isArray(input.allowedCounts)
    ? [...new Set(input.allowedCounts.map(value => Math.max(0, Math.round(Number(value) || 0))))].sort((a, b) => a - b)
    : [];
  return {
    key: String(input.key || AssetRoles.STICKER),
    label: String(input.label || input.key || 'Sticker'),
    required: Boolean(input.required || exact > 0),
    exact,
    min,
    max,
    allowedCounts,
    width: Math.max(1, Math.round(Number(input.width) || 1)),
    height: Math.max(1, Math.round(Number(input.height) || 1)),
    safeMargin: Math.max(0, Math.round(Number(input.safeMargin) || 0)),
    maxFileSizeBytes: Math.max(1, Math.round(Number(input.maxFileSizeBytes) || Number(input.maxFileSizeKB) * 1024 || 1000 * 1024)),
    naming: {
      fileName: input.naming?.fileName || input.fileName || null,
      sequence: Math.max(1, Math.round(Number(input.naming?.sequence || input.sequence) || 2)),
      prefix: String(input.naming?.prefix || ''),
      suffix: String(input.naming?.suffix || '')
    }
  };
}

function destinationFileName(roleRule, index, extension, globalPrefix = '', globalSuffix = '') {
  const fixed = roleRule.naming.fileName;
  if (fixed) return decorateName(fixed, globalPrefix, globalSuffix);
  const digits = roleRule.naming.sequence || 2;
  const base = `${roleRule.naming.prefix || ''}${String(index).padStart(digits, '0')}${roleRule.naming.suffix || ''}.${extension}`;
  return decorateName(base, globalPrefix, globalSuffix);
}

function sequentialFileName(index, extension, prefix = '', suffix = '') {
  const name = `${String(prefix || '').trim()}${prefix ? '_' : ''}${String(index).padStart(3, '0')}${suffix ? `_${String(suffix).trim()}` : ''}.${extension}`;
  return name.replace(/\s+/g, '-');
}

function decorateName(fileName, prefix = '', suffix = '') {
  const dot = fileName.lastIndexOf('.');
  const base = dot >= 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot >= 0 ? fileName.slice(dot) : '';
  return `${prefix ? `${String(prefix).trim()}_` : ''}${base}${suffix ? `_${String(suffix).trim()}` : ''}${extension}`.replace(/\s+/g, '-');
}

function sanitizeKey(value) {
  return String(value || 'custom').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'custom';
}

function normalizeVersion(value) {
  const parts = String(value || '1.0.0').split('.').map(part => Math.max(0, Math.round(Number(part) || 0)));
  return [parts[0] || 1, parts[1] || 0, parts[2] || 0].join('.');
}

function majorVersion(value) {
  return Math.max(0, Math.round(Number(String(value || '0').split('.')[0]) || 0));
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function issue(code, message, metadata = {}, severity = 'error') {
  return { code, message, severity, ...metadata };
}

function destinationProfileError(issues) {
  const error = new Error(issues[0]?.message || 'Destination Profile is invalid.');
  error.name = 'DestinationProfileValidationError';
  error.issues = issues;
  return error;
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
