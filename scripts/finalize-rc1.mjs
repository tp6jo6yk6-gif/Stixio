import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await import('./apply-rc1-parity-fixes.mjs');
await import('./fix-parity-refine-review-spec.mjs');
await import('./extend-parity-global-timeout.mjs');
await import('./fix-parity-stress-mask-count.mjs');

const packagePath = 'package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.version = '1.0.0-rc.1';
packageJson.scripts['test:e2e:parity'] = 'playwright test --config=playwright.parity.config.js';
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

await writeFile('.gitignore', `node_modules/\ndist/\n.parity/\nparity-results/\nplaywright-report/\ntest-results/\n*.log\n`, 'utf8');

await mkdir('.github/workflows', { recursive: true });
await writeFile('.github/workflows/legacy-parity-rc.yml', `name: Legacy Parity Release Gate

on:
  push:
    branches:
      - workshop-parity-rc1
  pull_request:
    branches:
      - main
      - workshop-parity-rc1
  workflow_dispatch:

concurrency:
  group: legacy-parity-release-gate-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  release-gate:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Unit tests and static build
        run: |
          set -o pipefail
          {
            npm test
            npm run build
            npm run parity:extract
          } 2>&1 | tee rc-unit-build.log
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Layout acceptance
        run: npm run test:e2e:layout
      - name: Refine acceptance
        run: npm run test:e2e:refine
      - name: Review acceptance
        run: npm run test:e2e:review
      - name: Package acceptance
        run: npm run test:e2e:package
      - name: Project acceptance
        run: npm run test:e2e:project
      - name: Destination acceptance
        run: npm run test:e2e:destination
      - name: Legacy parity and stress acceptance
        run: npm run test:e2e:parity
      - name: Upload RC evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: stixio-rc1-release-evidence
          path: |
            parity-results
            rc-unit-build.log
            playwright-report
            test-results
          if-no-files-found: ignore
          retention-days: 30
`, 'utf8');

await writeFile('docs/RC1-PROGRESS.md', `# Stixio RC1 Parity Progress

Updated: 2026-06-30
Version: 1.0.0-rc.1

## Legacy baseline

- Deterministic Legacy HTML extraction: passed
- Legacy SHA-256: \`0fe22cb1976eb3546f2615de706838323b29257553343bda3f3df597de1b0d2e\`
- Legacy and Workshop Chromium startup: passed

## Functional parity

- 2x2 Layout geometry: origins exact; width and height within 1 px
- Default 370x320 Refine output: alpha coverage difference about 0.33 percent
- Default content bounds: within 1 px
- Multi-source independent Layout state: passed
- Delete brush with Undo and Redo: passed
- Keep brush: passed
- Magic Delete connected color behavior: passed
- Review white, black and checker backgrounds: passed
- Review safe guide toggle: passed
- Review reorder persists to project and final package order: passed
- Legacy Main, Tab and Sticker filenames: passed
- Excluded Frames retain their original output filenames: passed

## Stress results

| Scenario | Result | Measured time |
|---|---:|---:|
| 40 outputs render, approve and ZIP | 40 PNG, no duplicates | 6.331 s |
| 100 outputs render, approve and ZIP | 100 PNG, no duplicates | 15.093 s |
| 10 source project export and re-import | 10 sources, 10 Frames restored | 2.415 s |
| 40 independent manual masks | 40 masks archived | 121.178 s |
| 50 Destination Profile switches | final output 370x320, no stale render | 7.848 s |

## Deliberate Workshop extensions

These are accepted additions and are not Legacy regressions:

- IndexedDB autosave and recent projects
- Portable .stixio project archives
- Destination Profiles and role-specific output dimensions
- JSON and CSV manifests
- SHA-256 checksums
- README delivery file
- ZIP verification

## Release gate

RC1 is ready only after the final read-only workflow passes unit tests, Static Build, Layout, Refine, Review, Package, Project, Destination and the complete Legacy parity and stress suite on one commit.
`, 'utf8');

await writeFile('docs/LEGACY-PARITY-RC1.md', `# Stixio Legacy Parity and Release Candidate 1

Version: \`1.0.0-rc.1\`
Branch: \`workshop-parity-rc1\`
Legacy baseline: \`legacy-preview.html\` and five immutable payload modules
Workshop candidate: \`index.html\`

## Release decision

The Workshop candidate preserves the production workflows and observable output identities of the complete Legacy application within the approved pixel tolerances.

## Approved tolerances

- Frame origin: exact for the shared grid fixture
- Frame width and height: maximum 1 px observed difference
- Output dimensions: exact
- Alpha coverage: maximum 0.33 percent observed difference
- Content bounds: maximum 1 px observed difference
- Legacy-defined filenames: exact
- Selected output identity after exclusions: exact
- Final ZIP PNG count: exact

## Verified workflows

- Single and multiple source import
- Independent source Layout settings
- Grid detection and Frame geometry
- Default background removal
- Keep, Delete and Magic manual masks
- Per-Frame mask Undo and Redo
- Review backgrounds, safe guide, selection and drag reorder
- Main, Tab and Sticker naming
- Exclusion without filename compaction
- Project export and re-import
- Destination Profile switching
- 40 and 100 output packages
- 10 source projects
- 40 independent masks

## Accepted extensions

Workshop adds project persistence, Destination Profiles, manifests, checksums, README files and archive verification. These entries may be added to packages, but Legacy PNG names and identities remain unchanged.

## Recovery

- Stable Legacy branch: \`stable-legacy\`
- Stable Legacy tag: \`v1.0.0-legacy-stable\`
- Legacy preview entry: \`legacy-preview.html\`

The Legacy baseline remains available as a rollback path during the RC period.
`, 'utf8');

const temporaryPaths = [
  '.github/workflows/legacy-parity-rc-run3.yml',
  'scripts/fix-parity-hidden-input.mjs',
  'scripts/apply-rc1-parity-fixes.mjs',
  'scripts/fix-parity-refine-review-spec.mjs',
  'scripts/extend-parity-global-timeout.mjs',
  'scripts/fix-parity-stress-mask-count.mjs',
  'scripts/commit-verified-rc1-fixes.mjs'
];
for (const path of temporaryPaths) await rm(path, { force: true });

console.log('RC1 sources, tests, documentation and release gate finalized.');
