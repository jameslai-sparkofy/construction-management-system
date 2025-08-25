-- 每日工作日誌功能資料庫遷移
-- 新增每日工作日誌相關表

-- 1. 每日工作日誌表 (依建物分組)
CREATE TABLE IF NOT EXISTS daily_work_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  log_date DATE NOT NULL,
  building_id TEXT,
  building_name TEXT,
  completed_units TEXT, -- JSON array of unit IDs
  completed_count INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  progress_percentage REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, log_date, building_id)
);

-- 2. 每日工作彙總表 (專案總覽)
CREATE TABLE IF NOT EXISTS daily_work_summary (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  log_date DATE NOT NULL,
  total_completed_today INTEGER DEFAULT 0,
  total_completed_cumulative INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  overall_progress_percentage REAL DEFAULT 0.0,
  metadata TEXT, -- JSON with building breakdowns and additional info
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, log_date)
);

-- 建立索引優化查詢效能
CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date ON daily_work_logs(project_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_work_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_building ON daily_work_logs(building_id);

CREATE INDEX IF NOT EXISTS idx_daily_summary_project_date ON daily_work_summary(project_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_work_summary(log_date);

-- 觸發器：自動更新 updated_at
CREATE TRIGGER IF NOT EXISTS update_daily_work_logs_timestamp 
AFTER UPDATE ON daily_work_logs
BEGIN
  UPDATE daily_work_logs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_daily_work_summary_timestamp 
AFTER UPDATE ON daily_work_summary
BEGIN
  UPDATE daily_work_summary SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;