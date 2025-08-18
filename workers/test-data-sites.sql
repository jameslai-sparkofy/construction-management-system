-- Test data for project sites (object_d1ae2__c)
-- Date: 2025-08-17
-- Purpose: Create test sites with team assignments for demo project

-- Clear existing test data for demo project (optional)
-- DELETE FROM object_d1ae2__c WHERE opportunity__c = 'demo_project_123';

-- Insert test sites for demo project with different teams
INSERT OR IGNORE INTO object_d1ae2__c (
    _id, opportunity__c, shift_time__c, name,
    is_deleted, life_status, create_time, last_modified_time
) VALUES 
    -- Sites assigned to 周華龍工班
    ('test_site_001', 'demo_project_123', '周華龍工班', '測試案場-浴室1', 
     0, 'normal', datetime('now'), datetime('now')),
    ('test_site_002', 'demo_project_123', '周華龍工班', '測試案場-廚房1', 
     0, 'normal', datetime('now'), datetime('now')),
     
    -- Sites assigned to 樂邁(工班)-愛德美特有限公司
    ('test_site_003', 'demo_project_123', '樂邁(工班)-愛德美特有限公司', '測試案場-浴室2', 
     0, 'normal', datetime('now'), datetime('now')),
     
    -- Sites assigned to 莊聰源師傅/菲米裝潢工程行
    ('test_site_004', 'demo_project_123', '莊聰源師傅/菲米裝潢工程行', '測試案場-廚房2', 
     0, 'normal', datetime('now'), datetime('now'));