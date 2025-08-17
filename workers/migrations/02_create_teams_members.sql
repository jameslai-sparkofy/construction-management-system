-- Create new teams and members structure based on team-management.md
-- This replaces the old project_members/owners/permissions/users tables

-- Teams table: stores team information
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    site_count INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Members table: stores all members (workers and admins)
CREATE TABLE IF NOT EXISTS members (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    abbreviation TEXT,
    source_type TEXT NOT NULL, -- 'crm_worker', 'crm_admin', 'manual'
    source_id TEXT, -- CRM system ID reference
    password_suffix TEXT, -- Last 3 digits for login
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team memberships: many-to-many relationship between teams and members
CREATE TABLE IF NOT EXISTS team_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'team_member', -- 'team_leader' or 'team_member'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(user_id) ON DELETE CASCADE,
    UNIQUE(team_id, member_id)
);

-- Project teams: which teams are assigned to which projects
CREATE TABLE IF NOT EXISTS project_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(project_id, team_id)
);

-- Project admins: admins assigned to projects
CREATE TABLE IF NOT EXISTS project_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    role TEXT DEFAULT 'admin', -- Can be extended for different admin types
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES members(user_id) ON DELETE CASCADE,
    UNIQUE(project_id, admin_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_source ON members(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_member ON team_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_project_teams_project ON project_teams(project_id);
CREATE INDEX IF NOT EXISTS idx_project_admins_project ON project_admins(project_id);