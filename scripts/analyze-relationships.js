#!/usr/bin/env node

/**
 * 分析 D1 資料庫中各對象之間的關聯關係
 */

const Database = require('better-sqlite3');
const path = require('path');

async function analyzeRelationships() {
  try {
    // 連接到 D1 資料庫
    const dbPath = path.join(__dirname, '../workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f26dd3b4af2b86035a68fbb491403d4b54d63dee4c1e42d18d4ad58dc6978866.sqlite');
    const db = new Database(dbPath, { readonly: true });
    
    console.log('📊 分析 D1 資料庫中的對象關聯關係...\n');
    
    // 獲取所有表格
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sync_%' 
      AND name NOT LIKE 'fx_%'
      AND name NOT LIKE '_cf_%'
      AND name != 'd1_migrations'
      ORDER BY name
    `).all();
    
    console.log(`找到 ${tables.length} 個業務表:\n`);
    
    const tableSchemas = {};
    const relationships = [];
    
    // 分析每個表的結構
    for (const table of tables) {
      const tableName = table.name;
      console.log(`\n📋 表: ${tableName}`);
      console.log('─'.repeat(50));
      
      // 獲取表結構
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      tableSchemas[tableName] = columns;
      
      // 獲取樣本數據
      const sampleData = db.prepare(`SELECT * FROM ${tableName} LIMIT 1`).get();
      const rowCount = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      
      console.log(`記錄數: ${rowCount.count}`);
      
      // 尋找可能的外鍵欄位
      const potentialForeignKeys = [];
      
      for (const column of columns) {
        const colName = column.name;
        
        // 常見的外鍵模式
        if (colName.endsWith('_id') || 
            colName.endsWith('__c') ||
            colName.includes('owner') ||
            colName.includes('created_by') ||
            colName.includes('modified_by') ||
            colName.includes('parent') ||
            colName.includes('related') ||
            colName.includes('ref')) {
          
          // 如果有樣本數據，檢查值的格式
          if (sampleData && sampleData[colName]) {
            const value = sampleData[colName];
            console.log(`  🔗 潛在關聯欄位: ${colName}`);
            console.log(`     樣本值: ${typeof value === 'string' ? value.substring(0, 50) : value}`);
            
            // 嘗試識別關聯的表
            if (colName.includes('owner') || colName.includes('user')) {
              relationships.push({
                from: tableName,
                to: 'users/employees',
                field: colName,
                type: 'owner/user reference'
              });
            } else if (colName.includes('department')) {
              relationships.push({
                from: tableName,
                to: 'departments',
                field: colName,
                type: 'department reference'
              });
            } else if (colName.includes('site') || colName.includes('案場')) {
              relationships.push({
                from: tableName,
                to: 'object_8w9cb__c',
                field: colName,
                type: 'site reference'
              });
            } else if (colName.includes('opportunity') || colName.includes('商機')) {
              relationships.push({
                from: tableName,
                to: 'newopportunityobj',
                field: colName,
                type: 'opportunity reference'
              });
            }
            
            potentialForeignKeys.push({
              column: colName,
              value: value
            });
          }
        }
      }
      
      // 檢查 JSON 欄位中的關聯
      if (sampleData) {
        for (const [key, value] of Object.entries(sampleData)) {
          if (typeof value === 'string' && value.startsWith('{')) {
            try {
              const parsed = JSON.parse(value);
              if (parsed && typeof parsed === 'object') {
                console.log(`  📦 JSON 欄位: ${key}`);
                // 檢查 JSON 中的 ID 欄位
                for (const [jsonKey, jsonValue] of Object.entries(parsed)) {
                  if (jsonKey.includes('id') || jsonKey.includes('Id')) {
                    console.log(`     內嵌關聯: ${jsonKey} = ${jsonValue}`);
                  }
                }
              }
            } catch (e) {
              // 不是 JSON
            }
          }
        }
      }
    }
    
    // 輸出關係圖
    console.log('\n\n🗺️ 對象關聯關係圖\n');
    console.log('```mermaid');
    console.log('graph TD');
    
    // 定義節點
    for (const tableName of Object.keys(tableSchemas)) {
      const displayName = getDisplayName(tableName);
      console.log(`    ${tableName}["${displayName}"]`);
    }
    
    console.log('');
    
    // 定義關係
    const uniqueRelationships = {};
    for (const rel of relationships) {
      const key = `${rel.from}-${rel.to}-${rel.field}`;
      if (!uniqueRelationships[key]) {
        uniqueRelationships[key] = rel;
      }
    }
    
    for (const rel of Object.values(uniqueRelationships)) {
      console.log(`    ${rel.from} -->|${rel.field}| ${rel.to}`);
    }
    
    console.log('```\n');
    
    // 輸出詳細的關聯分析
    console.log('\n📝 關聯關係詳細說明:\n');
    
    const groupedRelationships = {};
    for (const rel of relationships) {
      if (!groupedRelationships[rel.from]) {
        groupedRelationships[rel.from] = [];
      }
      groupedRelationships[rel.from].push(rel);
    }
    
    for (const [tableName, rels] of Object.entries(groupedRelationships)) {
      console.log(`\n${getDisplayName(tableName)}:`);
      for (const rel of rels) {
        console.log(`  → ${rel.field} 關聯到 ${rel.to} (${rel.type})`);
      }
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ 分析失敗:', error.message);
    console.error(error.stack);
  }
}

function getDisplayName(tableName) {
  const mapping = {
    'newopportunityobj': '商機',
    'object_8w9cb__c': '案場',
    'object_k1xqg__c': '維修單',
    'object_50hj8__c': '工地師父',
    'supplierobj': '供應商',
    'site_cabinet__c': '案場(浴櫃)',
    'progress_management_announ__c': '進度管理公告'
  };
  return mapping[tableName] || tableName;
}

analyzeRelationships();