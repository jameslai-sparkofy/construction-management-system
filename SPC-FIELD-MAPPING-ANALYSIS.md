# SPC 案場欄位對應表分析

## 📋 **問題診斷結果**

根據診斷，發現主要問題：
1. **欄位名稱錯誤**: 前端使用 `field_before_notes__c` 但應該是 `field_sF6fn__c`
2. **API 路由問題**: Worker API 的 `/rest/object_8W9cb__c` 路由可能未正確實現

## 🗃️ **CRM API 標準欄位 vs 前端映射對比**

| 功能 | 前端 fieldMapping | CRM 實際欄位 API 名稱 | 中文名稱 | 欄位類型 | 狀態 |
|------|------------------|-------------------|--------|---------|------|
| 施工前備註 | `field_before_notes__c` ❌ | `field_sF6fn__c` ✅ | 施工前備註 | 单行文本 | **不匹配** |
| 棟別 | `field_WD7k1__c` ✅ | `field_WD7k1__c` ✅ | 棟別 | 单行文本 | 匹配 |
| 樓層 | `field_Q6Svh__c` ✅ | `field_Q6Svh__c` ✅ | 樓層 | 数字 | 匹配 |
| 戶別 | `field_XuJP2__c` ✅ | `field_XuJP2__c` ✅ | 戶別 | 单行文本 | 匹配 |
| 工班 | `shift_time__c` ✅ | `shift_time__c` ✅ | 工班 | 引用字段 | 匹配 |
| 鋪設坪數 | `field_B2gh1__c` ✅ | `field_B2gh1__c` ✅ | 舖設坪數 | 数字 | 匹配 |
| 工班師父 | `field_u1wpv__c` ✅ | `field_u1wpv__c` ✅ | 工班師父 | 单行文本 | 匹配 |
| 施工日期 | `field_23pFq__c` ✅ | `field_23pFq__c` ✅ | 施工日期 | 日期 | 匹配 |
| 施工完成 | `construction_completed__c` ✅ | `construction_completed__c` ✅ | 施工完成 | 布尔值 | 匹配 |
| 平面圖 | `field_3T38o__c` ✅ | `field_3T38o__c` ✅ | 平面圖 | 图片 | 匹配 |
| 施工前照片 | `field_V3d91__c` ✅ | `field_V3d91__c` ✅ | 施工前照片 | 图片 | 匹配 |
| 完工照片 | `field_3Fqof__c` ✅ | `field_3Fqof__c` ✅ | 完工照片 | 图片 | 匹配 |
| 標籤 | `field_23Z5i__c` ✅ | `field_23Z5i__c` ✅ | 標籤 | 多选 | 匹配 |
| 階段 | `field_z9H6O__c` ✅ | `field_z9H6O__c` ✅ | 階段 | 单选 | 匹配 |
| 工地坪數 | `field_tXAko__c` ✅ | `field_tXAko__c` ✅ | 工地坪數 | 数字 | 匹配 |
| 商機關聯 | `field_1P96q__c` ✅ | `field_1P96q__c` ✅ | 商機 | 查找关联 | 匹配 |
| 工班施工完備註 | `work_shift_completion_note__c` ✅ | `work_shift_completion_note__c` ✅ | 工班施工完備註 | 多行文本 | 匹配 |
| 工地狀況照片(施工後) | `construction_difficulty_ph__c` ✅ | `construction_difficulty_ph__c` ✅ | 工地狀況照片(施工後) | 图片 | 匹配 |

## 🔧 **需要修復的欄位**

### 1. 施工前備註欄位錯誤

**前端錯誤映射**:
```javascript
beforeNotes: 'field_before_notes__c',   // ❌ 錯誤
```

**應該修正為**:
```javascript
beforeNotes: 'field_sF6fn__c',          // ✅ 正確
```

## 🌐 **API 路由問題**

根據診斷結果，Worker API 的路由存在問題：
- `/rest/object_8W9cb__c` 返回 404
- 需要檢查 Worker 中是否正確實現了這個路由

## 📝 **其他發現的欄位**

CRM 中還有一些前端未映射的欄位：

| CRM 欄位 API 名稱 | 中文名稱 | 欄位類型 | 前端是否使用 |
|------------------|---------|---------|-------------|
| `field_27g6n__c` | 保護板坪數 | 数字 | ❌ 未使用 |
| `field_v1x3S__c` | 驗收照片 | 图片 | ❌ 未使用 |
| `field_f0mz3__c` | 保固日期 | 日期 | ❌ 未使用 |
| `field_i2Q1g__c` | 少請坪數 | 计算字段 | ❌ 未使用 |
| `field_03U9h__c` | 工地狀況照片(施工前) | 图片 | ❌ 未使用 |
| `bad_case_scene__c` | 做壞案場 | 布尔值 | ❌ 未使用 |
| `field_npLvn__c` | 請款單 | 查找关联 | ❌ 未使用 |
| `field_1zk34__c` | 缺失影片 | 附件 | ❌ 未使用 |
| `field_k7e6q__c` | 工單 | 查找关联 | ❌ 未使用 |
| `field_n37jC__c` | 驗收備註 | 单行文本 | ❌ 未使用 |
| `field_g18hX__c` | 工地備註 | 多行文本 | ❌ 未使用 |
| `field_W2i6j__c` | 施工前缺失 | 图片 | ❌ 未使用 |
| `field_dxr31__c` | 案場類型 | 单选 | ❌ 未使用 |

## 🚀 **立即修復方案**

### 1. 修復前端欄位映射
```javascript
// 在 project-detail.html 中修正
const fieldMapping = {
    // ... 其他欄位保持不變
    beforeNotes: 'field_sF6fn__c',   // 修正施工前備註欄位
    // ... 其他欄位
};
```

### 2. 檢查 Worker API 路由
需要確保 Worker API 中正確實現了：
- `PATCH /rest/object_8W9cb__c/:id` 路由
- 正確的 D1 資料庫欄位映射

### 3. 測試流程
1. 修復欄位映射
2. 重新部署前端
3. 測試案場更新功能
4. 驗證資料是否正確寫入 D1

## ⚠️ **注意事項**

1. **欄位名稱區分大小寫**: CRM API 欄位名稱必須完全匹配
2. **資料類型轉換**: 數字欄位需要確保資料格式正確
3. **圖片欄位**: 圖片欄位可能需要特殊處理（URL vs Base64）
4. **日期格式**: 日期欄位需要確保格式符合 CRM 要求

這個分析表明主要問題是前端的欄位映射錯誤，修復後應該能解決寫入問題。