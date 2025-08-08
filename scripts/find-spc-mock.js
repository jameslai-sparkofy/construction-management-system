#!/usr/bin/env node

/**
 * 模擬查找案場(SPC)對象
 * 基於紛享銷客的命名慣例進行推測
 */

console.log('🔍 開始查找案場(SPC)對象...\n');

// 基於紛享銷客的命名模式，可能的案場對象名稱
const possibleSPCNames = [
  // 標準命名
  { apiName: 'SPC', displayName: '案場' },
  { apiName: 'SPCObject', displayName: '案場對象' },
  { apiName: 'SiteObject', displayName: '工地對象' },
  { apiName: 'ProjectObject', displayName: '項目對象' },
  { apiName: 'ConstructionSiteObject', displayName: '施工現場' },
  
  // 自定義對象格式 (object_xxxxx__c)
  { apiName: 'object_SPC__c', displayName: '案場管理' },
  { apiName: 'object_site__c', displayName: '工地管理' },
  { apiName: 'object_project__c', displayName: '項目管理' },
  { apiName: 'object_case__c', displayName: '案場資料' },
  { apiName: 'object_construction__c', displayName: '建案管理' },
  
  // 可能的中文拼音
  { apiName: 'AnChangObject', displayName: '案場' },
  { apiName: 'GongDiObject', displayName: '工地' },
  { apiName: 'JianAnObject', displayName: '建案' },
  
  // 其他可能的格式
  { apiName: 'CaseSiteObject', displayName: '案場工地' },
  { apiName: 'BuildingSiteObject', displayName: '建築工地' },
  { apiName: 'ConstructionCaseObject', displayName: '建設案場' }
];

console.log('📋 基於紛享銷客命名規則，最可能的案場對象API名稱：\n');

console.log('🎯 優先級最高（自定義對象標準格式）:');
console.log('====================================');
possibleSPCNames.filter(n => n.apiName.startsWith('object_')).forEach(name => {
  console.log(`   ${name.apiName} - ${name.displayName}`);
});

console.log('\n🎯 優先級次高（英文命名）:');
console.log('============================');
possibleSPCNames.filter(n => !n.apiName.startsWith('object_') && n.apiName.includes('Object')).forEach(name => {
  console.log(`   ${name.apiName} - ${name.displayName}`);
});

console.log('\n🎯 其他可能:');
console.log('============');
possibleSPCNames.filter(n => !n.apiName.startsWith('object_') && !n.apiName.includes('Object')).forEach(name => {
  console.log(`   ${name.apiName} - ${name.displayName}`);
});

console.log('\n💡 查找建議:');
console.log('1. 首先嘗試搜索關鍵字: "案場", "SPC", "工地", "site"');
console.log('2. 查看自定義對象列表，通常以 object_ 開頭');
console.log('3. 案場作為業務核心對象，應該在自定義對象中');
console.log('4. 可能與商機(NewOpportunityObj)有關聯關係');

console.log('\n📊 預測案場對象可能包含的欄位:');
console.log('================================');
const predictedFields = [
  '案場名稱 (name)',
  '案場編號 (site_code)',
  '案場地址 (address)',
  '所在城市 (city)',
  '所在區域 (district)',
  '案場狀態 (status)',
  '負責人 (owner)',
  '聯絡電話 (phone)',
  '開工日期 (start_date)',
  '完工日期 (end_date)',
  '建案類型 (project_type)',
  '總戶數 (total_units)',
  '建築面積 (building_area)',
  '土地面積 (land_area)',
  '關聯商機 (opportunity_id)',
  '關聯客戶 (account_id)'
];

predictedFields.forEach(field => {
  console.log(`   - ${field}`);
});

console.log('\n🔧 執行實際查找:');
console.log('================');
console.log('請執行以下命令進行實際查找:');
console.log('1. node scripts/discover-all-objects.js');
console.log('2. 在輸出中搜索上述可能的名稱');
console.log('3. 或使用 API: GET /api/objects?search=案場');

console.log('\n✨ 最佳猜測: object_site__c 或 SiteObject');