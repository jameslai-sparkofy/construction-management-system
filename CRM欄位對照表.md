# CRM 案場欄位對照表

## 案場(SPC) - object_8W9cb__c

### 施工相關重要欄位

| 功能用途 | CRM 欄位名稱 | API 名稱 | 資料類型 |
|---------|-------------|----------|----------|
| **基本資訊** |
| 編號 | 編號 | name | 自增编号 |
| 棟別 | 棟別 | field_WD7k1__c | 单行文本 |
| 樓層 | 樓層 | field_Q6Svh__c | 数字 |
| 戶別 | 戶別 | field_XuJP2__c | 单行文本 |
| 工地坪數 | 工地坪數 | field_tXAko__c | 数字 |
| **施工前資料** |
| 平面圖 | 平面圖 | field_3T38o__c | 图片 |
| 施工前備註 | 施工前備註 | field_sF6fn__c | 单行文本 |
| 施工前照片 | 施工前照片 | field_V3d91__c | 图片 |
| 施工前缺失 | 施工前缺失 | field_W2i6j__c | 图片 |
| 工地狀況照片 | 工地狀況照片 | field_03U9h__c | 图片 |
| **施工資料** |
| 施工日期 | 施工日期 | field_23pFq__c | 日期 |
| 舖設坪數 | 舖設坪數 | field_B2gh1__c | 数字 |
| 施工完成 | 施工完成 | construction_completed__c | 布尔值 |
| 完工照片 | 完工照片 | field_3Fqof__c | 图片 |
| 工班師父 | 工班師父 | field_u1wpv__c | 单行文本 |
| **驗收資料** |
| 驗收照片 | 驗收照片 | field_v1x3S__c | 图片 |
| 驗收備註 | 驗收備註 | field_n37jC__c | 单行文本 |
| **狀態管理** |
| 標籤 | 標籤 | field_23Z5i__c | 多选（準備中/不可施工/可施工/已完工/需維修/維修完成/其他） |
| 階段 | 階段 | field_z9H6O__c | 单选（準備中/施工前場勘/施工/驗收/缺失維修/其他） |
| 案場類型 | 案場類型 | field_dxr31__c | 单选（工地/樣品屋/民宅/其他） |
| **備註欄位** |
| 工地備註 | 工地備註 | field_g18hX__c | 多行文本 |
| 工班備註 | 工班備註 | field_V32Xl__c | 单行文本 |
| 維修備註1 | 維修備註1 | field_sijGR__c | 单行文本 |
| **關聯欄位** |
| 工單 | 工單 | field_k7e6q__c | 查找关联 |
| 商機 | 商機 | field_1P96q__c | 查找关联 |
| 請款單 | 請款單 | field_npLvn__c | 查找关联 |
| 工班 | 工班 | shift_time__c | 引用字段 |
| **其他資料** |
| 保護板坪數 | 保護板坪數 | field_27g6n__c | 数字 |
| 保固日期 | 保固日期 | field_f0mz3__c | 日期 |
| 缺失影片 | 缺失影片 | field_1zk34__c | 附件 |

## 案場(浴櫃) - site_cabinet__c

### 施工相關重要欄位（與 SPC 相同的部分）

| 功能用途 | CRM 欄位名稱 | API 名稱 | 資料類型 |
|---------|-------------|----------|----------|
| **基本資訊** |
| 編號 | 編號 | name | 自增编号 |
| 棟別 | 棟別 | field_WD7k1__c | 单行文本 |
| 樓層 | 樓層 | field_Q6Svh__c | 数字 |
| 戶別 | 戶別 | field_XuJP2__c | 单行文本 |
| 位置 | 位置 | location__c | 单行文本 |
| **施工資料** |
| 平面圖 | 平面圖 | field_3T38o__c | 图片 |
| 施工前備註 | 施工前備註 | field_sF6fn__c | 单行文本 |
| 施工前照片 | 施工前照片 | field_V3d91__c | 图片 |
| 施工日期 | 施工日期 | field_23pFq__c | 日期 |
| 施工完成 | 施工完成 | construction_completed__c | 布尔值 |
| 完工照片 | 完工照片 | field_3Fqof__c | 图片 |
| 工班師父 | 工班師父 | field_u1wpv__c | 单行文本 |
| **維修資料（浴櫃專用）** |
| 維修單 | 維修單 | field_t2GYf__c | 查找关联(多选) |
| 維修日期1 | 維修日期1 | field_r1mp8__c | 日期 |
| 維修師父1 | 維修師父1 | field_xFCKf__c | 查找关联(多选) |
| 維修費用1 | 維修費用1 | field_7ndUg__c | 金额 |
| 維修備註1 | 維修備註1 | field_sijGR__c | 单行文本 |
| 維修完成照片1 | 維修完成照片1 | field_PuaLk__c | 图片 |
| 缺失照片1 | 缺失照片1 | field_tyRfE__c | 图片 |
| 缺失分類1 | 缺失分類1 | field_OmPo8__c | 多选 |
| 缺失備註1 | 缺失備註1 | field_nht8k__c | 单行文本 |

## 系統實作說明

### 資料架構
1. **所有案場資料都儲存在 CRM (fx-crm-database)**
   - SPC 案場：object_8W9cb__c 表
   - 浴櫃案場：site_cabinet__c 表

2. **工程管理資料庫 (engineering-management) 只儲存**
   - 專案資料 (projects)
   - 使用者資料 (users)
   - 權限設定 (project_permissions)

3. **R2 儲存**
   - 施工照片檔案（URL 儲存在 CRM）

### 關鍵處理邏輯

1. **棟別處理**
   - `field_WD7k1__c` = NULL 時，顯示為 "A" 棟

2. **施工狀態判斷**
   - `construction_completed__c` = true 時，案場格子顯示綠色
   - `field_23Z5i__c` 標籤欄位顯示詳細狀態

3. **施工人員顯示**
   - `field_u1wpv__c` 儲存工班師父名稱
   - 顯示時取最後一個字作為縮寫

4. **外部顯示名稱**
   - 使用 `field_V32Xl__c` (工班備註) 或 `field_g18hX__c` (工地備註) 儲存管理員備註

### API 呼叫方式

```javascript
// 讀取案場資料
const response = await fetch(
  `${API_BASE_URL}/rest/object_8w9cb__c?field_1P96q__c=${opportunityId}&limit=500`,
  {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`
    }
  }
);

// 更新案場施工資料
const updateData = {
  field_23pFq__c: '2025-01-08',  // 施工日期
  field_B2gh1__c: 25.5,           // 舖設坪數
  construction_completed__c: true, // 施工完成
  field_u1wpv__c: '王師傅',       // 工班師父
  field_3Fqof__c: 'https://r2.url/photo.jpg' // 完工照片
};

const updateResponse = await fetch(
  `${API_BASE_URL}/crud/object_8w9cb__c/${siteId}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  }
);
```