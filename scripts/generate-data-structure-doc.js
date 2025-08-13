#!/usr/bin/env node

/**
 * 自動從 schema 文件生成資料結構文檔
 * 確保文檔與實際資料庫結構同步
 */

const fs = require('fs');
const path = require('path');

// 讀取 schema 文件
const schemaPath = path.join(__dirname, '../workers/schema-engineering.sql');
const outputPath = path.join(__dirname, '../engineering-data-structure-auto.csv');

// 解析 SQL schema
function parseSchema(schemaContent) {
    const tables = [];
    const lines = schemaContent.split('\n');
    
    let currentTable = null;
    let inCreateTable = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 檢測 CREATE TABLE 開始
        if (line.match(/CREATE TABLE IF NOT EXISTS (\w+)/)) {
            const match = line.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
            currentTable = {
                name: match[1],
                fields: [],
                comment: ''
            };
            
            // 尋找前面的註釋
            for (let j = i - 1; j >= 0; j--) {
                const prevLine = lines[j].trim();
                if (prevLine.startsWith('--')) {
                    const comment = prevLine.replace(/^--\s*/, '').replace(/^\d+\.\s*/, '');
                    if (comment.includes('表')) {
                        currentTable.comment = comment;
                        break;
                    }
                }
            }
            
            inCreateTable = true;
            tables.push(currentTable);
            continue;
        }
        
        // 檢測 CREATE TABLE 結束
        if (inCreateTable && line === ');') {
            inCreateTable = false;
            currentTable = null;
            continue;
        }
        
        // 解析欄位
        if (inCreateTable && currentTable && line && !line.startsWith('FOREIGN KEY') && !line.startsWith('UNIQUE')) {
            // 解析欄位定義
            const fieldMatch = line.match(/^(\w+)\s+([^,]+?)(?:,|$)/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const fieldDef = fieldMatch[2];
                
                // 尋找前面的註釋
                let fieldComment = '';
                for (let j = i - 1; j >= 0; j--) {
                    const prevLine = lines[j].trim();
                    if (prevLine.startsWith('--')) {
                        fieldComment = prevLine.replace(/^--\s*/, '');
                        break;
                    } else if (prevLine && !prevLine.startsWith('--')) {
                        break;
                    }
                }
                
                // 從行尾註釋獲取說明
                const inlineCommentMatch = line.match(/--\s*(.+)$/);
                if (inlineCommentMatch) {
                    fieldComment = inlineCommentMatch[1];
                }
                
                currentTable.fields.push({
                    name: fieldName,
                    type: fieldDef,
                    comment: fieldComment
                });
            }
        }
    }
    
    return tables;
}

// 生成 CSV 內容
function generateCSV(tables) {
    const rows = [];
    
    // CSV 標題
    rows.push('表名,表說明,欄位名稱,欄位ID,資料類型,說明,範例值');
    
    // 為每個表生成行
    for (const table of tables) {
        // 第一個欄位包含表名和說明
        for (let i = 0; i < table.fields.length; i++) {
            const field = table.fields[i];
            const tableName = i === 0 ? table.name : '';
            const tableComment = i === 0 ? table.comment : '';
            
            // 生成範例值
            const exampleValue = generateExampleValue(table.name, field.name, field.type);
            
            rows.push([
                tableName,
                tableComment,
                translateFieldName(field.name, field.comment),
                field.name,
                field.type,
                field.comment || '',
                exampleValue
            ].join(','));
        }
        
        // 表之間加空行
        rows.push(',,,,,,');
    }
    
    return rows.join('\n');
}

