# Stixio Architecture Docs

This folder documents the production Workshop architecture.

## Production entry

`main/index.html` starts the single modular application at `src/ui/stixio-workshop-app.js`.

## User-facing workflow

`Layout → Refine → Review → Package`

- **Layout｜匯入與版面切割** replaces the former numbered first step.
- **Refine｜細部修補** handles mask and edge repair.
- **Review｜預覽與檢查** validates rendered results and order.
- **Package｜角色與輸出打包** handles roles, names, PNG, and ZIP delivery.

## Core documents

- [ARCHITECTURE_V1.md](./ARCHITECTURE_V1.md)
- [Workshop architecture](../WORKSHOP-ARCHITECTURE.md)

## Core locations

`src/core/` — engines and domain models  
`src/destinations/` — destination profiles  
`src/ui/stixio-workshop-app.js` — the only production UI
