-- Create test project with opportunity_id that matches our test sites
INSERT OR IGNORE INTO projects (
    id, name, opportunity_id, status, created_at, updated_at
) VALUES (
    'proj_test_teams', 
    '測試工班專案', 
    'demo_project_123',  -- This matches our test sites data
    'active',
    datetime('now'),
    datetime('now')
);