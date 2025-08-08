#!/usr/bin/env node

/**
 * 直接API調用查找案場對象
 * 請在命令行提供API憑證
 */

const [,, appId, appSecret, permanentCode] = process.argv;

if (!appId || !appSecret || !permanentCode) {
  console.log('使用方法:');
  console.log('node direct-api-search.js <APP_ID> <APP_SECRET> <PERMANENT_CODE>');
  console.log('\n示例:');
  console.log('node direct-api-search.js FSAID_xxx xxxx FSPERMANENTCODE_xxx');
  process.exit(1);
}

async function searchSPC() {
  console.log('🔍 開始查找案場對象...\n');

  try {
    // 獲取 Token
    console.log('1️⃣ 獲取訪問令牌...');
    const tokenRes = await fetch('https://open.fxiaoke.com/cgi/corpAccessToken/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        appSecret,
        permanentCode
      })
    });

    const tokenData = await tokenRes.json();
    
    if (tokenData.errorCode !== 0) {
      throw new Error(`Token錯誤: ${tokenData.errorMessage}`);
    }

    console.log('✅ Token獲取成功\n');

    // 獲取對象列表
    console.log('2️⃣ 獲取對象列表...');
    const objectsRes = await fetch('https://open.fxiaoke.com/cgi/object/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.corpAccessToken}`
      },
      body: JSON.stringify({
        corpId: tokenData.corpId,
        currentUserId: 'FSUID_0'
      })
    });

    const objectsData = await objectsRes.json();
    
    if (objectsData.errorCode !== 0) {
      throw new Error(`對象列表錯誤: ${objectsData.errorMessage}`);
    }

    const objects = objectsData.data.objects || [];
    console.log(`✅ 找到 ${objects.length} 個對象\n`);

    // 查找案場
    console.log('3️⃣ 搜索案場相關對象...');
    const keywords = ['案場', 'SPC', '工地', '工程', '建案', '項目', 'site', 'project'];
    const found = [];

    objects.forEach(obj => {
      const nameMatch = keywords.some(kw => 
        obj.displayName.toLowerCase().includes(kw.toLowerCase()) ||
        obj.apiName.toLowerCase().includes(kw.toLowerCase())
      );
      
      if (nameMatch) {
        found.push(obj);
      }
    });

    if (found.length > 0) {
      console.log(`✅ 找到 ${found.length} 個相關對象:\n`);
      
      // 獲取每個對象的欄位
      for (const obj of found) {
        console.log(`\n📌 ${obj.displayName} (${obj.apiName})`);
        console.log(`   類型: ${obj.isCustom ? '自定義' : '預設'}`);
        
        // 獲取欄位
        const fieldsRes = await fetch('https://open.fxiaoke.com/cgi/object/describe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenData.corpAccessToken}`
          },
          body: JSON.stringify({
            corpId: tokenData.corpId,
            currentUserId: 'FSUID_0',
            objectApiName: obj.apiName
          })
        });

        const fieldsData = await fieldsRes.json();
        
        if (fieldsData.errorCode === 0) {
          const fields = fieldsData.data.fields || [];
          console.log(`   欄位數: ${fields.length}`);
          
          // 顯示所有欄位
          console.log('\n   📊 完整欄位列表:');
          fields.forEach((field, idx) => {
            console.log(`   ${idx + 1}. ${field.displayName} (${field.apiName})`);
            console.log(`      類型: ${field.fieldType}, 必填: ${field.isRequired ? '是' : '否'}`);
          });
        }
      }
    } else {
      console.log('❌ 未找到案場相關對象\n');
      console.log('📋 列出所有自定義對象:');
      objects.filter(o => o.isCustom).forEach(obj => {
        console.log(`   ${obj.displayName} (${obj.apiName})`);
      });
    }

  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
  }
}

searchSPC();