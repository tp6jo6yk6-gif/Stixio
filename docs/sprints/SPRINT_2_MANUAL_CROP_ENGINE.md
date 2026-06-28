# Sprint 2 — Manual Crop Engine

## Goal

Build the platform-neutral core for manual crop before UI interaction is added.

Manual Crop is the foundation for:

- Correcting AI sheet detection mistakes
- Manual region adjustment
- Review board updates
- Render consistency
- Package output order
- Future auto-detect, brush repair, borders, shadows, and safe-area checks

## Added modules

```text
src/core/crop/
├── region.js
├── crop-engine.js
├── crop-selection.js
├── crop-snap.js
├── crop-validator.js
├── crop-history.js
└── index.js
```

## Data model

A crop region is platform-neutral. It does not know Sticker, Telegram, WhatsApp, or final file names.

```js
{
  id,
  name,
  bounds: { x, y, width, height },
  rotation,
  transform,
  locked,
  visible,
  selected,
  metadata
}
```

## Supported core operations

- Create region
- Clone region
- Convert grid box to region
- Convert region to artwork slice
- Move region
- Resize region
- Rotate region
- Duplicate region
- Delete region
- Merge regions
- Split region
- Select / multi-select
- Select next / previous
- Snap to canvas or region guides
- Validate bounds
- Clamp to canvas
- Undo / redo history

## Not included yet

- Drag handles UI
- Pointer interaction
- Keyboard shortcuts
- Region list UI
- Properties panel
- Integration into `stixio-app.js`

## Next step

Connect `calculateGridBoxes()` output to crop regions, then use regions as the source for artwork slices in UI.
