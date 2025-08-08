-- ================================
-- 紛享銷客 CRM 同步資料庫結構
-- ================================

-- 1. 商機對象表 (NewOpportunityObj)
CREATE TABLE IF NOT EXISTS newopportunityobj (
  -- 系統欄位
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount TEXT,
  close_date INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  account_id__r TEXT,
  sales_stage TEXT NOT NULL,
  sales_stage__r TEXT,
  sales_status TEXT,
  sales_status__r TEXT,
  sales_process_id TEXT NOT NULL,
  sales_process_id__r TEXT,
  probability INTEGER,
  probability_amount TEXT,
  owner TEXT,
  owner__r TEXT,
  owner_department_id TEXT,
  owner_department TEXT,
  opp_discount INTEGER,
  opp_lines_sum TEXT,
  relevant_team TEXT, -- JSON格式
  create_time INTEGER,
  created_by TEXT,
  created_by__r TEXT,
  last_modified_time INTEGER,
  last_modified_by TEXT,
  last_modified_by__r TEXT,
  last_followed_time INTEGER,
  stg_changed_time INTEGER,
  cost_time TEXT,
  lock_status TEXT DEFAULT '0',
  lock_status__r TEXT,
  life_status TEXT DEFAULT 'normal',
  life_status__r TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  record_type TEXT DEFAULT 'default__c',
  version TEXT,
  data_own_department TEXT,
  data_own_department__r TEXT,
  
  -- 自定義欄位 (依實際查詢結果)
  field_rU4l5__c TEXT,        -- 工地名或案場名
  field_SdEgv__c TEXT,        -- 需求描述 (必填)
  field_nI1xS__c TEXT,        -- 案場地址或地段
  field_lmjjf__c TEXT,        -- 商機可能性 (必填)
  field_lmjjf__c__r TEXT,     -- 商機可能性顯示
  field_UJ7fD__c TEXT,        -- 實體層或樣品屋
  field_UJ7fD__c__r TEXT,     -- 實體層或樣品屋顯示
  field_e8m3q__c TEXT,        -- 浴室(地)坪數
  field_vE1Zn__c TEXT,        -- 浴室(壁)坪數
  field_5co25__c TEXT,        -- 室內坪數
  field_i32Uj__c TEXT,        -- 二丁掛數量(萬)
  
  -- CSV中定義的其他欄位
  field_n4qm3__c INTEGER,     -- 預計拆架日
  field_3e2B2__c TEXT,        -- GMAP定位
  field_g927h__c TEXT,        -- 維修管理表
  field_3NRfq__c TEXT,        -- 客户是否确认报价
  field_Kt4Pg__c INTEGER,     -- 開工日期
  field_11xou__c INTEGER,     -- 舖土面日期
  field_hh49z__c INTEGER,     -- 總戶數
  field_bgi37__c TEXT,        -- 建案名稱
  field_IZys1__c INTEGER,     -- 頂樓完成日
  field_Rd32h__c TEXT,        -- 預計簽約季度 (必填)
  field_2zhjh__c TEXT,        -- 案場備註
  field_zO24t__c INTEGER,     -- 地上層數
  field_0t3OP__c TEXT,        -- 施工管理表
  field_ncsUJ__c TEXT,        -- 缺失追蹤表
  field_Mrn1l__c INTEGER,     -- 棟數
  field_mNxa4__c INTEGER,     -- 浴室間數
  field_DlN6M__c TEXT,        -- 認列比例
  field_Mss6d__c INTEGER,     -- 預計交屋日期
  field_iPvRk__c INTEGER,     -- 3房戶數
  field_zYRAu__c INTEGER,     -- 實體層或樣品屋日期
  field_30rKQ__c INTEGER,     -- 地下層數
  field_0oEz1__c INTEGER,     -- 1房戶數
  field_ax2Bf__c INTEGER,     -- 2房戶數
  field_w04Lk__c INTEGER,     -- 4房戶數
  
  -- 同步控制欄位
  sync_version INTEGER DEFAULT 0,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 商機表索引
CREATE INDEX IF NOT EXISTS idx_opp_account_id ON newopportunityobj(account_id);
CREATE INDEX IF NOT EXISTS idx_opp_owner ON newopportunityobj(owner);
CREATE INDEX IF NOT EXISTS idx_opp_sales_stage ON newopportunityobj(sales_stage);
CREATE INDEX IF NOT EXISTS idx_opp_close_date ON newopportunityobj(close_date);
CREATE INDEX IF NOT EXISTS idx_opp_life_status ON newopportunityobj(life_status);
CREATE INDEX IF NOT EXISTS idx_opp_is_deleted ON newopportunityobj(is_deleted);
CREATE INDEX IF NOT EXISTS idx_opp_last_modified ON newopportunityobj(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_opp_site_name ON newopportunityobj(field_rU4l5__c);

-- ================================

-- 2. 案場對象表 (object_8W9cb__c)
CREATE TABLE IF NOT EXISTS object_8w9cb__c (
  -- 系統欄位
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
  relevant_team TEXT, -- JSON格式
  total_num INTEGER,
  
  -- 自定義欄位
  field_k7e6q__c TEXT,        -- 建案ID
  field_k7e6q__c__r TEXT,     -- 建案名稱
  field_k7e6q__c__relation_ids TEXT,
  field_1P96q__c TEXT,        -- 年度建案ID
  field_1P96q__c__r TEXT,     -- 年度建案名稱
  field_1P96q__c__relation_ids TEXT,
  field_npLvn__c TEXT,        -- 樓層ID
  field_npLvn__c__r TEXT,     -- 樓層名稱
  field_npLvn__c__relation_ids TEXT,
  field_WD7k1__c TEXT,        -- 棟別
  field_XuJP2__c TEXT,        -- 戶別
  field_i2Q1g__c TEXT,        -- 坪數1
  field_tXAko__c TEXT,        -- 坪數2
  field_Q6Svh__c TEXT,        -- 面積
  field_23Z5i__c TEXT,        -- 狀態 (JSON陣列)
  field_23Z5i__c__r TEXT,     -- 狀態顯示
  field_dxr31__c TEXT,        -- 類型
  field_dxr31__c__r TEXT,     -- 類型顯示
  
  -- 同步控制欄位
  sync_version INTEGER DEFAULT 0,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 複合唯一鍵（建案+棟別+樓層+戶別）
  UNIQUE(field_k7e6q__c, field_WD7k1__c, field_npLvn__c, field_XuJP2__c)
);

-- 案場表索引
CREATE INDEX IF NOT EXISTS idx_spc_owner ON object_8w9cb__c(owner);
CREATE INDEX IF NOT EXISTS idx_spc_life_status ON object_8w9cb__c(life_status);
CREATE INDEX IF NOT EXISTS idx_spc_is_deleted ON object_8w9cb__c(is_deleted);
CREATE INDEX IF NOT EXISTS idx_spc_last_modified ON object_8w9cb__c(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_spc_project ON object_8w9cb__c(field_k7e6q__c);
CREATE INDEX IF NOT EXISTS idx_spc_building ON object_8w9cb__c(field_WD7k1__c);
CREATE INDEX IF NOT EXISTS idx_spc_floor ON object_8w9cb__c(field_npLvn__c);
CREATE INDEX IF NOT EXISTS idx_spc_unit ON object_8w9cb__c(field_XuJP2__c);
CREATE INDEX IF NOT EXISTS idx_spc_status ON object_8w9cb__c(field_23Z5i__c);

-- ================================

-- 3. 同步記錄表（已在init-database.sql中定義）
-- 這裡只是確保表存在
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  details TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_id ON sync_logs(sync_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_entity_type ON sync_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);

-- ================================

-- 4. 商機與案場關聯檢視（方便查詢）
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

-- ================================

-- 5. 同步統計檢視
CREATE VIEW IF NOT EXISTS v_sync_statistics AS
SELECT 
  entity_type,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as success_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
  COUNT(*) as total_count,
  MAX(completed_at) as last_sync_time,
  AVG(CASE 
    WHEN status = 'COMPLETED' AND completed_at IS NOT NULL 
    THEN (julianday(completed_at) - julianday(started_at)) * 86400 
  END) as avg_duration_seconds
FROM sync_logs
GROUP BY entity_type;

-- ================================

-- 使用說明：
-- 1. 執行此腳本創建所有必要的表和索引
-- 2. 商機表使用小寫的 newopportunityobj
-- 3. 案場表使用小寫的 object_8w9cb__c
-- 4. 所有欄位名稱保持與CRM一致
-- 5. 日期欄位使用INTEGER儲存Unix時間戳（毫秒）
-- 6. 陣列欄位（如owner）儲存第一個元素的ID
-- 7. 複雜對象（如relevant_team）使用JSON格式儲存