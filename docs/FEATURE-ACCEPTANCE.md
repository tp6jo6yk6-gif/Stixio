# Stixio 正式版功能驗收表

- 最新驗收日期：2026-06-30
- 驗收版本：`destination-rules-full-completion`（合併後為 `main`）
- 穩定備份分支：`stable-legacy`
- 穩定版本標籤：`v1.0.0-legacy-stable`
- 測試環境：Headless Chromium、Node.js 22
- 測試素材：多來源 SVG 排版圖、角色混合輸出、手動遮罩、損壞專案、自訂 Profile 與 `.stixio` 往返檔案
- 本階段驗收：**單元測試 89 / 89、Destination Chromium 4 / 4、Static Build 通過**

> 原始完整版本仍保留為穩定回復點。正式 Workshop 的 Layout、Refine、Review、Package、Document／Project 與 Destination Rules 必須同時通過語法檢查、單元測試、Build 與真實 Chromium 操作驗收。

## A. 文件與程式結構

| 項目 | 結果 | 說明 |
|---|---|---|
| HTML 文件結構 | ✅ | DOCTYPE、HTML 結尾與正式入口完整 |
| DOM ID 唯一性 | ✅ | 無重複 ID |
| 四階段工作流程 | ✅ | Layout、Refine、Review、Package 完整存在 |
| Project Toolbar | ✅ | 新建、儲存、另存、開啟、匯出與最近專案 |
| Destination Profile Engine | ✅ | Profile、角色、版本與規格驗證由核心統一管理 |
| 平台中立規則 | ✅ | Profile 可代表不同目的地，不綁死特定品牌名稱 |
| JavaScript 語法 | ✅ | Node.js 語法檢查全部通過 |
| Static Build | ✅ | 正式入口與所有模組可完整建置 |

## B. Layout 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 多圖追加／切換／刪除 | ✅ | 多來源可獨立管理 |
| 每張來源獨立設定 | ✅ | Rows、Cols、Margin、Gap 與模式互不覆蓋 |
| 智能與網格偵測 | ✅ | 智能、1×1、2×2、3×3、自訂均可重偵測 |
| 九點拖曳 | ✅ | 移動與八方向縮放同步輸出 |
| 智能貼合 | ✅ | 拖曳後可重新貼合實際內容 |
| Frame 狀態同步 | ✅ | Layout 變更同步至 Refine、Review、Package |
| 多來源 Chromium 回歸 | ✅ | 來源識別、選取與 Frame 順序均通過 |

## C. Refine 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 自動去背 | ✅ | 色鍵、外圍限制、去雜點、侵蝕與羽化 |
| 手動遮罩最終優先 | ✅ | Keep／Delete 在所有後處理後仍維持指定結果 |
| 魔術保留／魔術去背 | ✅ | 支援連續區域與全色域處理 |
| 三種手動筆刷 | ✅ | 保留、強制去背、清除標記 |
| 遮罩歷史與隔離 | ✅ | 每個 Frame 獨立保存並支援 Undo／Redo |
| 雙預覽 | ✅ | 原圖遮罩與最終成品同步顯示 |
| 視窗操作 | ✅ | 縮放、平移、空白鍵暫時平移與 100% 重設 |
| Chromium 驗收 | ✅ | 筆刷、魔術、歷史、Frame 隔離與視窗操作通過 |

## D. Review 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 大型輸出預覽 | ✅ | 顯示 Frame、角色、檔名、尺寸、透明比例、內容範圍與大小 |
| 角色專屬尺寸 | ✅ | Main、Tab、Sticker 與背景角色按各自 Profile 規格檢查 |
| 角色專屬安全區 | ✅ | 每張 Frame 使用所屬角色的 safe margin |
| 角色專屬檔案上限 | ✅ | 每張 Frame 使用所屬角色的 maxFileSizeBytes |
| 四種檢查背景 | ✅ | 透明格、白、黑、貼圖綠 |
| 搜尋、篩選與排序 | ✅ | 錯誤、警告、核准、匯出、名稱、來源與大小 |
| 單張與批次核准 | ✅ | Error 項目禁止核准 |
| 問題導航 | ✅ | 可直接跳到對應 Frame |
| Package 門檻 | ✅ | 未核准、角色數量或輸出規格錯誤時禁止封裝 |
| Chromium 驗收 | ✅ | 背景、指南、角色切換、批次操作與快捷鍵通過 |

## E. Package 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 正式 Package 工作區 | ✅ | 顯示最終 ZIP 路徑、角色、來源、尺寸與大小 |
| Profile 命名規則 | ✅ | 固定角色檔名、角色流水號與自訂流水號 |
| Profile 數量規則 | ✅ | exact、min、max 與 allowedCounts 均會阻擋不合規封裝 |
| Profile 角色規則 | ✅ | Main、Tab、Sticker、Fullscreen Background、Effect Background |
| 資料夾結構 | ✅ | 平放、角色、來源、來源／角色雙層 |
| 安全路徑 | ✅ | 清理非法字元、保留名稱、重複與過長路徑 |
| Manifest | ✅ | JSON 與 CSV |
| SHA-256 | ✅ | PNG 校驗碼與 `checksums.sha256` |
| ZIP 壓縮與驗證 | ✅ | STORE／DEFLATE、進度、取消與封裝後完整性檢查 |
| Chromium 驗收 | ✅ | Profile 預檢、角色分配、路徑、Manifest 與 ZIP 通過 |

