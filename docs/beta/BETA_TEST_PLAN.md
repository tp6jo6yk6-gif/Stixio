# Stixio Beta Test Plan

## Beta goal

Validate that the new modular Stixio UI can complete the basic Quick Project flow without breaking the core experience.

## Current beta scope

### In scope

- Load Stixio page from GitHub Pages.
- Import one image.
- Split a sheet with grid settings.
- Preview all detected stickers.
- Select one sticker.
- Apply background cleanup settings.
- Export one PNG in Free mode.
- Unlock Starter demo.
- Export ZIP for up to 8 stickers in Starter demo.
- Confirm new UI does not white-screen.

### Out of scope

- Real account login.
- Real Google Drive connection.
- Creator Workspace persistence.
- Brush repair.
- Manual crop handle editing.
- Full Sticker upload validation.
- Multi-platform rules beyond current Sticker-sized render.

## Test environment

- Browser: Chrome / Safari / Edge
- Device: Desktop first, tablet second
- Network: Normal connection
- Page source: GitHub Pages from `main`

## Test cases

### T01 — Page load

Steps:
1. Open the GitHub Pages URL.
2. Confirm the Stixio header appears.
3. Confirm hero, Quick Project, Layout, Review, Project Health, and Package panels appear.

Expected:
- No blank page.
- No module loading error.
- Page title includes Stixio.

### T02 — Import image

Steps:
1. Click or drag an image into Quick Project.
2. Wait for preview.

Expected:
- Image appears in the canvas area.
- Status shows file name and sticker count.
- Project Health increases.

### T03 — Grid layout

Steps:
1. Set Rows = 4 and Cols = 4, or press 4x4.
2. Click Apply layout.

Expected:
- Source canvas shows red/green boxes.
- Collection board shows 16 preview cards.
- One card is selected.

### T04 — Refine selected

Steps:
1. Adjust tolerance.
2. Click Render selected.

Expected:
- Selected sticker preview updates.
- Page remains responsive.

### T05 — Free PNG export

Steps:
1. Select one sticker.
2. Click Download selected PNG.

Expected:
- Browser downloads one PNG.
- File has transparent processed sticker on 370x320 canvas.

### T06 — Starter demo ZIP

Steps:
1. Click Export collection ZIP.
2. Confirm Starter demo prompt.
3. Click Export collection ZIP again.

Expected:
- Collection is limited to max 8 stickers.
- ZIP downloads.
- ZIP contains Sticker-style names.

### T07 — Layout after import

Steps:
1. Import image.
2. Change rows/cols multiple times.
3. Apply layout.

Expected:
- No duplicate broken previews.
- Selected sticker remains valid.

## Known limitations

- Current beta does not include manual crop drag handles.
- Current beta does not include brush repair.
- Current beta uses a Starter demo prompt instead of real login.
- Current beta uses a Workspace preview prompt instead of real Google Drive.
- ZIP export is behind Starter demo only.
- Multi-platform destinations are UI/product placeholders, not full rules yet.

## Pass criteria for Beta 1

Beta 1 passes when:

- Page loads without white screen.
- A 4x4 sheet can be imported and previewed.
- One selected PNG can be exported in Free mode.
- Starter demo ZIP export works for up to 8 stickers.
- No fatal error occurs during grid changes.

## Next beta after pass

Beta 2 should add:

- Manual crop editing.
- Brush repair return.
- Real Starter auth gate.
- Creator Workspace dashboard skeleton.
- Google Drive adapter prototype.
