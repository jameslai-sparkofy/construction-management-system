#!/usr/bin/env node

/**
 * 快速測試腳本 - 模擬API調用
 * 用於在沒有實際API連接的情況下測試功能
 */

// 模擬商機對象的欄位（基於CSV文件）
const opportunityFields = [
  { apiName: 'lock_rule', displayName: '锁定规则', fieldType: 'lock_rule', isRequired: false },
  { apiName: 'close_date', displayName: '預計成交日期', fieldType: '日期', isRequired: true },
  { apiName: 'field_n4qm3__c', displayName: '預計拆架日', fieldType: '日期', isRequired: false },
  { apiName: 'field_3e2B2__c', displayName: 'GMAP定位', fieldType: '网址', isRequired: false },
  { apiName: 'field_g927h__c', displayName: '維修管理表', fieldType: '网址', isRequired: false },
  { apiName: 'field_3NRfq__c', displayName: '客户是否确认报价', fieldType: '单选', isRequired: false },
  { apiName: 'name', displayName: '商機名稱', fieldType: '单行文本', isRequired: true },
  { apiName: 'account_id', displayName: '客戶名稱', fieldType: '查找关联', isRequired: true },
  { apiName: 'amount', displayName: '商機金額', fieldType: '金额', isRequired: false },
  { apiName: 'sales_stage', displayName: '商机阶段', fieldType: '单选', isRequired: true },
  // ... 更多欄位
];

console.log('🧪 快速測試 - 案場(SPC)對象查找\n');

// 模擬可能的案場對象名稱
const possibleSPCNames = [
  { apiName: 'SPC', displayName: '案場' },
  { apiName: 'SPCObject', displayName: '案場對象' },
  { apiName: 'SiteObject', displayName: '工地對象' },
  { apiName: 'ProjectObject', displayName: '項目對象' },
  { apiName: 'CaseObject', displayName: '案場管理' },
  { apiName: 'object_2jFGH__c', displayName: '案場資料' },
];

console.log('📋 可能的案場對象API名稱:');
possibleSPCNames.forEach(obj => {
  console.log(`   - ${obj.displayName} (${obj.apiName})`);
});

console.log('\n💡 建議:');
console.log('1. 執行 discover-all-objects.js 查看所有對象');
console.log('2. 在紛享銷客後台查看自定義對象的API名稱');
console.log('3. 通常自定義對象的API名稱格式為: object_xxxxx__c');

console.log('\n📊 商機對象(NewOpportunityObj)欄位統計:');
console.log(`   - 總欄位數: 83`);
console.log(`   - 必填欄位: ${opportunityFields.filter(f => f.isRequired).length}`);
console.log(`   - 自定義欄位: ${opportunityFields.filter(f => f.apiName.includes('__c')).length}`);

console.log('\n✅ 系統架構已就緒，等待實際API連接測試。');