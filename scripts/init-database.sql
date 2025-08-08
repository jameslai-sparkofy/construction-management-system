-- 注意：以下示例表結構僅供參考
-- 實際表結構將由動態Schema同步系統根據CRM定義自動生成
-- 請參考 docs/09-動態Schema同步設計.md

-- CRM對象定義表（系統核心表）
CREATE TABLE IF NOT EXISTS fx_object_definitions (
    id TEXT PRIMARY KEY,
    api_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_custom BOOLEAN DEFAULT TRUE,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_synced BOOLEAN DEFAULT FALSE,
    table_name TEXT,
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CRM欄位定義表（系統核心表）
CREATE TABLE IF NOT EXISTS fx_field_definitions (
    id TEXT PRIMARY KEY,
    object_api_name TEXT NOT NULL,
    field_api_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    data_type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    is_custom BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    default_value TEXT,
    options TEXT, -- JSON格式的選項列表
    validation_rules TEXT, -- JSON格式的驗證規則
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(object_api_name, field_api_name),
    FOREIGN KEY (object_api_name) REFERENCES fx_object_definitions(api_name)
);

-- Schema變更記錄表（系統核心表）
CREATE TABLE schema_change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_api_name TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'ADD_FIELD', 'DROP_FIELD', 'MODIFY_FIELD', 'ADD_TABLE'
    field_api_name TEXT,
    old_definition TEXT, -- JSON格式
    new_definition TEXT, -- JSON格式
    sql_executed TEXT,
    status TEXT NOT NULL, -- 'PENDING', 'COMPLETED', 'FAILED'
    error_message TEXT,
    executed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 圖片資產表
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    fx_attachment_id TEXT UNIQUE NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    r2_key TEXT,
    r2_url TEXT,
    thumbnail_r2_key TEXT,
    thumbnail_r2_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- 同步日誌表
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

-- 創建索引
-- 系統表索引
CREATE INDEX idx_fx_object_definitions_api_name ON fx_object_definitions(api_name);
CREATE INDEX idx_fx_object_definitions_is_synced ON fx_object_definitions(is_synced);

CREATE INDEX idx_fx_field_definitions_object ON fx_field_definitions(object_api_name);
CREATE INDEX idx_fx_field_definitions_field ON fx_field_definitions(field_api_name);
CREATE INDEX idx_fx_field_definitions_active ON fx_field_definitions(is_active);

CREATE INDEX idx_schema_change_logs_object ON schema_change_logs(object_api_name);
CREATE INDEX idx_schema_change_logs_status ON schema_change_logs(status);

CREATE INDEX idx_assets_entity ON assets(entity_type, entity_id);
CREATE INDEX idx_assets_fx_attachment_id ON assets(fx_attachment_id);

CREATE INDEX idx_sync_logs_sync_id ON sync_logs(sync_id);
CREATE INDEX idx_sync_logs_entity_type ON sync_logs(entity_type);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);