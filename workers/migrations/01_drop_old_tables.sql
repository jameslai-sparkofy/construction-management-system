-- Drop old tables that are being replaced
-- These tables had schema issues and are being replaced with a cleaner design

DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS project_owners;
DROP TABLE IF EXISTS project_permissions;
DROP TABLE IF EXISTS users;