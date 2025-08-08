#!/usr/bin/env node

/**
 * 分析 CRM 對象之間的關聯關係
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'https://open.fxiaoke.com';
const APP_ID = 'FSAID_1320691';
const APP_SECRET = 'ec63ff237c5c4a759be36d3a8fb7a3b4';
const PERMANENT_CODE = '899433A4A04A3B8CB1CC2183DA4B5B48';

// 定義要分析的對象
const OBJECTS_TO_ANALYZE = [
  { apiName: 'NewOpportunityObj', displayName: '商機', isCustom: false },
  { apiName: 'object_8W9cb__c', displayName: '案場', isCustom: true },
  { apiName: 'object_k1XqG__c', displayName: '維修單', isCustom: true },
  { apiName: 'object_50HJ8__c', displayName: '工地師父', isCustom: true },
  { apiName: 'SupplierObj', displayName: '供應商', isCustom: false },
  { apiName: 'site_cabinet__c', displayName: '案場(浴櫃)', isCustom: true },
  { apiName: 'progress_management_announ__c', displayName: '進度管理公告', isCustom: true }
];

async function analyzeRelationships() {
  try {
    // 1. 獲取認證
    console.log('🔐 獲取認證信息...');
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
    const corpAccessToken = tokenData.corpAccessToken;
    const corpId = tokenData.corpId;

    const userResponse = await fetch(`${API_BASE_URL}/cgi/user/getByMobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corpId: corpId,
        corpAccessToken: corpAccessToken,
        mobile: "17675662629"
      })
    });

    const userData = await userResponse.json();
    const currentOpenUserId = userData.empList?.[0]?.openUserId;
    console.log('✅ 認證成功\n');

    // 2. 獲取每個對象的樣本數據
    const objectData = {};
    const relationships = [];
    
    for (const obj of OBJECTS_TO_ANALYZE) {
      console.log(`\n📋 分析 ${obj.displayName} (${obj.apiName})...`);
      console.log('─'.repeat(60));
      
      // 獲取樣本數據
      const endpoint = obj.isCustom 
        ? '/cgi/crm/custom/v2/data/query'
        : '/cgi/crm/v2/data/query';
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corpId: corpId,
          corpAccessToken: corpAccessToken,
          currentOpenUserId: currentOpenUserId,
          data: {
            dataObjectApiName: obj.apiName,
            search_query_info: {
              limit: 3,
              offset: 0,
              filters: []
            }
          }
        })
      });

      const data = await response.json();
      
      if (data.errorCode !== 0) {
        console.log(`  ⚠️ 無法獲取數據: ${data.errorMessage}`);
        continue;
      }
      
      const records = data.data?.dataList || [];
      const total = data.data?.total || 0;
      
      console.log(`  記錄總數: ${total}`);
      
      if (records.length > 0) {
        const sample = records[0];
        objectData[obj.apiName] = {
          displayName: obj.displayName,
          sample: sample,
          fields: Object.keys(sample)
        };
        
        // 分析關聯欄位
        console.log(`\n  🔍 潛在關聯欄位:`);
        
        for (const [field, value] of Object.entries(sample)) {
          // 跳過系統欄位
          if (field === 'searchAfterId' || field === 'total_num') continue;
          
          // 識別關聯欄位的模式
          let relationType = null;
          let relatedObject = null;
          
          // 1. 以 __r 結尾的欄位通常是關聯對象
          if (field.endsWith('__r')) {
            relationType = 'lookup';
            console.log(`    🔗 ${field}: 查找關係 (值: ${JSON.stringify(value).substring(0, 50)}...)`);
            
            // 嘗試識別關聯的對象
            if (field.includes('owner') || field.includes('created_by') || field.includes('modified_by')) {
              relatedObject = 'User/Employee';
            } else if (field.includes('department')) {
              relatedObject = 'Department';
            } else if (field.includes('site') || field.includes('案場')) {
              relatedObject = 'object_8W9cb__c';
            } else if (field.includes('opportunity') || field.includes('商機')) {
              relatedObject = 'NewOpportunityObj';
            }
          }
          
          // 2. 以 _id 結尾的欄位可能是外鍵
          else if (field.endsWith('_id') || field.endsWith('Id')) {
            relationType = 'reference';
            console.log(`    🆔 ${field}: ID 引用 (值: ${value})`);
            
            if (field.includes('owner')) {
              relatedObject = 'User';
            } else if (field.includes('department')) {
              relatedObject = 'Department';  
            } else if (field.includes('parent')) {
              relatedObject = obj.apiName; // 自引用
            }
          }
          
          // 3. 包含特定關鍵字的欄位
          else if (field.includes('owner') || field.includes('created_by') || field.includes('modified_by')) {
            relationType = 'user_reference';
            relatedObject = 'User';
            console.log(`    👤 ${field}: 用戶引用 (值: ${value})`);
          }
          
          // 4. 檢查欄位值是否為對象（可能包含關聯信息）
          else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // 檢查對象中是否有 ID 欄位
            const hasId = Object.keys(value).some(k => k.includes('id') || k.includes('Id'));
            if (hasId) {
              relationType = 'embedded';
              console.log(`    📦 ${field}: 內嵌對象 (包含: ${Object.keys(value).join(', ')})`);
            }
          }
          
          // 5. 數組類型可能是多對多關係
          else if (Array.isArray(value) && value.length > 0) {
            if (typeof value[0] === 'object') {
              relationType = 'many_to_many';
              console.log(`    📚 ${field}: 陣列關係 (${value.length} 項)`);
            }
          }
          
          // 記錄關聯關係
          if (relationType && relatedObject) {
            relationships.push({
              from: obj.apiName,
              fromDisplay: obj.displayName,
              to: relatedObject,
              field: field,
              type: relationType
            });
          }
        }
      }
    }
    
    // 3. 生成關係圖
    console.log('\n\n' + '='.repeat(80));
    console.log('\n🗺️  對象關聯關係圖\n');
    console.log('```mermaid');
    console.log('graph TD');
    console.log('    %% 定義節點樣式');
    console.log('    classDef standard fill:#e1f5fe,stroke:#01579b,stroke-width:2px;');
    console.log('    classDef custom fill:#fff3e0,stroke:#e65100,stroke-width:2px;');
    console.log('    classDef system fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;');
    console.log('');
    console.log('    %% 定義節點');
    
    // 業務對象節點
    for (const obj of OBJECTS_TO_ANALYZE) {
      const className = obj.isCustom ? 'custom' : 'standard';
      console.log(`    ${obj.apiName}["${obj.displayName}<br/>${obj.apiName}"]:::${className}`);
    }
    
    // 系統對象節點
    console.log('    User["用戶/員工<br/>User/Employee"]:::system');
    console.log('    Department["部門<br/>Department"]:::system');
    console.log('');
    console.log('    %% 定義關係');
    
    // 去重並輸出關係
    const uniqueRelationships = new Map();
    for (const rel of relationships) {
      const key = `${rel.from}-${rel.to}-${rel.field}`;
      if (!uniqueRelationships.has(key)) {
        uniqueRelationships.set(key, rel);
      }
    }
    
    for (const rel of uniqueRelationships.values()) {
      const label = rel.field.replace(/__r$/, '').replace(/_/g, ' ');
      console.log(`    ${rel.from} -->|${label}| ${rel.to}`);
    }
    
    console.log('```');
    
    // 4. 輸出詳細的關聯分析
    console.log('\n\n📝 關聯關係詳細說明:\n');
    console.log('─'.repeat(80));
    
    // 按對象分組關係
    const groupedRelationships = {};
    for (const rel of uniqueRelationships.values()) {
      if (!groupedRelationships[rel.from]) {
        groupedRelationships[rel.from] = [];
      }
      groupedRelationships[rel.from].push(rel);
    }
    
    for (const [objName, rels] of Object.entries(groupedRelationships)) {
      const obj = OBJECTS_TO_ANALYZE.find(o => o.apiName === objName);
      if (obj) {
        console.log(`\n${obj.displayName} (${objName}):`);
        for (const rel of rels) {
          const toDisplay = rel.to === 'User' ? '用戶' :
                           rel.to === 'Department' ? '部門' :
                           rel.to === 'User/Employee' ? '用戶/員工' :
                           rel.to === 'object_8W9cb__c' ? '案場' :
                           rel.to === 'NewOpportunityObj' ? '商機' :
                           rel.to;
          console.log(`  ➤ ${rel.field} → ${toDisplay} (${rel.type})`);
        }
      }
    }
    
    // 5. 分析對象間的業務關係
    console.log('\n\n💡 業務關係分析:\n');
    console.log('─'.repeat(80));
    
    // 檢查特定的業務關係
    console.log('\n可能的業務關係鏈:');
    console.log('1. 商機 → 案場 → 維修單');
    console.log('   (銷售機會轉化為具體案場，案場產生維修需求)');
    console.log('\n2. 案場 → 案場(浴櫃)');
    console.log('   (案場包含浴櫃等設施信息)');
    console.log('\n3. 維修單 → 工地師父');
    console.log('   (維修單分配給工地師父處理)');
    console.log('\n4. 供應商 → 案場/維修單');
    console.log('   (供應商提供材料和服務)');
    console.log('\n5. 進度管理公告 → 案場');
    console.log('   (公告關聯特定案場的進度)');
    
  } catch (error) {
    console.error('❌ 分析失敗:', error.message);
    console.error(error.stack);
  }
}

analyzeRelationships();