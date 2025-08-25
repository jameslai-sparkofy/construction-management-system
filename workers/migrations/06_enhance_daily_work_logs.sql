-- 增強每日工作日誌功能
-- 新增備註、圖片上傳、刪除功能等

-- 1. 為 daily_work_summary 增加欄位
ALTER TABLE daily_work_summary ADD COLUMN notes TEXT; -- 工務備註
ALTER TABLE daily_work_summary ADD COLUMN notes_images TEXT; -- JSON array of image URLs
ALTER TABLE daily_work_summary ADD COLUMN created_by TEXT; -- 創建者
ALTER TABLE daily_work_summary ADD COLUMN generation_type TEXT DEFAULT 'manual'; -- manual/auto
ALTER TABLE daily_work_summary ADD COLUMN can_delete INTEGER DEFAULT 1; -- 是否可刪除(3天內)
ALTER TABLE daily_work_summary ADD COLUMN last_site_update DATETIME; -- 最後案場更新時間

-- 2. 新增定時任務記錄表
CREATE TABLE IF NOT EXISTS daily_log_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_date DATE NOT NULL,
  projects_processed INTEGER DEFAULT 0,
  logs_generated INTEGER DEFAULT 0,
  logs_skipped INTEGER DEFAULT 0,
  execution_status TEXT DEFAULT 'pending', -- pending/running/completed/failed
  execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  metadata TEXT, -- JSON with detailed info
  UNIQUE(schedule_date)
);

-- 3. 新增日誌分享記錄表
CREATE TABLE IF NOT EXISTS daily_log_shares (
  id TEXT PRIMARY KEY, -- share-{summary_id}
  summary_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  log_date DATE NOT NULL,
  shared_by TEXT,
  share_token TEXT UNIQUE,
  expires_at DATETIME,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (summary_id) REFERENCES daily_work_summary(id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_schedules_date ON daily_log_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON daily_log_schedules(execution_status);
CREATE INDEX IF NOT EXISTS idx_shares_token ON daily_log_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_project_date ON daily_log_shares(project_id, log_date);

-- 更新觸發器以處理 can_delete 狀態
CREATE TRIGGER IF NOT EXISTS update_daily_work_summary_delete_status
AFTER UPDATE ON daily_work_summary
WHEN OLD.created_at != NEW.created_at OR NEW.can_delete = 1
BEGIN
  -- 3天後自動設為不可刪除
  UPDATE daily_work_summary 
  SET can_delete = CASE 
    WHEN datetime('now') > datetime(NEW.created_at, '+3 days') THEN 0 
    ELSE NEW.can_delete 
  END
  WHERE id = NEW.id;
END;