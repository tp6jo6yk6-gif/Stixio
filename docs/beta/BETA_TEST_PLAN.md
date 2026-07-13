# Stixio Beta Test Plan

## Beta Goal

Validate that Stixio 1.0.0 can complete one clear production workflow without native Workspace, tab automation, accounts, cloud sync, or placeholder page modes.

## Release-Candidate Scope

### In Scope

- Load Stixio from a build deployed from `release/1.0.0`.
- Import PNG, JPEG, WebP, and SVG artwork.
- Create frames in Layout using grid or smart detection.
- Adjust frames before moving on.
- Refine selected frames with background cleanup and mask tools.
- Review selected outputs, inspect warnings/errors, and approve clean frames.
- Assign output roles and package names.
- Export PNG/ZIP and `.stixio` project files.
- Reopen a `.stixio` project and confirm sources, frames, masks, roles, approvals, and Destination settings survive restore.
- Confirm unsupported image or damaged project recovery guidance appears.
- Confirm diagnostics do not include artwork or project contents.

### Out Of Scope

- Native Workspace tabs or hidden-column modes.
- Cloud workspace.
- Google Drive sync.
- Login/accounts.
- Billing.
- AI Detect.
- Collaboration.
- Broad architecture refactors.

## Test Environment

- Source branch: `release/1.0.0`
- Build command: `npm run build`
- Build output: `dist`
- Browsers: Chromium, Firefox, and Safari/WebKit where available
- Devices: desktop first, tablet/mobile second

## Test Cases

### T01 Page Load

1. Open the deployed release-candidate URL.
2. Confirm the Stixio Workshop app loads without a blank screen.
3. Confirm the UI presents one core flow: Layout, Refine, Review, Package.

Expected:

- No runtime CDN dependency is required.
- No native Workspace/tab automation path appears as an active release path.
- No hidden-column or alternate workspace controls are shown as required actions.

### T02 Import And Frame Creation

1. Import one or more supported image files.
2. Use grid or smart detection.
3. Adjust at least one frame.

Expected:

- Frames appear and remain selectable.
- Per-source Layout settings persist while switching sources.
- Undo/Redo remains stable.

### T03 Refine

1. Select a frame.
2. Use background cleanup controls.
3. Add keep/delete mask edits.
4. Apply or rerender the result.

Expected:

- Manual mask edits affect only the intended frame.
- Refine output remains responsive and visible.
- Undo/Redo works for mask edits.

### T04 Review And Approval

1. Open Review after frames exist.
2. Check large preview, warnings, errors, safe guide, and content bounds.
3. Approve clean selected outputs.
4. Exclude at least one output and re-include it.

Expected:

- Review clearly reports blocking issues.
- Clean selected outputs can be approved.
- Package remains blocked until Review passes.

### T05 Package And Export

1. Assign roles such as Sticker, Main, and Tab where applicable.
2. Export ZIP.
3. Verify filenames and dimensions.
4. Export a `.stixio` project.

Expected:

- ZIP names match the active Destination Profile.
- Main/Tab role rules are enforced.
- Export does not include unselected frames.

### T06 Project Restore

1. Close or reset the workspace.
2. Reopen the exported `.stixio` project.
3. Compare source list, frame order, masks, roles, approvals, and Destination settings.

Expected:

- Project state is restored without data loss.
- Unsupported or damaged project files show recovery guidance instead of a blank screen.

## Pass Criteria

Beta sign-off can proceed only when:

- The release-candidate build is deployed from `release/1.0.0`.
- The core workflow completes without confusing native Workspace/tab detours.
- No high-severity blocker remains open.
- Medium risks are either fixed or explicitly accepted.
- Results are recorded in `docs/USER-TEST-SIGNOFF.md`.