// 翻譯欄位名稱
function translateFieldName(fieldId, comment) {
    const translations = {
        'id': 'ID',
        'opportunity_id': '商機ID',
        'name': '名稱',
        'spc_engineering': 'SPC工程設定',
        'cabinet_engineering': '浴櫃工程設定',
        'maintenance': '維修單設定',
        'progress_management': '進度管理設定',
        'permissions': '權限設定',
        'cached_stats': '統計快取',
        'stats_updated_at': '統計更新時間',
        'status': '狀態',
        'created_by': '建立者',
        'created_at': '建立時間',
        'updated_at': '更新時間',
        'phone': '手機號碼',
        'password_suffix': '密碼後綴',
        'email': '電子郵件',
        'role': '角色',
        'user_projects': '可存取專案',
        'session_token': '會話令牌',
        'last_login': '最後登入',
        'is_active': '是否啟用',
        'project_id': '專案ID',
        'user_id': '使用者ID',
        'engineering_type': '工程類型',
        'can_edit': '可編輯',
        'can_view_others': '可查看他人',
        'site_id': '案場ID',
        'before_photo_url': '施工前照片',
        'after_photo_url': '施工後照片',
        'floor_plan_url': '平面圖',
        'construction_area': '施工面積',
        'construction_date': '施工日期',
        'worker_id': '工人ID',
        'worker_name': '工人姓名',
        'notes': '備註',
        'external_display_name': '外部顯示名稱',
        'activity_type': '活動類型',
        'target_type': '目標類型',
        'target_id': '目標ID',
        'description': '描述',
        'metadata': '元資料',
        'login_time': '登入時間',
        'ip_address': 'IP位址',
        'user_agent': '使用者代理',
        'success': '成功',
        'error_message': '錯誤訊息'
    };
    
    // 如果有註釋，從註釋提取
    if (comment) {
        const match = comment.match(/^([^(（]+)/);
        if (match) {
            return match[1].trim();
        }
    }
    
    return translations[fieldId] || fieldId;
}

// 生成範例值
function generateExampleValue(tableName, fieldName, fieldType) {
    // 特定欄位的範例值
    const specificExamples = {
        'projects': {
            'id': 'proj_20250813_001',
            'opportunity_id': '96ce6b00-fbd7-4b09-bcd0-dcd09f8e7c01',
            'name': '勝美-建功段-2023',
            'spc_engineering': '{"enabled":true,"siteCount":90,"teamCount":9}',
            'cabinet_engineering': '{"enabled":false}',
            'permissions': '{"owner":"user_001","teams":[{"name":"工班A","leaderId":"master_001","canViewOthers":true}]}',
            'cached_stats': '{"building_count":5,"unit_count":90,"completion_rate":45}',
            'status': 'active',
            'created_by': 'user_team_1_leader'
        },
        'users': {
            'id': 'user_001',
            'phone': '0912345678',
            'password_suffix': '678',
            'name': '王小明',
            'email': 'wang@example.com',
            'role': 'admin',
            'user_projects': '["proj_001","proj_002"]',
            'session_token': 'sess_1755066524374_xeiiby4q6'
        },
        'construction_progress': {
            'site_id': 'site_001',
            'engineering_type': 'SPC',
            'status': 'in_progress',
            'before_photo_url': 'https://r2.url/before.jpg',
            'construction_area': '28.5',
            'worker_name': '李師傅',
            'notes': '一樓大廳已完工'
        }
    };
    
    // 檢查特定範例
    if (specificExamples[tableName] && specificExamples[tableName][fieldName]) {
        return specificExamples[tableName][fieldName];
    }
    
    // 根據類型生成通用範例
    if (fieldType.includes('INTEGER PRIMARY KEY')) return '1';
    if (fieldType.includes('TEXT PRIMARY KEY')) return tableName.slice(0, 4) + '_001';
    if (fieldType.includes('DATETIME')) return '2025-08-13 15:00:00';
    if (fieldType.includes('DATE')) return '2025-08-13';
    if (fieldType.includes('INTEGER')) return '1';
    if (fieldType.includes('REAL')) return '28.5';
    if (fieldType.includes('JSON')) return '{}';
    if (fieldType.includes('TEXT')) return '範例文字';
    
    return '';
}

// 主程式
function main() {
    try {
        // 讀取 schema 文件
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        // 解析 schema
        const tables = parseSchema(schemaContent);
        
        // 生成 CSV
        const csvContent = generateCSV(tables);
        
        // 寫入文件
        fs.writeFileSync(outputPath, csvContent, 'utf8');
        
        console.log(`✅ 成功生成資料結構文檔: ${outputPath}`);
        console.log(`📊 共解析 ${tables.length} 個表`);
        
        // 顯示表摘要
        tables.forEach(table => {
            console.log(`  - ${table.name}: ${table.fields.length} 個欄位`);
        });
        
    } catch (error) {
        console.error('❌ 生成文檔失敗:', error);
        process.exit(1);
    }
}

// 執行主程式
main();