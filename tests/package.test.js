import test from 'node:test';
import assert from 'node:assert/strict';
import { createPackagePlan, PackageRoles, setArtworkPackageRole } from '../src/core/package.js';

const rules = {
  key: 'line',
  name: 'LINE Stickers',
  version: '1.0.0',
  canvas: { width: 370, height: 320 },
  package: {
    naming: 'line-sticker',
    requiresMain: true,
    requiresTab: true,
    minStickers: 1,
    extension: 'png'
  }
};

test('package role plan creates main tab and sticker filenames', () => {
  const artworks = [
    setArtworkPackageRole({ id: 'a' }, PackageRoles.MAIN),
    setArtworkPackageRole({ id: 'b' }, PackageRoles.TAB),
    setArtworkPackageRole({ id: 'c' }, PackageRoles.STICKER),
    setArtworkPackageRole({ id: 'd' }, PackageRoles.STICKER)
  ];

  const plan = createPackagePlan({ destinationKey: 'line', artworks, rules });
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.items.map(item => item.fileName), ['main.png', 'tab.png', '01.png', '02.png']);
});

test('package role validation blocks duplicate main role', () => {
  const artworks = [
    setArtworkPackageRole({ id: 'a' }, PackageRoles.MAIN),
    setArtworkPackageRole({ id: 'b' }, PackageRoles.MAIN),
    setArtworkPackageRole({ id: 'c' }, PackageRoles.TAB),
    setArtworkPackageRole({ id: 'd' }, PackageRoles.STICKER)
  ];

  const plan = createPackagePlan({ destinationKey: 'line', artworks, rules });
  assert.equal(plan.ready, false);
  assert.equal(plan.validation.errors.some(issue => issue.code === 'package.main.count'), true);
});
