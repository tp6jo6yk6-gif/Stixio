import test from 'node:test';
import assert from 'node:assert/strict';

test('Workshop UI module resolves every Core import', async () => {
  const module = await import('../src/ui/stixio-workshop-app-v2.js');
  assert.equal(typeof module.initStixioWorkshop, 'function');
});
