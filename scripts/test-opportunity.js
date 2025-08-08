#!/usr/bin/env node

/**
 * 測試商機對象同步
 * 驗證：
 * 1. 是否能在對象列表中找到 NewOpportunityObj
 * 2. 是否能讀取完整的欄位定義
 * 3. 是否能成功創建資料表
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.WORKER_URL || 'http://localhost:8787/api';

async function testOpportunitySync() {
  console.log('🧪 開始測試商機對象同步...\n');

  try {
    // Step 1: 獲取對象列表
    console.log('📋 Step 1: 獲取CRM對象列表...');
    const objectsResponse = await axios.get(`${API_URL}/objects`);
    
    if (!objectsResponse.data.success) {
      throw new Error('獲取對象列表失敗');
    }

    const { defaultObjects, customObjects } = objectsResponse.data.data;
    console.log(`✅ 找到 ${defaultObjects.length} 個預設對象`);
    console.log(`✅ 找到 ${customObjects.length} 個自定義對象`);

    // 查找商機對象
    const allObjects = [...defaultObjects, ...customObjects];
    const opportunityObj = allObjects.find(obj => obj.apiName === 'NewOpportunityObj');

    if (!opportunityObj) {
      throw new Error('❌ 在對象列表中找不到 NewOpportunityObj');
    }

    console.log(`✅ 成功找到商機對象: ${opportunityObj.displayName} (${opportunityObj.apiName})`);
    console.log(`   - 是否自定義: ${opportunityObj.isCustom ? '是' : '否'}`);
    console.log(`   - 同步狀態: ${opportunityObj.isSynced ? '已同步' : '未同步'}`);
    console.log(`   - 表名: ${opportunityObj.tableName || '尚未創建'}\n`);

    // Step 2: 獲取欄位定義
    console.log('📊 Step 2: 獲取商機對象的欄位定義...');
    const fieldsResponse = await axios.get(`${API_URL}/objects/NewOpportunityObj/fields`);
    
    if (!fieldsResponse.data.success) {
      throw new Error('獲取欄位定義失敗');
    }

    const { systemFields, customFields, totalFields } = fieldsResponse.data.data;
    console.log(`✅ 成功獲取 ${totalFields} 個欄位`);
    console.log(`   - 系統欄位: ${systemFields.length} 個`);
    console.log(`   - 自定義欄位: ${customFields.length} 個`);

    // 顯示部分欄位示例
    console.log('\n📌 部分欄位示例:');
    const sampleFields = [...systemFields.slice(0, 3), ...customFields.slice(0, 3)];
    sampleFields.forEach(field => {
      console.log(`   - ${field.displayName} (${field.apiName})`);
      console.log(`     類型: ${field.fieldType}, 資料型態: ${field.dataType}, 必填: ${field.isRequired ? '是' : '否'}`);
    });

    // Step 3: 創建資料表（如果尚未創建）
    if (!opportunityObj.isSynced) {
      console.log('\n🔨 Step 3: 創建商機對象的資料表...');
      
      const createResponse = await axios.post(`${API_URL}/schema/NewOpportunityObj/create`);
      
      if (!createResponse.data.success) {
        throw new Error('創建資料表失敗: ' + createResponse.data.error);
      }

      console.log(`✅ ${createResponse.data.data.message}`);
      console.log(`   表名: ${createResponse.data.data.tableName}`);
    } else {
      console.log('\n🔄 Step 3: 檢查Schema變更...');
      
      const changesResponse = await axios.get(`${API_URL}/schema/NewOpportunityObj/changes`);
      
      if (changesResponse.data.success) {
        const changes = changesResponse.data.data.changes;
        if (changes.length > 0) {
          console.log(`⚠️  發現 ${changes.length} 個Schema變更:`);
          changes.forEach(change => {
            console.log(`   - ${change.type}: ${change.field?.apiName || change.fieldName}`);
          });
        } else {
          console.log('✅ Schema已是最新，無需變更');
        }
      }
    }

    // Step 4: 獲取表結構資訊
    console.log('\n📐 Step 4: 獲取表結構資訊...');
    try {
      const structureResponse = await axios.get(`${API_URL}/schema/NewOpportunityObj/structure`);
      
      if (structureResponse.data.success) {
        const { tableName, columns, indexes } = structureResponse.data.data;
        console.log(`✅ 表 ${tableName} 結構資訊:`);
        console.log(`   - 欄位數: ${columns.length}`);
        console.log(`   - 索引數: ${indexes.length}`);
      }
    } catch (error) {
      console.log('⚠️  表尚未創建或無法獲取結構');
    }

    console.log('\n🎉 測試完成！商機對象同步功能正常運作。');

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    if (error.response) {
      console.error('詳細錯誤:', error.response.data);
    }
    process.exit(1);
  }
}

// 執行測試
testOpportunitySync();