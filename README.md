# Stixio

**Create once. Adapt everywhere.**

Stixio is a fast sticker production workspace for creators. It helps you import artwork sheets, detect sticker frames, refine artwork, review output, and export sticker packs.

## Core workflow

```text
Import
  ↓
Layout
  ↓
Refine
  ↓
Review
  ↓
Package
  ↓
Export
```

## Current capabilities

- Multi-image artwork import
- Per-source Layout settings
- Grid and smart detection
- Frame-based render pipeline
- Background cleanup and mask tools
- Custom canvas, safe area, alignment, and output offsets
- Large Review preview and file-size warnings
- Platform-neutral package roles and naming
- PNG and ZIP export
- Wheel zoom, pan, keyboard shortcuts, workspace reset, and dark mode

## Clickable local preview

The local preview page embeds the real Stixio Workshop and adds:

- A browser-generated 2×2 demo artwork sheet
- One-click demo import
- Clickable smoke tests
- A persistent manual acceptance checklist
- Direct access to every real Workshop control

Run from the repository root:

```bash
npm install
npm run preview:local
```

Open:

```text
http://localhost:4173/local-preview.html
```

To verify the built `dist` output instead:

```bash
npm run preview:build
```

The same URL is available from the build server:

```text
http://localhost:4173/local-preview.html
```

Do not open the HTML file directly with `file://`; Stixio uses browser ES modules and requires a local HTTP server.

## Other development commands

```bash
npm run dev
npm run test
npm run build
npm run preview
```

## Deferred until after M1

- Google Drive sync
- Login
- Billing
- Cloud workspace
- AI Detect
- Collaboration

## Cloudflare Pages

Recommended Beta deployment:

```text
Project name: stixio-beta
Build command: npm run build
Build output: dist
Custom domain: beta.stixio.app
```

Beta should remain noindex and may be protected with Cloudflare Access.

## Version

Current version: `0.9.0-beta`
