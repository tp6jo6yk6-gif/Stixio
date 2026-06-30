import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AssetRoles,
  DestinationProfileKeys,
  buildDestinationPackagePlan,
  getBuiltInDestinationProfile
} from '../src/core/index.js';

function frame(id, role, selected = true) {
  return {
    id,
    state: { packageRole: role, exportSelected: selected },
    custom: { outputRole: role }
  };
}

test('profile naming preserves original role index when an earlier frame is excluded', () => {
  const identityFrames = [
    frame('main', AssetRoles.MAIN),
    frame('tab', AssetRoles.TAB),
    frame('sticker-1', AssetRoles.STICKER, false),
    frame('sticker-2', AssetRoles.STICKER)
  ];
  const selected = identityFrames.filter(item => item.state.exportSelected !== false);
  const plan = buildDestinationPackagePlan(selected, {
    profile: getBuiltInDestinationProfile(DestinationProfileKeys.FLEXIBLE),
    identityFrames
  });
  assert.deepEqual(plan.items.map(item => item.fileName), ['main.png', 'tab.png', '02.png']);
  assert.deepEqual(plan.items.map(item => item.roleIndex), [1, 1, 2]);
});

test('sequential naming preserves original global position when an earlier frame is excluded', () => {
  const identityFrames = [
    frame('a', AssetRoles.STICKER),
    frame('b', AssetRoles.STICKER, false),
    frame('c', AssetRoles.STICKER)
  ];
  const selected = identityFrames.filter(item => item.state.exportSelected !== false);
  const plan = buildDestinationPackagePlan(selected, {
    profile: getBuiltInDestinationProfile(DestinationProfileKeys.FLEXIBLE),
    namingMode: 'sequential',
    prefix: 'demo',
    identityFrames
  });
  assert.deepEqual(plan.items.map(item => item.fileName), ['demo_1.png', 'demo_3.png']);
});
