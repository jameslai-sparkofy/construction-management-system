-- ================================
-- 完整的 D1 資料庫結構（包含 CRM 案場所有欄位）
-- ================================

-- 1. 案場(SPC)表 - object_8w9cb__c
-- 注意：這是 CRM 同步表，資料從紛享銷客同步
CREATE TABLE IF NOT EXISTS object_8w9cb__c (
  -- 系統欄位
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                     -- 編號（自增）
  owner TEXT,                              -- 負責人
  owner__r TEXT,
  owner_department_id TEXT,
  owner_department TEXT,
  create_time INTEGER,
  created_by TEXT,
  created_by__r TEXT,
  last_modified_time INTEGER,
  last_modified_by TEXT,
  last_modified_by__r TEXT,
  life_status TEXT DEFAULT 'normal',
  life_status__r TEXT,
  lock_status TEXT DEFAULT '0',
  lock_status__r TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  record_type TEXT DEFAULT 'default__c',
  version TEXT,
  data_own_department TEXT,
  data_own_department__r TEXT,
  relevant_team TEXT,                     -- JSON格式
  tenant_id TEXT,
  
  -- 基本資訊欄位
  field_WD7k1__c TEXT,                   -- 棟別
  field_Q6Svh__c REAL,                   -- 樓層
  field_XuJP2__c TEXT,                   -- 戶別
  field_tXAko__c REAL,                   -- 工地坪數
  field_i2Q1g__c TEXT,                   -- 少請坪數（計算欄位）
  
  -- 施工前資料
  field_3T38o__c TEXT,                   -- 平面圖（圖片URL）
  field_sF6fn__c TEXT,                   -- 施工前備註
  field_V3d91__c TEXT,                   -- 施工前照片（圖片URL）
  field_W2i6j__c TEXT,                   -- 施工前缺失（圖片URL）
  field_03U9h__c TEXT,                   -- 工地狀況照片（圖片URL）
  
  -- 施工資料
  field_23pFq__c INTEGER,                -- 施工日期
  field_B2gh1__c REAL,                   -- 舖設坪數
  construction_completed__c BOOLEAN DEFAULT FALSE,  -- 施工完成
  field_3Fqof__c TEXT,                   -- 完工照片（圖片URL）
  field_u1wpv__c TEXT,                   -- 工班師父
  shift_time__c TEXT,                    -- 工班（引用欄位）
  
  -- 驗收資料
  field_v1x3S__c TEXT,                   -- 驗收照片（圖片URL）
  field_n37jC__c TEXT,                   -- 驗收備註
  
  -- 狀態管理
  field_23Z5i__c TEXT,                   -- 標籤（多選：準備中/不可施工/可施工/已完工/需維修/維修完成/其他）
  field_z9H6O__c TEXT,                   -- 階段（單選：準備中/施工前場勘/施工/驗收/缺失維修/其他）
  field_dxr31__c TEXT,                   -- 案場類型（單選：工地/樣品屋/民宅/其他）
  field_dxr31__c__r TEXT,                -- 案場類型顯示
  
  -- 備註欄位
  field_g18hX__c TEXT,                   -- 工地備註（多行文本）
  field_V32Xl__c TEXT,                   -- 工班備註
  field_sijGR__c TEXT,                   -- 維修備註1
  
  -- 關聯欄位
  field_k7e6q__c TEXT,                   -- 工單（查找關聯）
  field_k7e6q__c__r TEXT,                -- 工單名稱
  field_1P96q__c TEXT,                   -- 商機（查找關聯）
  field_1P96q__c__r TEXT,                -- 商機名稱
  field_npLvn__c TEXT,                   -- 請款單（查找關聯）
  field_npLvn__c__r TEXT,                -- 請款單名稱
  
  -- 其他資料
  field_27g6n__c REAL,                   -- 保護板坪數
  field_f0mz3__c INTEGER,                -- 保固日期
  field_1zk34__c TEXT,                   -- 缺失影片（附件）
  bad_case_scene__c BOOLEAN DEFAULT FALSE,  -- 做壞案場
  
  -- 同步控制欄位
  sync_version INTEGER DEFAULT 0,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 案場(SPC)表索引
CREATE INDEX IF NOT EXISTS idx_spc_owner ON object_8w9cb__c(owner);
CREATE INDEX IF NOT EXISTS idx_spc_life_status ON object_8w9cb__c(life_status);
CREATE INDEX IF NOT EXISTS idx_spc_is_deleted ON object_8w9cb__c(is_deleted);
CREATE INDEX IF NOT EXISTS idx_spc_opportunity ON object_8w9cb__c(field_1P96q__c);
CREATE INDEX IF NOT EXISTS idx_spc_building ON object_8w9cb__c(field_WD7k1__c);
CREATE INDEX IF NOT EXISTS idx_spc_floor ON object_8w9cb__c(field_Q6Svh__c);
CREATE INDEX IF NOT EXISTS idx_spc_unit ON object_8w9cb__c(field_XuJP2__c);
CREATE INDEX IF NOT EXISTS idx_spc_status ON object_8w9cb__c(field_23Z5i__c);
CREATE INDEX IF NOT EXISTS idx_spc_completed ON object_8w9cb__c(construction_completed__c);
CREATE INDEX IF NOT EXISTS idx_spc_construction_date ON object_8w9cb__c(field_23pFq__c);

-- ================================

-- 2. 案場(浴櫃)表 - site_cabinet__c
CREATE TABLE IF NOT EXISTS site_cabinet__c (
  -- 系統欄位（與 SPC 相同）
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT,
  owner__r TEXT,
  owner_department_id TEXT,
  owner_department TEXT,
  create_time INTEGER,
  created_by TEXT,
  created_by__r TEXT,
  last_modified_time INTEGER,
  last_modified_by TEXT,
  last_modified_by__r TEXT,
  life_status TEXT DEFAULT 'normal',
  life_status__r TEXT,
  lock_status TEXT DEFAULT '0',
  lock_status__r TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  record_type TEXT DEFAULT 'default__c',
  version TEXT,
  data_own_department TEXT,
  data_own_department__r TEXT,
  relevant_team TEXT,
  tenant_id TEXT,
  
  -- 基本資訊欄位
  field_WD7k1__c TEXT,                   -- 棟別
  field_Q6Svh__c REAL,                   -- 樓層
  field_XuJP2__c TEXT,                   -- 戶別
  location__c TEXT,                      -- 位置（浴櫃專用）
  
  -- 施工資料（與 SPC 相同）
  field_3T38o__c TEXT,                   -- 平面圖
  field_sF6fn__c TEXT,                   -- 施工前備註
  field_V3d91__c TEXT,                   -- 施工前照片
  field_23pFq__c INTEGER,                -- 施工日期
  construction_completed__c BOOLEAN DEFAULT FALSE,
  field_3Fqof__c TEXT,                   -- 完工照片
  field_u1wpv__c TEXT,                   -- 工班師父
  shift_time__c TEXT,                    -- 工班
  
  -- 驗收資料
  field_v1x3S__c TEXT,                   -- 驗收照片
  field_n37jC__c TEXT,                   -- 驗收備註
  field_qEaXB__c INTEGER,                -- 驗屋日期2
  field_xxa7B__c INTEGER,                -- 驗屋日期1
  
  -- 狀態管理（與 SPC 相同）
  field_23Z5i__c TEXT,                   -- 標籤
  field_z9H6O__c TEXT,                   -- 階段
  field_dxr31__c TEXT,                   -- 案場類型
  field_dxr31__c__r TEXT,
  
  -- 維修資料（浴櫃專用）
  field_t2GYf__c TEXT,                   -- 維修單（查找關聯多選）
  field_r1mp8__c INTEGER,                -- 維修日期1
  field_xFCKf__c TEXT,                   -- 維修師父1（查找關聯多選）
  field_7ndUg__c REAL,                   -- 維修費用1
  field_sijGR__c TEXT,                   -- 維修備註1
  field_PuaLk__c TEXT,                   -- 維修完成照片1
  field_tyRfE__c TEXT,                   -- 缺失照片1
  field_OmPo8__c TEXT,                   -- 缺失分類1（多選）
  field_nht8k__c TEXT,                   -- 缺失備註1
  
  -- 維修資料2（浴櫃專用）
  field_2io60__c TEXT,                   -- 維修日期2
  field_3dhaY__c TEXT,                   -- 維修師父2
  field_2jM31__c REAL,                   -- 維修費用2
  field_lZaAp__c TEXT,                   -- 維修備註2
  field_d2O5i__c TEXT,                   -- 維修完成照片2
  field_62279__c TEXT,                   -- 缺失照片2
  field_32Hxs__c TEXT,                   -- 缺失分類2
  field_dXrfQ__c TEXT,                   -- 缺失備註2
  
  -- 備註欄位
  field_g18hX__c TEXT,                   -- 工地備註
  field_V32Xl__c TEXT,                   -- 工班備註
  field_W2i6j__c TEXT,                   -- 施工前缺失
  field_03U9h__c TEXT,                   -- 工地狀況照片
  
  -- 關聯欄位
  field_k7e6q__c TEXT,                   -- 工單
  field_k7e6q__c__r TEXT,
  field_1P96q__c TEXT,                   -- 商機
  field_1P96q__c__r TEXT,
  field_npLvn__c TEXT,                   -- 請款單
  field_npLvn__c__r TEXT,
  
  -- 其他資料
  field_27g6n__c REAL,                   -- 保護板
  field_f0mz3__c INTEGER,                -- 保固日期
  field_1zk34__c TEXT,                   -- 缺失影片
  
  -- 同步控制欄位
  sync_version INTEGER DEFAULT 0,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 案場(浴櫃)表索引
CREATE INDEX IF NOT EXISTS idx_cabinet_owner ON site_cabinet__c(owner);
CREATE INDEX IF NOT EXISTS idx_cabinet_life_status ON site_cabinet__c(life_status);
CREATE INDEX IF NOT EXISTS idx_cabinet_is_deleted ON site_cabinet__c(is_deleted);
CREATE INDEX IF NOT EXISTS idx_cabinet_opportunity ON site_cabinet__c(field_1P96q__c);
CREATE INDEX IF NOT EXISTS idx_cabinet_building ON site_cabinet__c(field_WD7k1__c);
CREATE INDEX IF NOT EXISTS idx_cabinet_floor ON site_cabinet__c(field_Q6Svh__c);
CREATE INDEX IF NOT EXISTS idx_cabinet_unit ON site_cabinet__c(field_XuJP2__c);
CREATE INDEX IF NOT EXISTS idx_cabinet_status ON site_cabinet__c(field_23Z5i__c);
CREATE INDEX IF NOT EXISTS idx_cabinet_completed ON site_cabinet__c(construction_completed__c);

-- ================================

-- 3. 工程管理專案表（本地資料）
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,           -- 關聯到 CRM 商機
  name TEXT NOT NULL,
  spc_engineering TEXT,                   -- JSON: {enabled: boolean, settings: {}}
  cabinet_engineering TEXT,               -- JSON: {enabled: boolean, settings: {}}
  maintenance TEXT,                       -- JSON: 維修設定
  progress_management TEXT,               -- JSON: 進度管理設定
  permissions TEXT,                       -- JSON: 權限設定
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ================================

-- 4. 使用者表（本地資料）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_suffix TEXT NOT NULL,         -- 手機末3碼
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'member',            -- admin/owner/leader/member
  user_projects TEXT,                    -- JSON: 使用者所屬專案列表
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ================================

-- 5. 專案權限表（本地資料）
CREATE TABLE IF NOT EXISTS project_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,                    -- admin/owner/leader/member
  engineering_type TEXT DEFAULT 'ALL',   -- ALL/SPC/CABINET
  can_edit BOOLEAN DEFAULT FALSE,
  can_view_others BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id, engineering_type),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_project ON project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON project_permissions(user_id);

-- ================================

-- 注意事項：
-- 1. 案場資料（object_8w9cb__c, site_cabinet__c）從 CRM 同步，不在本地創建
-- 2. 施工照片儲存在 R2，URL 儲存在 CRM 欄位中
-- 3. 日期欄位使用 INTEGER 儲存 Unix 時間戳（毫秒）
-- 4. 多選欄位儲存為 JSON 格式或逗號分隔
-- 5. field_WD7k1__c (棟別) 為 NULL 時，系統顯示為 "A" 棟