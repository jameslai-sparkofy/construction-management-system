const { chromium } = require('playwright');

async function testFinalSites() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 監聽 Console 日誌
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  try {
    console.log('🎯 測試修復後的案場載入...');
    
    // 導航並設置認證
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    // 導航到專案詳情頁面
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入
    await page.waitForTimeout(8000);

    // 檢查頁面內容
    const projectName = await page.textContent('#projectName').catch(() => '未找到');
    const sitesContent = await page.textContent('#gridContent').catch(() => '未找到');
    const buildingTabs = await page.$$('.building-tab');
    const floorRows = await page.$$('.floor-row');

    console.log(`\n✅ 修復結果:`);
    console.log(`🏗️ 專案名稱: ${projectName}`);
    console.log(`📊 案場內容長度: ${sitesContent.length} 字符`);
    console.log(`🏢 建築標籤數: ${buildingTabs.length}`);
    console.log(`📏 樓層行數: ${floorRows.length}`);

    // 檢查建築標籤內容
    if (buildingTabs.length > 0) {
      console.log(`\n🏢 建築標籤:`);
      for (let i = 0; i < Math.min(buildingTabs.length, 3); i++) {
        const tabText = await buildingTabs[i].textContent();
        console.log(`  ${i+1}. ${tabText}`);
      }
    }

    // 檢查案場內容預覽
    if (sitesContent.length > 20) {
      console.log(`\n📄 案場內容預覽:`);
      console.log(sitesContent.substring(0, 300) + '...');
    }

    // 檢查圓餅圖
    const pieCharts = await page.$$('.pie-chart');
    console.log(`\n🥧 統計圓餅圖: ${pieCharts.length} 個`);

    // 檢查優化相關日誌
    const optimizedLogs = consoleLogs.filter(log => 
      log.text.includes('OPTIMIZED') || 
      log.text.includes('批次') ||
      log.text.includes('sites') ||
      log.text.includes('案場')
    );
    
    console.log(`\n📝 載入相關日誌 (${optimizedLogs.length} 條):`);
    optimizedLogs.slice(-10).forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

    // 檢查錯誤
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    if (errorLogs.length > 0) {
      console.log(`\n🚨 錯誤日誌 (${errorLogs.length} 條):`);
      errorLogs.slice(-3).forEach(log => {
        console.log(`  ${log.text}`);
      });
    }

    console.log(`\n🎉 測試完成！案場資料${sitesContent.includes('暫無') ? '仍為空' : '已成功載入'}！`);

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testFinalSites().catch(console.error);