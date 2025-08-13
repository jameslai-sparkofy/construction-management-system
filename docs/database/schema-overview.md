# 資料庫設計總覽

## 🏛️ 設計理念

採用 **混合式設計**，結合關聯式資料庫的嚴謹性與 NoSQL 的靈活性：

- **核心結構**: 使用傳統關聯式表格
- **彈性資料**: 使用 JSON 欄位儲存配置
- **權限統一**: 單一表格管理所有權限

## 📊 資料庫架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    projects     │    │     users       │    │construction_sites│
│                 │    │                 │    │                 │
│ id (TEXT)       │    │ id (TEXT)       │    │ id (TEXT)       │
│ name            │    │ phone           │    │ project_id      │
│ spc_engineering │◄─┐ │ password_suffix │    │ opportunity_id  │
│ (JSON)          │  │ │ name            │    │ status          │
│ permissions     │  │ │ global_role     │    │ config (JSON)   │
│ (JSON)          │  │ └─────────────────┘    └─────────────────┘
└─────────────────┘  │
         │            │
         ▼            │
┌─────────────────────┼─────────────────┐
│  project_members    │                 │
│                     │                 │
│ project_id ────────┘                 │
│ user_id ─────────────────────────────┘
│ member_type ('team'|'owner')         │
│ team_id (可選)                       │
│ role ('leader'|'member'|'viewer')    │
└─────────────────────┬─────────────────┘
                      │
                      ▼
          ┌─────────────────────┐
          │project_team_        │
          │assignments          │
          │                     │
          │ project_id          │
          │ team_id             │
          │ team_name           │
          │ leader_user_id      │
          │ status              │
          └─────────────────────┘
```

## 🗃️ 核心表格 (7個)

### 1. projects - 專案主表
- **用途**: 專案基本資訊和設定
- **設計**: 混合式 (關聯欄位 + JSON 配置)
- **JSON 欄位**: spc_engineering, cabinet_engineering, permissions

### 2. project_members - 統一權限管理 ⭐
- **用途**: 統一管理工班成員和業主權限
- **創新點**: 用 member_type 區分類型，避免重複設計
- **權限邏輯**: role + member_type 組合控制

### 3. project_team_assignments - 工班配置
- **用途**: 專案工班分配和領隊資訊
- **關聯**: 與 project_members 配合使用

### 4. users - 使用者資料
- **用途**: 統一使用者資料 (工班 + 業主)
- **認證**: 手機號碼 + 後三碼密碼
- **來源**: source_type 標記資料來源 (CRM)

### 5. construction_sites - 案場資料
- **用途**: 建案案場資訊
- **彈性**: config JSON 儲存案場特殊設定

### 6. project_activity_logs - 活動記錄
- **用途**: 操作日誌和審計追蹤
- **格式**: changes JSON 儲存變更內容

### 7. construction_progress - 施工進度
- **用途**: 案場施工狀態追蹤
- **狀態**: pending, in_progress, completed, repair_needed

## 🔑 統一權限設計重點

```sql
-- 核心設計理念
CREATE TABLE project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  member_type TEXT NOT NULL,  -- 'team' 或 'owner'
  team_id TEXT,              -- team 成員才有值
  role TEXT DEFAULT 'member', -- 'leader', 'member', 'viewer'
  UNIQUE(project_id, user_id, team_id)
);
```

### 權限邏輯
- **工班成員**: member_type='team', team_id=有值, role='leader'|'member'
- **業主**: member_type='owner', team_id=NULL, role='viewer'
- **管理員**: global_role='admin' (在 users 表)

## 🔄 資料同步策略

### CRM 同步 (DB_CRM → DB_ENGINEERING)
1. **商機資料**: opportunities → projects
2. **工班資料**: workers → users + project_members  
3. **業主資料**: contacts → users + project_members
4. **案場資料**: sites → construction_sites

### 同步頻率
- **即時同步**: 專案建立時
- **定期同步**: 每日更新工班和業主資料
- **手動同步**: 提供 API 端點強制同步

## 📈 效能考量

### 查詢優化
```sql
-- 常用查詢已建立索引
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_construction_sites_project ON construction_sites(project_id);
```

### 資料量預估
- **專案**: ~100個/年
- **使用者**: ~500個 (工班+業主)
- **案場**: ~10,000個/專案
- **活動記錄**: ~50,000筆/專案

## 🛠️ 維護指南

### Schema 更新
1. 新增 migration 檔案到 `/migrations/`
2. 測試本地資料庫
3. 部署到遠端: `wrangler d1 execute DB_ENGINEERING --remote --file=new_migration.sql`

### 資料備份
- D1 原生不支援直接備份
- 建議定期匯出重要資料到 R2
- 關鍵資料同步到 CRM 系統

---

**Schema 檔案**: `workers/schema-final.sql`  
**最後更新**: 2025-08-11  
**版本**: 1.0.0