# Stixio Workshop 架構整合

## 原則

- Stixio 模組化架構是產品主體。
- `workshop-legacy.html` 是功能與操作行為的基準，不再作為長期正式架構。
- UI 不擁有圖像處理、偵測、命名或打包邏輯。
- `main` 在功能對等完成前維持目前可用版本。
- 所有整合先進入 `stixio-workshop`，經驗收後才合併。

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
| 縮放與修補視角 | UI Viewport（不寫入輸出模型） |
| 一般／動態／大／全螢幕／特效尺寸 | Rules Engine |
| 拖曳排序與匯出勾選 | Package UI / Frame state |
| main、tab、01… 命名 | Package Engine |
| PNG、ZIP | Export Engine |
| 錯誤與規格檢查 | Review Engine |

## 已完成

- [x] 建立獨立整合分支
- [x] 貼圖尺寸與用途預設
- [x] 投影谷智能排版偵測
- [x] 每格內容感知緊緻裁切
- [x] 手動裁切後 12px 鄰近磁吸
- [x] Keep／Delete／Magic Mask Engine
- [x] 遮罩接入共用 Render Engine
- [x] 多來源 Document ZIP 輸出管線
- [x] main／tab 改為明確角色，貼圖由 01.png 開始
- [x] 多圖匯入與原圖切換介面
- [x] 九點裁切框
- [x] 吸色器、去背、雜點、侵蝕、羽化、外框控制
- [x] 魔術、保留與刪除筆刷及筆刷歷史
- [x] 貼圖規格切換
- [x] Review 拖曳排序、匯出勾選與角色設定
- [x] 單張 PNG 與多來源 ZIP
- [x] CI 語法、既有測試、新增測試與靜態建置通過

## 尚未允許取代正式版的條件

- [ ] 使用原驗收圖片重跑完整瀏覽器功能驗收
- [ ] 高解析多圖壓力測試
- [ ] 瀏覽器人工檢查筆刷座標、九點裁切及拖曳排序
- [ ] 驗收表確認沒有功能倒退

## 入口

整合分支的預覽入口：`workshop.html`

正式 `main/index.html` 在驗收前維持不變。
