# Stixio Core Architecture v1.0

> Product principle: **Artwork stays original. Outputs are rendered.**

Stixio is designed as a sticker production platform, not a single-purpose image editor. The core architecture separates source artwork, non-destructive operations, destination rules, rendering, packaging, and storage.

## Core flow

```text
Import
  ↓
Artwork Engine
  ↓
Workflow Engine
  ↓
Operation Engine
  ↓
Rules Engine
  ↓
Render Engine
  ↓
Package Engine
  ↓
Export
```

## Engines

### Document Engine
Owns the project document lifecycle.

Responsibilities:
- Create, load, save, and migrate project documents.
- Preserve schema versioning.
- Track project metadata, destinations, operations, and asset references.
- Keep exports disposable and reproducible.

Does not own:
- Pixel rendering.
- Destination rules.
- ZIP packaging.

### Artwork Engine
Owns source artwork and derived sticker units.

Responsibilities:
- Register imported images, folders, future PSD/SVG assets, or Google Drive files.
- Split large sheets into artwork units through grid operations.
- Store metadata such as emotion, category, notes, and main/tab candidacy.

Does not own:
- Destination validation.
- Render output.

### Operation Engine
Owns non-destructive edits.

Responsibilities:
- Record edits as operations instead of overwriting pixels.
- Support operations such as grid slice, crop, mask, remove background, border, shadow, alignment, sort, and rename.
- Allow operations to be replayed per destination.

Does not own:
- Final file output.

### Workflow Engine
Owns routing.

Responsibilities:
- Decide whether imported assets need Layout, Refine, Review, Package, or can skip stages.
- Example: a single 4x4 sheet should enter Layout; 40 PNG files can skip Layout.

Does not own:
- Platform rules.

### Rules Engine
Owns destination specifications.

Responsibilities:
- Load platform rules from destination profiles.
- Define canvas size, safe area, format, file size, count limits, validation checks, and package behavior.

Does not own:
- User artwork.

### Render Engine
Owns image generation.

Responsibilities:
- Combine Artwork + Operations + Destination Rules into final image outputs.
- Render different outputs from the same artwork for LINE, Telegram, WhatsApp, Discord, or custom destinations.

Does not own:
- ZIP structure or package ordering.

### Package Engine
Owns delivery format.

Responsibilities:
- Generate destination-specific package plans.
- Support LINE `main.png`, `tab.png`, `01.png` naming, sticker order, ZIP output, and future manifest formats.
- Keep package order editable by the user.

Does not own:
- Brush tools or layout detection.

### Storage Adapter
Owns where data lives.

Responsibilities:
- Support local projects first.
- Support Google Drive BYOS later.
- Store only references when possible.

Does not own:
- Rendering or validation logic.

## V1 rule

V1 should build the core shape without replacing the current working production app until the new architecture is stable.

The old `index.html` remains usable while the new architecture is developed under `src/` and documented under `docs/`.
