# Architecture Docs

This folder tracks the Stickio architecture migration.

## Documents

- [ARCHITECTURE_V1.md](./ARCHITECTURE_V1.md)

## Current migration rule

The current production app remains in the root `index.html`.

The new architecture is developed separately under:

```text
src/core/
src/destinations/
docs/architecture/
```

This lets us build the new engine layer without breaking the working Sticker sticker tool.

## First architecture milestone

- Document Engine skeleton
- Artwork data model
- Operation Engine skeleton
- Rules Engine skeleton
- Package Engine skeleton
- Sticker Package destination rules

Next milestone:

- Add Render Engine skeleton
- Add Storage Adapter interface
- Add basic validation helpers
- Add unit-test-ready examples
