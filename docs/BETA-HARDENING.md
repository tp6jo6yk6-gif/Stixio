# Stixio Beta Hardening

## Scope

This hardening pass prepares Stixio `1.0.0-rc.1` for protected Beta testing.

### Local runtime dependencies

The Workshop no longer loads Tailwind or JSZip from a public runtime CDN.

- `npm run prepare:styles` runs the exact Tailwind CSS `3.4.17` CLI at build time and writes the compiled stylesheet to `public/vendor/tailwind-3.4.17.css`.
- `npm run prepare:vendor` downloads the exact JSZip `3.10.1` npm archive, verifies the archive and extracted browser bundle SHA-256 fingerprints, and writes it to `public/vendor/jszip-3.10.1.min.js`.
- The browser loads only the compiled local CSS and the verified local JSZip bundle. It does not run a Tailwind browser compiler.

The static build fails when:

- the compiled Tailwind stylesheet is missing or lacks required selectors
- the verified JSZip bundle is missing
- a PWA icon is missing
- the diagnostic module is missing
- a Tailwind browser runtime or known public runtime CDN URL remains in `dist/index.html`

### Cross-browser smoke coverage

`npm run test:e2e:smoke` runs the same Beta smoke suite in:

- Chromium
- Firefox
- WebKit

The suite verifies compiled local styles, the Workshop shell, JSZip, the PWA manifest and icons, unsupported image rejection, damaged `.stixio` rejection, storage recovery guidance, and anonymous diagnostics.

### Project and file safety

Before an import reaches the editor, Stixio checks:

- supported artwork MIME types
- empty files
- per-image Beta size limits
- `.stixio` archive size
- archive entry count
- unsafe archive paths
- `project.json` presence and size
- project schema and references
- required source and mask assets
- SHA-256 checksum verification

Rejected project files are not restored and the original file is never overwritten.

### Diagnostics and recovery UI

The floating **診斷** button opens a support panel with:

- Stixio version and build commit
- browser and viewport information
- online status
- local runtime feature availability
- browser storage usage and quota, when available
- the latest sanitized error summaries

Users can copy or download the diagnostic JSON. Artwork bytes, image data URLs, masks, and project contents are not included.

### PWA assets

The manifest includes an ordinary SVG icon and a maskable SVG icon. Both are local build assets and are verified by CI and the deployment workflow.

## Commands

```bash
npm run prepare:vendor
npm run prepare:styles
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e:smoke
```

## Release policy

The full `Legacy Parity Release Gate` runs cross-browser Beta smoke before the existing Layout, Refine, Review, Package, Project, Destination, Legacy parity, and stress suites. The Cloudflare Beta deployment refuses a build that contains a Tailwind browser compiler, a known runtime CDN URL, or missing hardened local assets.
