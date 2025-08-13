-- 更新 projects 表結構，新增狀態和日期欄位
-- 執行命令: npx wrangler d1 execute DB_ENGINEERING --file=update-project-status.sql --remote

-- 1. 新增專案狀態欄位
ALTER TABLE projects ADD COLUMN project_status VARCHAR(20) DEFAULT 'not_started';

-- 2. 新增開始日期欄位
ALTER TABLE projects ADD COLUMN start_date DATE;

-- 3. 新增結束日期欄位
ALTER TABLE projects ADD COLUMN end_date DATE;

-- 4. 新增狀態索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(project_status);

-- 5. 更新現有專案狀態（已存在的專案設為進行中）
UPDATE projects 
SET project_status = 'in_progress' 
WHERE project_status IS NULL OR project_status = '';

-- 6. 查詢更新結果
SELECT 
    id, 
    name, 
    project_status, 
    start_date, 
    end_date, 
    created_at,
    updated_at
FROM projects 
ORDER BY created_at DESC 
LIMIT 10;