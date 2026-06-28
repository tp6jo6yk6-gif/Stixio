# Stixio Product Constitution

## Product identity

Stixio is a sticker production workspace.

It is not only a crop tool. It is a workflow for turning artwork into finished sticker packs.

## M1 principle

Core Editor comes first.

M1 must work without:

- Login
- Billing
- Google Drive
- Cloud sync
- AI Detect
- Collaboration

## M1 required workflow

```text
Import → Detect → Refine → Review → Package → Export
```

## Development principles

1. UI must not directly own core business logic.
2. Detection creates Frames.
3. Frame is the single source of truth for sticker areas.
4. Render Engine owns final canvas output.
5. Refine effects must be reusable by Preview, PNG, and ZIP export.
6. Export must not mutate source images or frames.
7. Brand information must come from `src/core/brand.js`.
8. Any migration must preserve or improve user-facing capability.
9. New features should answer: does this help users finish a sticker pack faster?

## Deferred after M1

- Creator Workspace
- Local project persistence
- Google Drive sync
- Login
- Billing
- AI Detect
- Cloud collaboration

## Version target

Current target: `0.9.0-beta`

M1 release target: `1.0.0`
