# 系統架構與檔案清單
最後更新：2025-08-12 10:15

## ✅ 已解決問題
- ~~`api.yes-ceramics.com` 路由指向 `construction-management-api-clerk` Worker~~ ✅ 已修復
- ~~Worker 部署後沒有更新~~ ✅ 使用 `--no-bundle` 參數解決
- ~~多個重複的 Worker 和配置檔案造成混亂~~ ✅ 已清理

## 📁 Workers 檔案結構

### 主要 Worker 檔案 (`/workers/src/`)
| 檔案名稱 | 用途 | 狀態 | 最後修改 |
|---------|------|------|---------|
| `index.js` | 主要 Worker（生產環境） | ✅ 有完整認證 | 2025-08-12 |
| `index-simple.js` | 簡化測試版本 | ✅ 保留備用 | 2025-08-12 |
| `index-clerk-simple.js` | Clerk 簡化版 | ⚠️ 保留參考 | 2025-08-10 |
| `index-final.js` | Final 版本 | ⚠️ 保留參考 | 2025-08-11 |
| `test-deploy.js` | 部署測試 | ✅ 測試用 | 2025-08-12 |
| ~~`index-v2.js`~~ | ~~V2 版本~~ | ❌ 已刪除 | - |
| ~~`index-v3.js`~~ | ~~V3 版本~~ | ❌ 已刪除 | - |
| ~~`index-backup.js`~~ | ~~備份~~ | ❌ 已刪除 | - |
| ~~`test-index.js`~~ | ~~測試用~~ | ❌ 已刪除 | - |

### Wrangler 配置檔案 (`/workers/`)
| 檔案名稱 | Worker 名稱 | 狀態 |
|---------|------------|------|
| `wrangler.toml` | construction-management-api-clerk | ✅ 唯一配置 |
| ~~`wrangler-final.toml`~~ | ~~construction-final-api~~ | ❌ 已刪除 |
| ~~`wrangler-simple.toml`~~ | ~~construction-management-api-clerk~~ | ❌ 已刪除 |
| ~~`simple-wrangler.toml`~~ | ~~construction-management-api-clerk~~ | ❌ 已刪除 |
| ~~`wrangler-test.toml`~~ | ~~construction-management-api-clerk~~ | ❌ 已刪除 |
| ~~`wrangler.production.toml`~~ | ~~construction-management-api~~ | ❌ 已刪除 |

## 🌐 線上 Workers 狀態
| Worker 名稱 | 最後修改 | 用途 | 狀態 |
|------------|---------|------|------|
| construction-management-api-clerk | 2025-08-12 | **主 API** | ✅ 生產環境 |
| fx-crm-sync | 2025-08-11 | **CRM 同步服務** | ✅ 運行中 |
| fx-d1-rest-api | 2025-08-03 | **D1 REST API** | ✅ 運行中 |
| ~~construction-management-api~~ | ~~2025-08-08~~ | ~~舊版本~~ | ❌ 已刪除 |

## 🔗 域名路由
| 域名 | 指向 | 狀態 |
|-----|------|------|
| api.yes-ceramics.com/* | construction-management-api-clerk | ✅ 主 API |
| sync.yes-ceramics.com/* | fx-crm-sync | ✅ CRM 同步 |
| d1.yes-ceramics.com/* | fx-d1-rest-api | ✅ D1 REST |
| construction-management-frontend.pages.dev | Cloudflare Pages | ✅ 前端 |
| manage.yes-ceramics.com | Cloudflare Pages (CNAME) | ✅ 生產環境前端 |

## 📱 前端檔案 (`/frontend/`)

### 主要頁面
| 檔案名稱 | 用途 | 狀態 |
|---------|------|------|
| `index.html` | 首頁 | ✅ 正常 |
| `login.html` | 登入頁（新） | ✅ 今天建立 |
| `project-list.html` | 專案列表 | ✅ 正常 |
| `project-detail.html` | 專案詳情 | ✅ 正常 |
| `project-create-v2.html` | 建立專案 | ✅ 使用中 |
| `project-create-v3.html` | 建立專案 V3 | ❓ 未使用 |
| `project-edit.html` | 編輯專案 | ❓ 未測試 |
| `config.js` | API 設定 | ✅ 正常 |

### 要刪除的檔案
- `clerk.html` (已不存在)
- 所有在 `待刪/` 資料夾的檔案

## 🗄️ 資料庫
| 名稱 | ID | 用途 |
|-----|-----|------|
| DB_ENGINEERING | 21fce5cd-8364-4dc2-be7f-6d68cbd6fca9 | 工程管理資料 |
| DB_CRM | 332221d8-61cb-4084-88dc-394e208ae8b4 | CRM 資料 |

## 🔑 認證系統
| 方式 | 狀態 | 說明 |
|-----|------|------|
| 簡單認證 | ⚠️ 實作但無法測試 | Phone + 後3碼 |
| Demo Token | ✅ 可用 | localStorage: demo-token |
| Clerk | ❌ 未使用 | 有配置但未實作 |
| Supabase | ❌ 已移除 | 今天刪除 |

## ✅ 已完成清理

### 2025-08-12 已執行
1. **修復 API 路由** ✅
   - 使用 `--no-bundle` 參數成功部署
   - Worker 程式碼已更新到最新版本

2. **刪除不需要的 Workers** ✅
   - ❌ construction-management-api (已刪除)
   - ❌ 所有測試 Workers (已刪除)

3. **清理檔案** ✅
   - ❌ 所有 `wrangler-*.toml` 已刪除（只保留主要的）
   - ❌ `src/index-v2.js`, `src/index-v3.js`, `src/index-backup.js` 已刪除
   - ❌ 所有測試檔案已刪除

### 未來改進計劃
1. ✅ 統一使用單一 Worker 配置
2. ⏳ 建立明確的版本控制策略
3. ⏳ 實作適當的環境分離（dev/staging/prod）
4. ✅ 所有服務統一在 yes-ceramics.com 域名下

## 📝 注意事項
- 每次創建新檔案時，立即更新此文檔
- 部署前確認使用正確的 Worker 名稱
- 定期清理不需要的檔案