const { chromium } = require('playwright');

async function testOptimizedLoading() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🚀 測試優化後的載入速度...\n');
    
    // 測試 Project List 載入速度
    console.log('1. 測試 Project List 載入速度');
    const listStartTime = Date.now();
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-list.html');
    
    // 等待專案列表載入完成
    await page.waitForSelector('.project-card', { timeout: 10000 });
    await page.waitForTimeout(2000); // 等待所有進度計算完成
    
    const listLoadTime = Date.now() - listStartTime;
    
    // 檢查專案進度是否正確顯示
    const projectStats = await page.evaluate(() => {
      const cards = document.querySelectorAll('.project-card');
      const projects = Array.from(cards).map(card => {
        const name = card.querySelector('.project-card-title')?.textContent || 'Unknown';
        const progressText = card.querySelector('.progress-text')?.textContent || '0%';
        const progressBar = card.querySelector('.progress-fill');
        const progressWidth = progressBar ? progressBar.style.width : '0%';
        
        return {
          name: name.trim(),
          progressText: progressText.trim(),
          progressWidth: progressWidth
        };
      });
      
      return {
        totalProjects: projects.length,
        projectsWithProgress: projects.filter(p => p.progressText !== '0%').length,
        sampleProjects: projects.slice(0, 3)
      };
    });

    console.log(`   載入時間: ${listLoadTime}ms`);
    console.log(`   專案數量: ${projectStats.totalProjects}`);
    console.log(`   有進度的專案: ${projectStats.projectsWithProgress}`);
    console.log('   前3個專案進度:');
    projectStats.sampleProjects.forEach((project, i) => {
      console.log(`     ${i+1}. ${project.name}: ${project.progressText} (${project.progressWidth})`);
    });

    // 測試 Project Detail 載入速度
    console.log('\n2. 測試 Project Detail 載入速度');
    const detailStartTime = Date.now();
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待批次載入完成
    await page.waitForTimeout(6000);
    
    const detailLoadTime = Date.now() - detailStartTime;
    
    // 檢查批次載入效果
    const detailStats = await page.evaluate(() => {
      return {
        hasTeamMappings: !!window.teamMappings,
        teamMappingsCount: window.teamMappings ? Object.keys(window.teamMappings).length : 0,
        hasTeamNameToIdMap: !!window.teamNameToIdMap,
        teamNameToIdMapCount: window.teamNameToIdMap ? Object.keys(window.teamNameToIdMap).length : 0,
        hasCurrentSites: !!window.currentSites,
        currentSitesCount: window.currentSites ? window.currentSites.length : 0
      };
    });

    console.log(`   載入時間: ${detailLoadTime}ms`);
    console.log(`   teamMappings: ${detailStats.hasTeamMappings} (${detailStats.teamMappingsCount}個)`);
    console.log(`   teamNameToIdMap: ${detailStats.hasTeamNameToIdMap} (${detailStats.teamNameToIdMapCount}個)`);
    console.log(`   sites: ${detailStats.hasCurrentSites} (${detailStats.currentSitesCount}個)`);

    // 測試緩存效果
    console.log('\n3. 測試緩存效果（第二次載入）');
    
    const cachedListStartTime = Date.now();
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-list.html');
    await page.waitForSelector('.project-card', { timeout: 5000 });
    const cachedListLoadTime = Date.now() - cachedListStartTime;
    
    const cachedDetailStartTime = Date.now();
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    await page.waitForTimeout(3000);
    const cachedDetailLoadTime = Date.now() - cachedDetailStartTime;

    console.log(`   Project List (緩存): ${cachedListLoadTime}ms`);
    console.log(`   Project Detail (緩存): ${cachedDetailLoadTime}ms`);

    // 總結優化效果
    console.log('\n📊 優化效果總結:');
    console.log(`   Project List 首次載入: ${listLoadTime}ms`);
    console.log(`   Project List 緩存載入: ${cachedListLoadTime}ms`);
    console.log(`   緩存加速: ${Math.round(((listLoadTime - cachedListLoadTime) / listLoadTime) * 100)}%`);
    console.log(`   Project Detail 載入: ${detailLoadTime}ms`);
    
    if (projectStats.projectsWithProgress > 0) {
      console.log('✅ 專案進度預計算正常工作');
    } else {
      console.log('❌ 專案進度預計算需要檢查');
    }
    
    if (detailStats.teamNameToIdMapCount > 0) {
      console.log('✅ 工班映射正常工作');
    } else {
      console.log('❌ 工班映射需要檢查');
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testOptimizedLoading().catch(console.error);