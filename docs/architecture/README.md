# Stixio Architecture Docs

This folder documents the production Workshop architecture.

## Production entry

`main/index.html` starts the single modular application at `src/ui/stixio-workshop-app-v2.js`.

## User-facing workflow

`Layout → Refine → Review → Package`

- **Layout｜匯入與版面切割** handles imports, per-source layouts, detection, Frames, and crop geometry.
- **Refine｜細部修補** handles masks, background removal, edge repair, and borders.
- **Review｜預覽與檢查** handles large preview, safe area, file-size warnings, order, and export selection.
- **Package｜角色與輸出打包** handles roles, platform-neutral rules, custom filenames, PNG, and ZIP delivery.

## Core documents

- [ARCHITECTURE_V1.md](./ARCHITECTURE_V1.md)
- [Workshop architecture](../WORKSHOP-ARCHITECTURE.md)

## Core locations

`src/core/` — engines and domain models  
`src/destinations/` — destination profiles  
`src/core/workshop-output.js` — Workshop output rules, roles, placement, and package planning  
`src/ui/stixio-workshop-app-v2.js` — the only production UI
