#!/usr/bin/env node

/**
 * 獲取案場(object_8W9cb__c)對象的所有欄位
 */

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48',
  token: 'a7e3281a220a4c35ac48f7a1433ca0ea',
  encodingAESKey: 'YTRjYjkyMmZkYTdiNGRiY2FmN2I3MTIwMzZiNTRkNTg',
  domain: 'fxiaoke.journeyrent.com'
};

async function getSPCFields() {
  console.log('🏢 開始獲取案場對象(object_8W9cb__c)的欄位定義...\n');

  try {
    // Step 1: 獲取 Access Token
    console.log('1️⃣ 獲取訪問令牌...');
    const tokenResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/corpAccessToken/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: CRM_CONFIG.appId,
        appSecret: CRM_CONFIG.appSecret,
        permanentCode: CRM_CONFIG.permanentCode
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.errorCode !== 0) {
      throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
    }

    const accessToken = tokenData.corpAccessToken;
    const corpId = tokenData.corpId;
    console.log('✅ Token 獲取成功!\n');
    
    // Step 1.5: 獲取當前用戶ID
    console.log('1.5️⃣ 獲取當前用戶ID...');
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
    const currentOpenUserId = userData.empList[0].openUserId;
    console.log('✅ 用戶ID獲取成功!\n');
    
    // Step 2: 獲取案場對象定義 - 使用標準API
    console.log('2️⃣ 獲取案場對象(object_8W9cb__c)的詳細資訊...');
    const describeResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/object/describe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        corpId: corpId,
        currentUserId: currentOpenUserId,
        objectApiName: 'object_8W9cb__c'
      })
    });

    const describeData = await describeResponse.json();
    
    if (describeData.errorCode !== 0) {
      throw new Error(`獲取對象定義失敗: ${describeData.errorMessage}`);
    }

    const objectInfo = describeData.data;
    console.log(`✅ 成功獲取案場對象資訊!`);
    console.log(`   對象名稱: ${objectInfo.dataObjectName}`);
    console.log(`   API名稱: ${objectInfo.dataObjectApiName}`);
    console.log(`   描述: ${objectInfo.describe || '無'}\n`);

    // Step 3: 顯示所有欄位
    const fields = objectInfo.fieldList || [];
    console.log(`3️⃣ 案場對象共有 ${fields.length} 個欄位:\n`);

    // 分類欄位
    const systemFields = fields.filter(f => !f.isCustom);
    const customFields = fields.filter(f => f.isCustom);

    console.log(`📊 欄位統計:`);
    console.log(`   系統欄位: ${systemFields.length} 個`);
    console.log(`   自定義欄位: ${customFields.length} 個\n`);

    // 顯示系統欄位
    console.log('🔧 系統欄位:');
    console.log('='.repeat(80));
    systemFields.forEach((field, idx) => {
      console.log(`${idx + 1}. ${field.apiName}`);
      console.log(`   顯示名稱: ${field.fieldName}`);
      console.log(`   類型: ${field.fieldType}`);
      console.log(`   必填: ${field.isRequired ? '是' : '否'}`);
      if (field.describe) {
        console.log(`   描述: ${field.describe}`);
      }
      console.log('');
    });

    // 顯示自定義欄位
    console.log('📝 自定義欄位:');
    console.log('='.repeat(80));
    customFields.forEach((field, idx) => {
      console.log(`${idx + 1}. ${field.apiName}`);
      console.log(`   顯示名稱: ${field.fieldName}`);
      console.log(`   類型: ${field.fieldType}`);
      console.log(`   必填: ${field.isRequired ? '是' : '否'}`);
      if (field.describe) {
        console.log(`   描述: ${field.describe}`);
      }
      if (field.options && field.options.length > 0) {
        console.log(`   選項: ${field.options.map(o => o.label).join(', ')}`);
      }
      console.log('');
    });

    // 保存欄位定義到文件
    const fs = require('fs');
    const outputPath = './spc-fields.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      objectInfo: {
        name: objectInfo.dataObjectName,
        apiName: objectInfo.dataObjectApiName,
        describe: objectInfo.describe
      },
      fields: fields.map(f => ({
        apiName: f.apiName,
        displayName: f.fieldName,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        isCustom: f.isCustom,
        describe: f.describe,
        options: f.options
      })),
      summary: {
        total: fields.length,
        system: systemFields.length,
        custom: customFields.length
      }
    }, null, 2));
    
    console.log(`\n💾 欄位定義已保存到: ${outputPath}`);

    // 顯示重要欄位
    console.log('\n🌟 重要欄位識別:');
    const importantFields = fields.filter(f => 
      f.apiName.includes('project') ||
      f.apiName.includes('building') ||
      f.apiName.includes('floor') ||
      f.apiName.includes('unit') ||
      f.apiName.includes('name') ||
      f.apiName.includes('address') ||
      f.apiName.includes('status')
    );
    
    importantFields.forEach(field => {
      console.log(`   - ${field.fieldName} (${field.apiName})`);
    });

  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    console.error(error);
  }
}

// 執行
getSPCFields();