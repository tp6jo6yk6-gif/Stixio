# Stixio Workshop 架構

## 唯一正式產品

Stixio 目前只有一套正式應用程式：

```text
index.html
└── src/ui/stixio-workshop-app-v2.js
    └── src/core/*
```

- `index.html` 是唯一正式入口。
- `workshop.html` 與 `next.html` 僅保留舊網址相容跳轉，不再載入其他 UI。
- 舊單檔版本不再存在於正式建置；需要回復時使用 `stable-legacy` 分支或 `v1.0.0-legacy-stable` 標籤。
- UI 負責操作與呈現；圖像處理、規格、命名、角色與打包邏輯由 Core Engines 提供。

## 使用者工作流程名稱

`Layout → Refine → Review → Package`

| 階段 | 中文名稱 | 主要工作 |
|---|---|---|
| Layout | 匯入與版面切割 | 匯入、多圖管理、每張原圖獨立 Layout、智能偵測、網格、Frame 與裁切 |
| Refine | 細部修補 | 去背、遮罩、保留／刪除筆刷、羽化、外框顏色與粗細 |
| Review | 預覽與檢查 | 大型預覽、安全區、檔案大小警告、排序與匯出選取 |
| Package | 角色與輸出打包 | sticker／main／tab／background／effect-background、命名、PNG 與 ZIP |

原本的編號式第一階段已正式改名為 **Layout｜匯入與版面切割**。

## 功能歸屬

| 貼圖功能 | Stixio 模組 |
|---|---|
| 多張原圖、追加、切換與獨立 Layout | Document Engine / Source Image |
| 智能偵測、網格、自訂切割 | Detection Engine |
| 圖案緊緻裁切、12px 鄰近磁吸 | Detection Engine / Frame Engine |
| 九點控制裁切框 | Frame Editor UI + Command Engine |
| 每張圖案輸出 Offset | Frame state / Render Engine |
| 吸色器、色鍵去背、外圍去背 | Refine Engine |
| 清除雜點、侵蝕、羽化、外框 | Refine / Render Engine |
| 魔術去背、保留與刪除筆刷 | Refine Mask Engine |
| 自訂尺寸、安全留白、置中／靠下 | Rules Engine / Render Engine |
| 一般／動態／大／全螢幕／特效尺寸 | Rules Engine |
| 大型預覽、安全區與檔案大小警告 | Review Engine / Review UI |
| 拖曳排序與匯出勾選 | Package UI / Frame state |
| 角色命名、前綴／後綴、流水號 | Workshop Package Plan / File Naming |
| PNG、ZIP | Export Engine |
| 錯誤與規格檢查 | Review Engine |

## 平台中立 Package Rules

Workshop 的正式 destination key 為 `workshop`，不再把特定平台名稱硬編碼於 UI 或 Export 流程。

支援角色：

- `sticker`
- `main`
- `tab`
- `background`（全螢幕貼圖）
- `effect-background`（特效貼圖）

支援兩種命名模式：

- 角色命名：`main.png`、`tab.png`、`background.png`、`effect-background.png`、`01.png`…
- 自訂流水號：前綴＋序號＋後綴

## 已完成

- [x] 多圖匯入與原圖切換
- [x] 每張原圖獨立 Layout 設定
- [x] 投影谷智能排版偵測
- [x] 網格與自訂切割
- [x] 內容感知緊緻裁切
- [x] 手動裁切後 12px 鄰近磁吸
- [x] 九點裁切框
- [x] 自訂輸出寬高與安全留白
- [x] 安全區大型預覽
- [x] 絕對置中／靠下貼齊
- [x] 每張圖案 Offset X／Y
- [x] 吸色、色鍵去背、外圍去背
- [x] 雜點、侵蝕、羽化與外框顏色
- [x] Keep／Delete／Magic Mask Engine
- [x] 筆刷歷史
- [x] 遮罩接入共用 Render Engine
- [x] 貼圖尺寸與用途預設
- [x] 全螢幕背景／特效背景角色
- [x] Review 大型預覽、拖曳排序、匯出勾選與檔案大小警告
- [x] 角色命名與自訂檔名前後綴
- [x] 平台中立 Package Rules
- [x] 單張 PNG 與多來源 ZIP
- [x] 單一正式入口

## 發版規則

- `main/index.html` 必須永遠直接啟動 `initStixioWorkshop`。
- 不得再建立第二套可執行 UI 入口。
- 相容網址只能跳轉到 `index.html`。
- 每次修改須通過 Workshop naming、entry、output integrity、integration 與既有核心測試。
- 回復點為 `stable-legacy` 分支與 `v1.0.0-legacy-stable` 標籤。
