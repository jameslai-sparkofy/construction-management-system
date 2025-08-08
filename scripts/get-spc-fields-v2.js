#!/usr/bin/env node

/**
 * 獲取案場對象的所有欄位 - 使用自定義對象查詢API
 */

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function getSPCFields() {
  console.log('🏢 開始獲取案場對象(object_8W9cb__c)的欄位定義...\n');

  try {
    // Step 1: 獲取 Access Token
    console.log('1️⃣ 獲取訪問令牌...');
    const tokenResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/corpAccessToken/get/V2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: CRM_CONFIG.appId,
        appSecret: CRM_CONFIG.appSecret,
        permanentCode: CRM_CONFIG.permanentCode
      })
    });

    const tokenData = await tokenResponse.json();
    console.log('Token Response:', JSON.stringify(tokenData, null, 2));
    
    if (tokenData.errorCode !== 0) {
      throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
    }

    const accessToken = tokenData.corpAccessToken;
    const corpId = tokenData.corpId;
    console.log('✅ Token 獲取成功!');
    console.log(`   Corp ID: ${corpId}\n`);
    
    // Step 2: 獲取一條案場資料來推斷欄位結構
    console.log('2️⃣ 查詢案場資料以獲取欄位結構...');
    
    // 先獲取用戶ID
    const userResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/user/getByMobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: accessToken,
        mobile: "17675662629"
      })
    });

    const userData = await userResponse.json();
    
    if (userData.errorCode !== 0) {
      throw new Error(`獲取用戶失敗: ${userData.errorMessage}`);
    }
    
    const currentOpenUserId = userData.empList[0].openUserId;
    console.log('✅ 用戶ID獲取成功!');
    
    // 查詢案場資料
    const queryResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/custom/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: accessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: 'object_8W9cb__c',
          search_query_info: {
            limit: 1,
            offset: 0
          }
        }
      })
    });

    const queryData = await queryResponse.json();
    console.log('Query Response:', JSON.stringify(queryData, null, 2));
    
    if (queryData.errorCode !== 0) {
      throw new Error(`查詢案場資料失敗: ${queryData.errorMessage}`);
    }
    
    const sampleData = queryData.data?.dataList?.[0];
    
    if (!sampleData) {
      console.log('⚠️  沒有案場資料，無法獲取欄位結構');
      return;
    }
    
    // Step 3: 分析欄位
    console.log('\n3️⃣ 分析案場對象欄位...');
    const fields = Object.keys(sampleData);
    console.log(`✅ 找到 ${fields.length} 個欄位\n`);
    
    // 分類欄位
    const systemFields = [];
    const customFields = [];
    
    fields.forEach(fieldName => {
      if (fieldName.endsWith('__c')) {
        customFields.push(fieldName);
      } else {
        systemFields.push(fieldName);
      }
    });
    
    console.log(`📊 欄位統計:`);
    console.log(`   總欄位數: ${fields.length}`);
    console.log(`   系統欄位: ${systemFields.length} 個`);
    console.log(`   自定義欄位: ${customFields.length} 個\n`);
    
    // 顯示系統欄位
    console.log('🔧 系統欄位:');
    console.log('='.repeat(80));
    systemFields.forEach((field, idx) => {
      const value = sampleData[field];
      const valueType = Array.isArray(value) ? 'array' : typeof value;
      console.log(`${idx + 1}. ${field}`);
      console.log(`   資料類型: ${valueType}`);
      console.log(`   範例值: ${JSON.stringify(value)?.substring(0, 100)}`);
      console.log('');
    });
    
    // 顯示自定義欄位
    console.log('📝 自定義欄位:');
    console.log('='.repeat(80));
    customFields.forEach((field, idx) => {
      const value = sampleData[field];
      const valueType = Array.isArray(value) ? 'array' : typeof value;
      console.log(`${idx + 1}. ${field}`);
      console.log(`   資料類型: ${valueType}`);
      console.log(`   範例值: ${JSON.stringify(value)?.substring(0, 100)}`);
      console.log('');
    });
    
    // 保存欄位列表
    const fs = require('fs');
    const outputData = {
      objectApiName: 'object_8W9cb__c',
      fields: fields.map(field => ({
        apiName: field,
        isCustom: field.endsWith('__c'),
        exampleValue: sampleData[field],
        dataType: Array.isArray(sampleData[field]) ? 'array' : typeof sampleData[field]
      })),
      summary: {
        total: fields.length,
        system: systemFields.length,
        custom: customFields.length
      },
      sampleData: sampleData
    };
    
    const outputPath = './spc-fields-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 欄位分析已保存到: ${outputPath}`);
    
    // 識別重要欄位
    console.log('\n🌟 識別到的重要欄位:');
    const importantFields = fields.filter(f => 
      f.includes('name') ||
      f.includes('project') ||
      f.includes('building') ||
      f.includes('floor') ||
      f.includes('unit') ||
      f.includes('address') ||
      f.includes('status') ||
      f.includes('owner')
    );
    
    importantFields.forEach(field => {
      console.log(`   - ${field}: ${JSON.stringify(sampleData[field])}`);
    });

  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// 執行
getSPCFields();