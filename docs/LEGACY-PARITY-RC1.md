# Stixio Legacy Parity & Release Candidate 1

- Release branch: `main`
- Version: `1.0.0-rc.1`
- Legacy baseline: `legacy-preview.html` + `src/legacy/payload-1.js` … `payload-5.js`
- Workshop candidate: `index.html`
- Status: Release Candidate accepted
- Completed: 2026-06-30

## Objective

Verify that Stixio Workshop can replace the complete Legacy application without deleting or weakening production workflows. Equivalent workflows must preserve observable dimensions, frame identity, package names, archive entries, editable project state, and accepted pixel geometry.

## Final result

The complete Legacy parity suite passed **16 of 16 tests**. Unit tests, static build, Legacy fingerprinting, Layout, Refine, Review, Package, Project, Destination Profiles, and stress acceptance all passed on the RC source commit.

## Evidence rules

1. Both applications run in Chromium from the same repository commit.
2. Legacy HTML is reconstructed from the five immutable payload modules and fingerprinted with SHA-256.
3. The same fixtures and target outputs are used for both applications.
4. Final PNG pixels, dimensions, file names, project state, and ZIP entries are inspected; successful clicks alone are not accepted as evidence.
5. Every corrected parity gap has regression coverage.
6. Release evidence is uploaded by the read-only `Legacy Parity Release Gate` workflow.

## Functional parity matrix

| Workflow | Verified behavior | Status |
|---|---|---|
| Import | Single and multiple image import, source order, source switching | ✅ Equivalent |
| Layout | Preset grid, per-source settings, geometry persistence, reorder | ✅ Equivalent |
| Refine | Background removal, Keep, Delete, Magic, Undo, Redo | ✅ Equivalent |
| Review | Large preview, backgrounds, safe guide, exclusion, drag reorder | ✅ Equivalent |
| Package | Main, Tab, Sticker identity, PNG and verified ZIP | ✅ Equivalent |
| Project | Multi-source project export and editable restore | ✅ Equivalent plus extension |
| Destination | Versioned profiles, dimensions, counts, limits, naming rules | ✅ Equivalent plus extension |
| Keyboard and navigation | Required editing and workspace interactions | ✅ Equivalent |

## Accepted comparison rules

| Measurement | RC1 acceptance rule |
|---|---|
| PNG width and height | Exact match for equivalent roles |
| File names | Exact match where Legacy defines identity |
| ZIP entry count | Exact match |
| ZIP entry order | Exact match where Legacy order is observable |
| Alpha mask | Exact match or documented algorithmic improvement |
| RGB pixels | Exact outside approved anti-alias tolerance |
| Frame geometry | Within the approved 1 px browser-rendering tolerance |
| Safe margin | Exact match |
| Package gate | Must not allow a package Legacy would reject unless documented |

## Stress and recovery results

| Check | Result |
|---|---|
| 40-output workflow and ZIP | ✅ Passed |
| 100-output workflow and ZIP | ✅ Passed |
| Ten source images with independent Layout state | ✅ Passed |
| Ten-source project export and restore | ✅ Passed |
| 40 independent masks without leakage | ✅ Passed |
| 50 Destination Profile switches | ✅ Passed |
| Exclusion and reorder filename identity | ✅ Passed |
| No missing or duplicate ZIP entries | ✅ Passed |

## Release gate

`.github/workflows/legacy-parity-release.yml` runs on:

- pull requests targeting `main`
- pushes to `main`
- version tags matching `v*`
- manual dispatch

The gate performs:

1. `npm ci`
2. unit tests
3. static build
4. Legacy extraction and SHA-256 fingerprint
5. Chromium installation
6. Layout acceptance
7. Refine acceptance
8. Review acceptance
9. Package acceptance
10. Project acceptance
11. Destination acceptance
12. complete Legacy parity and stress acceptance
13. release evidence upload

## Recovery

- Stable Legacy branch: `stable-legacy`
- Stable Legacy tag: `v1.0.0-legacy-stable`
- Legacy preview: `legacy-preview.html`

If an RC-blocking regression is discovered, keep user project files intact, restore the public entry point to the stable Legacy build, fix the issue on a hotfix branch, and require the full Release Gate before redeployment.

## RC1 release decision

RC1 is approved for protected Beta deployment. It must remain a pre-release until post-merge Gate verification and real-user smoke testing are complete. Promotion to `1.0.0` requires a separate release decision.
