#!/usr/bin/env node

/**
 * 實際查找案場(SPC)對象
 * 通過API真實調用CRM系統
 */

require('dotenv').config();

async function findSPCObject() {
  console.log('🔍 開始從CRM實際查找案場對象...\n');

  const { FX_APP_ID, FX_APP_SECRET, FX_PERMANENT_CODE } = process.env;

  if (!FX_APP_ID || !FX_APP_SECRET || !FX_PERMANENT_CODE) {
    console.error('❌ 請先配置環境變量: FX_APP_ID, FX_APP_SECRET, FX_PERMANENT_CODE');
    process.exit(1);
  }

  try {
    // Step 1: 獲取 Access Token
    console.log('🔐 獲取 Access Token...');
    const tokenResponse = await fetch('https://open.fxiaoke.com/cgi/corpAccessToken/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: FX_APP_ID,
        appSecret: FX_APP_SECRET,
        permanentCode: FX_PERMANENT_CODE
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.errorCode !== 0) {
      throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
    }

    const accessToken = tokenData.corpAccessToken;
    const corpId = tokenData.corpId;
    console.log('✅ Access Token 獲取成功!\n');
    
    // Step 2: 獲取對象列表
    console.log('📋 獲取所有CRM對象列表...');
    const objectsResponse = await fetch('https://open.fxiaoke.com/cgi/object/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        corpId: corpId,
        currentUserId: 'FSUID_0'
      })
    });

    const objectsData = await objectsResponse.json();
    
    if (objectsData.errorCode !== 0) {
      throw new Error(`獲取對象列表失敗: ${objectsData.errorMessage}`);
    }

    const allObjects = objectsData.data.objects || [];
    console.log(`✅ 找到 ${allObjects.length} 個對象\n`);

    // Step 3: 查找案場相關對象
    console.log('🏢 搜索案場相關對象...');
    const spcRelatedObjects = allObjects.filter(obj => 
      obj.displayName.includes('案場') ||
      obj.displayName.includes('SPC') ||
      obj.displayName.includes('工地') ||
      obj.displayName.includes('工程') ||
      obj.displayName.includes('建案') ||
      obj.displayName.includes('項目') ||
      obj.apiName.toLowerCase().includes('spc') ||
      obj.apiName.toLowerCase().includes('site') ||
      obj.apiName.toLowerCase().includes('project') ||
      obj.apiName.toLowerCase().includes('case')
    );

    if (spcRelatedObjects.length > 0) {
      console.log(`✅ 找到 ${spcRelatedObjects.length} 個可能的案場相關對象:\n`);
      
      for (const obj of spcRelatedObjects) {
        console.log(`📌 對象: ${obj.displayName} (${obj.apiName})`);
        console.log(`   類型: ${obj.isCustom ? '自定義' : '預設'}`);
        if (obj.description) {
          console.log(`   描述: ${obj.description}`);
        }
        
        // Step 4: 獲取該對象的欄位
        console.log(`   獲取欄位定義...`);
        const fieldsResponse = await fetch('https://open.fxiaoke.com/cgi/object/describe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            corpId: corpId,
            currentUserId: 'FSUID_0',
            objectApiName: obj.apiName
          })
        });

        const fieldsData = await fieldsResponse.json();
        
        if (fieldsData.errorCode === 0) {
          const fields = fieldsData.data.fields || [];
          console.log(`   ✅ 找到 ${fields.length} 個欄位\n`);
          
          // 顯示前10個欄位作為示例
          console.log('   📊 欄位列表:');
          fields.slice(0, 10).forEach(field => {
            console.log(`      - ${field.displayName} (${field.apiName}) - ${field.fieldType}${field.isRequired ? ' [必填]' : ''}`);
          });
          
          if (fields.length > 10) {
            console.log(`      ... 還有 ${fields.length - 10} 個欄位`);
          }
        } else {
          console.log(`   ❌ 無法獲取欄位: ${fieldsData.errorMessage}`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
      }
    } else {
      console.log('❌ 沒有找到明顯的案場相關對象\n');
      
      // 列出所有自定義對象供參考
      console.log('📋 所有自定義對象列表:');
      const customObjects = allObjects.filter(obj => obj.isCustom);
      customObjects.forEach(obj => {
        console.log(`   - ${obj.displayName} (${obj.apiName})`);
      });
    }

    // 顯示統計
    console.log('\n📊 對象統計:');
    console.log(`總對象數: ${allObjects.length}`);
    console.log(`自定義對象: ${allObjects.filter(o => o.isCustom).length}`);
    console.log(`預設對象: ${allObjects.filter(o => !o.isCustom).length}`);

  } catch (error) {
    console.error('❌ 查找失敗:', error.message);
    console.error(error);
  }
}

// 執行查找
findSPCObject();