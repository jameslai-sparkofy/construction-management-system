-- Simplify database structure to single table
-- Drop the complex 5-table structure and use a simple single table

-- Drop all the complex tables
DROP TABLE IF EXISTS project_admins;
DROP TABLE IF EXISTS project_teams;
DROP TABLE IF EXISTS team_memberships;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS members;

-- Create single simplified table for project users
CREATE TABLE IF NOT EXISTS project_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL,  -- 'admin', 'owner', 'worker'
    team_id TEXT,              -- Team ID for workers (from SupplierObj)
    team_name TEXT,            -- Team name for display
    name TEXT NOT NULL,
    phone TEXT,
    nickname TEXT,             -- Abbreviation/nickname
    source_table TEXT,         -- 'employees_simple', 'object_50hj8__c', etc
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT,
    UNIQUE(project_id, user_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_project_users_project ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_type ON project_users(user_type);
CREATE INDEX IF NOT EXISTS idx_project_users_team ON project_users(team_id);
CREATE INDEX IF NOT EXISTS idx_project_users_phone ON project_users(phone);