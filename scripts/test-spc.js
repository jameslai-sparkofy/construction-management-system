#!/usr/bin/env node

/**
 * 測試案場(SPC)對象同步
 * 驗證：
 * 1. 是否能在對象列表中找到 SPC 相關對象
 * 2. 是否能讀取完整的欄位定義
 * 3. 是否能成功創建資料表
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.WORKER_URL || 'http://localhost:8787/api';

async function testSPCSync() {
  console.log('🏢 開始測試案場(SPC)對象同步...\n');

  try {
    // Step 1: 獲取對象列表並查找案場相關對象
    console.log('📋 Step 1: 獲取CRM對象列表，查找案場相關對象...');
    const objectsResponse = await axios.get(`${API_URL}/objects`);
    
    if (!objectsResponse.data.success) {
      throw new Error('獲取對象列表失敗');
    }

    const { defaultObjects, customObjects } = objectsResponse.data.data;
    const allObjects = [...defaultObjects, ...customObjects];
    
    // 查找可能的案場對象（可能的API名稱）
    const possibleNames = ['SPC', 'SPCObject', 'SiteObject', 'ProjectObject', 'CaseObject'];
    let spcObject = null;
    
    // 先嘗試精確匹配
    for (const name of possibleNames) {
      spcObject = allObjects.find(obj => obj.apiName === name);
      if (spcObject) break;
    }
    
    // 如果沒找到，嘗試模糊匹配
    if (!spcObject) {
      console.log('🔍 精確匹配失敗，嘗試模糊搜索...');
      
      // 搜索包含"案場"、"SPC"、"Site"、"Project"的對象
      const spcRelatedObjects = allObjects.filter(obj => 
        obj.displayName.includes('案場') ||
        obj.displayName.includes('SPC') ||
        obj.apiName.toLowerCase().includes('spc') ||
        obj.apiName.toLowerCase().includes('site') ||
        obj.apiName.toLowerCase().includes('project')
      );
      
      if (spcRelatedObjects.length > 0) {
        console.log(`\n📌 找到 ${spcRelatedObjects.length} 個可能的案場相關對象:`);
        spcRelatedObjects.forEach(obj => {
          console.log(`   - ${obj.displayName} (${obj.apiName})`);
          console.log(`     自定義: ${obj.isCustom ? '是' : '否'}, 已同步: ${obj.isSynced ? '是' : '否'}`);
        });
        
        // 選擇第一個作為測試對象
        spcObject = spcRelatedObjects[0];
        console.log(`\n✅ 選擇測試對象: ${spcObject.displayName} (${spcObject.apiName})`);
      }
    }
    
    if (!spcObject) {
      // 列出所有自定義對象供參考
      console.log('\n📋 所有自定義對象列表:');
      customObjects.forEach(obj => {
        console.log(`   - ${obj.displayName} (${obj.apiName})`);
      });
      throw new Error('找不到案場相關對象，請檢查對象API名稱');
    }

    console.log(`\n✅ 成功找到案場對象: ${spcObject.displayName} (${spcObject.apiName})`);
    console.log(`   - 是否自定義: ${spcObject.isCustom ? '是' : '否'}`);
    console.log(`   - 同步狀態: ${spcObject.isSynced ? '已同步' : '未同步'}`);
    console.log(`   - 表名: ${spcObject.tableName || '尚未創建'}\n`);

    // Step 2: 獲取欄位定義
    console.log(`📊 Step 2: 獲取案場對象 ${spcObject.apiName} 的欄位定義...`);
    const fieldsResponse = await axios.get(`${API_URL}/objects/${spcObject.apiName}/fields`);
    
    if (!fieldsResponse.data.success) {
      throw new Error('獲取欄位定義失敗');
    }

    const { systemFields, customFields, totalFields } = fieldsResponse.data.data;
    console.log(`✅ 成功獲取 ${totalFields} 個欄位`);
    console.log(`   - 系統欄位: ${systemFields.length} 個`);
    console.log(`   - 自定義欄位: ${customFields.length} 個`);

    // 顯示所有欄位
    console.log('\n📌 系統欄位:');
    systemFields.forEach(field => {
      console.log(`   - ${field.displayName} (${field.apiName})`);
      console.log(`     類型: ${field.fieldType}, 資料型態: ${field.dataType}, 必填: ${field.isRequired ? '是' : '否'}`);
    });
    
    console.log('\n📌 自定義欄位:');
    customFields.forEach(field => {
      console.log(`   - ${field.displayName} (${field.apiName})`);
      console.log(`     類型: ${field.fieldType}, 資料型態: ${field.dataType}, 必填: ${field.isRequired ? '是' : '否'}`);
    });

    // Step 3: 創建資料表（如果尚未創建）
    if (!spcObject.isSynced) {
      console.log(`\n🔨 Step 3: 創建案場對象 ${spcObject.apiName} 的資料表...`);
      
      const createResponse = await axios.post(`${API_URL}/schema/${spcObject.apiName}/create`);
      
      if (!createResponse.data.success) {
        throw new Error('創建資料表失敗: ' + createResponse.data.error);
      }

      console.log(`✅ ${createResponse.data.data.message}`);
      console.log(`   表名: ${createResponse.data.data.tableName}`);
    } else {
      console.log('\n🔄 Step 3: 檢查Schema變更...');
      
      const changesResponse = await axios.get(`${API_URL}/schema/${spcObject.apiName}/changes`);
      
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
      const structureResponse = await axios.get(`${API_URL}/schema/${spcObject.apiName}/structure`);
      
      if (structureResponse.data.success) {
        const { tableName, columns, indexes } = structureResponse.data.data;
        console.log(`✅ 表 ${tableName} 結構資訊:`);
        console.log(`   - 欄位數: ${columns.length}`);
        console.log(`   - 索引數: ${indexes.length}`);
        
        // 顯示表欄位
        console.log('\n   表欄位列表:');
        columns.forEach(col => {
          console.log(`   - ${col.name} (${col.type})`);
        });
      }
    } catch (error) {
      console.log('⚠️  表尚未創建或無法獲取結構');
    }

    console.log(`\n🎉 測試完成！案場對象 ${spcObject.apiName} 同步功能正常運作。`);

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    if (error.response) {
      console.error('詳細錯誤:', error.response.data);
    }
    process.exit(1);
  }
}

// 執行測試
testSPCSync();