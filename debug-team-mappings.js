const { chromium } = require('playwright');

async function debugTeamMappings() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 調試工班映射問題...');
    
    // 設置認證並導航
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(6000);

    // 檢查全域變數
    const debugInfo = await page.evaluate(() => {
      return {
        teamMappings: window.teamMappings,
        teamNameToIdMap: window.teamNameToIdMap,
        projectTeams: window.projectTeams,
        currentSites: window.currentSites ? window.currentSites.slice(0, 3).map(site => ({
          name: site.name,
          building: site.field_WD7k1__c,
          floor: site.field_XuJP2__c,
          team: site.shift_time__c,
          teamProcessed: 'unknown' // 待分析
        })) : []
      };
    });

    console.log('\n📊 工班映射調試資訊:');
    console.log('🔑 teamMappings 數量:', Object.keys(debugInfo.teamMappings || {}).length);
    console.log('🔑 teamNameToIdMap 數量:', Object.keys(debugInfo.teamNameToIdMap || {}).length);
    console.log('🔑 projectTeams 數量:', debugInfo.projectTeams?.length || 0);

    if (debugInfo.teamMappings) {
      console.log('\n📋 工班映射清單:');
      Object.entries(debugInfo.teamMappings).slice(0, 5).forEach(([name, team]) => {
        console.log(`  ${name} → ID: ${team.id}, 縮寫: ${team.abbreviation}`);
      });
    }

    if (debugInfo.currentSites && debugInfo.currentSites.length > 0) {
      console.log('\n🏗️ 案場工班範例:');
      debugInfo.currentSites.forEach((site, i) => {
        const mappedTeam = debugInfo.teamMappings[site.team];
        console.log(`  ${i+1}. ${site.name} (${site.building}${site.floor})`);
        console.log(`     原始工班: "${site.team}"`);
        console.log(`     映射結果: ${mappedTeam ? `${mappedTeam.name} (${mappedTeam.abbreviation})` : '未找到映射'}`);
      });
    }

    // 檢查頁面上的工班顯示
    const displayedTeams = await page.evaluate(() => {
      const teamElements = document.querySelectorAll('.team-name, .team-info');
      return Array.from(teamElements).slice(0, 10).map(el => el.textContent.trim());
    });

    console.log('\n🖥️ 頁面顯示的工班名稱:');
    displayedTeams.forEach((team, i) => {
      console.log(`  ${i+1}. "${team}"`);
    });

    // 檢查是否有工班縮寫顯示
    const abbreviations = await page.evaluate(() => {
      const abbrevElements = document.querySelectorAll('.team-abbreviation, .team-short');
      return Array.from(abbrevElements).slice(0, 5).map(el => el.textContent.trim());
    });

    if (abbreviations.length > 0) {
      console.log('\n📝 工班縮寫顯示:');
      abbreviations.forEach((abbrev, i) => {
        console.log(`  ${i+1}. "${abbrev}"`);
      });
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugTeamMappings().catch(console.error);