const { chromium } = require('playwright');

async function testIconInjection() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('💉 直接注入通知圖示測試...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    const result = await page.evaluate(() => {
      // 找到第一個有內容的單元格
      const cells = document.querySelectorAll('.grid-cell');
      let targetCell = null;
      
      for (let cell of cells) {
        const content = cell.querySelector('.cell-content');
        if (content && content.textContent.trim() !== '') {
          targetCell = cell;
          break;
        }
      }
      
      if (!targetCell) {
        return { error: 'No suitable cell found' };
      }

      // 直接注入通知圖示
      const cellContent = targetCell.querySelector('.cell-content');
      const iconHtml = '<div class="notification-icon" title="有施工前備註">⚠</div>';
      cellContent.insertAdjacentHTML('afterbegin', iconHtml);

      // 確認注入成功
      const injectedIcon = cellContent.querySelector('.notification-icon');
      const allIcons = document.querySelectorAll('.notification-icon');

      return {
        success: true,
        iconInjected: !!injectedIcon,
        iconText: injectedIcon ? injectedIcon.textContent : '',
        iconTitle: injectedIcon ? injectedIcon.title : '',
        totalIcons: allIcons.length,
        cellContent: targetCell.textContent.trim()
      };
    });

    if (result.error) {
      console.log('❌ 錯誤:', result.error);
      return;
    }

    console.log('📊 直接注入測試結果:');
    console.log(`圖示注入成功: ${result.iconInjected}`);
    console.log(`圖示文字: "${result.iconText}"`);
    console.log(`圖示標題: "${result.iconTitle}"`);
    console.log(`總圖示數量: ${result.totalIcons}`);
    console.log(`目標單元格內容: "${result.cellContent}"`);

    if (result.iconInjected) {
      console.log('\n✅ 直接注入成功！這證明:');
      console.log('   1. CSS 樣式正常');
      console.log('   2. DOM 結構正確');
      console.log('   3. 問題在於 renderFloorGrid 的邏輯執行');
    }

    // 等待一下讓用戶看到結果
    await page.waitForTimeout(3000);

    // 現在測試實際的 renderFloorGrid 邏輯
    console.log('\n🔧 測試實際的 renderFloorGrid 邏輯...');
    
    const logicTest = await page.evaluate(() => {
      // 修改第一個案場的資料
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No sites data' };
      }

      const site = window.currentSites[0];

      // 設置測試資料
      site.field_sF6fn__c = '這是測試施工前備註';
      site.construction_completed__c = false;

      // 重新分組資料
      if (typeof groupSitesByBuilding === 'function') {
        groupSitesByBuilding();
      }

      // 設置正確的建築物
      const buildingStats = {};
      window.currentSites.forEach(s => {
        const building = s.field_WD7k1__c || 'unknown';
        if (!buildingStats[building]) buildingStats[building] = 0;
        buildingStats[building]++;
      });
      
      const firstBuilding = Object.keys(buildingStats)[0];
      window.currentBuilding = firstBuilding;

      // 調用渲染函數
      if (typeof renderFloorGrid === 'function') {
        renderFloorGrid();
      }

      return {
        success: true,
        modifiedSite: site.name,
        beforeNotes: site.field_sF6fn__c,
        isCompleted: site.construction_completed__c,
        currentBuilding: window.currentBuilding,
        sitesInBuilding: window.sitesGroupedByBuilding[firstBuilding]?.length || 0
      };
    });

    if (logicTest.error) {
      console.log('❌ 邏輯測試失敗:', logicTest.error);
      return;
    }

    console.log('📊 邏輯測試結果:');
    console.log(`修改的案場: ${logicTest.modifiedSite}`);
    console.log(`施工前備註: "${logicTest.beforeNotes}"`);
    console.log(`完工狀態: ${logicTest.isCompleted}`);
    console.log(`當前建築物: ${logicTest.currentBuilding}`);
    console.log(`建築物內案場數: ${logicTest.sitesInBuilding}`);

    await page.waitForTimeout(3000);

    // 最終檢查
    const finalCheck = await page.evaluate(() => {
      const icons = document.querySelectorAll('.notification-icon');
      return {
        iconCount: icons.length,
        iconDetails: Array.from(icons).map(icon => ({
          text: icon.textContent,
          title: icon.title,
          visible: icon.offsetHeight > 0
        }))
      };
    });

    console.log('\n📊 最終檢查:');
    console.log(`通知圖示總數: ${finalCheck.iconCount}`);
    
    if (finalCheck.iconCount > 1) { // > 1 because we injected one manually
      console.log('✅ renderFloorGrid 邏輯正常工作！');
      finalCheck.iconDetails.forEach((icon, index) => {
        console.log(`  圖示 ${index + 1}: "${icon.text}" (可見: ${icon.visible})`);
      });
    } else {
      console.log('❌ renderFloorGrid 邏輯可能有問題');
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testIconInjection().catch(console.error);