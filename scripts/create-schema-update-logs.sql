-- 創建結構更新日誌表
CREATE TABLE IF NOT EXISTS schema_update_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  update_type TEXT NOT NULL,
  update_details TEXT NOT NULL,
  status TEXT NOT NULL,
  executed_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schema_update_logs_table ON schema_update_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_schema_update_logs_executed ON schema_update_logs(executed_at);