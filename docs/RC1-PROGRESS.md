# RC1 Parity Progress

Updated: 2026-07-01

## Release state

- Version: `1.0.0-rc.1`
- Source branch: `main`
- Legacy parity: **16 / 16 passed**
- Status: approved for protected Beta deployment

## Passed

- Legacy payload extraction and SHA-256 fingerprint
- Legacy and Workshop Chromium startup
- Layout geometry within the approved browser-rendering tolerance
- Refine output within the approved anti-alias tolerance
- Package names and excluded Frame identities
- Delete, Keep, Magic, Undo, and Redo
- Review backgrounds, guide, selection, exclusion, and reorder
- Multiple-source Layout state and project restore
- Destination Profile switching and persistence
- 40-output and 100-output package stress tests
- Ten-source project export and restore
- 40 independent masks without leakage
- 50 repeated Destination Profile switches
- ZIP entry count, order, identity, and duplicate checks

## Release workflow

The read-only `Legacy Parity Release Gate` now runs for pull requests to `main`, pushes to `main`, version tags matching `v*`, and manual dispatch. Release evidence is retained as a GitHub Actions artifact.

## Remaining RC activities

- Verify the final `main` commit through the post-merge Release Gate
- Create `v1.0.0-rc.1` after the Gate is green
- Deploy the protected Beta build
- Complete real-user smoke testing before promotion to `1.0.0`
