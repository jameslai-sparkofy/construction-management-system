-- 創建 Webhook 日誌表
CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  object_api_name TEXT NOT NULL,
  object_id TEXT NOT NULL,
  payload TEXT,
  received_at DATETIME NOT NULL,
  processed_at DATETIME,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_object ON webhook_logs(object_api_name, object_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at);