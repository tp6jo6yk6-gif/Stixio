# Stixio 1.0.0 Real-user Test Sign-off

Release decision: **BLOCKED**

This file is the human approval gate for Stixio 1.0.0. Automated checks cannot replace this sign-off. Do not mark the release PR ready, merge it, create tag `v1.0.0`, or publish a GitHub Release until every required row is complete and the release owner changes the decision to **APPROVED**.

## Required testers

Record at least three real users who are not the primary implementer:

| Tester | Environment | Typical workload | Date | Result | Evidence / issue |
|---|---|---|---|---|---|
| Pending | Chromium on Windows | Small project, 1–10 images | | | |
| Pending | Firefox on Windows or macOS | Medium project, 10–40 outputs | | | |
| Pending | Safari/WebKit on macOS | Project restore and package export | | | |

## Required scenarios

Each tester should complete the scenarios relevant to their environment.

- Open the Workshop and confirm it reaches the ready state without a blank screen.
- Import PNG, JPEG, and WebP artwork.
- Detect and edit frames, including resize and reorder.
- Use Refine tools and preserve at least one independent mask.
- Review artwork and change approval/export selection.
- Switch Destination Profiles and verify dimensions and roles.
- Export a ZIP and inspect filenames and image dimensions.
- Export a `.stixio` project, close the app, reopen it, and restore the project.
- Confirm source count, frame count, ordering, masks, roles, approvals, and Destination settings after restore.
- Trigger one safe failure case, such as an unsupported image or damaged project, and verify the recovery message.
- Open the diagnostics panel and verify no artwork or project content appears in the downloaded JSON.

## Severity policy

- **Release blocker:** data loss, project corruption, security/privacy exposure, app cannot start, export is unusable, or rollback fails.
- **High:** common workflow cannot complete without a workaround.
- **Medium:** workflow completes with a confusing or slow workaround.
- **Low:** cosmetic or wording issue that does not affect saved or exported results.

All blocker and high-severity issues must be fixed and retested before approval. Medium issues require an explicit release-owner decision. Low issues may be deferred with a linked issue.

## Final approval

- Open blocker issues: Pending
- Open high-severity issues: Pending
- Medium-risk acceptance: Pending
- Rollback rehearsal: Pending
- Branch protection verified: Pending
- Release owner: Pending
- Approval date: Pending
- Decision: **BLOCKED**

To approve, replace the final decision with **APPROVED** in a reviewed commit and link the completed test evidence in the release PR.
