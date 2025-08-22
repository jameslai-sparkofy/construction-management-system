const { chromium } = require('playwright');

async function testActualUIDisplay() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 檢查實際UI中工班簡稱的顯示...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(8000);

    // 檢查實際表格中的工班顯示
    const uiDisplayCheck = await page.evaluate(() => {
      // 檢查樓層表格中的工班顯示
      const gridCells = document.querySelectorAll('.grid-cell');
      const sampleCells = Array.from(gridCells).slice(0, 20).map(cell => ({
        content: cell.textContent?.trim() || '',
        title: cell.title || '',
        className: cell.className,
        hasTeamData: cell.textContent?.includes('工班') || cell.textContent?.includes('公司'),
        isLongText: cell.textContent?.length > 10
      }));

      // 檢查工班圖例
      const teamLegendItems = document.querySelectorAll('.team-legend-item, .legend-item');
      const legendInfo = Array.from(teamLegendItems).slice(0, 10).map(item => ({
        text: item.textContent?.trim() || '',
        className: item.className
      }));

      // 檢查是否有工班相關的 tooltip 或標題
      const cellsWithTitles = Array.from(gridCells).filter(cell => cell.title && cell.title.length > 0);
      const titleSamples = cellsWithTitles.slice(0, 5).map(cell => ({
        content: cell.textContent?.trim() || '',
        title: cell.title
      }));

      return {
        gridCellsTotal: gridCells.length,
        sampleCells: sampleCells.filter(cell => cell.content.length > 0),
        legendItems: legendInfo,
        cellsWithTitles: titleSamples,
        hasAnyTeamData: sampleCells.some(cell => cell.hasTeamData),
        hasLongContent: sampleCells.some(cell => cell.isLongText)
      };
    });

    console.log('📋 實際UI顯示檢查:');
    console.log(`表格單元格總數: ${uiDisplayCheck.gridCellsTotal}`);
    console.log(`有內容的範例單元格: ${uiDisplayCheck.sampleCells.length}`);
    
    console.log('\n🔹 表格單元格內容範例:');
    uiDisplayCheck.sampleCells.slice(0, 10).forEach((cell, i) => {
      console.log(`   ${i+1}. "${cell.content}" ${cell.isLongText ? '(長文本)' : ''}`);
    });

    console.log('\n🔹 工班圖例:');
    if (uiDisplayCheck.legendItems.length > 0) {
      uiDisplayCheck.legendItems.forEach((item, i) => {
        console.log(`   ${i+1}. "${item.text}"`);
      });
    } else {
      console.log('   無圖例項目');
    }

    console.log('\n🔹 有標題的單元格:');
    if (uiDisplayCheck.cellsWithTitles.length > 0) {
      uiDisplayCheck.cellsWithTitles.forEach((cell, i) => {
        console.log(`   ${i+1}. 內容: "${cell.content}" / 標題: "${cell.title}"`);
      });
    } else {
      console.log('   無標題單元格');
    }

    // 檢查 processSitesData 是否被正確調用
    const processingStatus = await page.evaluate(() => {
      return {
        currentSitesCount: window.currentSites ? window.currentSites.length : 0,
        teamMappingsCount: window.teamMappings ? Object.keys(window.teamMappings).length : 0,
        teamNameToIdMapCount: window.teamNameToIdMap ? Object.keys(window.teamNameToIdMap).length : 0,
        
        // 檢查是否有 processSitesData 的痕跡
        hasProcessedData: !!window.unassignedSitesCount || window.unassignedSitesCount === 0,
        unassignedCount: window.unassignedSitesCount
      };
    });

    console.log('\n📊 資料處理狀態:');
    console.log(`currentSites: ${processingStatus.currentSitesCount}`);
    console.log(`teamMappings: ${processingStatus.teamMappingsCount}`);
    console.log(`teamNameToIdMap: ${processingStatus.teamNameToIdMapCount}`);
    console.log(`已處理資料: ${processingStatus.hasProcessedData}`);
    console.log(`未分配案場: ${processingStatus.unassignedCount}`);

    // 診斷
    console.log('\n🎯 診斷結果:');
    if (uiDisplayCheck.hasLongContent) {
      console.log('❌ 發現長文本 - 可能顯示完整工班名稱而非簡稱');
    } else if (uiDisplayCheck.sampleCells.some(cell => /^[0-9a-f]{24}$/.test(cell.content))) {
      console.log('❌ 發現ID格式文本 - 可能顯示工班ID');
    } else {
      console.log('✅ 內容看起來正常 - 可能是簡稱');
    }

    if (processingStatus.hasProcessedData) {
      console.log('✅ processSitesData 已執行');
    } else {
      console.log('❌ processSitesData 可能未正確執行');
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testActualUIDisplay().catch(console.error);