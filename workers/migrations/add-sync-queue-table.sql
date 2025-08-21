-- 同步隊列表，用於背景同步 D1 → CRM
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_type TEXT NOT NULL,           -- 對象類型：site, worker 等
  object_id TEXT NOT NULL,             -- 對象 ID（CRM ID）
  operation TEXT NOT NULL,             -- 操作類型：create, update, delete
  data TEXT NOT NULL,                  -- 要同步的資料（JSON）
  status TEXT NOT NULL DEFAULT 'pending', -- 狀態：pending, completed, failed
  retry_count INTEGER DEFAULT 0,       -- 重試次數
  error_message TEXT,                  -- 錯誤訊息
  next_retry_at DATETIME,              -- 下次重試時間
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME               -- 完成時間
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_object ON sync_queue(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(next_retry_at) WHERE status = 'pending';

-- 工地師父表，儲存 CRM ID
CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crm_id TEXT UNIQUE NOT NULL,         -- 儲存 CRM 的 _id
  name TEXT NOT NULL,
  phone TEXT,
  abbreviation TEXT,
  password TEXT,
  account TEXT,
  line_user_id TEXT,
  team_id TEXT,                        -- 關聯到工班
  avatar_url TEXT,                     -- 頭像 URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'synced'    -- 同步狀態
);

-- 工地師父索引
CREATE INDEX IF NOT EXISTS idx_workers_crm_id ON workers(crm_id);
CREATE INDEX IF NOT EXISTS idx_workers_team ON workers(team_id);
CREATE INDEX IF NOT EXISTS idx_workers_phone ON workers(phone);