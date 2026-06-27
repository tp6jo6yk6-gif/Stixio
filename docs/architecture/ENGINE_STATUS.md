# Stixio Engine Status

## Current rule

During development, all features are open. Plan restrictions will be added later through the Feature Engine.

## Engine map

```text
Workspace
  ↓
Collection
  ↓
Document
  ↓
Source Image
  ↓
Detection Engine
  ↓
Frame Engine
  ↓
Command / History Engine
  ↓
Refine Engine
  ↓
Render Engine
  ↓
Review Engine
  ↓
Package Engine
  ↓
Export Engine
```

## Engine completion

| Engine | Status | Notes |
|---|---:|---|
| Image Engine | 70% | Import and image processing exist; orientation and metadata still need polish. |
| Document Engine | 35% | Document and Source Image model added. Needs UI/session integration. |
| Detection Engine | 30% | Grid detection now has standard `detectFrames()` entry. AI detect reserved. |
| Frame Engine | 45% | Frame model currently lives under `crop/`; rename to `frame/` still needed. |
| Command Engine | 35% | Generic command and shared history added. Needs concrete command factories. |
| Refine Engine | 35% | Background removal exists. White border, shadow, brush still pending. |
| Render Engine | 45% | Placement and canvas render helpers exist. Needs full frame-based render pipeline. |
| Review Engine | 25% | Review session model added. Needs validation aggregation and UI integration. |
| Package Engine | 45% | LINE naming and package plan helpers exist. More destinations pending. |
| Export Engine | 35% | Export job model added. Needs PNG/ZIP execution integration. |
| Workspace Engine | 55% | Workspace schema, collections, storage adapter, libraries exist. Google Drive pending. |
| Feature Engine | 50% | Developer mode opens all features. Production plan restrictions pending. |

## Next architectural cleanup

1. Rename internal `crop/` module to `frame/`.
2. Connect Detection Engine to UI instead of direct `calculateGridBoxes()` calls.
3. Make Document the session source of truth.
4. Use Command Engine for frame edits.
5. Move ZIP logic from UI into Export Engine.
