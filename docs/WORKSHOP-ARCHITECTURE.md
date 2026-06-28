# Stixio Workshop 架構

## 唯一正式產品

Stixio 目前只有一套正式應用程式：

```text
index.html
└── src/ui/stixio-workshop-app.js
    └── src/core/*
```

- `index.html` 是唯一正式入口。
- `workshop.html` 與 `next.html` 僅保留舊網址相容跳轉，不再載入其他 UI。
- 舊單檔版本不再存在於正式建置；需要回復時使用 `stable-legacy` 分支或 `v1.0.0-legacy-stable` 標籤。
- UI 不擁有圖像處理、偵測、命名或打包邏輯。

## 功能歸屬

| 貼圖功能 | Stixio 模組 |
|---|---|
| 多張原圖、追加、切換 | Document Engine / Source Image |
| 智能偵測、網格、自訂切割 | Detection Engine |
| 圖案緊緻裁切、12px 鄰近磁吸 | Detection Engine / Frame Engine |
| 九點控制裁切框 | Frame Editor UI + Command Engine |
| 吸色器、色鍵去背、外圍去背 | Refine Engine |
| 清除雜點、侵蝕、羽化、外框 | Refine / Render Engine |
| 魔術去背、保留與刪除筆刷 | Refine Mask Engine |
| 縮放與修補視角 | UI Viewport |
| 一般／動態／大／全螢幕／特效尺寸 | Rules Engine |
| 拖曳排序與匯出勾選 | Package UI / Frame state |
| main、tab、01… 命名 | Package Engine |
| PNG、ZIP | Export Engine |
| 錯誤與規格檢查 | Review Engine |

## 已完成

- [x] 多圖匯入與原圖切換
- [x] 投影谷智能排版偵測
- [x] 網格與自訂切割
- [x] 內容感知緊緻裁切
- [x] 手動裁切後 12px 鄰近磁吸
- [x] 九點裁切框
- [x] 吸色、色鍵去背、外圍去背
- [x] 雜點、侵蝕、羽化與外框
- [x] Keep／Delete／Magic Mask Engine
- [x] 筆刷歷史
- [x] 遮罩接入共用 Render Engine
- [x] 貼圖尺寸與用途預設
- [x] Review 拖曳排序、匯出勾選與角色設定
- [x] main／tab 明確角色，貼圖從 01.png 開始
- [x] 單張 PNG 與多來源 ZIP
- [x] 單一正式入口
- [x] 語法、整合、既有測試與靜態建置通過

## 發版規則

- `main/index.html` 必須永遠直接啟動 `initStixioWorkshop`。
- 不得再建立第二套可執行 UI 入口。
- 相容網址只能跳轉到 `index.html`。
- 每次修改須通過 Workshop naming、entry、integration 與既有核心測試。
- 回復點為 `stable-legacy` 分支與 `v1.0.0-legacy-stable` 標籤。
