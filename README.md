# Stixio

**Create once. Adapt everywhere.**

Stixio is a fast sticker production workspace for creators. It helps you import artwork sheets, detect sticker frames, refine artwork, review output, and export sticker packs.

## M1 Focus: Core Editor

M1 is focused on making the editor complete before adding cloud, login, billing, or AI features.

### Core workflow

```text
Import
  ↓
Detect
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

- Import artwork sheets
- Grid Detect v2 with quality scoring
- Frame-based render pipeline
- Background cleanup controls
- Trim Transparent
- White Border
- Shadow
- PNG export
- ZIP export
- Sticker-style naming helpers

## Deferred until after M1

- Google Drive sync
- Login
- Billing
- Cloud workspace
- AI Detect
- Collaboration

## Development

This project is currently a static web app using browser modules.

```bash
npm run dev
npm run build
npm run preview
```

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
