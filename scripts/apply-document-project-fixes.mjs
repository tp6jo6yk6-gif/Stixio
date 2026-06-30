import { readFile, writeFile } from 'node:fs/promises';

const controllerPath = 'src/ui/project-controller.js';
const browserTestPath = 'tests/e2e/project.spec.js';
const unitTestPath = 'tests/project-workflow.test.js';

let controller = await readFile(controllerPath, 'utf8');
controller = controller.replace(
  `    const copy = {
      ...current,
      id: createId('project'),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      document: { ...current.document, id: createId('doc'), name }
    };`,
  `    const copyId = createId('project');
    const copy = {
      ...current,
      id: copyId,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      document: { ...current.document, id: copyId, name }
    };`
);
await writeFile(controllerPath, controller, 'utf8');

let browserTest = await readFile(browserTestPath, 'utf8');
browserTest = browserTest.replace(
  `    const duplicateOpen = page.locator('[data-project-open]').nth(1);
    await duplicateOpen.click();
    await expect(page.locator('#projectNameInput')).toHaveValue(/Copy/);`,
  `    const duplicateCard = page.locator('article').filter({ hasText: 'Library Project Copy' });
    await duplicateCard.locator('[data-project-open]').click();
    await expect(page.locator('#projectNameInput')).toHaveValue('Library Project Copy');`
);
browserTest = browserTest.replace(
  `    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-project-delete]').nth(1).click();`,
  `    page.once('dialog', dialog => dialog.accept());
    await page.locator('article').filter({ hasText: 'Library Project Copy' }).locator('[data-project-delete]').click();`
);
browserTest = browserTest.replace(
  `    await expect.poll(() => dialogs.length).toBe(1);`,
  `    await expect.poll(() => dialogs.length).toBe(2);
    expect(dialogs.some(message => message.includes('尚未儲存'))).toBe(true);
    expect(dialogs.some(message => message.includes('valid .stixio'))).toBe(true);`
);
await writeFile(browserTestPath, browserTest, 'utf8');

let unitTest = await readFile(unitTestPath, 'utf8');
unitTest = unitTest.replace(
  `test('Project summary is compact and suitable for recent project cards', () => {
  const summary = projectSummary(workshopSnapshot());
  assert.deepEqual(summary, {
    id: 'doc-1',
    name: 'Project Alpha',
    createdAt: workshopSnapshot().createdAt,`,
  `test('Project summary is compact and suitable for recent project cards', () => {
  const snapshot = workshopSnapshot();
  const summary = projectSummary(snapshot);
  assert.deepEqual(summary, {
    id: 'doc-1',
    name: 'Project Alpha',
    createdAt: snapshot.createdAt,`
);
await writeFile(unitTestPath, unitTest, 'utf8');

console.log('Document and Project fixes applied.');
