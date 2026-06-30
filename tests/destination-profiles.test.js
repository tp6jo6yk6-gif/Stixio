import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AssetRoles,
  DESTINATION_PROFILE_SCHEMA_VERSION,
  DestinationProfileKeys,
  applyDestinationProfileToSettings,
  buildDestinationPackagePlan,
  createDestinationProfile,
  createDestinationProfileRegistry,
  destinationProfileSummary,
  duplicateDestinationProfile,
  getBuiltInDestinationProfile,
  getDestinationOutput,
  getDestinationRoleKeys,
  listBuiltInDestinationProfiles,
  normalizeFramesForDestination,
  parseDestinationProfile,
  serializeDestinationProfile,
  validateDestinationPackage,
  validateDestinationProfile
} from '../src/core/index.js';

function frame(id, role = AssetRoles.STICKER) {
  return {
    id,
    name: id,
    state: { visible: true, exportSelected: true, reviewApproved: true, packageRole: role },
    custom: { outputRole: role }
  };
}

function rendered(width, height, bytes = 128) {
  return {
    width,
    height,
    toDataURL() {
      return `data:image/png;base64,${'A'.repeat(Math.max(4, Math.ceil(bytes / 0.75)))}`;
    }
  };
}

test('built-in Destination Profiles are versioned and valid', () => {
  const profiles = listBuiltInDestinationProfiles();
  assert.equal(profiles.length, 6);
  assert.deepEqual(profiles.map(item => item.key), [
    DestinationProfileKeys.ANIMATED,
    DestinationProfileKeys.BIG,
    DestinationProfileKeys.EFFECT,
    DestinationProfileKeys.FULLSCREEN,
    DestinationProfileKeys.STANDARD,
    DestinationProfileKeys.FLEXIBLE
  ].sort((a, b) => {
    const left = profiles.find(item => item.key === a);
    const right = profiles.find(item => item.key === b);
    return Number(right?.builtIn) - Number(left?.builtIn) || left?.name.localeCompare(right?.name);
  }));
  for (const profile of profiles) {
    assert.equal(profile.schemaVersion, DESTINATION_PROFILE_SCHEMA_VERSION);
    assert.equal(profile.builtIn, true);
    assert.equal(validateDestinationProfile(profile).ready, true);
  }
});

test('each role resolves its own dimensions and safe margin', () => {
  const profile = getBuiltInDestinationProfile(DestinationProfileKeys.STANDARD);
  assert.deepEqual(getDestinationOutput(profile, AssetRoles.STICKER), {
    role: AssetRoles.STICKER,
    width: 370,
    height: 320,
    safeMargin: 15,
    maxFileSizeBytes: 1000 * 1024,
    mimeType: 'image/png',
    extension: 'png'
  });
  assert.equal(getDestinationOutput(profile, AssetRoles.MAIN).width, 240);
  assert.equal(getDestinationOutput(profile, AssetRoles.TAB).height, 74);
});

test('applying a Profile updates the output role and canvas dimensions', () => {
  const profile = getBuiltInDestinationProfile(DestinationProfileKeys.BIG);
  const settings = applyDestinationProfileToSettings({ alignMode: 'bottom' }, profile, AssetRoles.STICKER);
  assert.equal(settings.destinationProfileKey, DestinationProfileKeys.BIG);
  assert.equal(settings.stickerCategory, 'big');
  assert.equal(settings.targetW, 396);
  assert.equal(settings.targetH, 660);
  assert.equal(settings.safeMargin, 20);
  assert.equal(settings.alignMode, 'bottom');
});

test('Destination package enforces Main, Tab and allowed Sticker counts', () => {
  const profile = getBuiltInDestinationProfile(DestinationProfileKeys.STANDARD);
  const invalid = buildDestinationPackagePlan([
    frame('main', AssetRoles.MAIN),
    frame('tab', AssetRoles.TAB),
    ...Array.from({ length: 7 }, (_, index) => frame(`sticker-${index + 1}`))
  ], { profile });
  assert.equal(invalid.ready, false);
  assert.ok(invalid.validation.errors.some(item => item.code === 'destination.role.allowedCount'));

  const valid = buildDestinationPackagePlan([
    frame('main', AssetRoles.MAIN),
    frame('tab', AssetRoles.TAB),
    ...Array.from({ length: 8 }, (_, index) => frame(`sticker-${index + 1}`))
  ], { profile });
  assert.equal(valid.ready, true);
  assert.deepEqual(valid.items.slice(0, 3).map(item => item.fileName), ['main.png', 'tab.png', '01.png']);
  assert.equal(valid.validation.counts.sticker, 8);
});

