const { chromium } = require('playwright');

async function testScopeFix() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔧 測試作用域修復後的通知圖示功能...\n');
    
    // 等待部署完成
    console.log('⏳ 等待部署完成...');
    await new Promise(resolve => setTimeout(resolve, 60000)); // 等待1分鐘
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    const testResult = await page.evaluate(() => {
      // 1. 檢查作用域同步
      console.log('🔍 檢查作用域同步...');
      const localBuilding = currentBuilding; // 局部變數
      const globalBuilding = window.currentBuilding; // 全域變數
      
      console.log('局部 currentBuilding:', localBuilding);
      console.log('全域 window.currentBuilding:', globalBuilding);
      
      // 2. 設置測試資料
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No sites data' };
      }
      
      // 修改前3個案場
      const testSites = window.currentSites.slice(0, 3);
      testSites.forEach((site, index) => {
        site.field_sF6fn__c = `重要施工前備註 ${index + 1}`;
        site.construction_completed__c = false;
      });
      
      // 重新分組
      if (typeof groupSitesByBuilding === 'function') {
        groupSitesByBuilding();
      }
      
      // 3. 驗證建築物資料存在
      const buildingsAvailable = Object.keys(window.sitesGroupedByBuilding || {});
      const currentBuildingData = window.sitesGroupedByBuilding[localBuilding] || [];
      
      console.log('可用建築物:', buildingsAvailable);
      console.log('當前建築物案場數:', currentBuildingData.length);
      
      // 4. 調用渲染函數
      let htmlGenerated = '';
      let iconCount = 0;
      
      const gridContent = document.getElementById('gridContent');
      if (gridContent) {
        // 攔截 innerHTML
        const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(gridContent, 'innerHTML', {
          set: function(value) {
            htmlGenerated = value;
            console.log('📝 HTML 生成，長度:', value.length);
            console.log('📝 包含通知圖示:', value.includes('notification-icon'));
            originalDescriptor.set.call(this, value);
          },
          configurable: true
        });
        
        if (typeof renderFloorGrid === 'function') {
          renderFloorGrid();
        }
        
        // 檢查最終結果
        const icons = document.querySelectorAll('.notification-icon');
        iconCount = icons.length;
        
        // 恢復原來的 innerHTML 描述符
        Object.defineProperty(gridContent, 'innerHTML', originalDescriptor);
      }
      
      return {
        success: true,
        scopeSynced: localBuilding === globalBuilding,
        localBuilding: localBuilding,
        globalBuilding: globalBuilding,
        buildingsAvailable: buildingsAvailable,
        currentBuildingHasSites: currentBuildingData.length > 0,
        htmlGenerated: htmlGenerated.length > 0,
        htmlContainsIcons: htmlGenerated.includes('notification-icon'),
        finalIconCount: iconCount,
        testSitesModified: testSites.length
      };
    });

    console.log('📊 測試結果:');
    
    if (testResult.error) {
      console.log('❌ 錯誤:', testResult.error);
      return;
    }
    
    console.log(`作用域同步: ${testResult.scopeSynced ? '✅' : '❌'}`);
    console.log(`局部建築物變數: ${testResult.localBuilding}`);
    console.log(`全域建築物變數: ${testResult.globalBuilding}`);
    console.log(`可用建築物: ${testResult.buildingsAvailable.join(', ')}`);
    console.log(`當前建築物有案場: ${testResult.currentBuildingHasSites ? '✅' : '❌'}`);
    console.log(`HTML 已生成: ${testResult.htmlGenerated ? '✅' : '❌'}`);
    console.log(`HTML 包含圖示: ${testResult.htmlContainsIcons ? '✅' : '❌'}`);
    console.log(`最終圖示數量: ${testResult.finalIconCount}`);
    console.log(`測試案場數: ${testResult.testSitesModified}`);

    console.log('\n🎯 診斷結果:');
    if (testResult.finalIconCount > 0) {
      console.log('🎉 SUCCESS! 通知圖示功能完全修復！');
      console.log(`✅ 成功顯示 ${testResult.finalIconCount} 個通知圖示`);
    } else if (testResult.htmlContainsIcons) {
      console.log('🔧 部分成功：HTML 包含圖示但未正確渲染到 DOM');
    } else if (!testResult.htmlGenerated) {
      console.log('❌ HTML 未生成：仍有作用域或資料問題');
    } else {
      console.log('❌ HTML 已生成但不包含圖示：邏輯問題');
    }

    // 讓用戶看到結果
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testScopeFix().catch(console.error);