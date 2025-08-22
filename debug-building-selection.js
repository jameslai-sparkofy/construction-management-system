const { chromium } = require('playwright');

async function debugBuildingSelection() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🏢 調試建築物選擇和資料分組...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(6000);

    const buildingInfo = await page.evaluate(() => {
      const sites = window.currentSites || [];
      const grouped = window.sitesGroupedByBuilding || {};
      const currentBuilding = window.currentBuilding;

      // 統計建築物
      const buildingStats = {};
      sites.forEach(site => {
        const building = site.field_WD7k1__c || 'unknown';
        if (!buildingStats[building]) {
          buildingStats[building] = 0;
        }
        buildingStats[building]++;
      });

      return {
        totalSites: sites.length,
        currentBuilding: currentBuilding,
        buildingStats: buildingStats,
        groupedBuildings: Object.keys(grouped),
        groupedCounts: Object.entries(grouped).map(([building, sites]) => 
          ({ building, count: sites.length })
        )
      };
    });

    console.log('📊 建築物資料分析:');
    console.log(`總案場數: ${buildingInfo.totalSites}`);
    console.log(`當前選中建築物: "${buildingInfo.currentBuilding}"`);
    console.log('\n🏢 建築物統計:');
    
    Object.entries(buildingInfo.buildingStats).forEach(([building, count]) => {
      console.log(`  ${building}: ${count} 個案場`);
    });

    console.log('\n📋 分組後建築物:');
    buildingInfo.groupedCounts.forEach(({ building, count }) => {
      console.log(`  ${building}: ${count} 個案場`);
    });

    // 選擇第一個有案場的建築物進行測試
    const firstBuilding = Object.keys(buildingInfo.buildingStats)[0];
    if (!firstBuilding) {
      console.log('❌ 沒有找到任何建築物');
      return;
    }

    console.log(`\n🎯 切換到建築物: "${firstBuilding}"`);

    // 切換建築物並測試通知圖示
    const testResult = await page.evaluate((targetBuilding) => {
      // 設置當前建築物
      window.currentBuilding = targetBuilding;
      
      // 手動修改第一個案場資料
      const sitesInBuilding = window.sitesGroupedByBuilding[targetBuilding] || [];
      if (sitesInBuilding.length > 0) {
        const testSite = sitesInBuilding[0];
        testSite.field_sF6fn__c = '這是測試施工前備註內容';
        testSite.construction_completed__c = false;
        
        console.log('✅ 修改測試案場:');
        console.log(`  名稱: ${testSite.name}`);
        console.log(`  建築物: ${testSite.field_WD7k1__c}`);
        console.log(`  施工前備註: ${testSite.field_sF6fn__c}`);
        console.log(`  完工狀態: ${testSite.construction_completed__c}`);
      }

      // 手動調用渲染函數
      if (typeof renderFloorGrid === 'function') {
        renderFloorGrid();
      }

      return {
        success: true,
        sitesInBuilding: sitesInBuilding.length,
        modifiedSite: sitesInBuilding.length > 0
      };
    }, firstBuilding);

    console.log(`✅ 建築物切換完成，案場數: ${testResult.sitesInBuilding}`);

    // 等待渲染完成
    await page.waitForTimeout(3000);

    // 檢查最終結果
    const finalResult = await page.evaluate(() => {
      const icons = document.querySelectorAll('.notification-icon');
      const cells = document.querySelectorAll('.grid-cell');
      
      // 檢查前幾個有內容的單元格
      const cellsWithContent = Array.from(cells).filter(cell => {
        const content = cell.querySelector('.cell-content');
        return content && content.textContent.trim() !== '';
      });

      const iconDetails = Array.from(icons).map(icon => ({
        text: icon.textContent,
        title: icon.title,
        parentCellContent: icon.closest('.grid-cell')?.textContent?.trim() || 'unknown'
      }));

      return {
        totalCells: cells.length,
        cellsWithContent: cellsWithContent.length,
        iconCount: icons.length,
        iconDetails: iconDetails
      };
    });

    console.log('\n📊 最終測試結果:');
    console.log(`表格單元格總數: ${finalResult.totalCells}`);
    console.log(`有內容的單元格: ${finalResult.cellsWithContent}`);
    console.log(`通知圖示數量: ${finalResult.iconCount}`);

    if (finalResult.iconCount > 0) {
      console.log('\n✅ 成功找到通知圖示！');
      finalResult.iconDetails.forEach((icon, i) => {
        console.log(`  圖示 ${i + 1}:`);
        console.log(`    文字: "${icon.text}"`);
        console.log(`    提示: "${icon.title}"`);
        console.log(`    所在單元格: "${icon.parentCellContent}"`);
      });
    } else {
      console.log('\n❌ 仍然沒有找到通知圖示');
      console.log('💡 可能需要檢查前端邏輯或部署狀態');
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugBuildingSelection().catch(console.error);