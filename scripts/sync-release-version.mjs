import { readFile, writeFile } from 'node:fs/promises';

const releaseVersion = '1.0.0';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
packageJson.version = releaseVersion;
await writeFile('package.json', JSON.stringify(packageJson, null, 2) + '\n');

const packageLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
packageLock.version = releaseVersion;
if (packageLock.packages && packageLock.packages['']) {
  packageLock.packages[''].version = releaseVersion;
}
await writeFile('package-lock.json', JSON.stringify(packageLock, null, 2) + '\n');

await updateText('src/ui/beta-hardening.js', "version: '1.0.0-rc.1'", "version: '1.0.0'");
await updateText('src/core/project-workflow.js', "generatorVersion: '0.9.0-beta'", "generatorVersion: '1.0.0'");

console.log('Stixio release version synchronized to 1.0.0.');

async function updateText(path, before, after) {
  const source = await readFile(path, 'utf8');
  await writeFile(path, source.split(before).join(after));
}
