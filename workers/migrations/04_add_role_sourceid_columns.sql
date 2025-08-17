-- Migration: Add role and source_id columns to project_users table
-- Date: 2025-08-17
-- Purpose: Support team member/leader roles and track source record IDs

-- Add role column to distinguish between member and leader
ALTER TABLE project_users ADD COLUMN role TEXT DEFAULT 'member';

-- Add source_id column to store the original record ID from source table
ALTER TABLE project_users ADD COLUMN source_id TEXT;

-- Create index for efficient querying by source_id
CREATE INDEX IF NOT EXISTS idx_project_users_source_id ON project_users(source_id);

-- Update existing records to have source_id from user_id (for CRM workers)
UPDATE project_users 
SET source_id = REPLACE(user_id, 'crm_worker_', '')
WHERE user_id LIKE 'crm_worker_%' AND source_id IS NULL;