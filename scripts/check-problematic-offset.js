#!/usr/bin/env node

/**
 * 檢查 offset 2500 之後的案場資料
 * 找出導致同步失敗的具體原因
 */

const fetch = require('node-fetch');
const fs = require('fs');

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function checkProblematicOffset() {
  console.log('🔍 檢查 offset 2500 之後的案場資料...\n');

  try {
    // Step 1: 獲取 Token
    console.log('1. 獲取 Access Token...');
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
    if (tokenData.errorCode !== 0) {
      throw new Error(`Token 獲取失敗: ${tokenData.errorMessage}`);
    }

    const { corpAccessToken, corpId } = tokenData;
    console.log('✅ Token 獲取成功');

    // Step 2: 獲取用戶 ID
    console.log('\n2. 獲取用戶 ID...');
    const userResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/user/getByMobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        mobile: "17675662629"
      })
    });

    const userData = await userResponse.json();
    const currentOpenUserId = userData.openUserId;
    console.log('✅ 用戶 ID 獲取成功');

    // Step 3: 獲取不同 offset 的資料進行比較
    const offsets = [2400, 2500, 2600, 2700];  // 測試不同的 offset
    const results = [];

    for (const offset of offsets) {
      console.log(`\n3. 測試 offset ${offset}...`);
      
      const queryResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/custom/v2/data/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corpId: corpId,
          corpAccessToken: corpAccessToken,
          currentOpenUserId: currentOpenUserId,
          data: {
            dataObjectApiName: 'object_8W9cb__c',
            search_query_info: {
              limit: 3,  // 每個 offset 獲取 3 筆
              offset: offset,
              filters: [{
                field_name: 'life_status',
                operator: 'NEQ',
                field_values: ['作废']
              }],
              orders: [{ fieldName: 'create_time', isAsc: false }]
            }
          }
        })
      });

      const queryData = await queryResponse.json();
      if (queryData.errorCode !== 0) {
        console.error(`❌ Offset ${offset} 查詢失敗: ${queryData.errorMessage}`);
        continue;
      }

      const sites = queryData.data?.dataList || [];
      console.log(`✅ 獲取到 ${sites.length} 筆資料`);

      // 分析資料
      sites.forEach((site, index) => {
        const analysis = {
          offset: offset,
          index: index,
          id: site._id,
          name: site.name,
          problems: []
        };

        // 檢查 field_23Z5i__c
        if (site.field_23Z5i__c !== undefined) {
          const isArray = Array.isArray(site.field_23Z5i__c);
          const jsonLength = isArray ? JSON.stringify(site.field_23Z5i__c).length : 0;
          
          analysis.field_23Z5i__c = {
            type: isArray ? 'array' : typeof site.field_23Z5i__c,
            length: isArray ? site.field_23Z5i__c.length : null,
            jsonLength: jsonLength,
            value: site.field_23Z5i__c
          };

          if (jsonLength > 255) {
            analysis.problems.push(`field_23Z5i__c JSON 太長: ${jsonLength} 字元`);
          }
        }

        // 檢查其他可能有問題的欄位
        const checkFields = ['relevant_team', 'owner', 'created_by', 'last_modified_by'];
        checkFields.forEach(field => {
          if (site[field] && Array.isArray(site[field])) {
            const jsonStr = JSON.stringify(site[field]);
            if (jsonStr.length > 255) {
              analysis.problems.push(`${field} JSON 太長: ${jsonStr.length} 字元`);
            }
          }
        });

        // 檢查文字欄位
        Object.keys(site).forEach(key => {
          const value = site[key];
          if (typeof value === 'string' && value.length > 1000) {
            analysis.problems.push(`${key} 文字太長: ${value.length} 字元`);
          }
        });

        results.push(analysis);

        if (analysis.problems.length > 0) {
          console.log(`\n⚠️  發現問題 - ${site.name}:`);
          analysis.problems.forEach(p => console.log(`   - ${p}`));
        }
      });
    }

    // 保存分析結果
    const outputFile = 'site-analysis-results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n\n📊 分析結果已保存到: ${outputFile}`);

    // 總結
    const problematicRecords = results.filter(r => r.problems.length > 0);
    console.log(`\n🎯 總結:`);
    console.log(`   檢查記錄數: ${results.length}`);
    console.log(`   有問題記錄: ${problematicRecords.length}`);
    
    if (problematicRecords.length > 0) {
      console.log(`\n最常見的問題:`);
      const problemTypes = {};
      problematicRecords.forEach(r => {
        r.problems.forEach(p => {
          const type = p.split(' ')[0];
          problemTypes[type] = (problemTypes[type] || 0) + 1;
        });
      });
      
      Object.entries(problemTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} 次`);
      });
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error(error.stack);
  }
}

// 執行
checkProblematicOffset();