## F. Document／Project 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 完整 Workshop Snapshot | ✅ | 保存來源、Layouts、Frames、設定與目前選取位置 |
| 原始來源圖片 | ✅ | 來源圖以專案資產保存並可重新載入 |
| Refine 手動遮罩 | ✅ | 每張 Frame 的 Keep／Delete 遮罩完整還原 |
| Review 狀態 | ✅ | 核准、排除、角色與 Frame 順序完整還原 |
| Package 狀態 | ✅ | ZIP 名稱、資料夾、Manifest、Checksum 與歷史 |
| Destination 狀態 | ✅ | Active Profile、角色、版本與所有自訂 Profile 完整保存 |
| `.stixio` 封裝 | ✅ | `project.json`、`assets/`、`masks/`、`preview.png` 與校驗碼 |
| Schema Migration | ✅ | 舊專案缺少 Destination 狀態時自動使用 Flexible Profile |
| IndexedDB 與自動保存 | ✅ | 最近專案、草稿恢復及 Profile 狀態一併保存 |
| 損壞檔案保護 | ✅ | 無效、缺少素材與 checksum 錯誤不會覆蓋目前專案 |
| 真實 Chromium 驗收 | ✅ | 自動恢復、匯出匯入、最近專案與損壞檔案通過 |

## G. Destination Rules／多 Profile 規格引擎

| 項目 | 結果 | 說明 |
|---|---|---|
| Versioned Profile Schema | ✅ | Profile 具有 schemaVersion、key、version 與 metadata |
| 六個內建 Profile | ✅ | Flexible、Standard、Animated、Big、Fullscreen、Effect |
| 每角色獨立規格 | ✅ | width、height、safeMargin、maxFileSizeBytes 與命名 |
| 數量規則 | ✅ | exact、min、max、allowedCounts |
| Profile Registry | ✅ | 內建與自訂 Profile 共存，內建不可刪除 |
| Profile 切換 | ✅ | 不支援的角色自動正規化，過期核准自動撤銷 |
| 自訂尺寸相容 | ✅ | 修改內建尺寸時自動複製成 Custom Profile，不刪除原功能 |
| JSON 編輯 | ✅ | 自訂 Profile 可完整編輯並驗證 |
| 匯入／匯出 | ✅ | `.stixio-profile.json` 可攜式規格檔 |
| Profile 複製／刪除 | ✅ | 可複製內建或自訂規格並管理自訂項目 |
| 版本提示 | ✅ | 專案使用版本與目前版本不同時要求重新 Review |
| Project 保存 | ✅ | Active／Custom Profile 隨 `.stixio` 與 IndexedDB 保存 |
| Chromium 驗收 | ✅ | 標準角色尺寸、數量阻擋、自訂 Profile 與重載恢復 4 / 4 通過 |

## 本階段發現並修正

### 所有角色錯誤共用 Sticker 尺寸

原流程以全域 `targetW／targetH` 渲染所有 Frame。現在每張 Frame 依角色取得輸出規格，因此 Main、Tab、Sticker 與特殊背景可以同時存在於同一個專案與 ZIP。

### Profile 切換後沿用過期核准

目的地、角色或尺寸改變後，原 Review 核准不再有效。切換 Profile、修改規格或改變角色時會撤銷對應核准並重新渲染與檢查。

### 不能為了 Profile 刪除自訂尺寸

原本的自訂寬高與安全留白功能已保留。修改內建 Profile 時，Stixio 會先複製成 Custom Profile，再修改自訂版本，確保內建規格與舊功能都不被破壞。

### 驗收流程不應修改正式程式

一次性遷移完成後已刪除遷移腳本，Destination workflow 改為唯讀，只驗證正式來源檔案。

## 已知產品行為／後續改善

1. 內建 Profile 是可版本化的模板；正式接入特定服務前仍需依當時官方規格更新版本與來源說明。
2. 大型混合角色專案需要多種尺寸重複渲染，後續可加入 Web Worker 與角色輸出快取。
3. 瀏覽器清除網站資料會移除 IndexedDB 專案，因此重要自訂 Profile 與專案仍應匯出備份。
4. 多裝置同步與雲端 Profile Registry 尚未實作，屬於後續 Storage／Sync 階段。

## 發版規則

- `stable-legacy` 與 `v1.0.0-legacy-stable` 作為不可破壞的回復點。
- 新功能不得直接覆蓋穩定版本。
- 所有階段需同時通過單元測試、Build 與 Chromium 回歸後才可合併至 `main`。
