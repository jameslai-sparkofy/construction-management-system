-- 移除案場表的唯一約束
-- SQLite 不支持直接刪除約束，需要重建表

-- 0. 先刪除依賴的視圖
DROP VIEW IF EXISTS v_opportunity_site;

-- 1. 創建新表（沒有 UNIQUE 約束）
CREATE TABLE IF NOT EXISTS object_8w9cb__c_new (
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
  total_num INTEGER,
  
  -- 自定義欄位
  field_k7e6q__c TEXT,
  field_k7e6q__c__r TEXT,
  field_k7e6q__c__relation_ids TEXT,
  field_1P96q__c TEXT,
  field_1P96q__c__r TEXT,
  field_1P96q__c__relation_ids TEXT,
  field_npLvn__c TEXT,
  field_npLvn__c__r TEXT,
  field_npLvn__c__relation_ids TEXT,
  field_WD7k1__c TEXT,
  field_XuJP2__c TEXT,
  field_i2Q1g__c TEXT,
  field_tXAko__c TEXT,
  field_Q6Svh__c TEXT,
  field_23Z5i__c TEXT,
  field_23Z5i__c__r TEXT,
  field_dxr31__c TEXT,
  field_dxr31__c__r TEXT,
  
  -- 同步控制欄位
  sync_version INTEGER DEFAULT 0,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 複製數據
INSERT INTO object_8w9cb__c_new SELECT * FROM object_8w9cb__c;

-- 3. 刪除舊表
DROP TABLE object_8w9cb__c;

-- 4. 重命名新表
ALTER TABLE object_8w9cb__c_new RENAME TO object_8w9cb__c;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_spc_owner ON object_8w9cb__c(owner);
CREATE INDEX IF NOT EXISTS idx_spc_life_status ON object_8w9cb__c(life_status);
CREATE INDEX IF NOT EXISTS idx_spc_is_deleted ON object_8w9cb__c(is_deleted);
CREATE INDEX IF NOT EXISTS idx_spc_last_modified ON object_8w9cb__c(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_spc_project ON object_8w9cb__c(field_k7e6q__c);
CREATE INDEX IF NOT EXISTS idx_spc_building ON object_8w9cb__c(field_WD7k1__c);
CREATE INDEX IF NOT EXISTS idx_spc_floor ON object_8w9cb__c(field_npLvn__c);
CREATE INDEX IF NOT EXISTS idx_spc_unit ON object_8w9cb__c(field_XuJP2__c);
CREATE INDEX IF NOT EXISTS idx_spc_status ON object_8w9cb__c(field_23Z5i__c);

-- 6. 重建視圖
CREATE VIEW IF NOT EXISTS v_opportunity_site AS
SELECT 
  o._id as opportunity_id,
  o.name as opportunity_name,
  o.field_rU4l5__c as site_name,
  o.account_id__r as customer_name,
  o.amount,
  o.sales_stage__r as stage,
  s._id as site_id,
  s.field_k7e6q__c__r as project_name,
  s.field_WD7k1__c as building,
  s.field_XuJP2__c as unit,
  s.field_npLvn__c__r as floor_name,
  s.field_23Z5i__c__r as site_status
FROM newopportunityobj o
LEFT JOIN object_8w9cb__c s ON o.field_rU4l5__c LIKE '%' || s.name || '%'
WHERE o.is_deleted = FALSE AND (s.is_deleted = FALSE OR s.is_deleted IS NULL);