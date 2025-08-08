#!/usr/bin/env node

/**
 * 發現並分析對象的實際欄位結構
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;

// 加載環境變量
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = 'https://open.fxiaoke.com';
const APP_ID = process.env.FX_APP_ID || 'FSAID_1320691';
const APP_SECRET = process.env.FX_APP_SECRET || 'ec63ff237c5c4a759be36d3a8fb7a3b4';
const PERMANENT_CODE = process.env.FX_PERMANENT_CODE || '899433A4A04A3B8CB1CC2183DA4B5B48';

// 要發現的對象列表
const OBJECTS_TO_DISCOVER = [
  { apiName: 'object_k1XqG__c', label: 'SPC維修單', isCustom: true },
  { apiName: 'object_50HJ8__c', label: '工地師父', isCustom: true },
  { apiName: 'SupplierObj', label: '供應商', isCustom: false },
  { apiName: 'site_cabinet__c', label: '案場(浴櫃)', isCustom: true },
  { apiName: 'progress_management_announ__c', label: '進度管理公告', isCustom: true }
];

class FieldDiscovery {
  constructor() {
    this.corpAccessToken = null;
    this.corpId = null;
    this.currentOpenUserId = null;
  }

  async init() {
    // 獲取 Access Token
    const tokenResponse = await fetch(`${API_BASE_URL}/cgi/corpAccessToken/get/V2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: APP_ID,
        appSecret: APP_SECRET,
        permanentCode: PERMANENT_CODE
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.errorCode !== 0) {
      throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
    }

    this.corpAccessToken = tokenData.corpAccessToken;
    this.corpId = tokenData.corpId;

    // 獲取用戶 ID
    const userResponse = await fetch(`${API_BASE_URL}/cgi/user/getByMobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: this.corpId,
        corpAccessToken: this.corpAccessToken,
        mobile: "17675662629"
      })
    });

    const userData = await userResponse.json();
    if (userData.errorCode !== 0) {
      console.error('用戶數據:', userData);
      throw new Error(`獲取用戶 ID 失敗: ${userData.errorMessage}`);
    }

    this.currentOpenUserId = userData.data?.openUserId || userData.openUserId;
    console.log('✅ 初始化成功, 用戶ID:', this.currentOpenUserId);
  }

  async discoverObjectFields(objectApiName, isCustom) {
    console.log(`\n📋 發現對象 ${objectApiName} 的欄位...`);
    
    const endpoint = isCustom 
      ? '/cgi/crm/custom/v2/object/describe'
      : '/cgi/crm/v2/object/describe';

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: this.corpId,
        corpAccessToken: this.corpAccessToken,
        currentOpenUserId: this.currentOpenUserId,
        apiName: objectApiName
      })
    });

    const data = await response.json();
    
    if (data.errorCode !== 0) {
      console.error(`❌ 無法獲取 ${objectApiName} 的欄位: ${data.errorMessage}`);
      return null;
    }

    const fields = data.data?.fields || [];
    console.log(`✅ 發現 ${fields.length} 個欄位`);
    
    return {
      objectApiName,
      fields: fields.map(field => ({
        apiName: field.apiName,
        label: field.label,
        dataType: field.dataType,
        required: field.required,
        length: field.length,
        unique: field.unique
      }))
    };
  }

  async discoverAll() {
    const results = {};
    
    for (const obj of OBJECTS_TO_DISCOVER) {
      const fieldInfo = await this.discoverObjectFields(obj.apiName, obj.isCustom);
      if (fieldInfo) {
        results[obj.apiName] = {
          label: obj.label,
          isCustom: obj.isCustom,
          fields: fieldInfo.fields
        };
      }
      
      // 短暫延遲避免請求過快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }

  generateCreateTableSQL(objectApiName, objectInfo) {
    const tableName = objectApiName.toLowerCase();
    const fields = objectInfo.fields;
    
    // 基本系統欄位
    let sql = `-- ${objectInfo.label} (${objectApiName})\n`;
    sql += `DROP TABLE IF EXISTS ${tableName};\n`;
    sql += `CREATE TABLE ${tableName} (\n`;
    
    // 添加主鍵
    sql += `  _id TEXT PRIMARY KEY,\n`;
    
    // 添加所有欄位
    const fieldDefinitions = [];
    for (const field of fields) {
      if (field.apiName === '_id') continue; // 已經添加了
      
      let fieldDef = `  ${field.apiName}`;
      
      // 根據數據類型設置欄位類型
      switch (field.dataType) {
        case 'TEXT':
        case 'PHONE':
        case 'EMAIL':
        case 'SELECT':
        case 'MULTI_SELECT':
        case 'REFERENCE':
          fieldDef += ` TEXT`;
          break;
        case 'NUMBER':
        case 'CURRENCY':
          fieldDef += ` REAL`;
          break;
        case 'INTEGER':
          fieldDef += ` INTEGER`;
          break;
        case 'BOOLEAN':
          fieldDef += ` BOOLEAN`;
          break;
        case 'DATE':
        case 'DATETIME':
          fieldDef += ` INTEGER`; // 時間戳
          break;
        default:
          fieldDef += ` TEXT`;
      }
      
      if (field.required && field.apiName !== 'name') {
        fieldDef += ` NOT NULL`;
      }
      
      fieldDefinitions.push(fieldDef);
    }
    
    // 添加同步相關欄位
    fieldDefinitions.push('  fx_created_at INTEGER');
    fieldDefinitions.push('  fx_updated_at INTEGER');
    fieldDefinitions.push('  sync_version INTEGER DEFAULT 0');
    fieldDefinitions.push('  sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    
    sql += fieldDefinitions.join(',\n');
    sql += '\n);\n\n';
    
    // 添加索引
    sql += `-- 創建索引\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_life_status ON ${tableName}(life_status);\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_last_modified ON ${tableName}(last_modified_time);\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_${tableName}_owner ON ${tableName}(owner);\n\n`;
    
    return sql;
  }
}

async function main() {
  try {
    const discovery = new FieldDiscovery();
    await discovery.init();
    
    console.log('🔍 開始發現對象欄位...\n');
    const results = await discovery.discoverAll();
    
    // 保存結果為 JSON
    const outputPath = path.join(__dirname, 'discovered-fields.json');
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 欄位結構已保存到: ${outputPath}`);
    
    // 生成 SQL
    let sqlContent = '-- 自動生成的表結構 SQL\n';
    sqlContent += `-- 生成時間: ${new Date().toISOString()}\n\n`;
    
    for (const [apiName, info] of Object.entries(results)) {
      sqlContent += discovery.generateCreateTableSQL(apiName, info);
    }
    
    const sqlPath = path.join(__dirname, 'create-dynamic-tables.sql');
    await fs.writeFile(sqlPath, sqlContent);
    console.log(`📄 SQL 已保存到: ${sqlPath}`);
    
    // 顯示摘要
    console.log('\n📊 發現摘要:');
    for (const [apiName, info] of Object.entries(results)) {
      console.log(`  - ${info.label} (${apiName}): ${info.fields.length} 個欄位`);
    }
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

main();