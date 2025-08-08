#!/usr/bin/env node

/**
 * 找出有問題的案場資料
 * 直接從 CRM API 獲取 offset 2500 之後的資料進行分析
 */

const fs = require('fs');
const path = require('path');

// CRM 配置
const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function getAccessToken() {
  const response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/corpAccessToken/get/V2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: CRM_CONFIG.appId,
      appSecret: CRM_CONFIG.appSecret,
      permanentCode: CRM_CONFIG.permanentCode
    })
  });
  
  const data = await response.json();
  if (data.errorCode !== 0) {
    throw new Error(`獲取 Token 失敗: ${data.errorMessage}`);
  }
  
  return {
    corpAccessToken: data.corpAccessToken,
    corpId: data.corpId
  };
}

async function getCurrentUserId(corpId, accessToken) {
  const response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/user/getByMobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corpId: corpId,
      corpAccessToken: accessToken,
      mobile: "17675662629"
    })
  });
  
  const data = await response.json();
  if (data.errorCode !== 0) {
    throw new Error(`獲取用戶 ID 失敗: ${data.errorMessage}`);
  }
  
  return data.openUserId;
}

async function fetchProblematicSites(corpId, accessToken, userId) {
  // 獲取 offset 2500 之後的資料
  const offset = 2500;
  const limit = 10; // 先獲取 10 筆來分析
  
  console.log(`\n📥 從 offset ${offset} 獲取 ${limit} 筆資料...`);
  
  const response = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/custom/v2/data/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corpId: corpId,
      corpAccessToken: accessToken,
      currentOpenUserId: userId,
      data: {
        dataObjectApiName: 'object_8W9cb__c',
        search_query_info: {
          limit: limit,
          offset: offset,
          filters: [{
            field_name: 'life_status',
            operator: 'NEQ',
            field_values: ['作废']
          }],
          orders: [{ fieldName: 'create_time', isAsc: 'false' }]
        }
      }
    })
  });
  
  const data = await response.json();
  if (data.errorCode !== 0) {
    throw new Error(`獲取案場數據失敗: ${data.errorMessage}`);
  }
  
  return data.data?.dataList || [];
}

function analyzeRecord(record, index) {
  console.log(`\n\n========== 記錄 ${index + 1} ==========`);
  console.log(`ID: ${record._id}`);
  console.log(`名稱: ${record.name}`);
  
  const problems = [];
  
  // 1. 檢查陣列欄位
  const arrayFields = [
    'owner', 'created_by', 'last_modified_by', 
    'data_own_department', 'relevant_team', 'field_23Z5i__c'
  ];
  
  arrayFields.forEach(field => {
    if (record[field] !== undefined) {
      const value = record[field];
      const type = Array.isArray(value) ? 'array' : typeof value;
      console.log(`\n${field}:`);
      console.log(`  類型: ${type}`);
      
      if (Array.isArray(value)) {
        console.log(`  長度: ${value.length}`);
        console.log(`  內容: ${JSON.stringify(value)}`);
        
        // 檢查 JSON.stringify 後的長度
        const jsonStr = JSON.stringify(value);
        if (jsonStr.length > 255) {
          problems.push(`${field} JSON 序列化後太長: ${jsonStr.length} 字元`);
        }
      } else {
        console.log(`  值: ${value}`);
      }
    }
  });
  
  // 2. 檢查文字欄位長度
  Object.keys(record).forEach(key => {
    const value = record[key];
    if (typeof value === 'string' && value.length > 1000) {
      problems.push(`${key} 太長: ${value.length} 字元`);
      console.log(`\n${key} (超長):`);
      console.log(`  長度: ${value.length}`);
      console.log(`  前100字元: ${value.substring(0, 100)}...`);
    }
  });
  
  // 3. 檢查特殊字元
  Object.keys(record).forEach(key => {
    const value = record[key];
    if (typeof value === 'string') {
      // 檢查是否包含控制字元或特殊字元
      if (/[\x00-\x1F\x7F]/.test(value)) {
        problems.push(`${key} 包含控制字元`);
      }
      
      // 檢查是否包含不正常的 Unicode
      if (/[\uD800-\uDFFF]/.test(value)) {
        problems.push(`${key} 包含不正常的 Unicode`);
      }
    }
  });
  
  // 4. 特別檢查 field_23Z5i__c
  if (record.field_23Z5i__c) {
    console.log('\n特別分析 field_23Z5i__c:');
    console.log('  原始值:', record.field_23Z5i__c);
    console.log('  類型:', typeof record.field_23Z5i__c);
    
    if (Array.isArray(record.field_23Z5i__c)) {
      console.log('  陣列長度:', record.field_23Z5i__c.length);
      console.log('  第一個元素:', record.field_23Z5i__c[0]);
      
      // 測試 JSON.stringify
      try {
        const jsonStr = JSON.stringify(record.field_23Z5i__c);
        console.log('  JSON.stringify 結果:', jsonStr);
        console.log('  JSON 長度:', jsonStr.length);
      } catch (e) {
        problems.push(`field_23Z5i__c 無法 JSON.stringify: ${e.message}`);
      }
    }
  }
  
  // 總結問題
  if (problems.length > 0) {
    console.log('\n🚨 發現的問題:');
    problems.forEach(p => console.log(`  - ${p}`));
  } else {
    console.log('\n✅ 此記錄沒有明顯問題');
  }
  
  return problems;
}

async function main() {
  console.log('🔍 開始尋找有問題的案場資料...\n');
  
  try {
    // 1. 獲取認證資訊
    console.log('1. 獲取 CRM 認證...');
    const { corpAccessToken, corpId } = await getAccessToken();
    console.log('✅ 獲取 Token 成功');
    
    const userId = await getCurrentUserId(corpId, corpAccessToken);
    console.log('✅ 獲取用戶 ID 成功');
    
    // 2. 獲取問題資料
    console.log('\n2. 獲取 offset 2500 之後的案場資料...');
    const sites = await fetchProblematicSites(corpId, corpAccessToken, userId);
    console.log(`✅ 獲取到 ${sites.length} 筆資料`);
    
    // 3. 分析每筆資料
    console.log('\n3. 開始分析資料...');
    const allProblems = [];
    
    sites.forEach((site, index) => {
      const problems = analyzeRecord(site, index);
      if (problems.length > 0) {
        allProblems.push({
          id: site._id,
          name: site.name,
          problems: problems
        });
      }
    });
    
    // 4. 總結
    console.log('\n\n========== 分析總結 ==========');
    if (allProblems.length > 0) {
      console.log(`\n發現 ${allProblems.length} 筆有問題的記錄:`);
      allProblems.forEach(p => {
        console.log(`\n📍 ${p.name} (${p.id})`);
        p.problems.forEach(problem => console.log(`   - ${problem}`));
      });
      
      // 保存到文件
      const outputFile = path.join(__dirname, 'problematic-sites.json');
      fs.writeFileSync(outputFile, JSON.stringify(allProblems, null, 2));
      console.log(`\n詳細資訊已保存到: ${outputFile}`);
    } else {
      console.log('\n✅ 所有檢查的記錄都沒有明顯問題');
      console.log('可能需要檢查更多記錄或其他錯誤原因');
    }
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error(error.stack);
  }
}

// 執行
main();