#!/usr/bin/env node

/**
 * 發現並列出所有CRM對象
 * 幫助找到案場(SPC)和其他對象的正確API名稱
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.WORKER_URL || 'http://localhost:8787/api';

async function discoverAllObjects() {
  console.log('🔍 開始發現所有CRM對象...\n');

  try {
    const response = await axios.get(`${API_URL}/objects`);
    
    if (!response.data.success) {
      throw new Error('獲取對象列表失敗');
    }

    const { defaultObjects, customObjects } = response.data.data;
    
    console.log('📋 預設對象 (Default Objects):');
    console.log('================================');
    defaultObjects.forEach((obj, index) => {
      console.log(`${index + 1}. ${obj.displayName}`);
      console.log(`   API名稱: ${obj.apiName}`);
      console.log(`   已同步: ${obj.isSynced ? '✅' : '❌'}`);
      if (obj.tableName) {
        console.log(`   表名: ${obj.tableName}`);
      }
      console.log('');
    });

    console.log('\n📋 自定義對象 (Custom Objects):');
    console.log('================================');
    customObjects.forEach((obj, index) => {
      console.log(`${index + 1}. ${obj.displayName}`);
      console.log(`   API名稱: ${obj.apiName}`);
      console.log(`   已同步: ${obj.isSynced ? '✅' : '❌'}`);
      if (obj.tableName) {
        console.log(`   表名: ${obj.tableName}`);
      }
      if (obj.description) {
        console.log(`   描述: ${obj.description}`);
      }
      console.log('');
    });

    // 搜索可能的案場對象
    console.log('\n🏢 可能的案場相關對象:');
    console.log('=======================');
    const allObjects = [...defaultObjects, ...customObjects];
    const siteRelatedObjects = allObjects.filter(obj => 
      obj.displayName.includes('案場') ||
      obj.displayName.includes('SPC') ||
      obj.displayName.includes('工地') ||
      obj.displayName.includes('項目') ||
      obj.displayName.includes('工程') ||
      obj.apiName.toLowerCase().includes('spc') ||
      obj.apiName.toLowerCase().includes('site') ||
      obj.apiName.toLowerCase().includes('project') ||
      obj.apiName.toLowerCase().includes('case')
    );

    if (siteRelatedObjects.length > 0) {
      siteRelatedObjects.forEach(obj => {
        console.log(`✅ ${obj.displayName} (${obj.apiName})`);
        console.log(`   類型: ${obj.isCustom ? '自定義' : '預設'}`);
        console.log(`   同步狀態: ${obj.isSynced ? '已同步' : '未同步'}`);
      });
    } else {
      console.log('❌ 沒有找到明顯的案場相關對象');
    }

    console.log('\n📊 統計:');
    console.log(`總對象數: ${allObjects.length}`);
    console.log(`預設對象: ${defaultObjects.length}`);
    console.log(`自定義對象: ${customObjects.length}`);
    console.log(`已同步對象: ${allObjects.filter(o => o.isSynced).length}`);

  } catch (error) {
    console.error('\n❌ 發現對象失敗:', error.message);
    if (error.response) {
      console.error('詳細錯誤:', error.response.data);
    }
    process.exit(1);
  }
}

// 執行發現
discoverAllObjects();