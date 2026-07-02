# Stixio 1.0.0 Rollback Plan

## Objective

Restore the last verified release candidate within one deployment cycle without modifying or deleting user project data.

## Rollback trigger

Rollback immediately when any of the following is confirmed after deployment:

- Workshop cannot reach `data-stixio-ready=true` in a supported browser.
- Project restore corrupts or loses sources, frames, masks, roles, approvals, or Destination settings.
- Package export creates missing, invalid, or incorrectly named assets.
- A security or privacy issue exposes project content in diagnostics.
- Error rate or user-blocking failures exceed the release owner’s accepted threshold.

## Protected rollback target

Before publishing 1.0.0, record the exact last-green commit SHA and deployment identifier in the release evidence artifact. The expected initial rollback target is the final verified RC1 commit, not an arbitrary branch head.

## Deployment rollback procedure

1. Freeze new production deployments.
2. Announce that Stixio is temporarily returning to the last verified build.
3. Preserve the failing deployment URL, commit SHA, diagnostics, and browser information.
4. Redeploy the recorded last-green artifact or commit to the production environment.
5. Do not clear IndexedDB, local storage, caches, or user project data as part of deployment rollback.
6. Open the restored application in Chromium, Firefox, and WebKit.
7. Import the rollback rehearsal fixture and verify source count, frame count, masks, package plan, and export.
8. Confirm production health before reopening deployments.
9. Create a follow-up incident issue with the failing release SHA and evidence.

## Data compatibility rule

The rollback build must never silently overwrite a project created by a newer unsupported schema. It must reject future project schema versions with a clear recovery message. Users should retain both the original `.stixio` file and any newer export.

## Automated rehearsal

The release workflow performs a reversible deployment simulation:

1. Build the current 1.0.0 candidate.
2. Save its `dist` fingerprint.
3. Build the recorded RC rollback reference.
4. Verify that the rollback build starts and passes a browser smoke check.
5. Restore the 1.0.0 candidate build.
6. Verify that its fingerprint matches the original candidate fingerprint.

The rehearsal is evidence only; it does not change the production deployment.

## Manual rehearsal record

- Candidate SHA:
- Rollback SHA:
- Candidate artifact digest:
- Rollback artifact digest:
- Rehearsal operator:
- Rehearsal date:
- Chromium result:
- Firefox result:
- WebKit result:
- Project restore result:
- Package export result:
- Candidate restoration fingerprint match:
- Approval:

## Abort conditions

Do not publish 1.0.0 if the rollback reference cannot be reproduced, the candidate cannot be restored byte-for-byte after rehearsal, or the rollback build cannot safely reject newer project schemas.
