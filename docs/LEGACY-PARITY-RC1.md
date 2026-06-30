# Stixio Legacy Parity & Release Candidate 1

- Branch: `release/workshop-parity-rc1`
- Version: `0.9.0-rc.1`
- Legacy baseline: `legacy-preview.html` + `src/legacy/payload-1.js` … `payload-5.js`
- Workshop candidate: `index.html`
- Goal: verify that the new Workshop can replace the complete Legacy application without deleting or weakening production workflows.

## Release gate

RC1 may replace the Legacy default only when all rows below are either:

- ✅ Equivalent
- ⚠️ Deliberate difference with documented acceptance

No ❌ Missing or 🔧 Fix required rows may remain.

## Evidence rules

1. Both applications must run in Chromium from the same repository commit.
2. The Legacy HTML must be reconstructed from the five immutable payload modules and fingerprinted with SHA-256.
3. The same fixture image and the same target output must be used for both applications.
4. A successful click is not sufficient evidence. Final PNG pixels, dimensions, file names and ZIP entries must be inspected.
5. Every fixed parity gap must receive a browser regression test.

## Phase 1 — Baseline inventory

| Area | Evidence | Status |
|---|---|---|
| Legacy payload extraction | `.parity/legacy-extracted.html` and SHA-256 | 🔄 Running |
| Legacy runtime controls | `.parity/legacy-runtime-inventory.json` | 🔄 Running |
| Workshop runtime controls | `.parity/workshop-runtime-inventory.json` | 🔄 Running |
| Initial feature signals | `.parity/runtime-feature-matrix.json` | 🔄 Running |
| Initial screenshots | `.parity/legacy-initial.png`, `.parity/workshop-initial.png` | 🔄 Running |

## Phase 2 — Functional parity matrix

| Workflow | Legacy operation | Workshop operation | Output evidence | Status |
|---|---|---|---|---|
| Import | Single image import | Single image import | Source dimensions and count | ⏳ |
| Import | Append multiple images | Append multiple images | Source order and selection | ⏳ |
| Import | Switch and delete source | Switch and delete source | Remaining source state | ⏳ |
| Layout | Preset grid | Preset grid | Frame geometry JSON | ⏳ |
| Layout | Smart detection | Smart detection | Detected bounds | ⏳ |
| Layout | Redetect | Redetect | Replaced bounds and state | ⏳ |
| Layout | Manual move | Nine-point move | Frame geometry JSON | ⏳ |
| Layout | Manual resize | Eight resize handles | Frame geometry JSON | ⏳ |
| Refine | Background removal | Chroma / exterior removal | Alpha mask comparison | ⏳ |
| Refine | Despeckle | Despeckle | Alpha component comparison | ⏳ |
| Refine | Shrink / feather | Shrink / feather | Pixel comparison | ⏳ |
| Refine | Border | White / custom border | Pixel comparison | ⏳ |
| Refine | Manual keep | Keep brush / magic keep | Alpha mask comparison | ⏳ |
| Refine | Manual delete | Delete brush / magic delete | Alpha mask comparison | ⏳ |
| Refine | Undo / redo | Per-frame mask history | Restored alpha mask | ⏳ |
| Review | Large preview | Large preview | Dimensions and safe guide | ⏳ |
| Review | Background switch | Four review backgrounds | Screenshot evidence | ⏳ |
| Review | Select / exclude | Export selection | Package item list | ⏳ |
| Review | Sort / reorder | Sort and drag reorder | Final output order | ⏳ |
| Review | Approval gate | Approval gate | Package blocked / allowed | ⏳ |
| Package | Single PNG | Single PNG | PNG bytes and dimensions | ⏳ |
| Package | Batch PNG | Batch PNG | Names and count | ⏳ |
| Package | ZIP | Verified ZIP | Entry names, order, bytes | ⏳ |
| Package | Main / Tab / Sticker | Destination role output | Role dimensions and names | ⏳ |
| Project | Legacy session continuity | `.stixio` and IndexedDB | Restored editable state | ⚠️ Deliberate extension |
| Destination | Legacy fixed settings | Versioned Profiles | Equivalent defaults + extensions | ⚠️ Deliberate extension |
| Keyboard | Undo / redo | Undo / redo | State transitions | ⏳ |
| Keyboard | Zoom / pan | Zoom / pan | View transform | ⏳ |

## Phase 3 — Output comparison thresholds

| Measurement | RC1 rule |
|---|---|
| PNG width / height | Exact match for equivalent role |
| File names | Exact match where Legacy defines the name |
| ZIP entry count | Exact match |
| ZIP entry order | Exact match where Legacy order is observable |
| Alpha mask | Exact match or documented algorithmic improvement |
| RGB pixels | Exact match outside accepted anti-alias tolerance |
| Frame geometry | Maximum 0.5 px absolute difference |
| Safe margin | Exact match |
| Package gate | Must never allow a package Legacy would reject unless documented |

## Phase 4 — Stress and release checks

| Check | Target | Status |
|---|---:|---|
| 40 outputs | Complete edit, Review and ZIP | ⏳ |
| 100 outputs | Complete edit, Review and ZIP | ⏳ |
| 10 source images | Independent Layout and state | ⏳ |
| 40 manual masks | Switch without mask leakage | ⏳ |
| Repeated Profile switches | 50 switches without stale output | ⏳ |
| Autosave reload | Editable state restored | ⏳ |
| ZIP generation | No missing or duplicate entries | ⏳ |
| Memory trend | No unbounded growth after cache release | ⏳ |

## RC1 completion tasks

1. Capture and review the Legacy runtime inventory.
2. Add stable selectors or an adapter for the Legacy controls that matter to parity.
3. Build shared fixture actions for both applications.
4. Add Layout and Refine output comparisons first.
5. Add Review and Package archive comparisons.
6. Run stress scenarios.
7. Fix every parity gap and add regression coverage.
8. Change version to `1.0.0-rc.1` only after functional parity is green.
9. Publish the final parity report and release notes.
