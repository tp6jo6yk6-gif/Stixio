# Stixio 1.0.0 Release Notes

Release status: **Prepared, not published**

Stixio 1.0.0 is the first production-ready release of the Workshop. Publication remains blocked until real-user Beta sign-off, all required checks, branch protection, and rollback rehearsal are complete.

## Highlights

- Complete Layout, Refine, Review, Package, Project, and Destination workflows.
- Legacy parity and stress coverage for 40 and 100 outputs, multi-source re-import, independent masks, reordering, and Destination Profile switching.
- Local compiled Tailwind CSS and verified local JSZip; no public runtime CDN dependency.
- Single production browser bundle instead of a large runtime ES-module request graph.
- Chromium, Firefox, and WebKit release smoke tests.
- Project archive validation, unsafe-path rejection, checksum verification, and damaged-project recovery guidance.
- User-facing error banners and downloadable sanitized diagnostics.
- Installable PWA manifest with ordinary and maskable Stixio icons.

## Reliability and safety

- Unsupported or empty artwork is rejected before it enters the editor.
- Oversized, malformed, unsafe, or checksum-invalid `.stixio` archives are blocked before restoration.
- Storage pressure, missing runtime assets, image decode failures, memory pressure, offline state, cancellation, and unexpected failures receive distinct recovery guidance.
- Diagnostic exports do not contain artwork bytes, image data URLs, masks, or project contents.

## Compatibility

The release gate tests current Playwright Chromium, Firefox, and WebKit engines on Ubuntu CI. Real-user Beta testing must additionally cover the supported desktop operating systems and representative project sizes listed in `docs/USER-TEST-SIGNOFF.md`.

## Known release constraints

- Stixio 1.0.0 is a browser application and available memory varies by browser and device.
- Large source images should be imported in batches when the browser reports memory pressure.
- A `.stixio` backup should be exported before clearing browser site data.
- Final publication is intentionally blocked until the real-user sign-off file records approval.

## Upgrade from RC1

1. Export an RC1 `.stixio` backup.
2. Open Stixio 1.0.0.
3. Import the backup.
4. Verify source count, frame count, masks, roles, approvals, Destination Profile, and package filenames.
5. Export a new 1.0.0 backup before continuing production work.

## Rollback

Follow `docs/ROLLBACK-1.0.0.md`. The release must not be published unless the automated rollback rehearsal and the manual checklist both pass.
