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

## Workflow stages

The user-facing workflow uses stage names instead of numbered steps:

1. **Layout｜匯入與版面切割** — imports artwork, detects grids, creates Frames, and adjusts crop geometry. This replaces the former `Step 1` label.
2. **Refine｜細部修補** — removes backgrounds, repairs masks, feathers edges, and applies borders.
3. **Review｜預覽與檢查** — reviews rendered results, warnings, order, and export selection.
4. **Package｜角色與輸出打包** — assigns main/tab/sticker roles, applies destination naming, and exports PNG or ZIP.

These are Workflow Engine stages. Artwork, Detection, Refine, Review, Rules, Render, and Package remain engine responsibilities beneath them.

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
- Render different outputs from the same artwork for Sticker, Telegram, WhatsApp, Discord, or custom destinations.

Does not own:
- ZIP structure or package ordering.

### Package Engine
Owns delivery format.

Responsibilities:
- Generate destination-specific package plans.
- Support Sticker `main.png`, `tab.png`, `01.png` naming, sticker order, ZIP output, and future manifest formats.
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

## Current production rule

The modular Workshop architecture is now the production application.

- `main/index.html` directly starts `src/ui/stixio-workshop-app.js`.
- User-facing workflow terminology is `Layout → Refine → Review → Package`.
- Numbered `Step 1 / Step 2 / Step 3` labels are retired.
- The stable legacy recovery points remain `stable-legacy` and `v1.0.0-legacy-stable`.
