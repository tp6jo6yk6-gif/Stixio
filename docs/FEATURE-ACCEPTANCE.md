# Stixio 正式版功能驗收表

- 最新驗收日期：2026-06-30
- 驗收版本：`document-project-full-completion`（合併後為 `main`）
- 穩定備份分支：`stable-legacy`
- 穩定版本標籤：`v1.0.0-legacy-stable`
- 測試環境：Headless Chromium、Node.js 22
- 測試素材：多來源 SVG 排版圖、手動遮罩、空白輸出、損壞專案與 `.stixio` 往返檔案
- 驗收結果：**單元測試 75 / 75、Project Chromium 4 / 4，Layout／Refine／Review／Package Chromium 與 Static Build 全部通過**

> 原始完整版本仍保留為穩定回復點。正式 Workshop 的 Layout、Refine、Review、Package 與 Document／Project 必須同時通過語法檢查、單元測試、Build 與真實 Chromium 操作驗收。

## A. 文件與程式結構

| 項目 | 結果 | 說明 |
|---|---|---|
| HTML 文件結構 | ✅ | DOCTYPE、HTML 結尾與正式入口完整 |
| DOM ID 唯一性 | ✅ | 無重複 ID |
| 四階段工作流程 | ✅ | Layout、Refine、Review、Package 完整存在 |
| Project Toolbar | ✅ | 新建、儲存、另存、開啟、匯出與最近專案 |
| 平台中立規則 | ✅ | 核心與 UI 不依賴特定販售平台名稱 |
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
| 大型輸出預覽 | ✅ | 顯示 Frame、檔名、尺寸、透明比例、內容範圍與大小 |
| 四種檢查背景 | ✅ | 透明格、白、黑、貼圖綠 |
| 安全區與內容邊界 | ✅ | 可獨立顯示並依實際 Alpha 計算 |
| 搜尋、篩選與排序 | ✅ | 錯誤、警告、核准、匯出、名稱、來源與大小 |
| 單張與批次核准 | ✅ | Error 項目禁止核准 |
| 問題導航 | ✅ | 可直接跳到對應 Frame |
| 像素品質檢查 | ✅ | 空白、內容過少、碰邊、安全區與疑似背景 |
| Package 門檻 | ✅ | 未核准或仍有 Error 時禁止封裝 |
| Chromium 驗收 | ✅ | 背景、指南、批次操作、拖曳排序與快捷鍵通過 |

## E. Package 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 正式 Package 工作區 | ✅ | 顯示最終 ZIP 路徑、角色、來源、尺寸與大小 |
| 命名模式 | ✅ | Main／Tab／Sticker 與自訂流水號 |
| 資料夾結構 | ✅ | 平放、角色、來源、來源／角色雙層 |
| 安全路徑 | ✅ | 清理非法字元、保留名稱、重複與過長路徑 |
| Manifest | ✅ | JSON 與 CSV |
| SHA-256 | ✅ | PNG 校驗碼與 `checksums.sha256` |
| README | ✅ | 交付內容說明 |
| ZIP 壓縮 | ✅ | STORE／DEFLATE 與壓縮等級 |
| 進度與取消 | ✅ | Hash、壓縮、驗證狀態可見並可取消 |
| 完整性驗證 | ✅ | 產生後重新讀取 ZIP 並核對內容 |
| Chromium 驗收 | ✅ | 預檢、路徑、Manifest、ZIP 與輸出紀錄通過 |

## F. Document／Project 全功能驗收

| 項目 | 結果 | 說明 |
|---|---|---|
| 完整 Workshop Snapshot | ✅ | 保存來源、Layouts、Frames、設定與目前選取位置 |
| 原始來源圖片 | ✅ | 來源圖以專案資產保存並可重新載入 |
| Refine 手動遮罩 | ✅ | 每張 Frame 的 Keep／Delete 遮罩完整還原 |
| Review 狀態 | ✅ | 核准、排除、角色與 Frame 順序完整還原 |
| Package 狀態 | ✅ | ZIP 名稱、根目錄、資料夾、Manifest、Checksum 與歷史 |
| `.stixio` 封裝 | ✅ | `project.json`、`assets/`、`masks/`、`preview.png` 與校驗碼 |
| `.stixio` 完整性 | ✅ | 開啟時驗證必要檔案與 SHA-256 |
| Schema Migration | ✅ | 1.x 專案升級到 2.0；未來版本明確阻擋 |
| IndexedDB 專案庫 | ✅ | 儲存、載入、最近專案、複製與刪除 |
| 自動保存 | ✅ | 編輯後自動保存草稿，重新整理後自動恢復 |
| 新建／儲存／另存 | ✅ | 未儲存變更提示與 Ctrl／Cmd+S |
| 損壞檔案保護 | ✅ | 無效、缺少素材與 checksum 錯誤不會覆蓋目前專案 |
| 專案重新整理恢復 | ✅ | 來源、遮罩、Review 與 Package 狀態全部恢復 |
| 真實 Chromium 驗收 | ✅ | 自動恢復、匯出匯入、最近專案與損壞檔案 4 / 4 通過 |

## 本階段發現並修正

### 執行期 Canvas 不能直接序列化

來源圖片的 `HTMLImageElement` 與手動遮罩 Canvas 不可直接放進 JSON。現在 Snapshot 會移除執行期物件，來源改由資產資料保存，遮罩改為 PNG，再於開啟專案時重建 Image 與 Canvas。

### Package 設定位於獨立 Controller

Package 的交付設定原本只存在 Controller 私有狀態。現在 Controller 提供明確的 `exportState()`／`importState()`，因此 Project 可以保存並恢復完整交付設定與輸出紀錄。

### 機器人提交不應觸發寫回循環

一次性遷移完成後已移除遷移腳本，Project CI 改為唯讀驗收，不再由測試流程修改正式程式。

## 已知產品行為／後續改善

1. 高解析多來源專案會占用較多 IndexedDB 空間；後續可加入資產去重、分塊儲存與容量管理。
2. 自動保存目前以完整 Snapshot 為單位；大型專案後續可改為增量保存與背景 Worker。
3. 瀏覽器清除網站資料會移除 IndexedDB 專案，因此重要專案仍應匯出 `.stixio` 備份。
4. 多裝置同步與雲端 Workspace 尚未實作，屬於後續 Storage／Sync 階段。

## 發版規則

- `stable-legacy` 與 `v1.0.0-legacy-stable` 作為不可破壞的回復點。
- 新功能不得直接覆蓋穩定版本。
- 所有階段需同時通過單元測試、Build 與 Chromium 回歸後才可合併至 `main`。
