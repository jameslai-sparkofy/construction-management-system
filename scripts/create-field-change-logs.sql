-- 創建欄位變更日誌表
CREATE TABLE IF NOT EXISTS field_change_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_api_name TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_details TEXT NOT NULL,
  detected_at DATETIME NOT NULL,
  applied BOOLEAN DEFAULT FALSE,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_field_change_logs_object ON field_change_logs(object_api_name);
CREATE INDEX IF NOT EXISTS idx_field_change_logs_detected ON field_change_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_field_change_logs_applied ON field_change_logs(applied);