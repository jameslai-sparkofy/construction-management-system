const { chromium } = require('playwright');

async function debugTeamStructure() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 比較批次載入與原始載入的工班資料結構...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待批次載入完成
    await page.waitForTimeout(6000);

    // 檢查批次載入的資料結構
    const batchDataStructure = await page.evaluate(() => {
      const teamMappings = window.teamMappings;
      const teamNameToIdMap = window.teamNameToIdMap;
      
      if (!teamMappings) return { error: 'No teamMappings found' };
      
      // 檢查第一個工班的結構
      const firstTeamName = Object.keys(teamMappings)[0];
      const firstTeam = teamMappings[firstTeamName];
      
      // 檢查案場資料中的工班引用
      const currentSites = window.currentSites;
      const siteTeamNames = currentSites ? currentSites.slice(0, 5).map(site => ({
        siteName: site.name || 'unnamed',
        teamFromSite: site.shift_time__c,
        teamType: typeof site.shift_time__c
      })) : [];
      
      return {
        teamMappingsStructure: {
          totalTeams: Object.keys(teamMappings).length,
          firstTeamName,
          firstTeamStructure: firstTeam,
          hasAbbreviation: firstTeam && 'abbreviation' in firstTeam,
          hasId: firstTeam && 'id' in firstTeam,
          hasName: firstTeam && 'name' in firstTeam
        },
        teamNameToIdMapStructure: {
          exists: !!teamNameToIdMap,
          count: teamNameToIdMap ? Object.keys(teamNameToIdMap).length : 0,
          sampleMapping: teamNameToIdMap ? Object.entries(teamNameToIdMap).slice(0, 2) : []
        },
        siteTeamReferences: siteTeamNames,
        hasSites: !!currentSites,
        sitesCount: currentSites ? currentSites.length : 0
      };
    });

    console.log('📊 批次載入的資料結構:');
    console.log('teamMappings:');
    console.log(`   總工班數: ${batchDataStructure.teamMappingsStructure?.totalTeams || 0}`);
    console.log(`   第一個工班名: "${batchDataStructure.teamMappingsStructure?.firstTeamName}"`);
    console.log(`   第一個工班結構:`, batchDataStructure.teamMappingsStructure?.firstTeamStructure);
    console.log(`   有abbreviation欄位: ${batchDataStructure.teamMappingsStructure?.hasAbbreviation}`);
    
    console.log('\nteamNameToIdMap:');
    console.log(`   存在: ${batchDataStructure.teamNameToIdMapStructure?.exists}`);
    console.log(`   數量: ${batchDataStructure.teamNameToIdMapStructure?.count}`);
    console.log(`   範例映射:`, batchDataStructure.teamNameToIdMapStructure?.sampleMapping);
    
    console.log('\n案場中的工班引用:');
    console.log(`   案場總數: ${batchDataStructure.sitesCount}`);
    batchDataStructure.siteTeamReferences?.forEach((site, i) => {
      console.log(`   ${i+1}. ${site.siteName}: "${site.teamFromSite}" (${site.teamType})`);
    });

    // 手動模擬 processSitesData 來找出問題
    console.log('\n🔧 手動模擬 processSitesData 執行...');
    const simulationResult = await page.evaluate(() => {
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No currentSites data' };
      }
      
      const testResults = [];
      const sites = window.currentSites.slice(0, 5); // 測試前5個案場
      
      sites.forEach(site => {
        const teamNameFromSite = site.shift_time__c;
        
        if (teamNameFromSite && teamNameFromSite !== '-') {
          // 模擬工班 ID 查找邏輯
          let teamId = window.teamNameToIdMap[teamNameFromSite];
          let foundMethod = 'direct';
          
          if (!teamId) {
            const decodedName = decodeURIComponent(teamNameFromSite).trim();
            teamId = window.teamNameToIdMap[decodedName];
            foundMethod = 'decoded';
          }
          
          if (!teamId && teamNameFromSite.match(/^[0-9a-f]{24}$/)) {
            teamId = teamNameFromSite;
            foundMethod = 'as-id';
          }
          
          // 檢查工班映射中的資料
          const teamFromMappings = window.teamMappings[teamNameFromSite];
          
          testResults.push({
            siteName: site.name,
            teamNameFromSite: teamNameFromSite,
            teamId: teamId || 'NOT_FOUND',
            foundMethod: foundMethod,
            teamFromMappings: teamFromMappings ? {
              id: teamFromMappings.id,
              name: teamFromMappings.name,
              abbreviation: teamFromMappings.abbreviation
            } : 'NOT_FOUND'
          });
        }
      });
      
      return { success: true, results: testResults };
    });

    if (simulationResult.success) {
      console.log('模擬結果:');
      simulationResult.results.forEach((result, i) => {
        console.log(`   ${i+1}. ${result.siteName}:`);
        console.log(`      工班名: "${result.teamNameFromSite}"`);
        console.log(`      找到ID: ${result.teamId} (${result.foundMethod})`);
        console.log(`      映射資料: ${result.teamFromMappings !== 'NOT_FOUND' ? JSON.stringify(result.teamFromMappings) : 'NOT_FOUND'}`);
        console.log('');
      });
    } else {
      console.log('模擬失敗:', simulationResult.error);
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugTeamStructure().catch(console.error);