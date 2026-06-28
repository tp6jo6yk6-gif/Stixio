# Stixio Engine Status

## Current rule

During development, all features are open. Plan restrictions will be added later through the Feature Engine.

## M1 rule

Core Editor comes first. Google Drive, login, billing, cloud sync, and AI are after M1.

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
| Detection Engine | 72% | Grid Detect v2 has clamp, pixel snap, presets, and quality report. |
| Frame Engine | 70% | New `src/core/frame/` module is active in UI. Legacy `crop/` remains temporarily for compatibility. |
| Command Engine | 35% | Generic command and shared history added. Needs concrete command factories. |
| Refine Engine | 62% | Background removal, Trim Transparent, White Border, and Shadow exist. Brush still pending. |
| Render Engine | 75% | Preview, PNG, ZIP, Review, and Export share `renderFrameToCanvas()`. Queue still pending. |
| Review Engine | 72% | Review checks rendered Frames, size mismatch, missing renders, hidden/export states, and readiness. |
| Package Engine | 50% | LINE naming and package helpers exist. More destinations pending after Core Editor. |
| Export Engine | 72% | PNG and ZIP helpers now own file creation; UI routes download actions through Export Engine. |
| Workspace Engine | 55% | Workspace schema, collections, storage adapter, libraries exist. Google Drive deferred after M1. |
| Feature Engine | 50% | Developer mode opens all features. Production plan restrictions pending. |

## Cleanup status

1. ✅ Add `frame/` module.
2. ✅ Detection Engine outputs Frame objects.
3. ✅ Connect UI to Detection Engine instead of direct `calculateGridBoxes()` calls.
4. ✅ UI preview and export now read from Frames.
5. ✅ Add reusable Render Engine path with `renderFrameToCanvas()`.
6. ✅ UI previews, PNG, and ZIP now route through Render Engine.
7. ✅ Add Refine Effects Engine: Trim, White Border, Shadow.
8. ✅ Render Engine applies refine effects before final canvas placement.
9. ✅ Review Engine checks render readiness and blocking errors.
10. ✅ Export Engine owns PNG and ZIP creation helpers.
11. ✅ UI download actions route through Export Engine.
12. ⚠️ Legacy `crop/` still exists for beta compatibility.
13. ⏳ Make Document the session source of truth.
14. ⏳ Use Command Engine for frame edits.
