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
| Detection Engine | 55% | UI now calls `detectFrames()` for grid detection. AI detect reserved. |
| Frame Engine | 70% | New `src/core/frame/` module is active in UI. Legacy `crop/` remains temporarily for compatibility. |
| Command Engine | 35% | Generic command and shared history added. Needs concrete command factories. |
| Refine Engine | 35% | Background removal exists. White border, shadow, brush still pending. |
| Render Engine | 50% | UI renders from Frames. Needs dedicated frame render pipeline module. |
| Review Engine | 30% | Review board displays Frames. Needs validation aggregation and review session integration. |
| Package Engine | 45% | LINE naming and package plan helpers exist. More destinations pending. |
| Export Engine | 35% | Export job model added. Needs PNG/ZIP execution integration. |
| Workspace Engine | 55% | Workspace schema, collections, storage adapter, libraries exist. Google Drive pending. |
| Feature Engine | 50% | Developer mode opens all features. Production plan restrictions pending. |

## Cleanup status

1. ✅ Add `frame/` module.
2. ✅ Detection Engine outputs Frame objects.
3. ✅ Connect UI to Detection Engine instead of direct `calculateGridBoxes()` calls.
4. ✅ UI preview and export now read from Frames.
5. ⚠️ Legacy `crop/` still exists for beta compatibility.
6. ⏳ Make Document the session source of truth.
7. ⏳ Use Command Engine for frame edits.
8. ⏳ Move ZIP logic from UI into Export Engine.