test('role-specific rendered dimensions and file limits are validated', () => {
  const profile = getBuiltInDestinationProfile(DestinationProfileKeys.FLEXIBLE);
  const renderedMap = new Map([
    ['main', rendered(370, 320)],
    ['sticker', rendered(370, 320)]
  ]);
  const plan = buildDestinationPackagePlan([
    frame('main', AssetRoles.MAIN),
    frame('sticker', AssetRoles.STICKER)
  ], { profile, renderedMap });
  assert.equal(plan.ready, false);
  const mismatch = plan.validation.errors.find(item => item.code === 'destination.output.size');
  assert.equal(mismatch.frameId, 'main');
  assert.equal(mismatch.role, AssetRoles.MAIN);
});

test('Fullscreen and Effect Profiles expose their special roles', () => {
  assert.ok(getDestinationRoleKeys(getBuiltInDestinationProfile(DestinationProfileKeys.FULLSCREEN)).includes(AssetRoles.BACKGROUND));
  assert.ok(getDestinationRoleKeys(getBuiltInDestinationProfile(DestinationProfileKeys.EFFECT)).includes(AssetRoles.EFFECT_BACKGROUND));
});

test('switching Profile normalizes unsupported roles and invalidates approvals', () => {
  const standard = getBuiltInDestinationProfile(DestinationProfileKeys.STANDARD);
  const normalized = normalizeFramesForDestination([
    frame('background', AssetRoles.BACKGROUND),
    frame('sticker', AssetRoles.STICKER)
  ], standard);
  assert.equal(normalized[0].state.packageRole, AssetRoles.STICKER);
  assert.equal(normalized[0].custom.outputRole, AssetRoles.STICKER);
  assert.equal(normalized[0].state.reviewApproved, false);
  assert.equal(normalized[1].state.packageRole, AssetRoles.STICKER);
});

test('custom Profile can be duplicated, registered, exported and imported', () => {
  const custom = createDestinationProfile({
    key: 'client-square',
    name: 'Client Square',
    category: 'normal',
    roles: [
      { key: 'sticker', label: 'Square Sticker', width: 512, height: 512, min: 4, max: 12, safeMargin: 24, maxFileSizeKB: 2048, sequence: 3 },
      { key: 'main', label: 'Cover', width: 1024, height: 1024, exact: 1, fileName: 'cover.png' }
    ]
  });
  const duplicate = duplicateDestinationProfile(custom, { key: 'client-square-v2', name: 'Client Square V2' });
  const registry = createDestinationProfileRegistry({ customProfiles: [custom, duplicate] });
  assert.equal(registry.has('client-square'), true);
  assert.equal(registry.has('client-square-v2'), true);
  assert.equal(registry.exportCustom().length, 2);
  assert.equal(registry.remove(DestinationProfileKeys.FLEXIBLE), false);
  assert.equal(registry.remove('client-square-v2'), true);

  const parsed = parseDestinationProfile(serializeDestinationProfile(custom));
  assert.equal(parsed.key, 'client-square');
  assert.equal(parsed.builtIn, false);
  assert.equal(parsed.roles[0].width, 512);
  assert.equal(destinationProfileSummary(parsed).roles[1].label, 'Cover');
});

test('future Destination Profile schema is rejected', () => {
  assert.throws(
    () => parseDestinationProfile(JSON.stringify({ schemaVersion: '99.0.0', key: 'future', name: 'Future', roles: [] })),
    error => error.name === 'DestinationProfileVersionError'
  );
});

test('profile validation rejects duplicate roles and invalid count ranges', () => {
  const validation = validateDestinationProfile({
    key: 'broken',
    name: 'Broken',
    version: '1.0.0',
    roles: [
      { key: 'sticker', label: 'Sticker', width: 100, height: 100, min: 10, max: 5, allowedCounts: [] },
      { key: 'sticker', label: 'Sticker 2', width: 100, height: 100, allowedCounts: [] }
    ]
  });
  assert.equal(validation.ready, false);
  assert.ok(validation.errors.some(item => item.code === 'destination.role.duplicate'));
  assert.ok(validation.errors.some(item => item.code === 'destination.role.rangeInvalid'));
});

test('destination validation reports empty packages', () => {
  const profile = getBuiltInDestinationProfile(DestinationProfileKeys.FLEXIBLE);
  const validation = validateDestinationPackage({ profile, items: [] });
  assert.equal(validation.ready, false);
  assert.ok(validation.errors.some(item => item.code === 'destination.package.empty'));
});
