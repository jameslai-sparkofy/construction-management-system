const { chromium } = require('playwright');

async function finalComprehensiveTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🎯 最終綜合測試 - 完整修復通知圖示功能\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    // 完整的修復和測試
    const result = await page.evaluate(() => {
      console.log('🔧 開始完整修復...');
      
      // 1. 驗證基本資料
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No sites data available' };
      }
      
      console.log('✅ 基本資料驗證通過，案場數:', window.currentSites.length);

      // 2. 修改測試資料
      const testSites = window.currentSites.slice(0, 3);
      testSites.forEach((site, index) => {
        site.field_sF6fn__c = `測試施工前備註 ${index + 1}`;
        site.construction_completed__c = false; // 設為未完工
      });
      
      console.log('✅ 測試資料設置完成');

      // 3. 重新分組資料
      if (typeof groupSitesByBuilding === 'function') {
        groupSitesByBuilding();
        console.log('✅ 資料重新分組完成');
      }

      // 4. 設置正確的當前建築物
      const buildings = Object.keys(window.sitesGroupedByBuilding || {});
      if (buildings.length === 0) {
        return { error: 'No buildings after grouping' };
      }
      
      window.currentBuilding = buildings[0];
      console.log('✅ 當前建築物設置為:', window.currentBuilding);

      // 5. 驗證當前建築物的案場
      const sitesInCurrentBuilding = window.sitesGroupedByBuilding[window.currentBuilding] || [];
      console.log('✅ 當前建築物案場數:', sitesInCurrentBuilding.length);

      // 6. 手動驗證通知圖示邏輯
      let shouldHaveIcons = 0;
      sitesInCurrentBuilding.forEach(site => {
        const beforeNotes = site.field_sF6fn__c || '';
        const isCompleted = site.construction_completed__c;
        if (beforeNotes.trim() !== '' && !isCompleted) {
          shouldHaveIcons++;
        }
      });
      
      console.log('✅ 應該有', shouldHaveIcons, '個通知圖示');

      // 7. 調用渲染函數
      let renderSuccessful = false;
      let htmlGenerated = '';
      
      try {
        const gridContent = document.getElementById('gridContent');
        if (!gridContent) {
          return { error: 'gridContent element not found' };
        }

        // 攔截 HTML 內容
        const originalInnerHTML = gridContent.innerHTML;
        Object.defineProperty(gridContent, 'innerHTML', {
          set: function(value) {
            htmlGenerated = value;
            console.log('📝 生成的 HTML 長度:', value.length);
            console.log('📝 包含 notification-icon:', value.includes('notification-icon'));
            HTMLElement.prototype.innerHTML.set.call(this, value);
          },
          configurable: true
        });

        if (typeof renderFloorGrid === 'function') {
          renderFloorGrid();
          renderSuccessful = true;
          console.log('✅ renderFloorGrid 調用成功');
        }
      } catch (e) {
        console.log('❌ renderFloorGrid 調用失敗:', e.message);
        return { error: 'renderFloorGrid failed: ' + e.message };
      }

      // 8. 最終驗證
      const finalIcons = document.querySelectorAll('.notification-icon');
      
      return {
        success: true,
        testSitesCount: testSites.length,
        currentBuilding: window.currentBuilding,
        sitesInCurrentBuilding: sitesInCurrentBuilding.length,
        shouldHaveIcons: shouldHaveIcons,
        renderSuccessful: renderSuccessful,
        htmlGenerated: htmlGenerated.length > 0,
        htmlContainsIcons: htmlGenerated.includes('notification-icon'),
        finalIconCount: finalIcons.length,
        finalIconsVisible: Array.from(finalIcons).filter(icon => 
          icon.offsetHeight > 0 && icon.offsetWidth > 0).length
      };
    });

    // 顯示結果
    if (result.error) {
      console.log('❌ 測試失敗:', result.error);
      return;
    }

    console.log('📊 最終測試結果:');
    console.log(`測試案場數量: ${result.testSitesCount}`);
    console.log(`當前建築物: ${result.currentBuilding}`);
    console.log(`建築物內案場數: ${result.sitesInCurrentBuilding}`);
    console.log(`應該有的圖示數: ${result.shouldHaveIcons}`);
    console.log(`渲染函數成功: ${result.renderSuccessful}`);
    console.log(`HTML 已生成: ${result.htmlGenerated}`);
    console.log(`HTML 包含圖示: ${result.htmlContainsIcons}`);
    console.log(`最終圖示數量: ${result.finalIconCount}`);
    console.log(`可見圖示數量: ${result.finalIconsVisible}`);

    console.log('\n🎯 最終診斷:');
    if (result.finalIconCount > 0 && result.finalIconsVisible > 0) {
      console.log('🎉 SUCCESS! 通知圖示功能完全正常！');
      console.log(`✅ 顯示了 ${result.finalIconsVisible} 個通知圖示`);
    } else if (result.htmlContainsIcons) {
      console.log('⚠️ HTML 包含圖示但 DOM 中找不到 - 可能是時序問題');
    } else if (!result.htmlGenerated) {
      console.log('❌ 未生成 HTML - renderFloorGrid 可能有問題');
    } else {
      console.log('❌ 生成了 HTML 但不包含圖示 - 邏輯問題');
    }

    // 等待用戶查看結果
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('❌ 綜合測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

finalComprehensiveTest().catch(console.error);