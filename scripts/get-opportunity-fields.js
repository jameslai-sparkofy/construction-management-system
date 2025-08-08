#!/usr/bin/env node

/**
 * 獲取商機對象(NewOpportunityObj)的所有欄位
 */

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

async function getOpportunityFields() {
  console.log('💼 開始獲取商機對象(NewOpportunityObj)的欄位定義...\n');

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
    
    if (tokenData.errorCode !== 0) {
      throw new Error(`獲取 Token 失敗: ${tokenData.errorMessage}`);
    }

    const accessToken = tokenData.corpAccessToken;
    const corpId = tokenData.corpId;
    console.log('✅ Token 獲取成功!\n');
    
    // Step 2: 獲取用戶ID
    console.log('2️⃣ 獲取用戶ID...');
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
    console.log('✅ 用戶ID獲取成功!\n');
    
    // Step 3: 查詢商機資料以獲取欄位結構
    console.log('3️⃣ 查詢商機資料以獲取欄位結構...');
    const queryResponse = await fetch(`${CRM_CONFIG.baseUrl}/cgi/crm/v2/data/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: accessToken,
        currentOpenUserId: currentOpenUserId,
        data: {
          dataObjectApiName: 'NewOpportunityObj',
          search_query_info: {
            limit: 1,
            offset: 0
          }
        }
      })
    });

    const queryData = await queryResponse.json();
    
    if (queryData.errorCode !== 0) {
      throw new Error(`查詢商機資料失敗: ${queryData.errorMessage}`);
    }
    
    const sampleData = queryData.data?.dataList?.[0];
    
    if (!sampleData) {
      console.log('⚠️  沒有商機資料，無法獲取欄位結構');
      return;
    }
    
    // Step 4: 分析欄位
    console.log('\n4️⃣ 分析商機對象欄位...');
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
      
      // 根據CSV文件中的欄位名稱匹配可能的中文名稱
      const fieldMapping = {
        'field_n4qm3__c': '預計拆架日',
        'field_3e2B2__c': 'GMAP定位',
        'field_g927h__c': '維修管理表',
        'field_3NRfq__c': '客户是否确认报价',
        'field_Kt4Pg__c': '開工日期',
        'field_11xou__c': '舖土面日期',
        'field_rU4l5__c': '工地名或案場名',
        'field_hh49z__c': '總戶數',
        'field_bgi37__c': '建案名稱',
        'field_SdEgv__c': '需求描述',
        'field_IZys1__c': '頂樓完成日',
        'field_lmjjf__c': '商機可能性',
        'field_Rd32h__c': '預計簽約季度',
        'field_nI1xS__c': '案場地址或地段',
        'field_2zhjh__c': '案場備註',
        'field_zO24t__c': '地上層數',
        'field_e8m3q__c': '浴室(地)坪數',
        'field_0t3OP__c': '施工管理表',
        'field_ncsUJ__c': '缺失追蹤表',
        'field_Mrn1l__c': '棟數',
        'field_mNxa4__c': '浴室間數',
        'field_DlN6M__c': '認列比例',
        'field_Mss6d__c': '預計交屋日期',
        'field_iPvRk__c': '3房戶數',
        'field_UJ7fD__c': '實體層或樣品屋',
        'field_i32Uj__c': '二丁掛數量(萬)',
        'field_5co25__c': '室內坪數',
        'field_ax2Bf__c': '2房戶數',
        'field_vE1Zn__c': '浴室(壁)坪數',
        'field_zYRAu__c': '實體層或樣品屋日期',
        'field_30rKQ__c': '地下層數',
        'field_0oEz1__c': '1房戶數',
        'field_w04Lk__c': '4房戶數'
      };
      
      if (fieldMapping[field]) {
        console.log(`   可能的中文名稱: ${fieldMapping[field]}`);
      }
      console.log('');
    });
    
    // 保存欄位列表
    const fs = require('fs');
    const outputData = {
      objectApiName: 'NewOpportunityObj',
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
    
    const outputPath = './opportunity-fields-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 欄位分析已保存到: ${outputPath}`);
    
    // 識別重要欄位
    console.log('\n🌟 識別到的重要商機欄位:');
    const importantFields = fields.filter(f => 
      f.includes('name') ||
      f.includes('amount') ||
      f.includes('close_date') ||
      f.includes('account') ||
      f.includes('owner') ||
      f.includes('sales_stage') ||
      f.includes('probability')
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
getOpportunityFields();