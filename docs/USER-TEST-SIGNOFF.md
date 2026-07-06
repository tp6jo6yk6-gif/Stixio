# Stixio 1.0.0 Real-user Test Sign-off

Release decision: **BLOCKED**

This file is the human approval gate for Stixio 1.0.0. Automated checks cannot replace this sign-off. Do not mark the release PR ready, merge it, create tag `v1.0.0`, or publish a GitHub Release until every required row is complete and the release owner changes the decision to **APPROVED**.

## Required testers

Record at least three real users who are not the primary implementer:

| Tester | Environment | Typical workload | Date | Result | Evidence / issue |
|---|---|---|---|---|---|
| Weizhe | Chromium on Windows | Small project, 1-10 images | 2026-07-06 17:29 Asia/Taipei | Reported pass; release-owner evidence review still required | User-reported Beta evidence supplied in ChatGPT; see detailed record WCH-20260706 below. |
| JOE | Firefox on Windows or macOS | Medium project, 10-40 outputs | 2026-07-06 17:29 Asia/Taipei | Reported pass; release-owner evidence review still required | User-reported Beta evidence supplied in ChatGPT; see detailed record FFX-20260706 below. |
| Weizhe / JOE | Safari/WebKit on macOS | Project restore and package export | 2026-07-06 17:29 Asia/Taipei | Reported pass; release-owner evidence review still required | User-reported Beta evidence supplied in ChatGPT; see detailed record WK-20260706 below. |

## Detailed real-user test records

These records intentionally preserve the distinction between user-reported Beta evidence and final release approval. They do not make the release approvable until the release owner confirms the evidence is sufficient, the missing independent tester requirement is resolved, branch protection is verified, and rollback rehearsal is green.

### WCH-20260706 — Chromium on Windows, small project

| Scenario | Result | Evidence note |
|---|---|---|
| Ready state without blank screen | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Import PNG / JPEG / WebP artwork | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Detect and edit frames, including resize and reorder | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Refine tools and independent mask preservation | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Review approval and export selection changes | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Destination Profile switching and dimensions / roles | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| ZIP export filenames and image dimensions | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| `.stixio` export / restore and state preservation | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Unsupported or damaged project recovery | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Diagnostics JSON excludes artwork / project content | Reported pass | User-reported Beta evidence supplied in ChatGPT. |

### FFX-20260706 — Firefox on Windows or macOS, medium project

| Scenario | Result | Evidence note |
|---|---|---|
| Ready state without blank screen | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Import PNG / JPEG / WebP artwork | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Detect and edit frames, including resize and reorder | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Refine tools and independent mask preservation | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Review approval and export selection changes | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Destination Profile switching and dimensions / roles | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| ZIP export filenames and image dimensions | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| `.stixio` export / restore and state preservation | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Unsupported or damaged project recovery | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Diagnostics JSON excludes artwork / project content | Reported pass | User-reported Beta evidence supplied in ChatGPT. |

### WK-20260706 — Safari / WebKit on macOS, project restore and package export

| Scenario | Result | Evidence note |
|---|---|---|
| Ready state without blank screen | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Import PNG / JPEG / WebP artwork | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Detect and edit frames, including resize and reorder | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Refine tools and independent mask preservation | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Review approval and export selection changes | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Destination Profile switching and dimensions / roles | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| ZIP export filenames and image dimensions | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| `.stixio` export / restore and state preservation | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Unsupported or damaged project recovery | Reported pass | User-reported Beta evidence supplied in ChatGPT. |
| Diagnostics JSON excludes artwork / project content | Reported pass | User-reported Beta evidence supplied in ChatGPT. |

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

- Open blocker issues: Pending release-owner review of user-reported evidence and parity-stress follow-up PR #23
- Open high-severity issues: Pending release-owner review of user-reported evidence
- Medium-risk acceptance: Pending
- Rollback rehearsal: Pending
- Branch protection verified: User-reported confirmation by Weizhe / JOE on 2026-07-06 17:30 Asia/Taipei; config file verified in `.github/branch-protection-main.json`
- Missing evidence: The sign-off file still names only two evidence holders. Do not approve until the release owner either adds a third independent tester record or explicitly changes the release requirement in a reviewed commit.
- Release owner: JOE
- Approval date: Pending
- Decision: **BLOCKED**

To approve, replace the final decision with **APPROVED** in a reviewed commit and link the completed test evidence in the release PR.