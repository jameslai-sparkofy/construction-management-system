# 欄位權限管理功能說明

## 功能概述
已在工程管理專案的「新增專案」第四步驟中加入欄位權限設定功能，讓專案管理員可以細緻控制每個欄位的編輯權限。

**重要：** 欄位權限設定儲存在工程管理系統（engineering-management）的專案資料中，而非 D1 資料庫。D1 資料庫只負責儲存實際的業務資料，不涉及權限管理。

## 實作內容

### 1. 前端界面更新
**檔案：** `/frontend/project-create-v2.html`

#### 新增功能：
- **欄位權限設定區塊**：在第四步「設定權限」中新增欄位權限管理界面
- **分頁顯示**：根據選擇的工程類型（SPC/浴櫃）顯示對應的欄位權限設定
- **批量操作**：提供「全選工班」、「全選業主」、「清除全部」快速設定按鈕
- **權限矩陣表格**：顯示每個欄位的名稱、類型，以及工班、業主、管理員的編輯權限

#### 權限角色說明：
- **工班**：專案的工班負責人和成員
- **業主**：商機連絡人（客戶）
- **管理員**：系統管理員（預設擁有所有權限）

### 2. JavaScript 功能
**新增函數：**
- `setupFieldPermissionsTabs()` - 設定分頁切換功能
- `loadFieldPermissions()` - 載入欄位權限設定
- `loadObjectFieldPermissions()` - 載入特定對象的欄位權限
- `setupPermissionCheckboxes()` - 處理權限勾選框的變更事件
- `selectAllPermissions()` - 批量選擇權限
- `clearAllPermissions()` - 清除所有權限設定

### 3. 權限應用範例
**檔案：** `/frontend/field-permissions-example.js`

提供完整的權限應用範例，包括：
- `canEditField()` - 檢查用戶對特定欄位的編輯權限
- `applyFieldPermissions()` - 根據權限設定表單欄位的可編輯狀態
- `loadProjectAndApplyPermissions()` - 載入專案並應用權限
- `batchUpdateFieldPermissions()` - 批量更新欄位權限

## 資料結構

### 專案資料中的權限設定
```javascript
{
    opportunityId: "xxx",
    name: "專案名稱",
    permissions: {
        leaders: ["user1", "user2"],       // 工班負責人
        members: ["user3", "user4"],       // 工班成員
        owners: ["user5"],                 // 業主
        canCrossView: false,               // 工班互相查看權限
        fieldPermissions: {                // 欄位權限設定
            "object_8W9cb__c": {           // SPC 對象
                "field_name": {
                    fieldDisplayName: "欄位顯示名稱",
                    fieldType: "text",
                    canEditByWorker: true,
                    canEditByOwner: false,
                    canEditByAdmin: true
                }
            },
            "site_cabinet__c": {           // 浴櫃對象
                // 類似結構...
            }
        }
    }
}
```

## 系統過濾的欄位
以下欄位不會顯示在權限設定中：
- `_id` - 系統 ID
- `created_at` - 創建時間
- `updated_at` - 更新時間
- `modification_record__c` - 修改記錄（審計日誌）
- 公式欄位（formula）
- 自動編號欄位（auto_number）

## 使用流程

1. **建立專案時設定權限**
   - 在第二步選擇工程類型（SPC/浴櫃）
   - 在第四步設定欄位權限
   - 系統自動載入對應對象的欄位清單
   - 勾選各角色的編輯權限

2. **編輯表單時應用權限**
   - 載入專案權限設定
   - 根據當前用戶角色判斷欄位編輯權限
   - 動態啟用/禁用表單欄位
   - 顯示唯讀提示

3. **權限檢查邏輯**
   - 管理員：預設擁有所有欄位編輯權限
   - 業主：只能編輯勾選「業主可編輯」的欄位
   - 工班：只能編輯勾選「工班可編輯」的欄位
   - 非專案成員：無編輯權限

## API 整合與資料流

### 權限管理架構
1. **權限儲存位置**：工程管理系統的專案資料庫
2. **D1 資料庫角色**：僅儲存業務資料（案場、維修單等）
3. **權限檢查流程**：
   - 前端從工程管理 API 載入專案資料（含權限設定）
   - 根據用戶角色和權限設定控制欄位
   - 編輯資料時送到 D1 資料庫儲存

### API 端點
- **載入專案權限**：`GET /api/v1/projects/{projectId}` (工程管理 API)
- **更新權限設定**：`PUT /api/v1/projects/{projectId}/permissions` (工程管理 API)
- **儲存業務資料**：`PUT /api/crud/{objectApiName}` (D1 API)
- **載入欄位架構**：`GET /api/schema/{objectApiName}` (D1 API，僅用於獲取欄位定義)

### 優點
- 簡化 D1 API 的複雜度（D1 不需要處理權限邏輯）
- 讓每個專案有獨立的權限設定
- 權限與專案資料一起管理，更容易維護
- 避免 D1 資料庫與工程管理系統之間的權限同步問題

## 注意事項

1. **權限繼承**：新建專案時可以從模板繼承權限設定
2. **權限變更**：專案建立後，管理員仍可修改權限設定
3. **審計追蹤**：所有權限變更都應記錄在 modification_record__c 中
4. **性能考量**：權限檢查應在前端快取，避免頻繁 API 呼叫

## 後續優化建議

1. **權限模板**：建立常用的權限模板供快速套用
2. **角色群組**：支援更細緻的角色分組管理
3. **權限報表**：提供權限設定的總覽報表
4. **權限歷史**：記錄權限變更歷史
5. **批量管理**：支援跨專案的權限批量管理