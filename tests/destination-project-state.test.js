import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DestinationProfileKeys,
  createDocument,
  createWorkshopProjectSnapshot,
  migrateWorkshopProject
} from '../src/core/index.js';

test('Workshop project snapshot preserves active and custom Destination Profiles', () => {
  const document = createDocument({ id: 'destination-doc', name: 'Destination Project' });
  const destinationState = {
    activeKey: 'client-square',
    activeRole: 'sticker',
    activeVersion: '2.1.0',
    customProfiles: [{
      schemaVersion: '1.0.0',
      key: 'client-square',
      name: 'Client Square',
      version: '2.1.0',
      category: 'normal',
      builtIn: false,
      output: { mimeType: 'image/png', extension: 'png', transparency: 'required' },
      package: { folderMode: 'role', rootFolder: 'Delivery', namingVersion: 1 },
      roles: [{
        key: 'sticker',
        label: 'Square Sticker',
        width: 512,
        height: 512,
        safeMargin: 24,
        maxFileSizeBytes: 2097152,
        min: 4,
        max: 12,
        exact: null,
        required: true,
        allowedCounts: [],
        naming: { fileName: null, sequence: 3, prefix: '', suffix: '' }
      }]
    }]
  };
  const snapshot = createWorkshopProjectSnapshot({ document, destinationState });
  assert.deepEqual(snapshot.destinationState, destinationState);
  const migrated = migrateWorkshopProject(snapshot);
  assert.equal(migrated.destinationState.activeKey, 'client-square');
  assert.equal(migrated.destinationState.customProfiles[0].roles[0].width, 512);
});

test('older projects without Destination state remain compatible', () => {
  const snapshot = createWorkshopProjectSnapshot({
    document: createDocument({ id: 'legacy-destination', name: 'Legacy Destination' })
  });
  delete snapshot.destinationState;
  const migrated = migrateWorkshopProject(snapshot);
  assert.equal(migrated.destinationState, null);
  assert.equal(migrated.settings.destinationProfileKey, undefined);
});

test('built-in Profile keys remain stable for project references', () => {
  assert.equal(DestinationProfileKeys.FLEXIBLE, 'workshop-flexible');
  assert.equal(DestinationProfileKeys.STANDARD, 'messaging-standard');
  assert.equal(DestinationProfileKeys.FULLSCREEN, 'messaging-fullscreen');
});
