-- 創建工地師父表
CREATE TABLE IF NOT EXISTS object_50hj8__c (
  _id TEXT PRIMARY KEY,
  name TEXT,
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
  life_status TEXT,
  life_status__r TEXT,
  lock_status TEXT,
  lock_status__r TEXT,
  is_deleted BOOLEAN DEFAULT false,
  record_type TEXT,
  version TEXT,
  data_own_department TEXT,
  data_own_department__r TEXT,
  relevant_team TEXT,
  total_num INTEGER,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_version INTEGER DEFAULT 0,
  sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建供應商表
CREATE TABLE IF NOT EXISTS supplierobj (
  _id TEXT PRIMARY KEY,
  name TEXT,
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
  life_status TEXT,
  life_status__r TEXT,
  lock_status TEXT,
  lock_status__r TEXT,
  is_deleted BOOLEAN DEFAULT false,
  record_type TEXT,
  version TEXT,
  data_own_department TEXT,
  data_own_department__r TEXT,
  relevant_team TEXT,
  total_num INTEGER,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_version INTEGER DEFAULT 0,
  sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建案場(浴櫃)表
CREATE TABLE IF NOT EXISTS site_cabinet__c (
  _id TEXT PRIMARY KEY,
  name TEXT,
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
  life_status TEXT,
  life_status__r TEXT,
  lock_status TEXT,
  lock_status__r TEXT,
  is_deleted BOOLEAN DEFAULT false,
  record_type TEXT,
  version TEXT,
  data_own_department TEXT,
  data_own_department__r TEXT,
  relevant_team TEXT,
  total_num INTEGER,
  fx_created_at INTEGER,
  fx_updated_at INTEGER,
  sync_version INTEGER DEFAULT 0,
  sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_object_50hj8__c_life_status ON object_50hj8__c(life_status);
CREATE INDEX IF NOT EXISTS idx_object_50hj8__c_last_modified ON object_50hj8__c(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_object_50hj8__c_owner ON object_50hj8__c(owner);

CREATE INDEX IF NOT EXISTS idx_supplierobj_life_status ON supplierobj(life_status);
CREATE INDEX IF NOT EXISTS idx_supplierobj_last_modified ON supplierobj(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_supplierobj_owner ON supplierobj(owner);

CREATE INDEX IF NOT EXISTS idx_site_cabinet__c_life_status ON site_cabinet__c(life_status);
CREATE INDEX IF NOT EXISTS idx_site_cabinet__c_last_modified ON site_cabinet__c(last_modified_time);
CREATE INDEX IF NOT EXISTS idx_site_cabinet__c_owner ON site_cabinet__c(owner);