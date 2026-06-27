# Main Extraction Map

This document maps the current root `index.html` features into the new Stickio architecture.

## Current production file

- `index.html` remains the production app.
- It currently contains HTML, CSS, state, DOM events, canvas logic, grid logic, background removal, brush repair, preview, and ZIP export in one file.

## Extraction priority

### Phase 1 — Pure logic extraction
Low risk. These modules should not depend on DOM.

| Current feature | Current area | Target module | Target engine |
|---|---|---|---|
| Sticker filename generation | `getStickerFilename()` | `src/core/file-naming.js` | Package Engine |
| LINE package order | `downloadAllAsZip()` naming logic | `src/core/package.js` + `src/core/file-naming.js` | Package Engine |
| Grid rows / cols / margins / gaps | `recalculateSourceGrid()` / `applyGridChange()` | `src/core/grid.js` | Artwork + Operation Engine |
| Sticker placement | repeated scale / pX / pY logic | `src/core/render.js` | Render Engine |
| Safe area math | `updateStep3Guide()` and preview | `src/core/validation.js` | Rules Engine |
| Canvas size presets | `stickerCategories` | `src/destinations/*.json` | Rules Engine |

### Phase 2 — Canvas processing extraction
Medium risk. These depend on Canvas APIs but should still avoid DOM.

| Current feature | Target module | Target engine |
|---|---|---|
| Chroma key background removal | `src/core/image-processing.js` | Operation + Render Engine |
| Feather / shrink mask handling | `src/core/image-processing.js` | Operation + Render Engine |
| Border generation | `src/core/render.js` | Render Engine |
| Final sticker canvas generation | `src/core/render.js` | Render Engine |

### Phase 3 — UI adapter extraction
Higher risk. These still depend on DOM.

| Current feature | Target module | Layer |
|---|---|---|
| Step switching | `src/ui/tabs.js` | UI Adapter |
| File input / drag-drop | `src/ui/import-controller.js` | UI Adapter |
| Source thumbnails | `src/ui/source-thumbnails.js` | UI Adapter |
| Sticker thumbnails | `src/ui/sticker-thumbnails.js` | UI Adapter |
| Step 2 brush UI | `src/ui/brush-controller.js` | UI Adapter |
| Step 3 preview UI | `src/ui/review-controller.js` | UI Adapter |

## Refactor rule

Do not remove existing inline functions until the replacement module has been tested.

Recommended order:

1. Create pure modules.
2. Add adapter calls from `index.html`.
3. Keep old functions as fallbacks temporarily.
4. Remove duplicated inline code only after matching behavior.

## Product rule

Artwork stays original. Outputs are rendered from:

```text
Artwork + Operations + Destination Rules → Rendered Output → Package
```
