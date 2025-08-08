#!/usr/bin/env node

/**
 * 同步缺失的 373 條案場資料
 * 直接從 CRM 獲取 offset 2500-3277 的資料並手動同步
 */

const fetch = require('node-fetch');

const CRM_CONFIG = {
  baseUrl: 'https://open.fxiaoke.com',
  appId: 'FSAID_1320691',
  appSecret: 'ec63ff237c5c4a759be36d3a8fb7a3b4',
  permanentCode: '899433A4A04A3B8CB1CC2183DA4B5B48'
};

const WORKER_URL = 'https://fx-d1-rest-api.lai-jameslai.workers.dev';
const AUTH_TOKEN = 'fx-crm-api-secret-2025';

async function syncMissingSites() {
  console.log('🔄 同步缺失的 373 條案場資料...\n');

  try {
    // 1. 獲取 CRM 認證
    console.log('1. 獲取 CRM 認證...');
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

    // 2. 獲取用戶 ID
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
    console.log('✅ 用戶 ID 獲取成功\n');

    // 3. 分批獲取並同步資料（從 offset 2500 開始）
    console.log('2. 開始分批同步缺失的資料...');
    const startOffset = 2500;
    const totalCount = 3277;
    const batchSize = 100; // 每批 100 條，避免超時
    let totalSynced = 0;
    let totalFailed = 0;

    for (let offset = startOffset; offset < totalCount; offset += batchSize) {
      const limit = Math.min(batchSize, totalCount - offset);
      console.log(`\n批次: offset ${offset}, 獲取 ${limit} 條...`);

      // 獲取 CRM 資料
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
              limit: limit,
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
        console.error(`❌ 獲取資料失敗: ${queryData.errorMessage}`);
        continue;
      }

      const sites = queryData.data?.dataList || [];
      console.log(`✅ 獲取到 ${sites.length} 條資料`);

      // 轉換資料格式
      const transformedSites = sites.map(site => ({
        _id: site._id,
        name: site.name,
        owner: Array.isArray(site.owner) ? site.owner[0] : site.owner,
        owner__r: site.owner__r?.name || null,
        owner_department_id: site.owner_department_id || null,
        owner_department: site.owner_department || null,
        create_time: site.create_time,
        created_by: Array.isArray(site.created_by) ? site.created_by[0] : site.created_by,
        created_by__r: site.created_by__r?.name || null,
        last_modified_time: site.last_modified_time,
        last_modified_by: Array.isArray(site.last_modified_by) ? site.last_modified_by[0] : site.last_modified_by,
        last_modified_by__r: site.last_modified_by__r?.name || null,
        life_status: site.life_status || 'normal',
        life_status__r: site.life_status__r || null,
        lock_status: site.lock_status || '0',
        lock_status__r: site.lock_status__r || null,
        is_deleted: site.is_deleted || false,
        record_type: site.record_type || 'default__c',
        version: site.version || null,
        data_own_department: Array.isArray(site.data_own_department) ? site.data_own_department[0] : site.data_own_department,
        data_own_department__r: site.data_own_department__r?.deptName || null,
        relevant_team: Array.isArray(site.relevant_team) ? JSON.stringify(site.relevant_team) : null,
        total_num: site.total_num || null,
        field_k7e6q__c: site.field_k7e6q__c || null,
        field_k7e6q__c__r: site.field_k7e6q__c__r || null,
        field_k7e6q__c__relation_ids: site.field_k7e6q__c__relation_ids || null,
        field_1P96q__c: site.field_1P96q__c || null,
        field_1P96q__c__r: site.field_1P96q__c__r || null,
        field_1P96q__c__relation_ids: site.field_1P96q__c__relation_ids || null,
        field_npLvn__c: site.field_npLvn__c || null,
        field_npLvn__c__r: site.field_npLvn__c__r || null,
        field_npLvn__c__relation_ids: site.field_npLvn__c__relation_ids || null,
        field_WD7k1__c: site.field_WD7k1__c || null,
        field_XuJP2__c: site.field_XuJP2__c || null,
        field_i2Q1g__c: site.field_i2Q1g__c || null,
        field_tXAko__c: site.field_tXAko__c || null,
        field_Q6Svh__c: site.field_Q6Svh__c || null,
        field_23Z5i__c: Array.isArray(site.field_23Z5i__c) ? site.field_23Z5i__c[0] : site.field_23Z5i__c,
        field_23Z5i__c__r: site.field_23Z5i__c__r || null,
        field_dxr31__c: site.field_dxr31__c || null,
        field_dxr31__c__r: site.field_dxr31__c__r || null,
        fx_created_at: site.create_time,
        fx_updated_at: site.last_modified_time,
        sync_version: 0
      }));

      // 批量插入到 D1
      let successCount = 0;
      let failCount = 0;

      for (const site of transformedSites) {
        try {
          const response = await fetch(`${WORKER_URL}/rest/object_8w9cb__c/${site._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify(site)
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            const error = await response.text();
            console.error(`  ❌ 同步失敗 ${site._id}: ${error}`);
          }
        } catch (error) {
          failCount++;
          console.error(`  ❌ 同步錯誤 ${site._id}: ${error.message}`);
        }
      }

      console.log(`  同步結果: 成功 ${successCount}, 失敗 ${failCount}`);
      totalSynced += successCount;
      totalFailed += failCount;

      // 短暫延遲，避免過載
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4. 最終統計
    console.log('\n========== 同步完成 ==========');
    console.log(`總共處理: ${totalSynced + totalFailed} 條`);
    console.log(`成功同步: ${totalSynced} 條`);
    console.log(`同步失敗: ${totalFailed} 條`);

    // 5. 驗證最終數量
    console.log('\n3. 驗證最終資料數量...');
    const countResponse = await fetch(`${WORKER_URL}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        sql: 'SELECT COUNT(*) as total FROM object_8w9cb__c'
      })
    });

    if (countResponse.ok) {
      const countData = await countResponse.json();
      const total = countData.results[0]?.total || 0;
      console.log(`\n📊 D1 資料庫案場總數: ${total} 條`);
      console.log(`同步率: ${((total / 3277) * 100).toFixed(1)}%`);
      
      if (total === 3277) {
        console.log('\n✨ 完美！所有 3,277 條案場資料都已成功同步！');
      }
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error(error.stack);
  }
}

// 執行
syncMissingSites();