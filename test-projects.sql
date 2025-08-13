-- Check if projects table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='projects';

-- Count projects
SELECT COUNT(*) as total_projects FROM projects;

-- Show all projects
SELECT * FROM projects;