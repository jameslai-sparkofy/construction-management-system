-- Test data for workers (object_50hj8__c)
-- Date: 2025-08-17
-- Purpose: Create test workers for each team

-- Clear existing test data (optional)
-- DELETE FROM object_50hj8__c WHERE _id LIKE 'test_%';

-- Insert test workers for 周華龍工班 (ID: 6510b636909f550001cc8f54)
INSERT OR IGNORE INTO object_50hj8__c (
    _id, name, field_D1087__c, field_D1087__c__r, 
    phone_number__c, abbreviation__c, is_deleted, life_status,
    create_time, last_modified_time
) VALUES 
    -- 周華龍工班的師父
    ('test_worker_001', '賴俊穎', '6510b636909f550001cc8f54', '周華龍工班', 
     '0912345678', '穎', 0, 'normal', datetime('now'), datetime('now')),
    ('test_worker_002', '王大明', '6510b636909f550001cc8f54', '周華龍工班', 
     '0923456789', '明', 0, 'normal', datetime('now'), datetime('now')),
    ('test_worker_003', '李小華', '6510b636909f550001cc8f54', '周華龍工班', 
     '0934567890', '華', 0, 'normal', datetime('now'), datetime('now')),
     
    -- 樂邁(工班)的師父 (假設 ID: 65f67913d1ba220001dbdc87)
    ('test_worker_004', '張三', '65f67913d1ba220001dbdc87', '樂邁(工班)-愛德美特有限公司', 
     '0945678901', '三', 0, 'normal', datetime('now'), datetime('now')),
    ('test_worker_005', '李四', '65f67913d1ba220001dbdc87', '樂邁(工班)-愛德美特有限公司', 
     '0956789012', '四', 0, 'normal', datetime('now'), datetime('now')),
     
    -- 莊聰源師傅的師父 (假設 ID: 655d4014f9b36a00016c48b2)
    ('test_worker_006', '陳五', '655d4014f9b36a00016c48b2', '莊聰源師傅/菲米裝潢工程行', 
     '0967890123', '五', 0, 'normal', datetime('now'), datetime('now')),
    ('test_worker_007', '林六', '655d4014f9b36a00016c48b2', '莊聰源師傅/菲米裝潢工程行', 
     '0978901234', '六', 0, 'normal', datetime('now'), datetime('now'));